import json
import logging
import re

import jwt
import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from rest_framework import status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import SocialAuthIdentity
from .serializers import UserSerializer

logger = logging.getLogger(__name__)

User = get_user_model()

_APPLE_JWKS_CACHE_KEY = "apple_oauth_jwks"
_APPLE_JWKS_CACHE_TIMEOUT_SECONDS = 60 * 60
_USERNAME_SANITIZER = re.compile(r"[^a-zA-Z0-9_.-]+")


class SocialAuthConflict(ValueError):
    pass


def _truthy(value):
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return value is True or value == 1


def legal_acceptance_from_data(data):
    """Terms/privacy acceptance sent by a client, or {} when it sent nothing.

    Reads terms_accepted / privacy_accepted (also camelCase) and optional
    terms_version / privacy_version. Older clients send none of them.
    """

    def pick(*names):
        for name in names:
            if name in data:
                return data.get(name)
        return None

    def version(*names):
        value = pick(*names)
        return value.strip()[:32] if isinstance(value, str) else ""

    return {
        "terms_accepted": _truthy(pick("terms_accepted", "termsAccepted")),
        "privacy_accepted": _truthy(pick("privacy_accepted", "privacyAccepted")),
        "terms_version": version("terms_version", "termsVersion"),
        "privacy_version": version("privacy_version", "privacyVersion"),
    }


def stamp_legal_acceptance(
    user, *, terms_accepted=False, privacy_accepted=False, terms_version="", privacy_version=""
):
    """Record acceptance once; an earlier timestamp is never overwritten."""
    now = timezone.now()
    updates = []
    if terms_accepted and not user.terms_accepted_at:
        user.terms_accepted_at = now
        updates.append("terms_accepted_at")
        if terms_version:
            user.terms_version = terms_version
            updates.append("terms_version")
    if privacy_accepted and not user.privacy_accepted_at:
        user.privacy_accepted_at = now
        updates.append("privacy_accepted_at")
        if privacy_version:
            user.privacy_version = privacy_version
            updates.append("privacy_version")
    if updates:
        user.save(update_fields=updates)


def _clean_settings_list(name):
    values = getattr(settings, name, [])
    if isinstance(values, str):
        values = [values]
    return [value.strip() for value in values if isinstance(value, str) and value.strip()]


def get_google_oauth_client_ids():
    values = []
    for name in (
        "GOOGLE_OAUTH_CLIENT_IDS",
        "GOOGLE_CLIENT_IDS",
        "GOOGLE_IOS_CLIENT_ID",
        "GOOGLE_ANDROID_CLIENT_ID",
        "GOOGLE_WEB_CLIENT_ID",
    ):
        values.extend(_clean_settings_list(name))

    seen = set()
    unique = []
    for value in values:
        if value not in seen:
            seen.add(value)
            unique.append(value)
    return unique


def get_apple_oauth_audiences():
    return _clean_settings_list("APPLE_OAUTH_AUDIENCES")


def is_google_oauth_configured():
    return bool(get_google_oauth_client_ids())


def is_apple_oauth_configured():
    return bool(get_apple_oauth_audiences())


def build_auth_response(user, *, created):
    refresh = RefreshToken.for_user(user)
    return {
        "user": UserSerializer(user).data,
        "tokens": {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        },
        "created": created,
    }


def build_auth_error(message, *, status_code=status.HTTP_400_BAD_REQUEST):
    return Response({"error": message}, status=status_code)


def normalize_email(value):
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    return normalized or None


def split_display_name(value):
    if not isinstance(value, str):
        return "", ""
    parts = [part for part in value.strip().split() if part]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def _clean_username_candidate(value):
    if not isinstance(value, str):
        return ""
    cleaned = _USERNAME_SANITIZER.sub("", value.strip().lower())
    cleaned = cleaned.strip("._-")
    return cleaned[:30]


def generate_unique_username(*candidates):
    for candidate in candidates:
        cleaned = _clean_username_candidate(candidate)
        if cleaned and not User.objects.filter(username=cleaned).exists():
            return cleaned

    base_candidate = next(
        (_clean_username_candidate(candidate) for candidate in candidates if candidate),
        "",
    )
    base = base_candidate or "irlobby"
    base = base[:24]
    counter = 1
    while True:
        suffix = str(counter)
        candidate = f"{base[: 30 - len(suffix)]}{suffix}"
        if not User.objects.filter(username=candidate).exists():
            return candidate
        counter += 1


def build_placeholder_email(provider, provider_user_id):
    safe_provider = _clean_username_candidate(provider) or "social"
    safe_identifier = _clean_username_candidate(provider_user_id) or "user"
    return f"{safe_identifier}@{safe_provider}.oauth.local"


def _sync_legacy_oauth_fields(user, provider, provider_user_id):
    updates = []
    if user.oauth_provider != provider:
        user.oauth_provider = provider
        updates.append("oauth_provider")
    if user.oauth_id != provider_user_id:
        user.oauth_id = provider_user_id
        updates.append("oauth_id")
    if updates:
        user.save(update_fields=updates)


