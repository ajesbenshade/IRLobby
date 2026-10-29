from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from activities.access import is_church_admin
from prayers.models import Circle, CircleMembership
from prayers.serializers import author_card
from utils.sanitize import strip_html

from .models import Ballot, BallotChoice

TITLE_MAX = 140
DESCRIPTION_MAX = 2000
CHOICE_MAX = 80
CHOICE_MIN = 2
CHOICE_MAX_COUNT = 6
DEFAULT_CHOICES = ("Yes", "No")

WHOLE_CHURCH_DENIED = "Only a church admin can open a ballot to the whole church."
CIRCLES_DENIED = "Choose circles you admin."
CIRCLES_OTHER_CHURCH = "Choose circles from your church."
NEED_AUDIENCE = "Choose at least one circle, or turn on whole church."
CIRCLE_ADMIN_ONLY = "Only a circle admin can create a ballot."
JOIN_CHURCH = "Join a church before creating a ballot."
CLOSES_FUTURE = "Choose a closing time in the future."
CHOICES_DIFFERENT = "Choices must be different."
CHOICE_LABEL = "Each choice needs a label."
CHOICE_LENGTH = f"Each choice must be {CHOICE_MAX} characters or fewer."
CHOICE_COUNT = f"Add {CHOICE_MIN} to {CHOICE_MAX_COUNT} choices."


def _viewer(serializer):
    request = serializer.context.get("request")
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return user
    return None


def _flags(serializer) -> dict:
    flags = serializer.context.get("flags")
    if flags is not None:
        return flags
    from .access import viewer_flags

    user = _viewer(serializer)
    return (
        viewer_flags(user)
        if user is not None
        else {
            "member_circle_ids": set(),
            "admin_circle_ids": set(),
            "church_admin": False,
            "voting_member": False,
        }
    )


def clean_choice_label(value) -> str:
    return " ".join(strip_html(value or "").split())


class BallotVoteSerializer(serializers.Serializer):
    choice_id = serializers.IntegerField()


class BallotSerializer(serializers.ModelSerializer):
    church_id = serializers.IntegerField(read_only=True)
    circles = serializers.SerializerMethodField()
    author = serializers.SerializerMethodField()
    is_open = serializers.SerializerMethodField()
    results_visible = serializers.SerializerMethodField()
    has_voted = serializers.SerializerMethodField()
    my_choice_id = serializers.SerializerMethodField()
    can_vote = serializers.SerializerMethodField()
    can_close = serializers.SerializerMethodField()
    visibility_summary = serializers.SerializerMethodField()
    choices = serializers.SerializerMethodField()
    total_votes = serializers.SerializerMethodField()

    class Meta:
        model = Ballot
        fields = (
            "id",
            "title",
            "description",
            "whole_church",
            "circles",
            "church_id",
            "author",
            "closes_at",
            "closed_at",
            "is_open",
            "results_mode",
            "results_visible",
            "has_voted",
            "my_choice_id",
            "can_vote",
            "can_close",
            "visibility_summary",
            "choices",
            "total_votes",
            "created_at",
        )

    def get_circles(self, obj):
        circles = sorted(obj.circles.all(), key=lambda circle: (circle.name.casefold(), circle.id))
        return [{"id": circle.id, "name": circle.name} for circle in circles]

    def get_author(self, obj):
        if obj.author_id is None:
            return None
        return author_card(obj.author)

    def get_is_open(self, obj):
        return obj.is_open_at()

    def _can_manage(self, obj) -> bool:
        user = _viewer(self)
        flags = _flags(self)
        if not flags["voting_member"] or user is None:
            return False
        if flags["church_admin"] and user.church_id and user.church_id == obj.church_id:
            return True
        admin_ids = flags["admin_circle_ids"]
        return any(circle.id in admin_ids for circle in obj.circles.all())

    def _in_audience(self, obj) -> bool:
        user = _viewer(self)
        if user is None:
            return False
        if obj.whole_church and user.church_id and user.church_id == obj.church_id:
            return True
        member_ids = _flags(self)["member_circle_ids"]
        return any(circle.id in member_ids for circle in obj.circles.all())

    def _viewer_vote(self, obj):
        votes = getattr(obj, "viewer_votes", None)
        if votes is None:
            user = _viewer(self)
            if user is None:
                return None
            return obj.votes.filter(user=user).first()
        return votes[0] if votes else None

    def get_results_visible(self, obj):
        if self._can_manage(obj):
            return True
        if obj.results_mode == Ballot.RESULTS_LIVE:
            return True
        return not obj.is_open_at()

    def get_has_voted(self, obj):
        return self._viewer_vote(obj) is not None

    def get_my_choice_id(self, obj):
        vote = self._viewer_vote(obj)
        return vote.choice_id if vote is not None else None

    def get_can_vote(self, obj):
        flags = _flags(self)
        if not flags["voting_member"] or not obj.is_open_at() or self.get_has_voted(obj):
            return False
        return self._in_audience(obj)

    def get_can_close(self, obj):
        return self._can_manage(obj) and obj.is_open_at()

    def get_visibility_summary(self, obj):
        if obj.whole_church:
            return "Whole church"
        names = [circle["name"] for circle in self.get_circles(obj)]
        return ", ".join(names)

    def get_choices(self, obj):
        visible = self.get_results_visible(obj)
        choices = list(obj.choices.all())
        choices.sort(key=lambda choice: (choice.position, choice.id))
        rows = []
        for choice in choices:
            count = getattr(choice, "vote_count", None)
            if count is None:
                count = choice.votes.count()
            rows.append(
                {
                    "id": choice.id,
                    "label": choice.label,
                    "position": choice.position,
                    "vote_count": count if visible else None,
                }
            )
        return rows

    def get_total_votes(self, obj):
        if not self.get_results_visible(obj):
            return None
        total = getattr(obj, "total_votes", None)
        if total is None:
            return obj.votes.count()
        return total


