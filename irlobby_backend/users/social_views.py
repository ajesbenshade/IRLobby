"""Profile cards, reports, and friends for The Foyer.

Rules live in users/social.py. Nothing here returns location, family, birth date,
username, or (unless the owner allowed it) email or phone.
"""

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from moderation.models import AbuseReport
from utils.sanitize import strip_html

from .models import Friendship, User
from .social import (
    blocked_user_ids,
    can_send_friend_request,
    can_view_profile,
    friend_ids,
    friendship_between,
    friendship_state,
    is_blocked_either_way,
    is_minor,
    level_allows,
)
from .throttles import FriendRequestThrottle

BIO_PREVIEW_LENGTH = 160


def _card(user) -> dict:
    """Smallest identity shown in lists and requests."""
    return {"id": user.id, "first_name": user.first_name, "avatar_url": user.avatar_url}


def _other_user_404(viewer, user_id):
    other = get_object_or_404(User.objects.filter(is_active=True), pk=user_id)
    if other.id != viewer.id and is_blocked_either_way(viewer.id, other.id):
        # Same answer as a missing user, so a block cannot be probed.
        from django.http import Http404

        raise Http404
    return other


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_profile_card(request, user_id):
    """GET /api/users/<id>/profile/ — what the viewer may see of someone else.

    Full card when the owner's visibility level includes the viewer (minors: accepted
    friends only). A viewer who could still send a friend request (shared event, same
    church, public) gets a limited card — id, first_name, friendship, visible=false —
    so the request can be made. Everyone else, and blocked pairs, get 404.
    """
    viewer = request.user
    owner = _other_user_404(viewer, user_id)
    state = friendship_state(viewer, owner)
    if owner.id == viewer.id:
        return Response(
            {
                **_card(owner),
                "bio": owner.bio[:BIO_PREVIEW_LENGTH],
                "friendship": state,
                "visible": True,
                "email": owner.email,
                "phone": owner.phone,
            }
        )
    if not can_view_profile(viewer, owner):
        reachable = state in {"pending_incoming", "pending_outgoing"} or can_send_friend_request(
            viewer, owner
        )
        if not reachable or is_minor(owner):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            {"id": owner.id, "first_name": owner.first_name, "friendship": state, "visible": False}
        )
    body = {
        **_card(owner),
        "bio": owner.bio[:BIO_PREVIEW_LENGTH],
        "friendship": state,
        "visible": True,
    }
    # Contact details need the toggle AND a viewer inside the owner's level. (Minors can only
    # be seen by friends, who are inside every level.)
    if level_allows(viewer, owner):
        if owner.show_email and owner.email:
            body["email"] = owner.email
        if owner.show_phone and owner.phone:
            body["phone"] = owner.phone
    return Response(body)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def report_user(request, user_id):
    """POST /api/users/<id>/report/ {reason, description?} — files an AbuseReport."""
    target = get_object_or_404(User, pk=user_id)
    if target.id == request.user.id:
        return Response(
            {"detail": "You cannot report yourself."}, status=status.HTTP_400_BAD_REQUEST
        )
    reason = (request.data.get("reason") or "other").strip()
    if reason not in dict(AbuseReport.REASON_CHOICES):
        return Response({"reason": "Unknown reason."}, status=status.HTTP_400_BAD_REQUEST)
    report = AbuseReport.objects.create(
        reporter=request.user,
        reported_user=target,
        reason=reason,
        description=strip_html(str(request.data.get("description") or ""))[:2000],
    )
    return Response({"id": report.id, "status": report.status}, status=status.HTTP_201_CREATED)


# ---- Friends -------------------------------------------------------------------------


