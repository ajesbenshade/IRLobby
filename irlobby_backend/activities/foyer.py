"""The Foyer rules for audience eligibility, household RSVP, and church hosting."""

from __future__ import annotations

from datetime import date

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .timezones import NEW_YORK

CONGREGATIONAL_ADMIN_EMAILS = frozenset(
    {
        "ajesbenshade@gmail.com",
        "ajesbenshade@outlook.com",
        "aesbenshade@dock.org",
    }
)

FRANCONIA_CHURCH_NAME = "Franconia Mennonite Church"

VERIFIED_CHURCHES = (
    "Franconia Mennonite Church",
    "Souderton Mennonite Church",
    "Blooming Glen Mennonite Church",
    "Plains Mennonite Church",
    "Zion Mennonite Church",
    "Perkasie Mennonite Church",
    "Deep Run Mennonite Church East",
    "Finland Mennonite Church",
)

PUBLIC_CALENDAR_FIELDS = (
    "title",
    "start",
    "end",
    "location",
    "host_name",
    "audience",
    "description",
    "cover_photo_url",
)

GIFT_PERSONAL_NOTICE = (
    "A gift to this host is a contribution to that person, not a tax-deductible church gift. "
    "Stripe's card fee still applies. The Foyer does not take a cut."
)
GIFT_CHURCH_NOTICE = (
    "A gift on this event goes to Franconia Mennonite Church. "
    "Stripe's card fee still applies. The Foyer does not take a cut."
)
PUBLIC_LOCATION_WARNING = (
    "A public event's location is visible on the church website. "
    "Do not put a home address there unless you mean for the congregation to see it."
)

MAX_EVENT_PHOTOS = 8


def foyer_mode() -> bool:
    return bool(getattr(settings, "FOYER_MODE", False))


def today_in_new_york() -> date:
    return timezone.now().astimezone(NEW_YORK).date()


def age_on(birth_date: date | None, on_date: date) -> int | None:
    if birth_date is None:
        return None
    years = on_date.year - birth_date.year
    if (on_date.month, on_date.day) < (birth_date.month, birth_date.day):
        years -= 1
    return years


def event_local_date(activity) -> date:
    moment = activity.time
    if timezone.is_naive(moment):
        moment = timezone.make_aware(moment, timezone.utc)
    return moment.astimezone(NEW_YORK).date()


def is_congregational_admin(user) -> bool:
    email = (getattr(user, "email", "") or "").strip().lower()
    return email in CONGREGATIONAL_ADMIN_EMAILS


def sex_matches_audience(sex: str, audience_gender: str) -> bool:
    audience = (audience_gender or "everyone").lower()
    if audience == "everyone":
        return True
    normalized = (sex or "").strip().lower()
    if audience == "men":
        return normalized == "male"
    if audience == "women":
        return normalized == "female"
    return False


def person_is_eligible(birth_date, sex, activity) -> bool:
    audience = getattr(activity, "audience_gender", None) or "everyone"
    if not sex_matches_audience(sex or "", audience):
        return False
    age_min = activity.age_min
    age_max = activity.age_max
    if age_min is None and age_max is None:
        return True
    age = age_on(birth_date, event_local_date(activity))
    if age is None:
        return False
    if age_min is not None and age < age_min:
        return False
    if age_max is not None and age > age_max:
        return False
    return True


def account_can_attend(user, activity, dependents=None) -> bool:
    if person_is_eligible(getattr(user, "birth_date", None), getattr(user, "sex", ""), activity):
        return True
    if dependents is None:
        related = getattr(user, "dependents", None)
        dependents = list(related.all()) if related is not None else []
    for dependent in dependents:
        if person_is_eligible(dependent.birth_date, dependent.sex, activity):
            return True
    return False


