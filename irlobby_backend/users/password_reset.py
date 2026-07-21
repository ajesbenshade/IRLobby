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
