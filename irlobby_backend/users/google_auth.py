import logging
import re
import secrets

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from jwt import PyJWKClient
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import UserSerializer

logger = logging.getLogger(__name__)

User = get_user_model()

GOOGLE_ISSUERS = {
    "https://accounts.google.com",
    "accounts.google.com",
}
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"

_google_jwks_client = None


def get_google_client_ids():
    """Return allowed Google OAuth client IDs used as ID token audiences."""
    configured = []
    for attr in (
        "GOOGLE_CLIENT_IDS",
        "GOOGLE_IOS_CLIENT_ID",
        "GOOGLE_ANDROID_CLIENT_ID",
        "GOOGLE_WEB_CLIENT_ID",
    ):
        raw = str(getattr(settings, attr, "") or "").strip()
        if not raw:
            continue
        if attr == "GOOGLE_CLIENT_IDS":
            configured.extend(part.strip() for part in raw.split(",") if part.strip())
        else:
            configured.append(raw)

    # Preserve order while deduping
    seen = set()
    unique = []
    for client_id in configured:
        if client_id not in seen:
            seen.add(client_id)
            unique.append(client_id)
    return unique


def is_google_auth_configured(client_ids=None):
    ids = client_ids if client_ids is not None else get_google_client_ids()
    return bool(ids)


def get_google_jwks_client():
    global _google_jwks_client
    if _google_jwks_client is None:
        _google_jwks_client = PyJWKClient(GOOGLE_JWKS_URL, cache_keys=True)
    return _google_jwks_client


def verify_google_identity_token(identity_token, client_ids):
    """Verify a Google ID token and return claims."""
    if not client_ids:
        raise jwt.InvalidTokenError("No Google client IDs configured")

    jwks_client = get_google_jwks_client()
    signing_key = jwks_client.get_signing_key_from_jwt(identity_token)
    return jwt.decode(
        identity_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=client_ids,
        issuer=GOOGLE_ISSUERS,
        options={
            "require": ["exp", "iat", "sub", "iss", "aud"],
        },
    )


def _sanitize_username_base(value):
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]", "", (value or "").strip())
    return cleaned[:24] or "googleuser"


def _unique_username(base):
    candidate = _sanitize_username_base(base)
    if not User.objects.filter(username=candidate).exists():
        return candidate

    for _ in range(20):
        suffix = secrets.token_hex(2)
        candidate_with_suffix = f"{candidate[:20]}{suffix}"
        if not User.objects.filter(username=candidate_with_suffix).exists():
            return candidate_with_suffix

    return f"googleuser{secrets.token_hex(4)}"


def _resolve_google_email(claims, request_email):
    email = (claims.get("email") or request_email or "").strip().lower()
    if email:
        return email
    return f"{claims['sub']}@google.oauth.local"


def _split_name(full_name):
    parts = [part for part in (full_name or "").strip().split() if part]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def _get_or_create_google_user(claims, request_data):
    google_sub = claims["sub"]
    email = _resolve_google_email(claims, request_data.get("email"))

    given_name = (claims.get("given_name") or "").strip()
    family_name = (claims.get("family_name") or "").strip()
    if not given_name and not family_name:
        given_name, family_name = _split_name(claims.get("name") or request_data.get("full_name"))

    full_name = request_data.get("full_name") or {}
    if isinstance(full_name, dict):
        given_name = given_name or (
            full_name.get("givenName") or full_name.get("given_name") or ""
        ).strip()
        family_name = family_name or (
            full_name.get("familyName") or full_name.get("family_name") or ""
        ).strip()

    user = User.objects.filter(oauth_provider="google", oauth_id=google_sub).first()
    if user:
        return user, False

    existing_by_email = User.objects.filter(email__iexact=email).first()
    if existing_by_email:
        if existing_by_email.oauth_provider and existing_by_email.oauth_id:
            if not (
                existing_by_email.oauth_provider == "google"
                and existing_by_email.oauth_id == google_sub
            ):
                raise ValueError(
                    "An account with this email already exists. Sign in with your existing method."
                )
        existing_by_email.oauth_provider = "google"
        existing_by_email.oauth_id = google_sub
        update_fields = ["oauth_provider", "oauth_id"]
        if given_name and not existing_by_email.first_name:
            existing_by_email.first_name = given_name
            update_fields.append("first_name")
        if family_name and not existing_by_email.last_name:
            existing_by_email.last_name = family_name
            update_fields.append("last_name")
        avatar_url = (claims.get("picture") or "").strip()
        if avatar_url and not existing_by_email.avatar_url:
            existing_by_email.avatar_url = avatar_url
            update_fields.append("avatar_url")
        existing_by_email.save(update_fields=update_fields)
        return existing_by_email, False

    username_base = email.split("@")[0] if "@" in email else f"google_{google_sub[:8]}"
    user = User(
        username=_unique_username(username_base),
        email=email,
        first_name=given_name,
        last_name=family_name,
        avatar_url=(claims.get("picture") or "").strip(),
        oauth_provider="google",
        oauth_id=google_sub,
    )
    user.set_unusable_password()
    user.save()
    return user, True


@api_view(["POST"])
@permission_classes([AllowAny])
def google_sign_in(request):
    """Exchange a verified Google ID token for IRLobby JWTs."""
    try:
        client_ids = get_google_client_ids()
        if not is_google_auth_configured(client_ids):
            return Response(
                {"error": "Google sign-in is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        identity_token = (
            request.data.get("identity_token") or request.data.get("id_token") or ""
        ).strip()
        if not identity_token:
            return Response(
                {"error": "identity_token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            claims = verify_google_identity_token(identity_token, client_ids)
        except jwt.PyJWTError as exc:
            logger.warning("Google identity token verification failed: %s", exc)
            return Response(
                {"error": "Invalid Google identity token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except Exception as exc:
            logger.error("Google identity token verification error: %s", exc)
            return Response(
                {"error": "Unable to verify Google identity token."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            user, created = _get_or_create_google_user(claims, request.data)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
                "created": created,
            },
            status=status.HTTP_200_OK,
        )
    except Exception as exc:
        logger.error("Google sign-in failed: %s", exc)
        return Response(
            {"error": "Google sign-in failed. Please try again."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def google_auth_status(request):
    """Check Google sign-in configuration status."""
    client_ids = get_google_client_ids()
    return Response(
        {
            "configured": is_google_auth_configured(client_ids),
            "client_id_count": len(client_ids),
        }
    )
