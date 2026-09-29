from rest_framework import serializers

from utils.client_urls import is_allowed_client_return_url
from utils.media import validate_image_reference_list
from utils.sanitize import strip_html

from .access import is_church_admin
from .eligibility import audience_label, confirmed_people_count, host_display_name
from .models import FRANCONIA_CHURCH_NAME, Activity, ActivityParticipant, Church, Ticket
from .photos import absolute_photo_url, cover_photo_url
from .public_calendar import build_calendar_links
from .ticketing import ticketing_enabled


class ActivitySerializer(serializers.ModelSerializer):
    host = serializers.StringRelatedField(read_only=True)
    participant_count = serializers.SerializerMethodField()
    dateTime = serializers.DateTimeField(source="time", read_only=True)
    endDateTime = serializers.DateTimeField(source="end_time", read_only=True)
    maxParticipants = serializers.IntegerField(source="capacity", read_only=True)
    requiresApproval = serializers.BooleanField(source="requires_approval", read_only=True)
    isPrivate = serializers.BooleanField(source="is_private", read_only=True)
    ageRestriction = serializers.CharField(source="age_restriction", read_only=True)
    skillLevel = serializers.CharField(source="skill_level", read_only=True)
    equipmentProvided = serializers.BooleanField(source="equipment_provided", read_only=True)
    equipmentRequired = serializers.CharField(source="equipment_required", read_only=True)
    weatherDependent = serializers.BooleanField(source="weather_dependent", read_only=True)
    isTicketed = serializers.BooleanField(source="is_ticketed", required=False)
    ticketPrice = serializers.DecimalField(
        source="ticket_price", max_digits=10, decimal_places=2, required=False
    )
    maxTickets = serializers.IntegerField(source="max_tickets", required=False)
    ticketsSold = serializers.IntegerField(source="tickets_sold", read_only=True)
    platformFeePercent = serializers.DecimalField(
        source="platform_fee_percent", max_digits=5, decimal_places=2, required=False
    )
    ticketsAvailable = serializers.SerializerMethodField()
    isSoldOut = serializers.SerializerMethodField()
    audience = serializers.SerializerMethodField()
    host_name = serializers.SerializerMethodField()
    host_church_id = serializers.PrimaryKeyRelatedField(
        source="host_church",
        queryset=Church.objects.all(),
        required=False,
        allow_null=True,
    )
    cover_photo_url = serializers.SerializerMethodField()
    going_count = serializers.SerializerMethodField()
    my_rsvp = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()
    calendar_links = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = (
            "id",
            "host",
            "is_approved",
            "title",
            "description",
            "category",
            "location",
            "latitude",
            "longitude",
            "time",
            "dateTime",
            "end_time",
            "endDateTime",
            "capacity",
            "maxParticipants",
            "visibility",
            "is_private",
            "isPrivate",
            "requires_approval",
            "requiresApproval",
            "price",
            "currency",
            "age_restriction",
            "ageRestriction",
            "skill_level",
            "skillLevel",
            "equipment_provided",
            "equipmentProvided",
            "equipment_required",
            "equipmentRequired",
            "weather_dependent",
            "weatherDependent",
            "is_ticketed",
            "isTicketed",
            "ticket_price",
            "ticketPrice",
            "max_tickets",
            "maxTickets",
            "tickets_sold",
            "ticketsSold",
            "platform_fee_percent",
            "platformFeePercent",
            "ticketsAvailable",
            "isSoldOut",
            "tags",
            "images",
            "created_at",
            "participant_count",
            "audience_gender",
            "age_min",
            "age_max",
            "audience",
            "list_on_church_calendar",
            "calendar_approved",
            "host_kind",
            "host_church_id",
            "host_name",
            "cover_photo_url",
            "going_count",
            "my_rsvp",
            "photos",
            "calendar_links",
        )
        read_only_fields = (
            "id",
            "is_approved",
            "created_at",
            "tickets_sold",
            "calendar_approved",
        )

    def to_internal_value(self, data):
        normalized_data = dict(data)
        aliases = {
            "dateTime": "time",
            "endDateTime": "end_time",
            "maxParticipants": "capacity",
            "requiresApproval": "requires_approval",
            "isPrivate": "is_private",
            "ageRestriction": "age_restriction",
            "skillLevel": "skill_level",
            "equipmentProvided": "equipment_provided",
            "equipmentRequired": "equipment_required",
            "weatherDependent": "weather_dependent",
            "isTicketed": "is_ticketed",
            "ticketPrice": "ticket_price",
            "maxTickets": "max_tickets",
            "platformFeePercent": "platform_fee_percent",
            "imageUrls": "images",
            "audienceGender": "audience_gender",
            "ageMin": "age_min",
            "ageMax": "age_max",
            "listOnChurchCalendar": "list_on_church_calendar",
            "hostKind": "host_kind",
            "hostChurchId": "host_church_id",
        }

        for alias, normalized in aliases.items():
            if alias in normalized_data and normalized not in normalized_data:
                normalized_data[normalized] = normalized_data[alias]

        if "visibility" not in normalized_data:
            normalized_data["visibility"] = ["everyone"]

        return super().to_internal_value(normalized_data)

    def validate(self, attrs):
        is_ticketed = attrs.get("is_ticketed", getattr(self.instance, "is_ticketed", False))
        ticket_price = attrs.get("ticket_price", getattr(self.instance, "ticket_price", 0))
        max_tickets = attrs.get("max_tickets", getattr(self.instance, "max_tickets", 0))

        # The Foyer takes no cut. Ignore STRIPE_PLATFORM_FEE_PERCENT and any client value.
        attrs["platform_fee_percent"] = 0

        host_kind = attrs.get("host_kind", getattr(self.instance, "host_kind", "person"))
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if host_kind == "church" and not is_church_admin(user):
            raise serializers.ValidationError(
                {"host_kind": "Only church admins can host as the church."}
            )

        age_min = attrs.get("age_min", getattr(self.instance, "age_min", None))
        age_max = attrs.get("age_max", getattr(self.instance, "age_max", None))
        if age_min is not None and age_max is not None and age_max < age_min:
            raise serializers.ValidationError(
                {"age_max": "Maximum age must be greater than or equal to minimum age."}
            )
        if age_min is not None and age_min > 120:
            raise serializers.ValidationError({"age_min": "Enter an age of 120 or less."})
        if age_max is not None and age_max > 120:
            raise serializers.ValidationError({"age_max": "Enter an age of 120 or less."})

        newly_ticketed = is_ticketed and not getattr(self.instance, "is_ticketed", False)
        request = self.context.get("request")
        if newly_ticketed and request is not None and not ticketing_enabled(request):
            raise serializers.ValidationError(
                {"is_ticketed": "Ticketed events are not available yet."}
            )

        if is_ticketed:
            if ticket_price <= 0:
                raise serializers.ValidationError(
                    {
                        "ticket_price": "Ticket price must be greater than zero for ticketed activities."
                    }
                )
            if max_tickets <= 0:
                raise serializers.ValidationError(
                    {"max_tickets": "Ticketed activities require a positive ticket quantity."}
                )

            host = getattr(request, "user", None) if request else None
            if self.instance is not None:
                host = self.instance.host
            if host is not None and getattr(host, "is_authenticated", False):
                from users.stripe_connect import host_can_receive_payouts

                if not host_can_receive_payouts(host):
                    raise serializers.ValidationError(
                        {
                            "is_ticketed": (
                                "Connect a payout account before creating a ticketed event. "
                                "Open Profile → Payout setup to finish Stripe Connect."
                            )
                        }
                    )

        return attrs

    def _apply_hosting_rules(self, validated_data, *, instance=None):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        admin = is_church_admin(user)
        host_kind = validated_data.get(
            "host_kind", getattr(instance, "host_kind", "person") if instance else "person"
        )
        list_on = validated_data.get(
            "list_on_church_calendar",
            getattr(instance, "list_on_church_calendar", False) if instance else False,
        )
        validated_data["platform_fee_percent"] = 0
        if host_kind == "church":
            validated_data["calendar_approved"] = True
            if not validated_data.get("host_church") and not (instance and instance.host_church_id):
                church = Church.objects.filter(name=FRANCONIA_CHURCH_NAME).first()
                if church is None:
                    raise serializers.ValidationError(
                        {"host_kind": "Franconia Mennonite Church is not configured."}
                    )
                validated_data["host_church"] = church
        elif list_on and admin:
            validated_data["calendar_approved"] = True
        elif instance is None or (
            list_on and instance is not None and not instance.list_on_church_calendar
        ):
            validated_data["calendar_approved"] = False
        return validated_data

    def create(self, validated_data):
        return super().create(self._apply_hosting_rules(validated_data))

    def update(self, instance, validated_data):
        validated_data.pop("calendar_approved", None)
        return super().update(
            instance, self._apply_hosting_rules(validated_data, instance=instance)
        )

    def validate_images(self, images):
        return validate_image_reference_list(images, max_items=5, field_name="images")

    def get_ticketsAvailable(self, obj):
        return obj.tickets_available

    def get_isSoldOut(self, obj):
        return obj.is_sold_out

    def get_participant_count(self, obj):
        return obj.participants.filter(status="confirmed").count()

    def get_audience(self, obj):
        return audience_label(obj)

    def get_host_name(self, obj):
        return host_display_name(obj)

    def get_cover_photo_url(self, obj):
        request = self.context.get("request")
        return cover_photo_url(obj, request)

    def get_going_count(self, obj):
        return confirmed_people_count(obj)

    def get_my_rsvp(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if not user or not getattr(user, "is_authenticated", False):
            return None
        participant = obj.participants.filter(user=user).prefetch_related("dependents").first()
        if participant is None:
            return None
        dependent_ids = [dependent.id for dependent in participant.dependents.all()]
        people = (1 if participant.include_self else 0) + len(dependent_ids)
        return {
            "status": participant.status,
            "include_self": participant.include_self,
            "dependent_ids": dependent_ids,
            "people_count": people,
        }

    def get_photos(self, obj):
        request = self.context.get("request")
        return [
            {"id": photo.id, "url": absolute_photo_url(photo, request)}
            for photo in obj.photos.all()
            if photo.image
        ]

    def get_calendar_links(self, obj):
        return build_calendar_links(obj, self.context.get("request"))

    def validate_description(self, value):
        return strip_html(value)


class ActivityParticipantSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    activity = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = ActivityParticipant
        fields = ("id", "activity", "user", "status", "joined_at")
        read_only_fields = ("id", "joined_at")


class TicketSerializer(serializers.ModelSerializer):
    buyer = serializers.StringRelatedField(read_only=True)
    activity = serializers.PrimaryKeyRelatedField(read_only=True)
    activityId = serializers.IntegerField(source="activity.id", read_only=True)
    ticketId = serializers.UUIDField(source="ticket_id", read_only=True)
    purchasedAt = serializers.DateTimeField(source="purchased_at", read_only=True)
    redeemedAt = serializers.DateTimeField(source="redeemed_at", read_only=True)
    qrCodeDataUrl = serializers.CharField(source="qr_code_data_url", read_only=True)

    class Meta:
        model = Ticket
        fields = (
            "id",
            "ticketId",
            "activity",
            "activityId",
            "buyer",
            "status",
            "purchasedAt",
            "redeemedAt",
            "qrCodeDataUrl",
            "created_at",
        )
        read_only_fields = (
            "id",
            "ticketId",
            "activity",
            "activityId",
            "buyer",
            "purchasedAt",
            "redeemedAt",
            "qrCodeDataUrl",
            "created_at",
        )


class TicketPurchaseSerializer(serializers.Serializer):
    successUrl = serializers.CharField(required=False, allow_blank=True, max_length=2048)
    cancelUrl = serializers.CharField(required=False, allow_blank=True, max_length=2048)

    def validate_successUrl(self, value):
        if value and not is_allowed_client_return_url(value):
            raise serializers.ValidationError("Invalid success URL.")
        return value

    def validate_cancelUrl(self, value):
        if value and not is_allowed_client_return_url(value):
            raise serializers.ValidationError("Invalid cancel URL.")
        return value


class TicketValidationSerializer(serializers.Serializer):
    ticketToken = serializers.CharField()
