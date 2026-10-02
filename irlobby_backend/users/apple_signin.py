"""Sign in with Apple server calls: exchange an authorization code, revoke a refresh token.

Apple requires an app that offers Sign in with Apple to revoke the user's token when the account
is deleted. Everything here is optional and best effort: with no APPLE_* signing settings, or on
any Apple/network error, each function does nothing and returns None/False. Nothing here ever
logs or returns the client secret or a refresh token.
"""

from __future__ import annotations

import logging
import time

import jwt
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

APPLE_AUDIENCE = "https://appleid.apple.com"
APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token"
APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke"
REQUEST_TIMEOUT_SECONDS = 10
CLIENT_SECRET_TTL_SECONDS = 300


def apple_client_id() -> str:
    """The app's bundle / services id: the first APPLE_OAUTH_AUDIENCES entry."""
    audiences = getattr(settings, "APPLE_OAUTH_AUDIENCES", None) or []
    for value in audiences:
        value = str(value).strip()
        if value:
            return value
    return ""


def is_apple_signin_configured() -> bool:
    return bool(
        apple_client_id()
        and getattr(settings, "APPLE_TEAM_ID", "")
        and getattr(settings, "APPLE_SIGNIN_KEY_ID", "")
        and getattr(settings, "APPLE_SIGNIN_PRIVATE_KEY", "")
    )


def build_client_secret() -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "iss": settings.APPLE_TEAM_ID,
            "iat": now,
            "exp": now + CLIENT_SECRET_TTL_SECONDS,
            "aud": APPLE_AUDIENCE,
            "sub": apple_client_id(),
        },
        settings.APPLE_SIGNIN_PRIVATE_KEY,
        algorithm="ES256",
        headers={"kid": settings.APPLE_SIGNIN_KEY_ID},
    )


def exchange_authorization_code(authorization_code: str) -> str | None:
    """Trade a one-time authorization code for Apple's refresh token, or None."""
    if not authorization_code or not is_apple_signin_configured():
        return None
    try:
        response = requests.post(
            APPLE_TOKEN_URL,
            data={
                "client_id": apple_client_id(),
                "client_secret": build_client_secret(),
                "code": authorization_code,
                "grant_type": "authorization_code",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        if response.status_code != 200:
            logger.warning("Apple token exchange failed status=%s", response.status_code)
            return None
        token = (response.json() or {}).get("refresh_token")
    except Exception as error:  # network, bad key, bad JSON: never block sign-in
        logger.warning("Apple token exchange failed: %s", type(error).__name__)
        return None
    return token if isinstance(token, str) and token else None


def revoke_refresh_token(refresh_token: str) -> bool:
    """Tell Apple to revoke the refresh token. True only when Apple accepted it."""
    if not refresh_token or not is_apple_signin_configured():
        return False
    try:
        response = requests.post(
            APPLE_REVOKE_URL,
            data={
                "client_id": apple_client_id(),
                "client_secret": build_client_secret(),
                "token": refresh_token,
                "token_type_hint": "refresh_token",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except Exception as error:
        logger.warning("Apple token revoke failed: %s", type(error).__name__)
        return False
    if response.status_code != 200:
        logger.warning("Apple token revoke failed status=%s", response.status_code)
        return False
    return True
