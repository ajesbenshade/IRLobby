"""Age, audience, and headcount rules for gatherings."""

from __future__ import annotations

from datetime import date, datetime
from datetime import timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.utils import timezone

NEW_YORK = ZoneInfo("America/New_York")

AUDIENCE_EVERYONE = "everyone"
AUDIENCE_MEN = "men"
AUDIENCE_WOMEN = "women"
SEX_MALE = "male"
SEX_FEMALE = "female"

AGE_RANGE_REASON = "Outside this event's age range"


def as_new_york(value: datetime) -> datetime:
    if timezone.is_naive(value):
        value = timezone.make_aware(value, dt_timezone.utc)
    return value.astimezone(NEW_YORK)


def event_local_date(activity) -> date:
    return as_new_york(activity.time).date()


def ny_today() -> date:
    return timezone.now().astimezone(NEW_YORK).date()


def age_on(dob: date | None, on_date: date) -> int | None:
    if dob is None:
        return None
    years = on_date.year - dob.year
    if (on_date.month, on_date.day) < (dob.month, dob.day):
        years -= 1
    return years


def audience_label(activity) -> str:
    labels = {
        AUDIENCE_EVERYONE: "Everyone",
        AUDIENCE_MEN: "Men",
        AUDIENCE_WOMEN: "Women",
    }
    label = labels.get(activity.audience_gender or AUDIENCE_EVERYONE, "Everyone")
    age_min = activity.age_min
    age_max = activity.age_max
    if age_min is not None and age_max is not None:
        return f"{label} · Ages {age_min}–{age_max}"
    if age_min is not None:
        if age_min >= 18:
            return f"{label} · {age_min}+"
        return f"{label} · Ages {age_min}+"
    if age_max is not None:
        return f"{label} · Ages {age_max} and under"
    return label


def host_display_name(activity) -> str:
    if activity.host_kind == "church":
        church = activity.host_church
        church_name = church.name if church is not None else ""
        if church_name:
            return church_name
        from activities.models import FRANCONIA_CHURCH_NAME

        return FRANCONIA_CHURCH_NAME
    user = activity.host
    full = f"{user.first_name} {user.last_name}".strip()
    return full or user.username or "Host"


def age_band(age: int | None) -> str:
    """Coarse band shown to hosts: "under 13", "13-17", "adult".

    No age on file (a spouse, or an account without a birth date) reads as "adult".
    """
    if age is None:
        return "adult"
    if age < 13:
        return "under 13"
    if age < 18:
        return "13-17"
    return "adult"


def eligibility_for_person(
    *, activity, sex: str, dob: date | None, on_date: date, assume_adult: bool = False
):
    """Return (eligible, reason). Reason is None when the person may attend.

    ``assume_adult`` is for a spouse, who has no birth data: they pass any age range
    unless the event is for under-18s only (age_max below 18).
    """
    audience = activity.audience_gender or AUDIENCE_EVERYONE
    normalized_sex = (sex or "").strip().lower()
    if audience == AUDIENCE_MEN and normalized_sex != SEX_MALE:
        if not normalized_sex:
            return False, "Add a sex to join this gathering."
        return False, "This gathering is for men."
    if audience == AUDIENCE_WOMEN and normalized_sex != SEX_FEMALE:
        if not normalized_sex:
            return False, "Add a sex to join this gathering."
        return False, "This gathering is for women."

    if activity.age_min is None and activity.age_max is None:
        return True, None

    if assume_adult:
        if activity.age_max is not None and activity.age_max < 18:
            return False, AGE_RANGE_REASON
        return True, None

    age = age_on(dob, on_date)
    if age is None:
        return False, "Birth date is required for this gathering's age range."
    if activity.age_min is not None and age < activity.age_min:
        return False, AGE_RANGE_REASON
    if activity.age_max is not None and age > activity.age_max:
        return False, AGE_RANGE_REASON
    return True, None


def participant_people_count(participant) -> int:
    return (1 if participant.include_self else 0) + len(participant.dependents.all())


def confirmed_people_count(activity, *, exclude_user_id=None) -> int:
    total = 0
    for participant in activity.participants.all():
        if participant.status != "confirmed":
            continue
        if exclude_user_id is not None and participant.user_id == exclude_user_id:
            continue
        total += participant_people_count(participant)
    return total
