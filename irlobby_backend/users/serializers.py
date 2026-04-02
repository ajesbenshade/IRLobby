from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import serializers

from .models import Invite, PushDeviceToken, User


class UserSerializer(serializers.ModelSerializer):
    firstName = serializers.CharField(source="first_name", read_only=True)
    lastName = serializers.CharField(source="last_name", read_only=True)
    avatarUrl = serializers.CharField(source="avatar_url", read_only=True)
    city = serializers.CharField(source="location", read_only=True)
    interests = serializers.SerializerMethodField()
    ageRange = serializers.SerializerMethodField()
    activityPreferences = serializers.SerializerMethodField()
    photoAlbum = serializers.SerializerMethodField()
    onboardingCompleted = serializers.SerializerMethodField()
    termsAccepted = serializers.SerializerMethodField()
    privacyAccepted = serializers.SerializerMethodField()
    legalAccepted = serializers.SerializerMethodField()
    termsAcceptedAt = serializers.DateTimeField(source="terms_accepted_at", read_only=True)
    privacyAcceptedAt = serializers.DateTimeField(source="privacy_accepted_at", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "firstName",
            "lastName",
            "bio",
            "avatar_url",
            "avatarUrl",
            "location",
            "city",
            "preferences",
            "interests",
            "ageRange",
            "activityPreferences",
            "photoAlbum",
            "onboardingCompleted",
            "termsAccepted",
            "privacyAccepted",
            "legalAccepted",
            "termsAcceptedAt",
            "privacyAcceptedAt",
            "latitude",
            "longitude",
        )
        read_only_fields = ("id",)

    def get_interests(self, obj):
        return (obj.preferences or {}).get("interests", [])

    def get_ageRange(self, obj):
        return (obj.preferences or {}).get("age_range")

    def get_activityPreferences(self, obj):
        return (obj.preferences or {}).get("activity_preferences", {})

    def get_photoAlbum(self, obj):
        return (obj.preferences or {}).get("photo_album", [])

    def get_onboardingCompleted(self, obj):
        return bool((obj.preferences or {}).get("onboarding_completed", False))

    def get_termsAccepted(self, obj):
        return bool(obj.terms_accepted_at)

    def get_privacyAccepted(self, obj):
        return bool(obj.privacy_accepted_at)

    def get_legalAccepted(self, obj):
        return bool(obj.terms_accepted_at and obj.privacy_accepted_at)


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("username", "email", "password", "password_confirm", "first_name", "last_name")

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError("Passwords don't match")
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        user = User.objects.create_user(**validated_data)
        return user


class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        try:
            user_obj = User.objects.filter(email=email).first()
            if not user_obj:
                raise serializers.ValidationError("Invalid credentials")
            user = authenticate(username=user_obj.username, password=password)
        except Exception:
            raise serializers.ValidationError("Invalid credentials")

        if not user:
            raise serializers.ValidationError("Invalid credentials")

        attrs["user"] = user
        return attrs


