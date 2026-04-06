from django.db.models import Q
from django.shortcuts import get_object_or_404
from moderation.models import BlockedUser
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated
from users.push_notifications import send_new_message_notification

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer


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

        return (
            Conversation.objects.filter(Q(match__user_a=user) | Q(match__user_b=user))
            .exclude(match__user_a_id__in=exclude_ids)
            .exclude(match__user_b_id__in=exclude_ids)
        )


class MessageListView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        conversation_id = self.kwargs["conversation_id"]
        conversation = get_object_or_404(Conversation, id=conversation_id)

        # Check if user is part of this conversation
        if self.request.user not in [conversation.match.user_a, conversation.match.user_b]:
            return Message.objects.none()

        return Message.objects.filter(conversation=conversation).order_by("created_at")

    def perform_create(self, serializer):
        conversation_id = self.kwargs["conversation_id"]
        conversation = get_object_or_404(Conversation, id=conversation_id)

        # Check if user is part of this conversation
        if self.request.user not in [conversation.match.user_a, conversation.match.user_b]:
            raise serializers.ValidationError(
                "Not authorized to send messages in this conversation"
            )

        message = serializer.save(conversation=conversation, sender=self.request.user)
        send_new_message_notification(message)
