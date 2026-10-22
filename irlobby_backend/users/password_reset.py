import hashlib
import secrets
from datetime import timedelta

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


def app_password_reset_link(token, scheme="irlobby"):
    """Deep link that opens the app's Reset password screen with the token filled in."""
    return f"{scheme}://reset-password/{token}"
