"""Who may host as the church, and who may open a gathering chat."""

from __future__ import annotations

from django.conf import settings


def church_admin_emails() -> set[str]:
    raw = getattr(settings, "FOYER_CHURCH_ADMIN_EMAILS", []) or []
    return {email.strip().lower() for email in raw if isinstance(email, str) and email.strip()}


def is_church_admin(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    email = (getattr(user, "email", "") or "").strip().lower()
    return bool(email) and email in church_admin_emails()


def is_activity_host(user, activity) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if activity.host_id == user.id:
        return True
    return activity.host_kind == "church" and is_church_admin(user)


def user_has_going_rsvp(user, activity) -> bool:
    from activities.models import ActivityParticipant

    participant = (
        ActivityParticipant.objects.filter(activity=activity, user=user, status="confirmed")
        .prefetch_related("dependents")
        .first()
    )
    if participant is None:
        return False
    if participant.include_self:
        return True
    return participant.dependents.exists()


def user_can_access_activity_chat(user, activity) -> bool:
    """Going RSVP (self or a household child), the host, or a church admin on church events."""
    if is_activity_host(user, activity):
        return True
    return user_has_going_rsvp(user, activity)


def can_see_exact_location(user, activity) -> bool:
    """Exact address of a member-hosted gathering: host, staff, going, or a ticket holder.

    Church-hosted gatherings and gatherings on the public church calendar are never hidden.
    """
    from activities.public_calendar import is_public_calendar_event

    if activity.host_kind == "church" or is_public_calendar_event(activity):
        return True
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_staff or is_activity_host(user, activity):
        return True
    if user_has_going_rsvp(user, activity):
        return True
    return activity.tickets.filter(buyer=user, status__in=["paid", "used"]).exists()
