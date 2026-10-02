from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated

from moderation.models import BlockedUser
from users.push_notifications import send_new_message_notification

from .access import can_read_conversation, can_send_in_conversation
from .models import Conversation, Message
from .throttles import DirectMessageThrottle
from .serializers import ConversationSerializer, MessageSerializer


def _user_can_use_conversation(user, conversation) -> bool:
    return can_read_conversation(user, conversation)


class ConversationListView(generics.ListAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        blocked_ids = BlockedUser.objects.filter(blocker=user).values_list("blocked_id", flat=True)
        blocked_by_ids = BlockedUser.objects.filter(blocked=user).values_list(
            "blocker_id", flat=True
        )
        exclude_ids = set(blocked_ids) | set(blocked_by_ids)

        conversations = (
            Conversation.objects.filter(Q(match__user_a=user) | Q(match__user_b=user))
            # 1:1 chats are listed by /api/messages/direct/, not here.
            .filter(match__activity__isnull=False)
            .select_related("match__activity")
            .exclude(match__user_a_id__in=exclude_ids)
            .exclude(match__user_b_id__in=exclude_ids)
        )
        allowed_ids = [
            conversation.id
            for conversation in conversations
            if _user_can_use_conversation(user, conversation)
        ]
        return Conversation.objects.filter(id__in=allowed_ids)


class MessageListView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]
    throttle_classes = [DirectMessageThrottle]

    def get_queryset(self):
        conversation_id = self.kwargs["conversation_id"]
        conversation = get_object_or_404(
            Conversation.objects.select_related("match__activity"), id=conversation_id
        )

        if not _user_can_use_conversation(self.request.user, conversation):
            return Message.objects.none()

        return Message.objects.filter(conversation=conversation).order_by("created_at")

    def perform_create(self, serializer):
        conversation_id = self.kwargs["conversation_id"]
        conversation = get_object_or_404(
            Conversation.objects.select_related("match__activity"), id=conversation_id
        )

        if not can_send_in_conversation(self.request.user, conversation):
            raise serializers.ValidationError(
                "Not authorized to send messages in this conversation"
            )

        message = serializer.save(conversation=conversation, sender=self.request.user)
        send_new_message_notification(message)
