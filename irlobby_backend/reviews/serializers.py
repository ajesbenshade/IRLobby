from rest_framework import serializers
from .models import Review

class ReviewSerializer(serializers.ModelSerializer):
    reviewer = serializers.StringRelatedField()
    reviewee = serializers.StringRelatedField()
    activity = serializers.StringRelatedField()

    class Meta:
        model = Review
        fields = ('id', 'reviewer', 'reviewee', 'activity', 'rating', 'comment', 'created_at')
        read_only_fields = ('id', 'created_at', 'reviewer')
