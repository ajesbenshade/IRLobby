from rest_framework import serializers
from .models import Conversation, Message

class MessageSerializer(serializers.ModelSerializer):
    userId = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()
    message = serializers.CharField(source='text')
    createdAt = serializers.DateTimeField(source='created_at')

    class Meta:
        model = Message
        fields = ('id', 'userId', 'user', 'message', 'createdAt')
        read_only_fields = ('id', 'createdAt', 'userId', 'user')

    def get_userId(self, obj):
        return obj.sender.id

    def get_user(self, obj):
        return {
            'id': obj.sender.id,
            'firstName': obj.sender.first_name,
            'email': obj.sender.email
        }

class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)
    match = serializers.StringRelatedField()

    class Meta:
        model = Conversation
        fields = ('id', 'match', 'messages', 'created_at')
        read_only_fields = ('id', 'created_at')