@transaction.atomic
def resolve_or_create_social_user(
    *,
    provider,
    provider_user_id,
    email=None,
    username=None,
    first_name="",
    last_name="",
    legal=None,
):
    normalized_email = normalize_email(email)
    identity = (
        SocialAuthIdentity.objects.select_for_update()
        .select_related("user")
        .filter(provider=provider, provider_user_id=provider_user_id)
        .first()
    )
    user_created = False

    if identity:
        user = identity.user
    else:
        user = (
            User.objects.select_for_update()
            .filter(
                oauth_provider=provider,
                oauth_id=provider_user_id,
            )
            .first()
        )

        if not user and normalized_email:
            user = User.objects.select_for_update().filter(email=normalized_email).first()

        if not user:
            resolved_email = normalized_email or build_placeholder_email(provider, provider_user_id)
            resolved_username = generate_unique_username(
                username,
                resolved_email.split("@", 1)[0],
                f"{provider}_{provider_user_id}",
            )
            user = User.objects.create_user(
                username=resolved_username,
                email=resolved_email,
                first_name=first_name or "",
                last_name=last_name or "",
                password=None,
            )
            user.set_unusable_password()
            user.save(update_fields=["password"])
            user_created = True

        existing_provider_identity = (
            SocialAuthIdentity.objects.select_for_update()
            .filter(user=user, provider=provider)
            .exclude(provider_user_id=provider_user_id)
            .first()
        )
        if existing_provider_identity:
            raise SocialAuthConflict(
                f"This account is already linked to a different {provider} identity."
            )

        identity, _ = SocialAuthIdentity.objects.get_or_create(
            provider=provider,
            provider_user_id=provider_user_id,
            defaults={
                "user": user,
                "email": normalized_email or "",
            },
        )
        if identity.user_id != user.id:
            user = identity.user

    identity_updates = []
    if normalized_email and identity.email != normalized_email:
        identity.email = normalized_email
        identity_updates.append("email")
    if identity_updates:
        identity.save(update_fields=identity_updates + ["updated_at"])

    user_updates = []
    if normalized_email and user.email != normalized_email and user.email.endswith(".oauth.local"):
        user.email = normalized_email
        user_updates.append("email")
    if first_name and not user.first_name:
        user.first_name = first_name
        user_updates.append("first_name")
    if last_name and not user.last_name:
        user.last_name = last_name
        user_updates.append("last_name")
    if user_updates:
        user.save(update_fields=user_updates)

    _sync_legacy_oauth_fields(user, provider, provider_user_id)
    if legal:
        stamp_legal_acceptance(user, **legal)

    return user, user_created


def peek_google_token_audience(id_token_value):
    try:
        claims = jwt.decode(
            id_token_value,
            options={
                "verify_signature": False,
                "verify_aud": False,
                "verify_exp": False,
                "verify_iss": False,
            },
        )
    except Exception:
        return None

    audience = claims.get("aud") if isinstance(claims, dict) else None
    if isinstance(audience, str) and audience.strip():
        return audience.strip()
    if isinstance(audience, (list, tuple)):
        for item in audience:
            if isinstance(item, str) and item.strip():
                return item.strip()
    return None


def verify_google_identity_token(id_token_value):
    audiences = get_google_oauth_client_ids()
    if not audiences:
        raise ValueError("Google OAuth is not configured")

    token_audience = peek_google_token_audience(id_token_value)
    if token_audience and token_audience not in audiences:
        raise ValueError(
            "Google token audience "
            f"{token_audience} is not in GOOGLE_OAUTH_CLIENT_IDS. "
            "Add this iOS/Android/Web client ID on the server."
        )

    request_adapter = google_requests.Request()
    last_error = None
    candidate_audiences = [token_audience] if token_audience else list(audiences)
    if token_audience:
        candidate_audiences.extend(audience for audience in audiences if audience != token_audience)

    for audience in candidate_audiences:
        try:
            payload = google_id_token.verify_oauth2_token(id_token_value, request_adapter, audience)
            issuer = payload.get("iss")
            if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
                raise ValueError("Unexpected Google token issuer")
            return payload
        except ValueError as error:
            last_error = error

    raise ValueError(str(last_error or "Invalid Google identity token"))


def _load_apple_jwks():
    cached_keys = cache.get(_APPLE_JWKS_CACHE_KEY)
    if cached_keys:
        return cached_keys

    response = requests.get("https://appleid.apple.com/auth/keys", timeout=15)
    response.raise_for_status()
    keys = response.json().get("keys", [])
    cache.set(_APPLE_JWKS_CACHE_KEY, keys, timeout=_APPLE_JWKS_CACHE_TIMEOUT_SECONDS)
    return keys


def verify_apple_identity_token(identity_token):
    audiences = get_apple_oauth_audiences()
    if not audiences:
        raise ValueError("Apple Sign In is not configured")

    unverified_header = jwt.get_unverified_header(identity_token)
    key_id = unverified_header.get("kid")
    algorithm = unverified_header.get("alg")
    if algorithm != "RS256":
        raise ValueError("Unexpected Apple token algorithm")

    key_data = next((key for key in _load_apple_jwks() if key.get("kid") == key_id), None)
    if not key_data:
        raise ValueError("Unable to verify Apple identity token")

    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))
    last_error = None
    for audience in audiences:
        try:
            return jwt.decode(
                identity_token,
                public_key,
                algorithms=["RS256"],
                audience=audience,
                issuer="https://appleid.apple.com",
            )
        except jwt.PyJWTError as error:
            last_error = error

    raise ValueError(str(last_error or "Invalid Apple identity token"))
