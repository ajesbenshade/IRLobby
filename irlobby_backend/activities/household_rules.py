"""Account and household age rules.

- No accounts under 13.
- A 13–17 year old with their own account cannot also be stored as a dependent.
- A parent must be 18 or older to add a child under 18.
"""

from __future__ import annotations

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


def minor_account_for_dependent(name: str, date_of_birth):
    """Return the 13–17 account that matches this child, if one exists."""
    from users.models import User

    wanted = normalize_name(name)
    if not wanted or date_of_birth is None:
        return None
    today = ny_today()
    age = age_on(date_of_birth, today)
    if age is None or age < 13 or age > 17:
        return None
    for user in User.objects.filter(date_of_birth=date_of_birth):
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
    for dependent in HouseholdDependent.objects.filter(date_of_birth=date_of_birth):
        if normalize_name(dependent.name) in names:
            return True
    return False


MINOR_ACCOUNT_DEPENDENT_ERROR = (
    "This teen already has an account and cannot also be stored as a dependent."
)
MINOR_DEPENDENT_ACCOUNT_ERROR = (
    "A 13–17 year old who is already listed as a dependent cannot also create an account."
)


def dependent_create_errors(*, parent, name: str, date_of_birth) -> dict:
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
    elif minor_account_for_dependent(name, date_of_birth):
        errors["name"] = MINOR_ACCOUNT_DEPENDENT_ERROR
    return errors
