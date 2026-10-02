"""1:1 chat endpoints (mounted under /api/messages/direct/)."""

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from moderation.models import AbuseReport, BlockedUser
from users.models import Friendship, User
from users.social import blocked_user_ids, can_direct_message, is_blocked_either_way
from utils.sanitize import strip_html

from .access import (
    can_read_conversation,
    can_send_in_conversation,
    direct_conversation_for,
    other_participant,
    user_state,
)
from .models import Conversation, ConversationUserState, Message
from .throttles import DirectMessageThrottle


def conversation_summary(conversation, user) -> dict:
    other = other_participant(conversation, user)
    last = conversation.messages.order_by("-created_at", "-id").first()
    state = ConversationUserState.objects.filter(conversation=conversation, user=user).first()
    return {
        "id": conversation.id,
        "other_user": {
            "id": other.id,
            "first_name": other.first_name,
            "avatar_url": other.avatar_url,
        },
        "last_message": (
            {
                "id": last.id,
                "message": last.text,
                "userId": last.sender_id,
                "createdAt": last.created_at.isoformat(),
            }
            if last
            else None
        ),
        "muted": bool(state and state.muted),
        "can_send": can_send_in_conversation(user, conversation),
        "created_at": conversation.created_at.isoformat(),
    }


def _direct_or_404(user, conversation_id):
    conversation = get_object_or_404(
        Conversation.objects.select_related("match__activity", "match__user_a", "match__user_b"),
        pk=conversation_id,
        match__activity__isnull=True,
    )
    if not can_read_conversation(user, conversation):
        return None
    return conversation


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([DirectMessageThrottle])
def direct_conversations(request):
    """GET: my 1:1 chats. POST {user_id}: start (or reopen) the chat with that user."""
    user = request.user
    if request.method == "GET":
        hidden = blocked_user_ids(user)
        result = []
        for conversation in (
            Conversation.objects.filter(match__activity__isnull=True)
            .filter(Q(match__user_a=user) | Q(match__user_b=user))
            .select_related("match__user_a", "match__user_b", "match__activity")
            .order_by("-id")
        ):
            if other_participant(conversation, user).id in hidden:
                continue
            if can_read_conversation(user, conversation):
                result.append(conversation_summary(conversation, user))
        return Response({"conversations": result})

    try:
        target_id = int(request.data.get("user_id"))
    except (TypeError, ValueError):
        return Response({"user_id": "Send the user's id."}, status=status.HTTP_400_BAD_REQUEST)
    if target_id == user.id:
        return Response(
            {"detail": "You cannot message yourself."}, status=status.HTTP_400_BAD_REQUEST
        )
    target = User.objects.filter(pk=target_id, is_active=True).first()
    if target is None or is_blocked_either_way(user.id, target.id):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    existing = direct_conversation_for(user, target)
    replying = bool(existing and existing.messages.filter(sender=target).exists())
    if not can_direct_message(user, target, recipient_has_messaged_sender=replying):
        return Response(
            {"detail": "You can only message friends, or people who allow messages from "
                       "gatherings you both attended."},
            status=status.HTTP_403_FORBIDDEN,
        )
    with transaction.atomic():
        conversation = existing or direct_conversation_for(user, target, create=True)
        state = user_state(conversation, user)
        if state.left:
            state.left = False  # starting the chat again brings it back
            state.save(update_fields=["left"])
    created = existing is None
    return Response(
        conversation_summary(conversation, user),
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def direct_mute(request, conversation_id):
    """POST {muted: true|false} (default true). Muted chats send you no push notifications."""
    conversation = _direct_or_404(request.user, conversation_id)
    if conversation is None:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    muted = request.data.get("muted", True)
    if isinstance(muted, str):
        muted = muted.strip().lower() not in {"0", "false", "no"}
    state = user_state(conversation, request.user)
    state.muted = bool(muted)
    state.save(update_fields=["muted"])
    return Response({"id": conversation.id, "muted": state.muted})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def direct_leave(request, conversation_id):
    """Hide the chat for you. It returns only if you start it again from the profile."""
    conversation = _direct_or_404(request.user, conversation_id)
    if conversation is None:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    state = user_state(conversation, request.user)
    state.left = True
    state.save(update_fields=["left"])
    return Response({"id": conversation.id, "left": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def direct_report(request, conversation_id):
    """POST {reason, description?, message_id?} — reports the other person from the thread."""
    conversation = _direct_or_404(request.user, conversation_id)
    if conversation is None:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    reason = (request.data.get("reason") or "other").strip()
    if reason not in dict(AbuseReport.REASON_CHOICES):
        return Response({"reason": "Unknown reason."}, status=status.HTTP_400_BAD_REQUEST)
    other = other_participant(conversation, request.user)
    description = strip_html(str(request.data.get("description") or ""))[:1800]
    message_id = request.data.get("message_id")
    if message_id:
        message = Message.objects.filter(
            pk=message_id, conversation=conversation, sender=other
        ).first()
        if message is None:
            return Response({"message_id": "Message not found."}, status=status.HTTP_400_BAD_REQUEST)
        description = f"{description}\n[Reported message #{message.id}: {message.text[:200]}]".strip()
    report = AbuseReport.objects.create(
        reporter=request.user,
        reported_user=other,
        reason=reason,
        description=f"[1:1 chat {conversation.id}] {description}".strip(),
    )
    return Response({"id": report.id, "status": report.status}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def direct_block(request, conversation_id):
    """Block the other person. Ends the chat for both and removes any friendship."""
    conversation = _direct_or_404(request.user, conversation_id)
    if conversation is None:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    other = other_participant(conversation, request.user)
    BlockedUser.objects.get_or_create(blocker=request.user, blocked=other)
    Friendship.objects.filter(
        Q(requester=request.user, recipient=other) | Q(requester=other, recipient=request.user)
    ).delete()
    return Response({"detail": "User blocked."}, status=status.HTTP_201_CREATED)
