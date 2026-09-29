"""Birth-date gate for Google, Apple, and X sign-in in The Foyer."""

from django.core.cache import cache
from django.utils.dateparse import parse_date
from rest_framework import serializers, status
from rest_framework.response import Response

from .social_auth import find_social_user, resolve_or_create_social_user

SIGNUP_CACHE_PREFIX = "foyer_social_signup_"
SIGNUP_CACHE_SECONDS = 600

BIRTH_DATE_REQUIRED = "Birth date is required."
UNDER_13 = "A person under 13 cannot create an account."


class BirthDateRequired(Exception):
    """A social account cannot be used until a birth date is collected."""


class Under13Rejected(Exception):
    """Under 13. No usable account is left behind."""


def parse_birth_date(value):
    if value is None or value == "":
        return None
    if hasattr(value, "year") and hasattr(value, "month"):
        return value
    return parse_date(str(value)[:10])


def birth_date_required_body(*, signup_token=None):
    body = {
        "error": BIRTH_DATE_REQUIRED,
        "birth_date_required": True,
        "birth_date": [BIRTH_DATE_REQUIRED],
    }
    if signup_token:
        body["signup_token"] = signup_token
    return body


def under_13_body():
    return {
        "error": UNDER_13,
        "birth_date": [UNDER_13],
    }


def birth_date_required_response(*, signup_token=None):
    return Response(
        birth_date_required_body(signup_token=signup_token),
        status=status.HTTP_400_BAD_REQUEST,
    )


def under_13_response():
    return Response(under_13_body(), status=status.HTTP_400_BAD_REQUEST)


def stash_social_signup(profile):
    import secrets

    token = secrets.token_urlsafe(32)
    cache.set(f"{SIGNUP_CACHE_PREFIX}{token}", profile, timeout=SIGNUP_CACHE_SECONDS)
    return token


def pop_social_signup(token):
    if not token:
        return None
    key = f"{SIGNUP_CACHE_PREFIX}{token}"
    pending = cache.get(key)
    return pending if isinstance(pending, dict) else None


def drop_social_signup(token):
    if token:
        cache.delete(f"{SIGNUP_CACHE_PREFIX}{token}")


def admit_social_user(
    *,
    provider,
    provider_user_id,
    email=None,
    username=None,
    first_name="",
    last_name="",
    birth_date_raw=None,
):
    """Create or resume a social login only when the account may use The Foyer.

    A brand-new person under 13, or one who has not given a birth date, does not
    get a user row. An existing account without a birth date does not receive a
    session until the date is valid. An under-13 date on that shell deactivates it.
    """
    from activities.foyer import assert_account_birth_date, foyer_mode

    if not foyer_mode():
        return resolve_or_create_social_user(
            provider=provider,
            provider_user_id=provider_user_id,
            email=email,
            username=username,
            first_name=first_name,
            last_name=last_name,
        )

    existing = find_social_user(
        provider=provider,
        provider_user_id=provider_user_id,
        email=email,
    )
    needs_birth_date = existing is None or not existing.birth_date or not existing.is_active
    parsed = parse_birth_date(birth_date_raw)
    if needs_birth_date:
        if parsed is None:
            raise BirthDateRequired()
        try:
            assert_account_birth_date(parsed)
        except serializers.ValidationError:
            if existing is not None and not existing.birth_date:
                existing.is_active = False
                existing.save(update_fields=["is_active"])
            raise Under13Rejected()

    user, created = resolve_or_create_social_user(
        provider=provider,
        provider_user_id=provider_user_id,
        email=email,
        username=username,
        first_name=first_name,
        last_name=last_name,
    )
    if needs_birth_date:
        user.birth_date = parsed
        user.is_active = True
        user.save(update_fields=["birth_date", "is_active"])
    if not user.is_active:
        raise Under13Rejected()
    return user, created


def finish_social_birth_date(user, *, created, birth_date_raw):
    """Apply the same rule after a social user row already exists.

    The web Google and Apple sign-in views create the row themselves. A new
    under-13 row is deleted. A missing birth date on a new row is deleted too.
    """
    from activities.foyer import assert_account_birth_date, foyer_mode

    if not foyer_mode():
        return user
    if user.birth_date and user.is_active:
        return user
    parsed = parse_birth_date(birth_date_raw)
    if parsed is None:
        if created:
            user.delete()
        raise BirthDateRequired()
    try:
        assert_account_birth_date(parsed)
    except serializers.ValidationError:
        if created:
            user.delete()
        else:
            user.is_active = False
            user.save(update_fields=["is_active"])
        raise Under13Rejected()
    user.birth_date = parsed
    user.is_active = True
    user.save(update_fields=["birth_date", "is_active"])
    return user
