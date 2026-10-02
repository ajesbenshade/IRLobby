from django.conf import settings
from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import serializers

from activities.household_rules import (
    MINOR_DEPENDENT_ACCOUNT_ERROR,
    account_age_error,
    dependent_blocks_minor_account,
)
from activities.models import Church
from utils.media import validate_image_reference, validate_image_reference_list
from utils.sanitize import strip_html

from .models import Invite, PushDeviceToken, User
from .reliability import build_reliability_summary


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
    reliability = serializers.SerializerMethodField()
    swipes_remaining_today = serializers.SerializerMethodField()
    swipesRemainingToday = serializers.SerializerMethodField()
    stripeConnectAccountId = serializers.CharField(
        source="stripe_connect_account_id", read_only=True
    )
    stripeConnectPayoutsEnabled = serializers.BooleanField(
        source="stripe_connect_payouts_enabled", read_only=True
    )
    stripeConnectDetailsSubmitted = serializers.BooleanField(
        source="stripe_connect_details_submitted", read_only=True
    )
    canSellTickets = serializers.SerializerMethodField()
    church = serializers.SerializerMethodField()
    church_id = serializers.PrimaryKeyRelatedField(
        source="church",
        queryset=Church.objects.all(),
        required=False,
        allow_null=True,
    )
    is_church_admin = serializers.SerializerMethodField()
    household_child_count = serializers.SerializerMethodField()
    phone = serializers.CharField(required=False, allow_blank=True, max_length=32)

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
            "reliability",
            "swipes_remaining_today",
            "swipesRemainingToday",
            "stripeConnectAccountId",
            "stripeConnectPayoutsEnabled",
            "stripeConnectDetailsSubmitted",
            "canSellTickets",
            "date_of_birth",
            "sex",
            "church",
            "church_id",
            "is_church_admin",
            "household_child_count",
            "profile_visibility",
            "phone",
            "show_email",
            "show_phone",
            "dm_from_shared_events",
        )
        read_only_fields = ("id",)

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            normalized = data.copy()
        else:
            normalized = dict(data)
        aliases = {
            "birthDate": "date_of_birth",
            "birth_date": "date_of_birth",
            "churchId": "church_id",
        }
        for alias, name in aliases.items():
            if alias in normalized and name not in normalized:
                normalized[name] = normalized[alias]
        if isinstance(normalized.get("sex"), str):
            normalized["sex"] = normalized["sex"].strip().lower()
        return super().to_internal_value(normalized)

    def validate_date_of_birth(self, value):
        error = account_age_error(value)
        if error:
            raise serializers.ValidationError(error)
        return value

    def validate_sex(self, value):
        if value in (None, ""):
            return ""
        normalized = value.strip().lower()
        if normalized not in {"male", "female"}:
            raise serializers.ValidationError("Sex must be male or female.")
        return normalized

    def validate_phone(self, value):
        from .social import normalize_phone

        try:
            return normalize_phone(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate(self, attrs):
        dob = attrs.get("date_of_birth", getattr(self.instance, "date_of_birth", None))
        if dob is not None and ("date_of_birth" in attrs or self.instance is None):
            first = attrs.get("first_name", getattr(self.instance, "first_name", ""))
            last = attrs.get("last_name", getattr(self.instance, "last_name", ""))
            username = attrs.get("username", getattr(self.instance, "username", ""))
            if dependent_blocks_minor_account(
                first_name=first, last_name=last, username=username, date_of_birth=dob
            ):
                raise serializers.ValidationError({"date_of_birth": MINOR_DEPENDENT_ACCOUNT_ERROR})
        return attrs

    def get_church(self, obj):
        church = obj.church
        if church is None:
            return None
        return {"id": church.id, "name": church.name, "is_verified": church.is_verified}

    def get_is_church_admin(self, obj):
        from activities.access import is_church_admin

        return is_church_admin(obj)

    def get_household_child_count(self, obj):
        return obj.household_dependents.count()

    def get_canSellTickets(self, obj):
        from .stripe_connect import host_can_receive_payouts

        return host_can_receive_payouts(obj)

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

    def get_reliability(self, obj):
        return build_reliability_summary(obj)

    def get_swipes_remaining_today(self, obj):
        from swipes.throttles import get_swipes_remaining_today

        return get_swipes_remaining_today(obj)

    def get_swipesRemainingToday(self, obj):
        return self.get_swipes_remaining_today(obj)


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    sex = serializers.CharField(required=False, allow_blank=True)
    terms_accepted = serializers.BooleanField(write_only=True, required=False, default=False)
    privacy_accepted = serializers.BooleanField(write_only=True, required=False, default=False)
    terms_version = serializers.CharField(
        write_only=True, required=False, allow_blank=True, max_length=32
    )
    privacy_version = serializers.CharField(
        write_only=True, required=False, allow_blank=True, max_length=32
    )

    class Meta:
        model = User
        fields = (
            "username",
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
            "date_of_birth",
            "sex",
            "terms_accepted",
            "privacy_accepted",
            "terms_version",
            "privacy_version",
        )

    def to_internal_value(self, data):
        # Accept camelCase acceptance flags from the mobile client.
        data = data.copy() if hasattr(data, "copy") else dict(data)
        for camel, snake in (
            ("termsAccepted", "terms_accepted"),
            ("privacyAccepted", "privacy_accepted"),
            ("termsVersion", "terms_version"),
            ("privacyVersion", "privacy_version"),
        ):
            if camel in data and snake not in data:
                data[snake] = data[camel]
        return super().to_internal_value(data)

    def validate_date_of_birth(self, value):
        error = account_age_error(value)
        if error:
            raise serializers.ValidationError(error)
        return value

    def validate_sex(self, value):
        if not value:
            return ""
        normalized = value.strip().lower()
        if normalized not in {"male", "female"}:
            raise serializers.ValidationError("Sex must be male or female.")
        return normalized

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError("Passwords don't match")
        dob = attrs.get("date_of_birth")
        if dob is not None and dependent_blocks_minor_account(
            first_name=attrs.get("first_name", ""),
            last_name=attrs.get("last_name", ""),
            username=attrs.get("username", ""),
            date_of_birth=dob,
        ):
            raise serializers.ValidationError({"date_of_birth": MINOR_DEPENDENT_ACCOUNT_ERROR})
        if getattr(settings, "REQUIRE_TERMS_ON_REGISTER", False):
            errors = {}
            if not attrs.get("terms_accepted"):
                errors["terms_accepted"] = "You must accept the Terms of Use to create an account."
            if not attrs.get("privacy_accepted"):
                errors["privacy_accepted"] = (
                    "You must accept the Privacy Policy to create an account."
                )
            if errors:
                raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        acceptance = {
            key: validated_data.pop(key, default)
            for key, default in (
                ("terms_accepted", False),
                ("privacy_accepted", False),
                ("terms_version", ""),
                ("privacy_version", ""),
            )
        }
        user = User.objects.create_user(**validated_data)
        from .social_auth import stamp_legal_acceptance

        stamp_legal_acceptance(user, **acceptance)
        return user


class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")
        request = self.context.get("request")
        auth_request = getattr(request, "_request", request)

        try:
            user_obj = User.objects.filter(email=email).first()
            username = user_obj.username if user_obj else email
            user = authenticate(
                request=auth_request,
                username=username,
                password=password,
                email=email,
            )
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

    def validate_bio(self, value):
        return strip_html(value)

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

        has_preferences = self._has_onboarding_preferences(
            interests=interests,
            activity_preferences=activity_preferences,
        )

        missing = []
        if not has_preferences:
            missing.append("choose interests or activity preferences (or skip the vibe quiz)")
        if not terms_accepted:
            missing.append("accept the terms of service")
        if not privacy_accepted:
            missing.append("accept the privacy policy")

        if not missing:
            return attrs

        raise serializers.ValidationError(
            {"detail": ("Before finishing onboarding, please " + ", ".join(missing) + ".")}
        )

    def _has_onboarding_preferences(self, interests, activity_preferences) -> bool:
        if interests:
            return True

        preferences = activity_preferences or {}
        if not isinstance(preferences, dict):
            return bool(preferences)

        for value in preferences.values():
            if isinstance(value, dict):
                if value.get("vibeQuizSkipped") or any(bool(item) for item in value.values()):
                    return True
                continue
            if value:
                return True
        return False

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
        return validate_image_reference_list(value, max_items=12, field_name="photo_album")

    def validate_avatar_url(self, value):
        if not value:
            return value
        return validate_image_reference(value, field_name="avatar_url")

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
