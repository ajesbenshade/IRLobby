from django.utils import timezone
from rest_framework import serializers

from users.reliability import build_reliability_summary

from .models import Match


class MatchSerializer(serializers.ModelSerializer):
    user_a_id = serializers.IntegerField(source="user_a.id", read_only=True)
    user_a = serializers.StringRelatedField()
    user_a_reliability = serializers.SerializerMethodField()
    user_b_id = serializers.IntegerField(source="user_b.id", read_only=True)
    user_b = serializers.StringRelatedField()
    user_b_reliability = serializers.SerializerMethodField()
    activity_id = serializers.IntegerField(source="activity.id", read_only=True, allow_null=True)
    activity = serializers.StringRelatedField()
    activity_time = serializers.DateTimeField(
        source="activity.time", read_only=True, allow_null=True
    )
    activity_end_time = serializers.DateTimeField(
        source="activity.end_time", read_only=True, allow_null=True
    )
    review_available = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = (
            "id",
            "activity_id",
            "activity",
            "user_a_id",
            "user_a",
            "user_a_reliability",
            "user_b_id",
            "user_b",
            "user_b_reliability",
            "activity_time",
            "activity_end_time",
            "review_available",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def get_user_a_reliability(self, obj):
        return build_reliability_summary(obj.user_a)

    def get_user_b_reliability(self, obj):
        return build_reliability_summary(obj.user_b)

    def get_review_available(self, obj):
        if not obj.activity:
            return False
        feedback_time = obj.activity.end_time or obj.activity.time
        return bool(feedback_time and feedback_time <= timezone.now())
