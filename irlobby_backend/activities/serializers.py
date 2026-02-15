from rest_framework import serializers
from .models import Activity, ActivityParticipant

class ActivitySerializer(serializers.ModelSerializer):
    host = serializers.StringRelatedField(read_only=True)
    participant_count = serializers.SerializerMethodField()
    dateTime = serializers.DateTimeField(source='time', read_only=True)
    endDateTime = serializers.DateTimeField(source='end_time', read_only=True)
    maxParticipants = serializers.IntegerField(source='capacity', read_only=True)
    requiresApproval = serializers.BooleanField(source='requires_approval', read_only=True)
    isPrivate = serializers.BooleanField(source='is_private', read_only=True)
    ageRestriction = serializers.CharField(source='age_restriction', read_only=True)
    skillLevel = serializers.CharField(source='skill_level', read_only=True)
    equipmentProvided = serializers.BooleanField(source='equipment_provided', read_only=True)
    equipmentRequired = serializers.CharField(source='equipment_required', read_only=True)
    weatherDependent = serializers.BooleanField(source='weather_dependent', read_only=True)

    class Meta:
        model = Activity
        fields = (
            'id',
            'host',
            'is_approved',
            'title',
            'description',
            'category',
            'location',
            'latitude',
            'longitude',
            'time',
            'dateTime',
            'end_time',
            'endDateTime',
            'capacity',
            'maxParticipants',
            'visibility',
            'is_private',
            'isPrivate',
            'requires_approval',
            'requiresApproval',
            'price',
            'currency',
            'age_restriction',
            'ageRestriction',
            'skill_level',
            'skillLevel',
            'equipment_provided',
            'equipmentProvided',
            'equipment_required',
            'equipmentRequired',
            'weather_dependent',
            'weatherDependent',
            'tags',
            'images',
            'created_at',
            'participant_count',
        )
        read_only_fields = ('id', 'is_approved', 'created_at')

    def to_internal_value(self, data):
        normalized_data = dict(data)
        aliases = {
            'dateTime': 'time',
            'endDateTime': 'end_time',
            'maxParticipants': 'capacity',
            'requiresApproval': 'requires_approval',
            'isPrivate': 'is_private',
            'ageRestriction': 'age_restriction',
            'skillLevel': 'skill_level',
            'equipmentProvided': 'equipment_provided',
            'equipmentRequired': 'equipment_required',
            'weatherDependent': 'weather_dependent',
            'imageUrls': 'images',
        }

        for alias, normalized in aliases.items():
            if alias in normalized_data and normalized not in normalized_data:
                normalized_data[normalized] = normalized_data[alias]

        if 'visibility' not in normalized_data:
            normalized_data['visibility'] = ['everyone']

        return super().to_internal_value(normalized_data)

    def get_participant_count(self, obj):
        return obj.participants.filter(status='confirmed').count()

class ActivityParticipantSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    activity = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = ActivityParticipant
        fields = ('id', 'activity', 'user', 'status', 'joined_at')
        read_only_fields = ('id', 'joined_at')
