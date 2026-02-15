from rest_framework import serializers
from .models import Match

class MatchSerializer(serializers.ModelSerializer):
    user_a_id = serializers.IntegerField(source='user_a.id', read_only=True)
    user_a = serializers.StringRelatedField()
    user_b_id = serializers.IntegerField(source='user_b.id', read_only=True)
    user_b = serializers.StringRelatedField()
    activity_id = serializers.IntegerField(source='activity.id', read_only=True, allow_null=True)
    activity = serializers.StringRelatedField()

    class Meta:
        model = Match
        fields = (
            'id',
            'activity_id',
            'activity',
            'user_a_id',
            'user_a',
            'user_b_id',
            'user_b',
            'created_at',
        )
        read_only_fields = ('id', 'created_at')
