from rest_framework import serializers
from django.db.models import Q
from .models import Review
from users.models import User
from activities.models import Activity
from matches.models import Match

class ReviewSerializer(serializers.ModelSerializer):
    reviewerId = serializers.IntegerField(source='reviewer.id', read_only=True)
    reviewer = serializers.StringRelatedField()
    revieweeId = serializers.PrimaryKeyRelatedField(
        source='reviewee',
        queryset=User.objects.all(),
        write_only=True,
    )
    reviewee = serializers.StringRelatedField()
    activityId = serializers.PrimaryKeyRelatedField(
        source='activity',
        queryset=Activity.objects.all(),
        write_only=True,
    )
    activity = serializers.StringRelatedField()
    revieweePk = serializers.IntegerField(source='reviewee.id', read_only=True)
    activityPk = serializers.IntegerField(source='activity.id', read_only=True)
    comment = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Review
        fields = (
            'id',
            'reviewerId',
            'reviewer',
            'revieweeId',
            'reviewee',
            'revieweePk',
            'activityId',
            'activity',
            'activityPk',
            'rating',
            'comment',
            'created_at',
        )
        read_only_fields = ('id', 'created_at', 'reviewer')

    def validate(self, attrs):
        request = self.context.get('request')
        reviewer = getattr(request, 'user', None)
        reviewee = attrs.get('reviewee')
        activity = attrs.get('activity')

        if not reviewer or not reviewer.is_authenticated:
            raise serializers.ValidationError('Authentication required to submit a review.')

        if reviewee and reviewer.id == reviewee.id:
            raise serializers.ValidationError('You cannot review yourself.')

        if reviewee and activity:
            match_exists = Match.objects.filter(activity=activity).filter(
                Q(user_a=reviewer, user_b=reviewee)
                | Q(user_a=reviewee, user_b=reviewer)
            ).exists()

            if not match_exists:
                raise serializers.ValidationError(
                    'You can only review users you matched with for this activity.'
                )

        return attrs
