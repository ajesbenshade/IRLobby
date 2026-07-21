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

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"

_apple_jwks_client = None


def get_apple_client_id():
    return str(getattr(settings, "APPLE_CLIENT_ID", "") or "").strip()


def is_apple_auth_configured(client_id=None):
    return bool((client_id if client_id is not None else get_apple_client_id()))


def get_apple_jwks_client():
    global _apple_jwks_client
    if _apple_jwks_client is None:
        _apple_jwks_client = PyJWKClient(APPLE_JWKS_URL, cache_keys=True)
    return _apple_jwks_client


def verify_apple_identity_token(identity_token, client_id):
    """Verify a native Sign in with Apple identity token and return claims."""
    jwks_client = get_apple_jwks_client()
    signing_key = jwks_client.get_signing_key_from_jwt(identity_token)
    return jwt.decode(
        identity_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=client_id,
        issuer=APPLE_ISSUER,
        options={
            "require": ["exp", "iat", "sub", "iss", "aud"],
        },
    )


def _sanitize_username_base(value):
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]", "", (value or "").strip())
    return cleaned[:24] or "appleuser"


def _unique_username(base):
    candidate = _sanitize_username_base(base)
    if not User.objects.filter(username=candidate).exists():
        return candidate

    for _ in range(20):
        suffix = secrets.token_hex(2)
        candidate_with_suffix = f"{candidate[:20]}{suffix}"
        if not User.objects.filter(username=candidate_with_suffix).exists():
            return candidate_with_suffix

    return f"appleuser{secrets.token_hex(4)}"


def _resolve_apple_email(claims, request_email):
    email = (claims.get("email") or request_email or "").strip().lower()
    if email:
        return email
    return f"{claims['sub']}@apple.oauth.local"


def _get_or_create_apple_user(claims, request_data):
    apple_sub = claims["sub"]
    email = _resolve_apple_email(claims, request_data.get("email"))
    given_name = ""
    family_name = ""

    full_name = request_data.get("full_name") or {}
    if isinstance(full_name, dict):
        given_name = (full_name.get("givenName") or full_name.get("given_name") or "").strip()
        family_name = (full_name.get("familyName") or full_name.get("family_name") or "").strip()

    user = User.objects.filter(oauth_provider="apple", oauth_id=apple_sub).first()
    if user:
        return user, False

    existing_by_email = User.objects.filter(email__iexact=email).first()
    if existing_by_email:
        if existing_by_email.oauth_provider and existing_by_email.oauth_id:
            if not (
                existing_by_email.oauth_provider == "apple"
                and existing_by_email.oauth_id == apple_sub
            ):
                raise ValueError(
                    "An account with this email already exists. Sign in with your existing method."
                )
        existing_by_email.oauth_provider = "apple"
        existing_by_email.oauth_id = apple_sub
        update_fields = ["oauth_provider", "oauth_id"]
        if given_name and not existing_by_email.first_name:
            existing_by_email.first_name = given_name
            update_fields.append("first_name")
        if family_name and not existing_by_email.last_name:
            existing_by_email.last_name = family_name
            update_fields.append("last_name")
        existing_by_email.save(update_fields=update_fields)
        return existing_by_email, False

    username_base = email.split("@")[0] if "@" in email else f"apple_{apple_sub[:8]}"
    user = User(
        username=_unique_username(username_base),
        email=email,
        first_name=given_name,
        last_name=family_name,
        oauth_provider="apple",
        oauth_id=apple_sub,
    )
    user.set_unusable_password()
    user.save()
    return user, True


@api_view(["POST"])
@permission_classes([AllowAny])
def apple_sign_in(request):
    """Exchange a verified Apple identity token for IRLobby JWTs."""
    try:
        client_id = get_apple_client_id()
        if not is_apple_auth_configured(client_id):
            return Response(
                {"error": "Sign in with Apple is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        identity_token = (request.data.get("identity_token") or "").strip()
        if not identity_token:
            return Response(
                {"error": "identity_token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            claims = verify_apple_identity_token(identity_token, client_id)
        except jwt.PyJWTError as exc:
            logger.warning("Apple identity token verification failed: %s", exc)
            return Response(
                {"error": "Invalid Apple identity token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except Exception as exc:
            logger.error("Apple identity token verification error: %s", exc)
            return Response(
                {"error": "Unable to verify Apple identity token."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            user, created = _get_or_create_apple_user(claims, request.data)
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
        logger.error("Apple sign-in failed: %s", exc)
        return Response(
            {"error": "Apple sign-in failed. Please try again."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def apple_auth_status(request):
    """Check Sign in with Apple configuration status."""
    client_id = get_apple_client_id()
    return Response(
        {
            "configured": is_apple_auth_configured(client_id),
            "client_id_set": bool(client_id),
        }
    )
