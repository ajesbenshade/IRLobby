"""Account and household age rules.

- No accounts under 13.
- A 13–17 year old with their own account cannot also be stored as a dependent.
- A parent must be 18 or older to add a child under 18.
- A household may also list one spouse: an adult with no birth data and no account.
"""

from __future__ import annotations

import calendar
from datetime import date

from django.db.models import Q

from activities.eligibility import age_on, ny_today


def normalize_name(value: str) -> str:
    return " ".join((value or "").lower().split())


def account_age_error(dob) -> str | None:
    if dob is None:
        return None
    age = age_on(dob, ny_today())
    if age is not None and age < 13:
        return "Accounts are not available under age 13."
    return None


def _name_candidates(first_name="", last_name="", username="", name="") -> set[str]:
    candidates = {
        normalize_name(name),
        normalize_name(first_name),
        normalize_name(f"{first_name} {last_name}"),
        normalize_name(username),
    }
    candidates.discard("")
    return candidates


def minor_account_for_dependent(name: str, date_of_birth, *, month_year_only: bool = False):
    """Return the 13–17 account that matches this child, if one exists.

    With ``month_year_only`` only the birth month and year are compared.
    """
    from users.models import User

    wanted = normalize_name(name)
    if not wanted or date_of_birth is None:
        return None
    today = ny_today()
    age = age_on(date_of_birth, today)
    if age is None or age < 13 or age > 17:
        return None
    if month_year_only:
        candidates = User.objects.filter(
            date_of_birth__year=date_of_birth.year, date_of_birth__month=date_of_birth.month
        )
    else:
        candidates = User.objects.filter(date_of_birth=date_of_birth)
    for user in candidates:
        if wanted in _name_candidates(
            first_name=user.first_name, last_name=user.last_name, username=user.username
        ):
            return user
    return None


def dependent_blocks_minor_account(*, first_name="", last_name="", username="", date_of_birth):
    """True when a 13–17 signup matches a child already stored on a household."""
    from activities.models import HouseholdDependent

    if date_of_birth is None:
        return False
    age = age_on(date_of_birth, ny_today())
    if age is None or age < 13 or age > 17:
        return False
    names = _name_candidates(first_name=first_name, last_name=last_name, username=username)
    if not names:
        return False
    # Stored children may have an exact date or only a birth month and year.
    stored = HouseholdDependent.objects.filter(relationship="child").filter(
        Q(date_of_birth=date_of_birth)
        | Q(
            date_of_birth__isnull=True,
            birth_year=date_of_birth.year,
            birth_month=date_of_birth.month,
        )
    )
    for dependent in stored:
        if normalize_name(dependent.name) in names:
            return True
    return False


MINOR_ACCOUNT_DEPENDENT_ERROR = (
    "This teen already has an account and cannot also be stored as a dependent."
)
MINOR_DEPENDENT_ACCOUNT_ERROR = (
    "A 13–17 year old who is already listed as a dependent cannot also create an account."
)


def dependent_create_errors(
    *, parent, name: str, date_of_birth, month_year_only: bool = False
) -> dict:
    errors = {}
    today = ny_today()
    if not getattr(parent, "date_of_birth", None):
        errors["parent"] = "Add your birth date before adding children."
    else:
        parent_age = age_on(parent.date_of_birth, today)
        if parent_age is None or parent_age < 18:
            errors["parent"] = "You must be 18 or older to add children."

    child_age = age_on(date_of_birth, today)
    if child_age is None or child_age >= 18:
        errors["date_of_birth"] = "Only children under 18 can be added to a household."
    elif minor_account_for_dependent(name, date_of_birth, month_year_only=month_year_only):
        errors["name"] = MINOR_ACCOUNT_DEPENDENT_ERROR
    return errors


MAX_SPOUSES = 1


def member_birth_date(member) -> date | None:
    """Exact date of birth when known, else the last day of birth_month/birth_year.

    Using the last day of the month makes a child look no older than they are.
    """
    if member.date_of_birth is not None:
        return member.date_of_birth
    if member.birth_month and member.birth_year:
        last_day = calendar.monthrange(member.birth_year, member.birth_month)[1]
        return date(member.birth_year, member.birth_month, last_day)
    return None


def member_age(member, on_date) -> int | None:
    """Age on ``on_date``. A spouse has no birth data, so no age."""
    if member.relationship == "spouse":
        return None
    return age_on(member_birth_date(member), on_date)


def parse_birth_month_year(month, year):
    """Return (month, year, error). Both must be sent together."""
    if month in (None, "") and year in (None, ""):
        return None, None, None
    try:
        month_value, year_value = int(month), int(year)
    except (TypeError, ValueError):
        return None, None, "Enter a birth month (1-12) and birth year."
    if not 1 <= month_value <= 12 or not 1900 <= year_value <= ny_today().year:
        return None, None, "Enter a birth month (1-12) and birth year."
    return month_value, year_value, None


def spouse_create_errors(*, parent) -> dict:
    errors = {}
    if parent.household_dependents.filter(relationship="spouse").count() >= MAX_SPOUSES:
        errors["relationship"] = "Your household already has a spouse."
    parent_dob = getattr(parent, "date_of_birth", None)
    if parent_dob is not None and (age_on(parent_dob, ny_today()) or 0) < 18:
        errors["parent"] = "You must be 18 or older to add a spouse."
    return errors
