"""Require approval: guest requests, the host's request list, approve and decline.

A guest's RSVP to a Require-approval gathering is stored as a ``pending``
``ActivityParticipant``. Only ``confirmed`` rows ever count as going, so every
headcount, address, chat and attendee check keeps working unchanged.
"""

from __future__ import annotations

import logging

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.social import blocked_user_ids, is_minor

from .access import is_activity_host
from .eligibility import (
    age_band,
    age_on,
    confirmed_people_count,
    event_local_date,
    participant_people_count,
)
from .household_rules import member_age
from .models import Activity, ActivityParticipant
from .public_calendar import is_public_calendar_event

logger = logging.getLogger(__name__)

MAX_DECLINE_REASON_LENGTH = 280
DECLINED_ERROR = {"detail": "The host declined your request."}
NOT_ENOUGH_SPOTS_ERROR = {"detail": "Not enough spots for this party."}

# API label -> stored ActivityParticipant.status
REQUEST_STATUS_FILTERS = {"pending": "pending", "approved": "confirmed", "declined": "declined"}
REQUEST_STATUS_LABELS = {value: key for key, value in REQUEST_STATUS_FILTERS.items()}


def is_open_listing(activity) -> bool:
    """Church-hosted or on the public calendar: the rule the public feed and open address use."""
    return activity.host_kind == "church" or is_public_calendar_event(activity)


def request_status_label(participant) -> str:
    return REQUEST_STATUS_LABELS.get(participant.status, "pending")


def my_request_status(user, activity) -> str:
    """none | pending | approved | declined, for one user. Approved means confirmed."""
    if not user or not getattr(user, "is_authenticated", False):
        return "none"
    for participant in activity.participants.all():
        if participant.user_id == user.id:
            return request_status_label(participant)
    return "none"


def my_request_reason(user, activity):
    """The host's decline note, for the declined requester only; otherwise None."""
    if not user or not getattr(user, "is_authenticated", False):
        return None
    for participant in activity.participants.all():
        if participant.user_id == user.id:
            return declined_reason(participant)
    return None


def declined_reason(participant):
    if participant.status != "declined":
        return None
    return participant.decline_reason or None


def visible_requests(activity, stored_status="pending"):
    """Requests the host may see: oldest first, never the host, never a blocked account."""
    queryset = ActivityParticipant.objects.filter(activity=activity, status=stored_status).exclude(
        user_id=activity.host_id
    )
    hidden = blocked_user_ids(activity.host)
    if hidden:
        queryset = queryset.exclude(user_id__in=hidden)
    return queryset.order_by("joined_at", "id")


def pending_request_count(activity) -> int:
    return visible_requests(activity, "pending").count()


def spots_left(activity):
    """Open places for people (not accounts), or None when capacity is unlimited."""
    if activity.capacity is None:
        return None
    return max(activity.capacity - confirmed_people_count(activity), 0)


def request_item(participant, on_date) -> dict:
    """What a host sees about one request. First name, avatar and bio only: never contact
    details or a last name, whatever the requester's profile visibility says. A minor's card
    is trimmed to first name and age band."""
    user = participant.user
    if is_minor(user):
        card = {
            "first_name": user.first_name or "Guest",
            "age_band": age_band(age_on(user.date_of_birth, on_date)),
            "avatar_url": None,
            "bio": None,
        }
    else:
        church = user.church
        card = {
            "first_name": user.first_name or "Guest",
            "age_band": age_band(age_on(user.date_of_birth, on_date)),
            "avatar_url": user.avatar_url or None,
            "bio": user.bio or None,
            "church_name": church.name if church is not None else None,
        }
    members = [
        {
            "name": member.name,
            "relationship": member.relationship,
            "age_band": age_band(member_age(member, on_date)),
        }
        for member in participant.dependents.all()
    ]
    return {
        "id": participant.id,
        "user_id": user.id,
        "requested_at": participant.joined_at.isoformat(),
        "decided_at": participant.decided_at.isoformat() if participant.decided_at else None,
        "status": request_status_label(participant),
        "decline_reason": declined_reason(participant),
        "party": {
            "size": participant_people_count(participant),
            "include_self": participant.include_self,
            "members": members,
        },
        "card": card,
    }


