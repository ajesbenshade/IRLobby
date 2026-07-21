from rest_framework import serializers

from utils.sanitize import strip_html

from .models import AbuseReport, BlockedUser


class BlockedUserSerializer(serializers.ModelSerializer):
    blocked_username = serializers.CharField(source="blocked.username", read_only=True)

    class Meta:
        model = BlockedUser
        fields = ("id", "blocked", "blocked_username", "created_at")
        read_only_fields = ("id", "created_at")


class AbuseReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = AbuseReport
        fields = ("id", "reported_user", "reason", "description", "status", "created_at")
        read_only_fields = ("id", "status", "created_at")

    def validate_description(self, value):
        return strip_html(value)