def filter_eligible_activities(queryset, user):
    if not foyer_mode() or not getattr(user, "is_authenticated", False):
        return queryset
    if getattr(user, "is_staff", False) or is_congregational_admin(user):
        return queryset
    dependents = list(user.dependents.all())
    eligible_ids = [
        activity.id
        for activity in queryset
        if activity.host_id == user.id or account_can_attend(user, activity, dependents)
    ]
    if not eligible_ids:
        return queryset.none()
    return queryset.filter(id__in=eligible_ids)


def going_headcount(activity, *, exclude_user_id=None) -> int:
    participants = activity.participants.filter(status="confirmed")
    if exclude_user_id is not None:
        participants = participants.exclude(user_id=exclude_user_id)
    total = 0
    for participant in participants.prefetch_related("dependents"):
        if participant.include_self:
            total += 1
        total += participant.dependents.count()
    return total


def user_is_going(user, activity) -> bool:
    participant = activity.participants.filter(user=user, status="confirmed").first()
    if participant is None:
        return False
    if participant.include_self:
        return True
    return participant.dependents.exists()


def user_can_access_activity_chat(user, activity) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if not foyer_mode():
        from .models import ActivityParticipant

        if activity.host_id == getattr(user, "id", None):
            return True
        return ActivityParticipant.objects.filter(
            activity=activity, user=user, status="confirmed"
        ).exists()
    if activity.host_id == getattr(user, "id", None):
        return True
    if getattr(activity, "host_kind", "person") == "church" and is_congregational_admin(user):
        return True
    return user_is_going(user, activity)


def user_can_add_event_photo(user, activity) -> bool:
    if activity.host_id == getattr(user, "id", None):
        return True
    if getattr(activity, "host_kind", "person") == "church" and is_congregational_admin(user):
        return True
    return user_is_going(user, activity)


def audience_label(activity) -> str:
    gender = {
        "everyone": "Everyone",
        "men": "Men",
        "women": "Women",
    }.get(activity.audience_gender or "everyone", "Everyone")
    if activity.age_min is not None and activity.age_max is not None:
        return f"{gender}, ages {activity.age_min}–{activity.age_max}"
    if activity.age_min is not None:
        return f"{gender}, ages {activity.age_min}+"
    if activity.age_max is not None:
        return f"{gender}, ages up to {activity.age_max}"
    return gender


def host_display_name(activity) -> str:
    if activity.host_kind == "church":
        church = getattr(activity, "church", None)
        if church is not None:
            return church.name
        return FRANCONIA_CHURCH_NAME
    host = activity.host
    name = f"{(host.first_name or '').strip()} {(host.last_name or '').strip()}".strip()
    return name or host.username


def gift_notice(activity) -> str:
    if activity.host_kind == "church":
        return GIFT_CHURCH_NOTICE
    return GIFT_PERSONAL_NOTICE


def cover_photo_url(activity, request=None) -> str:
    photo = activity.photos.order_by("created_at", "id").first()
    if photo is None:
        return ""
    return photo.public_url(request)


def assert_account_birth_date(birth_date):
    if birth_date is None:
        raise serializers.ValidationError({"birth_date": "Birth date is required."})
    age = age_on(birth_date, today_in_new_york())
    if age is None or age < 13:
        raise serializers.ValidationError(
            {"birth_date": "A person under 13 cannot create an account."}
        )


def validate_dependent(guardian, *, first_name, last_name, birth_date, sex):
    from users.models import User

    guardian_age = age_on(getattr(guardian, "birth_date", None), today_in_new_york())
    if guardian_age is None or guardian_age < 18:
        raise serializers.ValidationError(
            "A parent who is 18 or older can add children under 18 to a household."
        )
    child_age = age_on(birth_date, today_in_new_york())
    if child_age is None or child_age >= 18:
        raise serializers.ValidationError("Household children must be under 18.")
    if sex not in {"male", "female"}:
        raise serializers.ValidationError({"sex": "Sex must be male or female."})
    if 13 <= child_age <= 17:
        target = f"{first_name} {last_name}".strip().lower()
        for account in User.objects.filter(birth_date=birth_date):
            account_name = f"{account.first_name} {account.last_name}".strip().lower()
            if target and account_name == target:
                raise serializers.ValidationError(
                    "A 13–17 year old with their own account should not also be stored as a dependent."
                )