class BallotCreateSerializer(serializers.Serializer):
    title = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True, default="")
    choices = serializers.ListField(
        child=serializers.CharField(allow_blank=True),
        required=False,
        allow_null=True,
        default=None,
    )
    whole_church = serializers.BooleanField(required=False, default=False)
    circle_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    closes_at = serializers.DateTimeField()
    results_mode = serializers.ChoiceField(
        choices=[Ballot.RESULTS_AFTER_CLOSE, Ballot.RESULTS_LIVE],
        required=False,
        default=Ballot.RESULTS_AFTER_CLOSE,
    )

    def validate_title(self, value):
        title = strip_html(value or "").strip()
        if not title:
            raise serializers.ValidationError("Title is required.")
        if len(title) > TITLE_MAX:
            raise serializers.ValidationError(f"Title must be {TITLE_MAX} characters or fewer.")
        return title

    def validate_description(self, value):
        description = strip_html(value or "").strip()
        if len(description) > DESCRIPTION_MAX:
            raise serializers.ValidationError(
                f"Description must be {DESCRIPTION_MAX} characters or fewer."
            )
        return description

    def validate_closes_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError(CLOSES_FUTURE)
        return value

    def validate_choices(self, value):
        if value is None:
            return None
        labels = []
        seen = set()
        for raw in value:
            label = clean_choice_label(raw)
            if not label:
                raise serializers.ValidationError(CHOICE_LABEL)
            if len(label) > CHOICE_MAX:
                raise serializers.ValidationError(CHOICE_LENGTH)
            key = label.casefold()
            if key in seen:
                raise serializers.ValidationError(CHOICES_DIFFERENT)
            seen.add(key)
            labels.append(label)
        if len(labels) < CHOICE_MIN or len(labels) > CHOICE_MAX_COUNT:
            raise serializers.ValidationError(CHOICE_COUNT)
        return labels

    def _admin_circles(self, user):
        return Circle.objects.filter(
            church_id=user.church_id,
            memberships__user=user,
            memberships__is_admin=True,
        ).order_by("name", "id")

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.church_id:
            raise serializers.ValidationError({"church": JOIN_CHURCH})
        church_admin = is_church_admin(user)
        whole_church = bool(attrs.get("whole_church"))
        if whole_church and not church_admin:
            raise serializers.ValidationError({"whole_church": WHOLE_CHURCH_DENIED})

        raw_ids = attrs.get("circle_ids")
        circle_ids = list(dict.fromkeys(raw_ids)) if raw_ids else []
        circles = []
        if circle_ids:
            circles = list(
                Circle.objects.filter(id__in=circle_ids, church_id=user.church_id).order_by(
                    "name", "id"
                )
            )
            if len(circles) != len(circle_ids):
                raise serializers.ValidationError({"circle_ids": CIRCLES_OTHER_CHURCH})
            if not church_admin:
                admin_ids = set(
                    CircleMembership.objects.filter(
                        user=user, is_admin=True, circle_id__in=circle_ids
                    ).values_list("circle_id", flat=True)
                )
                if admin_ids != set(circle_ids):
                    raise serializers.ValidationError({"circle_ids": CIRCLES_DENIED})
            by_id = {circle.id: circle for circle in circles}
            circles = [by_id[circle_id] for circle_id in circle_ids]
        elif not whole_church:
            first = self._admin_circles(user).first()
            if first is None:
                message = NEED_AUDIENCE if church_admin else CIRCLE_ADMIN_ONLY
                raise serializers.ValidationError({"circle_ids": message})
            circles = [first]

        if not whole_church and not circles:
            raise serializers.ValidationError({"circle_ids": NEED_AUDIENCE})

        labels = attrs.get("choices")
        attrs["choices"] = list(DEFAULT_CHOICES) if labels is None else labels
        attrs["circles"] = circles
        attrs["whole_church"] = whole_church
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        circles = validated_data.pop("circles")
        labels = validated_data.pop("choices")
        validated_data.pop("circle_ids", None)
        try:
            with transaction.atomic():
                ballot = Ballot.objects.create(
                    author=user,
                    church_id=user.church_id,
                    title=validated_data["title"],
                    description=validated_data.get("description") or "",
                    whole_church=bool(validated_data.get("whole_church")),
                    closes_at=validated_data["closes_at"],
                    results_mode=validated_data.get("results_mode") or Ballot.RESULTS_AFTER_CLOSE,
                )
                BallotChoice.objects.bulk_create(
                    [
                        BallotChoice(ballot=ballot, label=label, position=index)
                        for index, label in enumerate(labels)
                    ]
                )
                if circles:
                    ballot.circles.set(circles)
        except IntegrityError:
            raise serializers.ValidationError({"choices": CHOICES_DIFFERENT}) from None
        return ballot
