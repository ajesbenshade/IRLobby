from datetime import timedelta
from typing import Tuple

from django.conf import settings


def _refresh_cookie_config() -> Tuple[bool, str, int]:
    """Return secure flag, samesite value, and max age for refresh cookies."""
    secure = not getattr(settings, 'DEBUG', False)
    samesite = 'None' if secure else 'Lax'
    lifetime = settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME']
    if isinstance(lifetime, timedelta):
        max_age = int(lifetime.total_seconds())
    else:
        max_age = int(timedelta(days=7).total_seconds())
    return secure, samesite, max_age


def set_refresh_cookie(response, token: str) -> None:
    """Persist the refresh token in an httpOnly cookie."""
    secure, samesite, max_age = _refresh_cookie_config()
    response.set_cookie(
        settings.REFRESH_TOKEN_COOKIE_NAME,
        token,
        max_age=max_age,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )


def clear_refresh_cookie(response) -> None:
    """Expire the refresh-token cookie on the client."""
    secure, samesite, _ = _refresh_cookie_config()
    response.delete_cookie(
        settings.REFRESH_TOKEN_COOKIE_NAME,
        secure=secure,
        samesite=samesite,
    )