def franconia_church():
    from .models import Church

    church, _created = Church.objects.get_or_create(
        name=FRANCONIA_CHURCH_NAME,
        defaults={"is_verified": True},
    )
    return church


def apply_foyer_host_rules(attrs, user, instance=None):
    """Force a zero platform fee and church-calendar approval rules."""
    if not foyer_mode():
        return attrs

    attrs["platform_fee_percent"] = 0
    attrs["is_ticketed"] = False
    host_kind = attrs.get("host_kind", getattr(instance, "host_kind", "person") if instance else "person")
    list_public = attrs.get(
        "list_on_church_calendar",
        getattr(instance, "list_on_church_calendar", False) if instance else False,
    )
    if host_kind == "church":
        if not is_congregational_admin(user):
            raise serializers.ValidationError(
                {"host_kind": "Only congregational admins can host as Franconia Mennonite Church."}
            )
        attrs["host_kind"] = "church"
        attrs["church"] = franconia_church()
        attrs["calendar_approved"] = bool(list_public)
    else:
        attrs["host_kind"] = "person"
        attrs["church"] = None
        if list_public:
            attrs["calendar_approved"] = False
        elif "list_on_church_calendar" in attrs and not list_public:
            attrs["calendar_approved"] = False
    return attrs


def apply_rsvp(activity, user, *, include_self, dependent_ids):
    from .models import ActivityParticipant, HouseholdDependent

    dependents = list(
        HouseholdDependent.objects.filter(id__in=dependent_ids, guardian=user)
    )
    if len(dependents) != len(set(dependent_ids)):
        raise serializers.ValidationError(
            {"dependent_ids": "Choose only children in your household."}
        )
    if include_self and not person_is_eligible(user.birth_date, user.sex, activity):
        raise serializers.ValidationError("You are not eligible for this gathering.")
    for dependent in dependents:
        if not person_is_eligible(dependent.birth_date, dependent.sex, activity):
            raise serializers.ValidationError(
                f"{dependent.first_name} is not eligible for this gathering."
            )
    if not include_self and not dependents:
        raise serializers.ValidationError("Choose who is coming.")

    added = (1 if include_self else 0) + len(dependents)
    if activity.capacity is not None:
        already = going_headcount(activity, exclude_user_id=user.id)
        if already + added > activity.capacity:
            raise serializers.ValidationError("This gathering is full.")

    participant, _created = ActivityParticipant.objects.get_or_create(
        activity=activity,
        user=user,
        defaults={"status": "confirmed", "include_self": include_self},
    )
    participant.status = "confirmed"
    participant.include_self = include_self
    participant.save(update_fields=["status", "include_self"])
    participant.dependents.set(dependents)
    return participant


def gift_destination_account_id(activity) -> str:
    if activity.host_kind == "church":
        church = activity.church or franconia_church()
        if church.stripe_connect_account_id and church.stripe_connect_payouts_enabled:
            return church.stripe_connect_account_id
        return ""
    from users.stripe_connect import host_can_receive_payouts

    if host_can_receive_payouts(activity.host):
        return activity.host.stripe_connect_account_id
    return ""


def public_calendar_queryset():
    from .models import Activity

    return (
        Activity.objects.filter(list_on_church_calendar=True, calendar_approved=True)
        .select_related("host", "church")
        .prefetch_related("photos")
        .order_by("time", "id")
    )


def public_event_payload(activity, request=None) -> dict:
    end = activity.end_time.isoformat() if activity.end_time else None
    return {
        "title": activity.title,
        "start": activity.time.isoformat(),
        "end": end,
        "location": activity.location,
        "host_name": host_display_name(activity),
        "audience": audience_label(activity),
        "description": activity.description,
        "cover_photo_url": cover_photo_url(activity, request),
    }