class UserOnboardingSerializer(serializers.Serializer):
    bio = serializers.CharField(required=False, allow_blank=True, max_length=500)
    avatar_url = serializers.CharField(required=False, allow_blank=True)
    city = serializers.CharField(required=False, allow_blank=True, max_length=255)
    interests = serializers.ListField(
        child=serializers.CharField(max_length=50), required=False, allow_empty=True
    )
    age_range = serializers.CharField(required=False, allow_blank=True, max_length=32)
    activity_preferences = serializers.DictField(required=False)
    photo_album = serializers.ListField(
        child=serializers.CharField(), required=False, allow_empty=True
    )
    terms_accepted = serializers.BooleanField(required=False)
    privacy_accepted = serializers.BooleanField(required=False)
    onboarding_completed = serializers.BooleanField(required=False)

    def to_internal_value(self, data):
        normalized_data = dict(data)
        key_aliases = {
            "avatarUrl": "avatar_url",
            "ageRange": "age_range",
            "activityPreferences": "activity_preferences",
            "photoAlbum": "photo_album",
            "termsAccepted": "terms_accepted",
            "privacyAccepted": "privacy_accepted",
            "onboardingCompleted": "onboarding_completed",
        }
        for alias, normalized in key_aliases.items():
            if alias in normalized_data and normalized not in normalized_data:
                normalized_data[normalized] = normalized_data[alias]
        return super().to_internal_value(normalized_data)

    def validate(self, attrs):
        if not attrs.get("onboarding_completed"):
            return attrs

        instance = getattr(self, "instance", None)
        preferences = dict(instance.preferences or {}) if instance else {}

        bio = (attrs.get("bio", instance.bio if instance else "") or "").strip()
        city = (attrs.get("city", instance.location if instance else "") or "").strip()
        avatar_url = (
            attrs.get("avatar_url", instance.avatar_url if instance else "") or ""
        ).strip()
        interests = attrs.get("interests", preferences.get("interests", []))
        activity_preferences = attrs.get(
            "activity_preferences", preferences.get("activity_preferences", {})
        )

        terms_accepted = self._is_acceptance_satisfied(
            instance=instance,
            accepted_in_request=attrs.get("terms_accepted"),
            timestamp_attr="terms_accepted_at",
        )
        privacy_accepted = self._is_acceptance_satisfied(
            instance=instance,
            accepted_in_request=attrs.get("privacy_accepted"),
            timestamp_attr="privacy_accepted_at",
        )

        has_preferences = bool(interests) or any(
            bool(value) for value in (activity_preferences or {}).values()
        )

        if bio and city and avatar_url and has_preferences and terms_accepted and privacy_accepted:
            return attrs

        raise serializers.ValidationError(
            {
                "detail": (
                    "Complete your bio, city, profile photo, interests or activity preferences, "
                    "and accept the terms and privacy policy before finishing onboarding."
                )
            }
        )

    def _is_acceptance_satisfied(self, instance, accepted_in_request, timestamp_attr):
        existing_timestamp = getattr(instance, timestamp_attr, None) if instance else None
        return bool(existing_timestamp or accepted_in_request)

    def validate_interests(self, value):
        cleaned = [
            interest.strip() for interest in value if isinstance(interest, str) and interest.strip()
        ]
        if len(cleaned) > 20:
            raise serializers.ValidationError("Maximum 20 interests allowed.")
        return cleaned

    def validate_photo_album(self, value):
        if len(value) > 12:
            raise serializers.ValidationError("Maximum 12 photos allowed.")
        return value

    def update(self, instance, validated_data):
        preferences = dict(instance.preferences or {})
        accepted_at = timezone.now()

        if "bio" in validated_data:
            instance.bio = validated_data["bio"]
        if "avatar_url" in validated_data:
            instance.avatar_url = validated_data["avatar_url"]
        if "city" in validated_data:
            instance.location = validated_data["city"]
        if "interests" in validated_data:
            preferences["interests"] = validated_data["interests"]
        if "age_range" in validated_data:
            preferences["age_range"] = validated_data["age_range"]
        if "activity_preferences" in validated_data:
            preferences["activity_preferences"] = validated_data["activity_preferences"]
        if "photo_album" in validated_data:
            preferences["photo_album"] = validated_data["photo_album"]
        if validated_data.get("terms_accepted") and not instance.terms_accepted_at:
            instance.terms_accepted_at = accepted_at
        if validated_data.get("privacy_accepted") and not instance.privacy_accepted_at:
            instance.privacy_accepted_at = accepted_at
        if "onboarding_completed" in validated_data:
            preferences["onboarding_completed"] = validated_data["onboarding_completed"]

        instance.preferences = preferences
        instance.save()
        return instance

    def create(self, validated_data):
        raise NotImplementedError("Use update() with an existing user instance.")

    def to_representation(self, instance):
        preferences = instance.preferences or {}
        return {
            "bio": instance.bio or "",
            "avatar_url": instance.avatar_url or "",
            "city": instance.location or "",
            "interests": preferences.get("interests", []),
            "age_range": preferences.get("age_range", ""),
            "activity_preferences": preferences.get("activity_preferences", {}),
            "photo_album": preferences.get("photo_album", []),
            "terms_accepted": bool(instance.terms_accepted_at),
            "privacy_accepted": bool(instance.privacy_accepted_at),
            "legal_accepted": bool(instance.terms_accepted_at and instance.privacy_accepted_at),
            "terms_accepted_at": instance.terms_accepted_at,
            "privacy_accepted_at": instance.privacy_accepted_at,
            "onboarding_completed": bool(preferences.get("onboarding_completed", False)),
            "avatarUrl": instance.avatar_url or "",
            "ageRange": preferences.get("age_range", ""),
            "activityPreferences": preferences.get("activity_preferences", {}),
            "photoAlbum": preferences.get("photo_album", []),
            "termsAccepted": bool(instance.terms_accepted_at),
            "privacyAccepted": bool(instance.privacy_accepted_at),
            "legalAccepted": bool(instance.terms_accepted_at and instance.privacy_accepted_at),
            "termsAcceptedAt": instance.terms_accepted_at,
            "privacyAcceptedAt": instance.privacy_accepted_at,
            "onboardingCompleted": bool(preferences.get("onboarding_completed", False)),
        }


class InviteCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invite
        fields = ("contact_name", "contact_value", "channel")


class InviteSerializer(serializers.ModelSerializer):
    inviter_name = serializers.SerializerMethodField()

    class Meta:
        model = Invite
        fields = (
            "id",
            "contact_name",
            "contact_value",
            "channel",
            "token",
            "status",
            "created_at",
            "accepted_at",
            "inviter_name",
        )
        read_only_fields = fields

    def get_inviter_name(self, obj):
        return f"{obj.inviter.first_name} {obj.inviter.last_name}".strip() or obj.inviter.username


class PushDeviceTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushDeviceToken
        fields = ("id", "token", "platform", "device_id", "is_active", "last_seen_at", "created_at")
        read_only_fields = fields


class PushDeviceTokenUpsertSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=255)
    platform = serializers.ChoiceField(
        choices=[choice[0] for choice in PushDeviceToken.PLATFORM_CHOICES],
        default="unknown",
    )
    device_id = serializers.CharField(required=False, allow_blank=True, max_length=255)
