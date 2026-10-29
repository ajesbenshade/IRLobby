"""Optional US mailing address on a member's own profile.

Stored separately from the account City (`User.location`). Other people see it only
through the member-profile card, and only when the owner turned `show_mailing_address`
on. Directory lists never include it.
"""

from __future__ import annotations

import re

from utils.sanitize import strip_html

# 50 states, DC, USPS territories, and military mail. ZIP codes for all of these are domestic.
US_STATE_CODES = frozenset("""
    AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD
    MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD
    TN TX UT VT VA WA WV WI WY PR VI GU AS MP AA AE AP
    """.split())

STREET_MAX = 255
CITY_MAX = 120

SHOW_INCOMPLETE_ERROR = "Add a street, city, state, and ZIP before showing your mailing address."
STATE_ERROR = "Use a 2-letter US state abbreviation."
POSTAL_ERROR = "Enter a 5-digit ZIP code, or a ZIP+4."

_ZIP = re.compile(r"^(\d{5})(?:-?(\d{4}))?$")


class MailingAddressError(Exception):
    def __init__(self, errors: dict):
        self.errors = errors
        super().__init__(errors)


def _line(value, *, max_length: int, empty_as_null: bool = False):
    text = strip_html("" if value is None else str(value))
    text = " ".join(text.split())
    if len(text) > max_length:
        raise ValueError(f"Must be {max_length} characters or fewer.")
    if empty_as_null:
        return text or None
    return text


def normalize_state(value) -> str:
    raw = "" if value is None else str(value).strip().upper()
    if not raw:
        return ""
    if raw not in US_STATE_CODES:
        raise ValueError(STATE_ERROR)
    return raw


def normalize_postal(value) -> str:
    raw = "" if value is None else str(value).strip()
    if not raw:
        return ""
    match = _ZIP.match(re.sub(r"\s+", "", raw))
    if not match:
        raise ValueError(POSTAL_ERROR)
    zip5, plus4 = match.group(1), match.group(2)
    return f"{zip5}-{plus4}" if plus4 else zip5


def address_is_complete(street, city, state, postal) -> bool:
    return bool(street and city and state and postal)


def clean_mailing_address(*, street, street2, city, state, postal, show: bool) -> dict:
    """Normalize one saved address. Raises MailingAddressError with field messages."""
    errors = {}

    def take(field, fn):
        try:
            return fn()
        except ValueError as exc:
            errors[field] = str(exc)
            return None

    street_v = take("mailing_street", lambda: _line(street, max_length=STREET_MAX))
    street2_v = take(
        "mailing_street2", lambda: _line(street2, max_length=STREET_MAX, empty_as_null=True)
    )
    city_v = take("mailing_city", lambda: _line(city, max_length=CITY_MAX))
    state_v = take("mailing_state", lambda: normalize_state(state))
    postal_v = take("mailing_postal", lambda: normalize_postal(postal))
    if show and not address_is_complete(street_v, city_v, state_v, postal_v):
        errors["show_mailing_address"] = SHOW_INCOMPLETE_ERROR
    if errors:
        raise MailingAddressError(errors)
    return {
        "mailing_street": street_v or "",
        "mailing_street2": street2_v,
        "mailing_city": city_v or "",
        "mailing_state": state_v or "",
        "mailing_postal": postal_v or "",
        "show_mailing_address": bool(show),
    }


def format_mailing_address(user) -> str | None:
    """Street[, Apt] / City, ST ZIP. None unless street, city, state, and ZIP are all set."""
    street = (user.mailing_street or "").strip()
    street2 = (user.mailing_street2 or "").strip()
    city = (user.mailing_city or "").strip()
    state = (user.mailing_state or "").strip()
    postal = (user.mailing_postal or "").strip()
    if not address_is_complete(street, city, state, postal):
        return None
    lines = [street]
    if street2:
        lines.append(street2)
    lines.append(f"{city}, {state} {postal}")
    return "\n".join(lines)


def mailing_address_payload(user) -> dict | None:
    """Structured address for a member-profile card, or None when it must stay hidden.

    Caller still has to check profile visibility. This returns nothing when the owner
    has not turned show_mailing_address on, or when the address is incomplete.
    """
    if not user.show_mailing_address:
        return None
    formatted = format_mailing_address(user)
    if not formatted:
        return None
    street2 = (user.mailing_street2 or "").strip() or None
    return {
        "street": (user.mailing_street or "").strip(),
        "street2": street2,
        "city": (user.mailing_city or "").strip(),
        "state": (user.mailing_state or "").strip(),
        "postal": (user.mailing_postal or "").strip(),
        "formatted": formatted,
    }