def _host_activity_or_error(request, pk):
    """404 for a missing or hidden gathering, then 403 unless host, staff or church admin."""
    user = request.user
    visible = Activity.objects.all()
    if not user.is_staff:
        visible = Activity.objects.filter(Q(is_approved=True) | Q(host=user))
    activity = get_object_or_404(visible.distinct(), pk=pk)
    if not (user.is_staff or is_activity_host(user, activity)):
        return None, Response(
            {"detail": "Only the host can review requests."}, status=status.HTTP_403_FORBIDDEN
        )
    return activity, None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def activity_requests(request, pk):
    """Host/staff/church admin: requests to join, ?status=pending (default)|approved|declined."""
    activity, error = _host_activity_or_error(request, pk)
    if error is not None:
        return error
    label = (request.query_params.get("status") or "pending").strip().lower()
    if label not in REQUEST_STATUS_FILTERS:
        return Response(
            {"status": "Status must be pending, approved or declined."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    on_date = event_local_date(activity)
    participants = visible_requests(activity, REQUEST_STATUS_FILTERS[label]).select_related(
        "user", "user__church"
    )
    participants = participants.prefetch_related("dependents")
    return Response(
        {
            "pending_count": pending_request_count(activity),
            "spots_left": spots_left(activity),
            "requests": [request_item(participant, on_date) for participant in participants],
        }
    )


def _decision_state_error(activity):
    """Why a decision can't be made on this gathering any more, or None."""
    if activity.is_cancelled:
        return Response(
            {"detail": "This gathering was cancelled, so requests can't be changed."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    now = timezone.now()
    if activity.time <= now or (activity.end_time and activity.end_time <= now):
        return Response(
            {"detail": "This gathering has already started, so requests can't be changed."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None


def _decision_response(participant_id, activity_id):
    activity = Activity.objects.get(pk=activity_id)
    participant = (
        ActivityParticipant.objects.select_related("user", "user__church")
        .prefetch_related("dependents")
        .get(pk=participant_id)
    )
    return Response(
        {
            "request": request_item(participant, event_local_date(activity)),
            "going_count": confirmed_people_count(activity),
            "spots_left": spots_left(activity),
        },
        status=status.HTTP_200_OK,
    )


def _locked_request(activity_id, participant_id):
    """Lock the gathering (the same row RSVP locks) and fetch the request under it."""
    activity = Activity.objects.select_for_update().get(pk=activity_id)
    participant = get_object_or_404(
        ActivityParticipant.objects.select_for_update().select_related("user"),
        pk=participant_id,
        activity=activity,
    )
    # A blocked requester is hidden from the host, so their request is not found.
    if participant.user_id in blocked_user_ids(activity.host) or (
        participant.user_id == activity.host_id
    ):
        return activity, None
    return activity, participant


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def approve_request(request, pk, participant_id):
    activity, error = _host_activity_or_error(request, pk)
    if error is not None:
        return error
    with transaction.atomic():
        activity, participant = _locked_request(activity.id, participant_id)
        if participant is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if participant.status == "confirmed":
            return _decision_response(participant.id, activity.id)
        state_error = _decision_state_error(activity)
        if state_error is not None:
            return state_error
        people = participant_people_count(participant)
        already = confirmed_people_count(activity, exclude_user_id=participant.user_id)
        if activity.capacity is not None and already + people > activity.capacity:
            return Response(NOT_ENOUGH_SPOTS_ERROR, status=status.HTTP_409_CONFLICT)
        participant.status = "confirmed"
        participant.decided_at = timezone.now()
        participant.decline_reason = ""
        participant.save(update_fields=["status", "decided_at", "decline_reason"])
        transaction.on_commit(lambda: _notify_decision(participant.id, approved=True))
    return _decision_response(participant.id, activity.id)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def decline_request(request, pk, participant_id):
    activity, error = _host_activity_or_error(request, pk)
    if error is not None:
        return error
    raw_reason = request.data.get("reason", "")
    if raw_reason is None:
        raw_reason = ""
    if not isinstance(raw_reason, str):
        return Response({"reason": "Reason must be text."}, status=status.HTTP_400_BAD_REQUEST)
    reason = raw_reason.strip()
    if len(reason) > MAX_DECLINE_REASON_LENGTH:
        return Response(
            {"reason": f"Reason must be {MAX_DECLINE_REASON_LENGTH} characters or fewer."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    with transaction.atomic():
        activity, participant = _locked_request(activity.id, participant_id)
        if participant is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if participant.status == "declined":
            return _decision_response(participant.id, activity.id)
        if participant.status == "confirmed":
            return Response(
                {"detail": "This request was already approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        state_error = _decision_state_error(activity)
        if state_error is not None:
            return state_error
        participant.status = "declined"
        participant.decided_at = timezone.now()
        participant.decline_reason = reason
        participant.save(update_fields=["status", "decided_at", "decline_reason"])
        transaction.on_commit(
            lambda: _notify_decision(participant.id, approved=False, reason=reason)
        )
    return _decision_response(participant.id, activity.id)


def _notify_decision(participant_id, *, approved, reason=""):
    """Push the requester after the decision commits. Failures never propagate."""
    from users.push_notifications import send_join_request_decision_notification

    participant = (
        ActivityParticipant.objects.select_related("user", "activity")
        .filter(pk=participant_id)
        .first()
    )
    if participant is None:
        return
    try:
        send_join_request_decision_notification(
            participant.activity, participant.user, approved=approved, reason=reason
        )
    except Exception:  # pragma: no cover - defensive; send_push_to_user already logs
        logger.exception("Request decision notification failed participant_id=%s", participant_id)


def notify_host_of_request(activity_id, requester_id):
    """Push the host about a new request after the RSVP commits. Failures never propagate."""
    from users.models import User
    from users.push_notifications import send_join_request_notification

    activity = Activity.objects.select_related("host").filter(pk=activity_id).first()
    requester = User.objects.filter(pk=requester_id).first()
    if activity is None or requester is None:
        return
    try:
        send_join_request_notification(activity, requester)
    except Exception:  # pragma: no cover - defensive; send_push_to_user already logs
        logger.exception("Join request notification failed activity_id=%s", activity_id)
