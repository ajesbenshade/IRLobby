"""Profile → Connections: people you are gathering with, and people you are praying for.

There is no older gathering-connections route. The legacy sheet reads ``GET /api/matches/``,
which stays the match list. This endpoint is the one the Connections sheet should use.

Gathering rows are other accounts with a confirmed RSVP (themselves or a household member)
on a gathering where you also have one. The gathering is upcoming, still going, or ended
within ``RECENT_GATHERING_DAYS``. Household members are not rows. A row is returned only
when you may open that person's profile (``can_view_profile``: the full profile card).

Praying rows are prayer requests you are actively praying for. Stop praying drops the row.
The author is the person on the row. ``user_id`` is set only when you may open their
profile; otherwise it is null and the row still opens the prayer.
"""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Exists, OuterRef, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from activities.eligibility import event_local_date
from activities.models import ActivityParticipant, HouseholdDependent
from prayers.models import PrayerParticipant
from users.social import blocked_user_ids, can_view_profile

# Long enough that a gathering from the Saturday before last still shows the
# following week (the sheet's "Sat Oct 17" example is still inside this window
# twelve days later).
RECENT_GATHERING_DAYS = 14


def _going_rsvps():
    """Confirmed RSVPs where the account holder or a household member is going."""
    bringing_household = HouseholdDependent.objects.filter(rsvps=OuterRef("pk"))
    return ActivityParticipant.objects.filter(status="confirmed").filter(
        Q(include_self=True) | Exists(bringing_household)
    )


def _identity(user, user_id, *, include_avatar: bool) -> dict:
    first = (user.first_name or "").strip()
    last = (user.last_name or "").strip()
    initial = last[0].upper() if last else ""
    if first and initial:
        display = f"{first} {initial}."
    else:
        display = first or "Guest"
    return {
        "user_id": user_id,
        "first_name": first,
        "last_initial": initial,
        "display_name": display,
        "avatar_url": (user.avatar_url or "") if include_avatar else "",
    }


def _profile_open(viewer, other) -> bool:
    """True when GET /api/users/<id>/profile/ would return the full card."""
    return bool(other.is_active) and can_view_profile(viewer, other)


def _gathering_rows(viewer, blocked: set[int], now) -> list[dict]:
    cutoff = now - timedelta(days=RECENT_GATHERING_DAYS)
    activity_ids = _going_rsvps().filter(user=viewer).values("activity_id")
    still_relevant = Q(activity__end_time__gte=cutoff) | Q(
        activity__end_time__isnull=True, activity__time__gte=cutoff
    )
    peers = (
        _going_rsvps()
        .filter(activity_id__in=activity_ids, activity__is_cancelled=False)
        .filter(still_relevant)
        .exclude(user_id=viewer.id)
        .exclude(user_id__in=blocked)
        .select_related("user", "activity")
    )
    pending = []
    seen = set()
    for participant in peers:
        key = (participant.activity_id, participant.user_id)
        if key in seen:
            continue
        seen.add(key)
        other = participant.user
        if not _profile_open(viewer, other):
            continue
        activity = participant.activity
        identity = _identity(other, other.id, include_avatar=True)
        pending.append((activity, identity))

    def sort_key(item):
        activity, identity = item
        finished = activity.end_time or activity.time
        name = identity["display_name"].casefold()
        # Upcoming and in-progress first (soonest start), then recent past
        # (most recently finished).
        if finished >= now:
            return (0, activity.time, name, identity["user_id"], activity.id)
        return (1, now - finished, name, identity["user_id"], activity.id)

    pending.sort(key=sort_key)
    rows = []
    for activity, identity in pending:
        rows.append(
            {
                **identity,
                "context_title": activity.title,
                "context_kind": "gathering",
                "context_id": activity.id,
                "context_date": event_local_date(activity).isoformat(),
            }
        )
    return rows


def _praying_rows(viewer, blocked: set[int]) -> list[dict]:
    links = (
        PrayerParticipant.objects.filter(user=viewer, status=PrayerParticipant.STATUS_PRAYING)
        .exclude(prayer_request__author_id=viewer.id)
        .exclude(prayer_request__author_id__in=blocked)
        .select_related("prayer_request", "prayer_request__author")
        .order_by("-prayer_request__created_at", "-prayer_request_id")
    )
    rows = []
    for link in links:
        prayer = link.prayer_request
        author = prayer.author
        visible = _profile_open(viewer, author)
        rows.append(
            {
                **_identity(author, author.id if visible else None, include_avatar=visible),
                "context_title": prayer.title,
                "context_kind": "prayer",
                "context_id": prayer.id,
            }
        )
    return rows


def build_connections(viewer) -> dict:
    blocked = blocked_user_ids(viewer)
    now = timezone.now()
    return {
        "gathering": _gathering_rows(viewer, blocked, now),
        "praying": _praying_rows(viewer, blocked),
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def connections(request):
    """GET /api/users/connections/ — gathering-with and praying-for lists."""
    return Response(build_connections(request.user))
