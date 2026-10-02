"""When is a gathering full, and who still sees a full gathering.

Capacity counts people (not accounts) who are confirmed. Pending requests never count.
A missing capacity (null, or 0 which the API never stores) means no limit, so never full.
Fullness is always computed from the RSVPs, never stored, so a freed spot reopens it.
"""

from __future__ import annotations

from django.db.models import Count, Exists, F, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce

from .eligibility import confirmed_people_count
from .models import ActivityParticipant

FULL_MESSAGE = "This gathering is full."
# `message` keeps the older clients' text.
FULL_ERROR = {"detail": FULL_MESSAGE, "message": "Activity is full"}
NOT_ENOUGH_SPOTS_MESSAGE = "Not enough spots for this party."


def has_capacity_limit(activity) -> bool:
    return activity.capacity is not None and activity.capacity > 0


def is_full(activity) -> bool:
    """True only with a capacity limit and confirmed people at or over it."""
    return has_capacity_limit(activity) and confirmed_people_count(activity) >= activity.capacity


def has_participant_row(user, activity) -> bool:
    return ActivityParticipant.objects.filter(activity=activity, user=user).exists()


def is_full_for_newcomer(user, activity) -> bool:
    """Full, and this user is a stranger to it: no RSVP or request row of any status, not the
    host, not staff. Those people keep seeing and using a full gathering."""
    if not is_full(activity):
        return False
    if user.is_staff or activity.host_id == user.id:
        return False
    return not has_participant_row(user, activity)


def exclude_full_for_strangers(queryset, user):
    """Drop full gatherings the user has no row on (and does not host) from a deck query.

    One query: confirmed people are summed in subqueries (self plus household members)
    rather than counted per row. Staff see everything.
    """
    if user.is_staff:
        return queryset
    selves = (
        ActivityParticipant.objects.filter(
            activity=OuterRef("pk"), status="confirmed", include_self=True
        )
        .order_by()
        .values("activity")
        .annotate(total=Count("pk"))
        .values("total")
    )
    members = (
        ActivityParticipant.dependents.through.objects.filter(
            activityparticipant__activity=OuterRef("pk"),
            activityparticipant__status="confirmed",
        )
        .order_by()
        .values("activityparticipant__activity")
        .annotate(total=Count("pk"))
        .values("total")
    )
    zero = IntegerField()
    queryset = queryset.annotate(
        confirmed_people_total=Coalesce(Subquery(selves, output_field=zero), 0)
        + Coalesce(Subquery(members, output_field=zero), 0),
        has_my_row=Exists(ActivityParticipant.objects.filter(activity=OuterRef("pk"), user=user)),
    )
    full_for_stranger = Q(
        capacity__gt=0, confirmed_people_total__gte=F("capacity"), has_my_row=False
    ) & ~Q(host=user)
    return queryset.exclude(full_for_stranger)
