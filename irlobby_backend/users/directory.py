"""Who appears in the Franconia church Directory.

Adults are users. Household children are nested under a parent and are never rows of
their own. Gathering, profile-card, and friend birthday rules live elsewhere.
"""

from __future__ import annotations

from datetime import date

from django.db.models import Prefetch, Q
from django.db.models.functions import Lower

from activities.eligibility import age_on, ny_today
from activities.household_rules import minor_account_for_dependent
from activities.models import FRANCONIA_CHURCH_NAME, Church, HouseholdDependent

from .models import User
from .social import blocked_user_ids


def franconia_church_id() -> int | None:
    """Id of the seeded Franconia Mennonite Church row, or None when it is missing."""
    return Church.objects.filter(name=FRANCONIA_CHURCH_NAME).values_list("id", flat=True).first()


def is_franconia_member(user) -> bool:
    church_id = franconia_church_id()
    return church_id is not None and getattr(user, "church_id", None) == church_id


def at_least_18_q(today: date | None = None) -> Q:
    """Users who are 18 or older, plus users with no birth date.

    A missing birth date is treated as an adult, the same rule as ``is_minor``.
    Someone whose 18th birthday is today is included. Feb 29 birthdays stay 17
    through Feb 28 of a non-leap year and turn 18 on March 1, matching ``age_on``.
    """
    today = today or ny_today()
    year = today.year - 18
    return (
        Q(date_of_birth__isnull=True)
        | Q(date_of_birth__year__lt=year)
        | (
            Q(date_of_birth__year=year)
            & (
                Q(date_of_birth__month__lt=today.month)
                | Q(date_of_birth__month=today.month, date_of_birth__day__lte=today.day)
            )
        )
    )


def viewer_is_directory_adult(viewer) -> bool:
    """A known age of 18 or older. No birth date does not unlock children's birthdays."""
    age = age_on(getattr(viewer, "date_of_birth", None), ny_today())
    return age is not None and age >= 18


def viewer_may_see_household_children(viewer) -> bool:
    return is_franconia_member(viewer) and viewer_is_directory_adult(viewer)


def child_first_name(name: str) -> str:
    """First word of a household name. Anything after it is left off (no last name)."""
    parts = (name or "").split()
    return parts[0] if parts else ""


def _directory_child_prefetch() -> Prefetch:
    return Prefetch(
        "household_dependents",
        queryset=HouseholdDependent.objects.filter(
            relationship="child",
            date_of_birth__isnull=False,
        ).order_by("id"),
        to_attr="directory_children",
    )


def household_children_for(parent) -> list[dict]:
    """Under-18 children with a full birth date, minus teens who have their own account.

    Month-and-year-only rows and spouses (no birth date) never qualify. The payload
    is id, first name, month, and day. The year is not copied onto the dict.
    """
    today = ny_today()
    children = getattr(parent, "directory_children", None)
    if children is None:
        children = parent.household_dependents.filter(
            relationship="child", date_of_birth__isnull=False
        )
    rows = []
    for child in children:
        dob = child.date_of_birth
        if dob is None:
            continue
        age = age_on(dob, today)
        if age is None or age >= 18:
            continue
        if minor_account_for_dependent(child.name, dob):
            continue
        first = child_first_name(child.name)
        if not first:
            continue
        rows.append(
            {
                "id": child.id,
                "first_name": first,
                "birth_month": dob.month,
                "birth_day": dob.day,
            }
        )
    rows.sort(key=lambda row: (row["first_name"].casefold(), row["id"]))
    return rows


def directory_queryset(viewer, query: str | None = None):
    """Franconia members with church visibility, 18+ (or no birth date), not blocked."""
    church_id = franconia_church_id()
    if church_id is None or getattr(viewer, "church_id", None) != church_id:
        return User.objects.none()
    hidden = blocked_user_ids(viewer)
    qs = User.objects.filter(
        is_active=True,
        church_id=church_id,
        profile_visibility="church",
    ).filter(at_least_18_q())
    if hidden:
        qs = qs.exclude(pk__in=hidden)
    text = (query or "").strip()
    if text:
        qs = qs.filter(Q(first_name__icontains=text) | Q(last_name__icontains=text))
    if viewer_may_see_household_children(viewer):
        qs = qs.prefetch_related(_directory_child_prefetch())
    return qs.order_by(Lower("first_name"), Lower("last_name"), "id")
