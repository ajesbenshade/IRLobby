from rest_framework import serializers

from users.social import blocked_user_ids
from utils.sanitize import strip_html

from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    userId = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()
    message = serializers.CharField(source="text")
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Message
        fields = ("id", "userId", "user", "message", "createdAt")
        read_only_fields = ("id", "createdAt", "userId", "user")

    def validate_message(self, value):
        return strip_html(value)

    def get_userId(self, obj):
        return obj.sender.id

    def get_user(self, obj):
        return {"id": obj.sender.id, "firstName": obj.sender.first_name}


class ConversationSerializer(serializers.ModelSerializer):
    messages = serializers.SerializerMethodField()
    match = serializers.StringRelatedField()
    matchId = serializers.IntegerField(source="match.id", read_only=True)
    activityId = serializers.IntegerField(
        source="match.activity.id", read_only=True, allow_null=True
    )
    otherUserId = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ("id", "match", "matchId", "activityId", "otherUserId", "messages", "created_at")
        read_only_fields = ("id", "created_at")

    def get_messages(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        messages = obj.messages.select_related("sender").order_by("id")
        if user is not None and getattr(user, "is_authenticated", False):
            hidden = blocked_user_ids(user)
            if hidden:
                messages = messages.exclude(sender_id__in=hidden)
        return MessageSerializer(messages, many=True, context=self.context).data

    def get_otherUserId(self, obj):
        request = self.context.get("request")
        if not request or not getattr(request, "user", None):
            return None
        current_user_id = request.user.id
        if obj.match.user_a_id == current_user_id:
            return obj.match.user_b_id
        if obj.match.user_b_id == current_user_id:
            return obj.match.user_a_id
        return None
