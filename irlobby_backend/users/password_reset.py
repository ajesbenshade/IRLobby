import hashlib
import secrets
from datetime import timedelta
from urllib.parse import urljoin, urlsplit, urlunsplit

from django.conf import settings
from django.utils import timezone
from django.utils.crypto import constant_time_compare

PASSWORD_RESET_TOKEN_TTL = timedelta(hours=2)


def generate_password_reset_token():
    return secrets.token_urlsafe(32)


def hash_password_reset_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def password_reset_token_matches(stored_token_hash, token):
    if not stored_token_hash or not token:
        return False
    return constant_time_compare(stored_token_hash, hash_password_reset_token(token))


def password_reset_token_expired(created_at):
    if not created_at:
        return True
    return timezone.now() - created_at > PASSWORD_RESET_TOKEN_TTL


def password_reset_token_ttl_display(ttl=None):
    """Human-readable token lifetime for emails, e.g. "2 hours" or "1 hour 30 minutes"."""
    ttl = PASSWORD_RESET_TOKEN_TTL if ttl is None else ttl
    total_minutes = max(int(ttl.total_seconds() // 60), 1)
    hours, minutes = divmod(total_minutes, 60)
    parts = []
    if hours:
        parts.append(f"{hours} hour{'s' if hours != 1 else ''}")
    if minutes:
        parts.append(f"{minutes} minute{'s' if minutes != 1 else ''}")
    return " ".join(parts)


def app_password_reset_link(token, base_url=None):
    """Web reset URL under FRONTEND_BASE_URL.

    ``urljoin(base, "reset-password/<token>")``, for example
    ``https://irlobby.com/reset-password/<token>``. ``www.irlobby.com`` is
    rewritten to the apex host because that host 301s to apex. The emailed
    button uses this https URL, not the ``irlobby://`` app scheme.
    """
    if base_url is None:
        base_url = getattr(settings, "FRONTEND_BASE_URL", "") or ""
    base = str(base_url).strip()
    if not base:
        return urljoin(base, f"reset-password/{token}")

    parsed = urlsplit(base)
    netloc = parsed.netloc
    if (parsed.hostname or "").lower() == "www.irlobby.com":
        port = f":{parsed.port}" if parsed.port else ""
        netloc = f"irlobby.com{port}"
    path = parsed.path or "/"
    if not path.endswith("/"):
        path += "/"
    base = urlunsplit((parsed.scheme, netloc, path, parsed.query, parsed.fragment))
    return urljoin(base, f"reset-password/{token}")
