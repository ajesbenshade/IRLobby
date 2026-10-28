from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError, transaction
from rest_framework import serializers

from utils.sanitize import strip_html

from .models import Circle, CircleMembership, PrayerRequest

TITLE_MAX = 140
DETAILS_MAX = 2000
CIRCLE_NAME_MAX = 80


def author_card(user) -> dict:
    first = (user.first_name or "").strip()
    last = (user.last_name or "").strip()
    initial = last[0].upper() if last else ""
    if first and initial:
        display = f"{first} {initial}."
    else:
        display = first or user.username
    return {
        "id": user.id,
        "first_name": first,
        "last_initial": initial,
        "display_name": display,
    }


def clean_circle_name(value) -> str:
    name = " ".join(strip_html(value or "").split())
    if not name:
        raise serializers.ValidationError("Name is required.")
    if len(name) > CIRCLE_NAME_MAX:
        raise serializers.ValidationError(f"Name must be {CIRCLE_NAME_MAX} characters or fewer.")
    return name


class CircleSerializer(serializers.ModelSerializer):
    church_id = serializers.IntegerField(read_only=True)
    member_count = serializers.IntegerField(read_only=True)
    is_member = serializers.BooleanField(read_only=True)

    class Meta:
        model = Circle
        fields = ("id", "name", "church_id", "member_count", "is_member")


class CircleCreateSerializer(serializers.Serializer):
    name = serializers.CharField()

    def validate_name(self, value):
        return clean_circle_name(value)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.church_id:
            raise serializers.ValidationError({"church": "Join a church before creating a circle."})
        church_id = user.church_id
        if Circle.objects.filter(church_id=church_id, name__iexact=attrs["name"]).exists():
            raise serializers.ValidationError(
                {"name": "A circle with this name already exists in your church."}
            )
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        try:
            with transaction.atomic():
                circle = Circle.objects.create(
                    church_id=user.church_id,
                    name=validated_data["name"],
                    created_by=user,
                )
                CircleMembership.objects.create(circle=circle, user=user)
        except IntegrityError:
            raise serializers.ValidationError(
                {"name": "A circle with this name already exists in your church."}
            ) from None
        return circle


class PrayerRequestSerializer(serializers.ModelSerializer):
    kind = serializers.SerializerMethodField()
    church_id = serializers.IntegerField(read_only=True)
    circles = serializers.SerializerMethodField()
    author = serializers.SerializerMethodField()
    praying_count = serializers.SerializerMethodField()
    is_praying = serializers.SerializerMethodField()
    is_author = serializers.SerializerMethodField()
    conversation_id = serializers.SerializerMethodField()
    visibility_summary = serializers.SerializerMethodField()

    class Meta:
        model = PrayerRequest
        fields = (
            "id",
            "kind",
            "title",
            "details",
            "whole_church",
            "circles",
            "church_id",
            "author",
            "praying_count",
            "is_praying",
            "is_author",
            "conversation_id",
            "visibility_summary",
            "created_at",
        )

    def get_kind(self, obj):
        return "prayer"

    def get_circles(self, obj):
        circles = sorted(obj.circles.all(), key=lambda circle: circle.name.casefold())
        return [{"id": circle.id, "name": circle.name} for circle in circles]

    def get_author(self, obj):
        return author_card(obj.author)

    def get_praying_count(self, obj):
        count = getattr(obj, "praying_count", None)
        if count is not None:
            return count
        return obj.participants.filter(status="praying").count()

    def get_is_praying(self, obj):
        flagged = getattr(obj, "viewer_is_praying", None)
        if flagged is not None:
            return bool(flagged)
        user = self.context["request"].user
        return obj.participants.filter(user=user, status="praying").exists()

    def get_is_author(self, obj):
        return obj.author_id == self.context["request"].user.id

    def get_conversation_id(self, obj):
        if not self.get_is_praying(obj):
            return None
        try:
            conversation = obj.conversation
        except ObjectDoesNotExist:
            return None
        return conversation.id if conversation is not None else None

    def get_visibility_summary(self, obj):
        if obj.whole_church:
            return "Whole church"
        names = [circle["name"] for circle in self.get_circles(obj)]
        return ", ".join(names)


class PrayerCreateSerializer(serializers.Serializer):
    title = serializers.CharField()
    details = serializers.CharField(required=False, allow_blank=True, default="")
    whole_church = serializers.BooleanField(required=False, default=False)
    circle_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )

    def validate_title(self, value):
        title = strip_html(value or "").strip()
        if not title:
            raise serializers.ValidationError("Title is required.")
        if len(title) > TITLE_MAX:
            raise serializers.ValidationError(f"Title must be {TITLE_MAX} characters or fewer.")
        return title

    def validate_details(self, value):
        details = strip_html(value or "").strip()
        if len(details) > DETAILS_MAX:
            raise serializers.ValidationError(f"Details must be {DETAILS_MAX} characters or fewer.")
        return details

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.church_id:
            raise serializers.ValidationError(
                {"church": "Join a church before posting a prayer request."}
            )
        circle_ids = list(dict.fromkeys(attrs.get("circle_ids") or []))
        attrs["circle_ids"] = circle_ids
        if not attrs.get("whole_church") and not circle_ids:
            raise serializers.ValidationError(
                {"circle_ids": "Choose at least one circle, or turn on whole church."}
            )
        circles = []
        if circle_ids:
            circles = list(Circle.objects.filter(id__in=circle_ids, church_id=user.church_id))
            if len(circles) != len(circle_ids):
                raise serializers.ValidationError(
                    {"circle_ids": "Choose circles from your church."}
                )
            member_ids = set(
                CircleMembership.objects.filter(user=user, circle_id__in=circle_ids).values_list(
                    "circle_id", flat=True
                )
            )
            if member_ids != set(circle_ids):
                raise serializers.ValidationError(
                    {"circle_ids": "Join a circle before posting to it."}
                )
        attrs["circles"] = circles
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        circles = validated_data.pop("circles")
        validated_data.pop("circle_ids", None)
        prayer = PrayerRequest.objects.create(
            author=user,
            church_id=user.church_id,
            title=validated_data["title"],
            details=validated_data.get("details") or "",
            whole_church=bool(validated_data.get("whole_church")),
        )
        if circles:
            prayer.circles.set(circles)
        return prayer
