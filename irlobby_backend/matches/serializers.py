from rest_framework import serializers
from .models import Match

class MatchSerializer(serializers.ModelSerializer):
    user_a = serializers.StringRelatedField()
    user_b = serializers.StringRelatedField()
    activity = serializers.StringRelatedField()

    class Meta:
        model = Match
        fields = ('id', 'activity', 'user_a', 'user_b', 'created_at')
        read_only_fields = ('id', 'created_at')
