"""Report content inside a gathering: a chat message, a photo, the gathering, a request."""

from __future__ import annotations

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from activities.access import is_activity_host, user_can_access_activity_chat
from activities.models import Activity, ActivityParticipant, EventPhoto
from chat.models import Message
from users.social import blocked_user_ids

from .reporting import file_report


def _visible_activity(user, pk):
    """The same visibility as the activity detail endpoint: approved, own, or staff."""
    visible = Activity.objects.all()
    if not user.is_staff:
        visible = Activity.objects.filter(Q(is_approved=True) | Q(host=user))
    return get_object_or_404(visible.select_related("host").distinct(), pk=pk)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def report_chat_message(request, pk, message_id):
    """POST {reason?, description?}: report a message in this gathering's chat."""
    activity = _visible_activity(request.user, pk)
    if not (request.user.is_staff or user_can_access_activity_chat(request.user, activity)):
        return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
    message = get_object_or_404(
        Message.objects.select_related("sender"),
        pk=message_id,
        conversation__match__activity=activity,
    )
    # Messages from someone blocked either way are hidden, so they are not found here.
    if message.sender_id in blocked_user_ids(request.user):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    return file_report(
        request,
        target_type="chat_message",
        target_id=message.id,
        reported_user=message.sender,
        snapshot=message.text,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def report_event_photo(request, pk, photo_id):
    """POST {reason?, description?}: report a photo on a gathering you can see."""
    activity = _visible_activity(request.user, pk)
    photo = get_object_or_404(
        EventPhoto.objects.select_related("uploaded_by"), pk=photo_id, activity=activity
    )
    return file_report(
        request,
        target_type="event_photo",
        target_id=photo.id,
        # Only the host uploads photos; older photos have no recorded uploader.
        reported_user=photo.uploaded_by or activity.host,
        snapshot=photo.image.name if photo.image else f"Photo {photo.id}",
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def report_activity(request, pk):
    """POST {reason?, description?}: report a gathering (reported user is its host)."""
    activity = _visible_activity(request.user, pk)
    if activity.host_id in blocked_user_ids(request.user):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    return file_report(
        request,
        target_type="activity",
        target_id=activity.id,
        reported_user=activity.host,
        snapshot=f"{activity.title}: {activity.description}",
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def report_join_request(request, pk, request_id):
    """POST {reason?, description?}: the host reports a requester's card."""
    user = request.user
    activity = _visible_activity(user, pk)
    if not (user.is_staff or is_activity_host(user, activity)):
        return Response(
            {"detail": "Only the host can report a request."}, status=status.HTTP_403_FORBIDDEN
        )
    participant = get_object_or_404(
        ActivityParticipant.objects.select_related("user"), pk=request_id, activity=activity
    )
    if participant.user_id in blocked_user_ids(activity.host):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    requester = participant.user
    return file_report(
        request,
        target_type="join_request",
        target_id=participant.id,
        reported_user=requester,
        snapshot=f"{requester.first_name}: {requester.bio}",
    )
