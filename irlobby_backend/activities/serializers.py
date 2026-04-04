from rest_framework import serializers

from .models import Activity, ActivityParticipant, Ticket


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
    isTicketed = serializers.BooleanField(source="is_ticketed")
    ticketPrice = serializers.DecimalField(source="ticket_price", max_digits=10, decimal_places=2)
    maxTickets = serializers.IntegerField(source="max_tickets")
    ticketsSold = serializers.IntegerField(source="tickets_sold", read_only=True)
    platformFeePercent = serializers.DecimalField(
        source="platform_fee_percent", max_digits=5, decimal_places=2
    )
    ticketsAvailable = serializers.SerializerMethodField()
    isSoldOut = serializers.SerializerMethodField()

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
        )
        read_only_fields = ("id", "is_approved", "created_at")

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
        platform_fee_percent = attrs.get(
            "platform_fee_percent", getattr(self.instance, "platform_fee_percent", 10)
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

        if platform_fee_percent < 0 or platform_fee_percent > 100:
            raise serializers.ValidationError(
                {"platform_fee_percent": "Platform fee must be between 0 and 100."}
            )

        return attrs

    def get_ticketsAvailable(self, obj):
        return obj.tickets_available

    def get_isSoldOut(self, obj):
        return obj.is_sold_out

    def get_participant_count(self, obj):
        return obj.participants.filter(status="confirmed").count()


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
    successUrl = serializers.URLField(required=False)
    cancelUrl = serializers.URLField(required=False)


class TicketValidationSerializer(serializers.Serializer):
    ticketToken = serializers.CharField()
