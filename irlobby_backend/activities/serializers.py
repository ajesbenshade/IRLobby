from rest_framework import serializers
from .models import Activity, ActivityParticipant

class ActivitySerializer(serializers.ModelSerializer):
    host = serializers.StringRelatedField(read_only=True)
    participant_count = serializers.SerializerMethodField()

    class Meta:
        model = Activity
    fields = ('id', 'host', 'title', 'description', 'location', 'latitude', 'longitude', 'time', 'capacity', 'auto_approve', 'tags', 'images', 'created_at', 'participant_count')
        read_only_fields = ('id', 'created_at')

    def get_participant_count(self, obj):
        return obj.participants.filter(status='confirmed').count()

class ActivityParticipantSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    activity = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = ActivityParticipant
        fields = ('id', 'activity', 'user', 'status', 'joined_at')
        read_only_fields = ('id', 'joined_at')
