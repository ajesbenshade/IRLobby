from datetime import timedelta
from typing import Tuple

from django.conf import settings


def _refresh_cookie_config() -> Tuple[bool, str, int]:
    """Return secure flag, samesite value, and max age for refresh cookies."""
    secure = not getattr(settings, 'DEBUG', False)
    samesite = 'None' if secure else 'Lax'

    # Get refresh token lifetime with fallback
    lifetime = getattr(settings, 'SIMPLE_JWT', {}).get('REFRESH_TOKEN_LIFETIME')

    if lifetime is None:
        # Default to 7 days if not configured
        max_age = int(timedelta(days=7).total_seconds())
    elif isinstance(lifetime, timedelta):
        max_age = int(lifetime.total_seconds())
    elif isinstance(lifetime, str):
        # Try to parse string duration (e.g., "7 days")
        try:
            # Simple parsing for common cases
            if 'days' in lifetime.lower():
                days = int(lifetime.split()[0])
                max_age = int(timedelta(days=days).total_seconds())
            else:
                max_age = int(timedelta(days=7).total_seconds())
        except (ValueError, IndexError):
            max_age = int(timedelta(days=7).total_seconds())
    else:
        # Fallback for any other type
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