def _request_payload(row, viewer) -> dict:
    outgoing = row.requester_id == viewer.id
    other = row.recipient if outgoing else row.requester
    return {
        "id": row.id,
        "direction": "outgoing" if outgoing else "incoming",
        "status": "pending" if row.status == "declined" and outgoing else row.status,
        "user": _card(other),
        "created_at": row.created_at.isoformat(),
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([FriendRequestThrottle])
def friend_requests(request):
    """POST {user_id} sends a request. GET returns {incoming: [...], outgoing: [...]}."""
    viewer = request.user
    if request.method == "GET":
        hidden = blocked_user_ids(viewer)
        rows = (
            Friendship.objects.filter(status="pending")
            .filter(Q(requester=viewer) | Q(recipient=viewer))
            .exclude(requester_id__in=hidden)
            .exclude(recipient_id__in=hidden)
            .select_related("requester", "recipient")
        )
        payloads = [_request_payload(row, viewer) for row in rows]
        return Response(
            {
                "incoming": [p for p in payloads if p["direction"] == "incoming"],
                "outgoing": [p for p in payloads if p["direction"] == "outgoing"],
            }
        )
    return _send_friend_request(request)


def _send_friend_request(request):
    viewer = request.user
    try:
        target_id = int(request.data.get("user_id"))
    except (TypeError, ValueError):
        return Response({"user_id": "Send the user's id."}, status=status.HTTP_400_BAD_REQUEST)
    if target_id == viewer.id:
        return Response(
            {"detail": "You cannot friend yourself."}, status=status.HTTP_400_BAD_REQUEST
        )
    target = User.objects.filter(pk=target_id, is_active=True).first()
    # Blocked and unknown users look identical.
    if target is None or is_blocked_either_way(viewer.id, target.id):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    existing = friendship_between(viewer, target)
    if existing is None and not can_send_friend_request(viewer, target):
        return Response(
            {"detail": "You can only add people you have met at a gathering, your church, or public profiles."},
            status=status.HTTP_403_FORBIDDEN,
        )

    with transaction.atomic():
        row = friendship_between(viewer, target)
        if row is None:
            row = Friendship.objects.create(requester=viewer, recipient=target)
            return Response(_request_payload(row, viewer), status=status.HTTP_201_CREATED)
        if row.status == "accepted":
            return Response({"detail": "You are already friends."}, status=status.HTTP_409_CONFLICT)
        if row.requester_id == viewer.id:
            # Already pending, or declined (a decline is never revealed to the requester).
            return Response(_request_payload(row, viewer), status=status.HTTP_200_OK)
        if row.status == "pending":
            # They already asked us: sending a request back is the same as accepting.
            row.status = "accepted"
            row.responded_at = timezone.now()
            row.save(update_fields=["status", "responded_at"])
            return Response({**_request_payload(row, viewer), "status": "accepted"})
        # They declined an earlier request from us; now we ask them. Reopen it.
        row.requester, row.recipient = viewer, target
        row.status, row.responded_at = "pending", None
        row.save(update_fields=["requester", "recipient", "status", "responded_at"])
        return Response(_request_payload(row, viewer), status=status.HTTP_201_CREATED)


def _respond(request, request_id, new_status):
    with transaction.atomic():
        row = (
            Friendship.objects.select_for_update()
            .filter(pk=request_id, recipient=request.user, status="pending")
            .first()
        )
        if row is None or is_blocked_either_way(row.requester_id, row.recipient_id):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        row.status = new_status
        row.responded_at = timezone.now()
        row.save(update_fields=["status", "responded_at"])
    return Response({"id": row.id, "status": row.status})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accept_friend_request(request, request_id):
    return _respond(request, request_id, "accepted")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def decline_friend_request(request, request_id):
    return _respond(request, request_id, "declined")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def friend_list(request):
    viewer = request.user
    ids = friend_ids(viewer) - blocked_user_ids(viewer)
    rows = Friendship.objects.filter(status="accepted").filter(
        Q(requester=viewer, recipient_id__in=ids) | Q(recipient=viewer, requester_id__in=ids)
    )
    since = {}
    for row in rows:
        since[row.recipient_id if row.requester_id == viewer.id else row.requester_id] = (
            row.responded_at or row.created_at
        )
    users = User.objects.filter(id__in=ids).order_by("first_name", "id")
    return Response(
        {
            "friends": [
                {
                    "user_id": u.id,
                    "first_name": u.first_name,
                    "avatar_url": u.avatar_url,
                    "since": since[u.id].isoformat(),
                }
                for u in users
            ]
        }
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def friend_remove(request, user_id):
    """Unfriend, or withdraw your own pending request. 404 when there is nothing to remove."""
    row = friendship_between(request.user, get_object_or_404(User, pk=user_id))
    removable = row is not None and (
        row.status == "accepted" or (row.status == "pending" and row.requester_id == request.user.id)
    )
    if not removable:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    row.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
