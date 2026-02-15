from rest_framework import generics, status, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer
from users.push_notifications import send_new_message_notification

class ConversationListView(generics.ListAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(
            match__user_a=user) | Conversation.objects.filter(match__user_b=user)

class MessageListView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        conversation_id = self.kwargs['conversation_id']
        conversation = get_object_or_404(Conversation, id=conversation_id)

        # Check if user is part of this conversation
        if self.request.user not in [conversation.match.user_a, conversation.match.user_b]:
            return Message.objects.none()

        return Message.objects.filter(conversation=conversation).order_by('created_at')

    def perform_create(self, serializer):
        conversation_id = self.kwargs['conversation_id']
        conversation = get_object_or_404(Conversation, id=conversation_id)

        # Check if user is part of this conversation
        if self.request.user not in [conversation.match.user_a, conversation.match.user_b]:
            raise serializers.ValidationError("Not authorized to send messages in this conversation")

        message = serializer.save(conversation=conversation, sender=self.request.user)
        send_new_message_notification(message)
