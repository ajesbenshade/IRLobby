from rest_framework import serializers

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
        return {
            "id": obj.sender.id,
            "firstName": obj.sender.first_name,
            "email": obj.sender.email,
            "avatarUrl": obj.sender.avatar_url or "",
        }


class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)
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
