import uuid

from django.conf import settings
from django.contrib.gis.db import models
from django.contrib.gis.geos import Point
from django.core import signing
from django.core.validators import MaxValueValidator, MinValueValidator
from django.utils import timezone

from users.models import User


class Activity(models.Model):
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name="hosted_activities")
    is_approved = models.BooleanField(default=False)
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(max_length=120, blank=True, default="")
    location = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    location_point = models.PointField(geography=True, srid=4326, null=True, blank=True)
    time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    # Null means no limit. The Foyer allows 1–500, not the old cap of 10.
    capacity = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(500)],
    )
    visibility = models.JSONField(default=list)
    is_private = models.BooleanField(default=False)
    requires_approval = models.BooleanField(default=False)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default="USD")
    age_restriction = models.CharField(max_length=32, blank=True, default="")
    audience_gender = models.CharField(
        max_length=16,
        choices=[("everyone", "Everyone"), ("men", "Men"), ("women", "Women")],
        default="everyone",
    )
    age_min = models.PositiveIntegerField(null=True, blank=True)
    age_max = models.PositiveIntegerField(null=True, blank=True)
    list_on_church_calendar = models.BooleanField(default=False)
    calendar_approved = models.BooleanField(default=False)
    donation_enabled = models.BooleanField(default=False)
    suggested_donation = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    host_kind = models.CharField(
        max_length=16,
        choices=[("person", "Person"), ("church", "Church")],
        default="person",
    )
    church = models.ForeignKey(
        "Church",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="hosted_activities",
    )
    skill_level = models.CharField(max_length=32, blank=True, default="")
    equipment_provided = models.BooleanField(default=False)
    equipment_required = models.TextField(blank=True, default="")
    weather_dependent = models.BooleanField(default=False)
    tags = models.JSONField(default=list)
    images = models.JSONField(default=list)

    is_ticketed = models.BooleanField(default=False)
    ticket_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_tickets = models.PositiveIntegerField(default=0)
    tickets_sold = models.PositiveIntegerField(default=0)
    platform_fee_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=10,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if getattr(settings, "FOYER_MODE", False):
            self.platform_fee_percent = 0
            self.is_ticketed = False
            update_fields = kwargs.get("update_fields")
            if update_fields is not None:
                kwargs["update_fields"] = list(
                    set(update_fields) | {"platform_fee_percent", "is_ticketed"}
                )
        if self.latitude is not None and self.longitude is not None:
            self.location_point = Point(self.longitude, self.latitude)
            update_fields = kwargs.get("update_fields")
            if update_fields is not None and "location_point" not in update_fields:
                kwargs["update_fields"] = list(set(update_fields) | {"location_point"})
        super().save(*args, **kwargs)

    @property
    def tickets_available(self):
        if not self.is_ticketed:
            return 0
        return max(self.max_tickets - self.tickets_sold, 0)

    @property
    def is_sold_out(self):
        return self.is_ticketed and self.tickets_available <= 0

    def __str__(self):
        return self.title


class ActivityParticipant(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("declined", "Declined"),
    ]
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="participating_activities"
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    include_self = models.BooleanField(default=True)
    dependents = models.ManyToManyField(
        "HouseholdDependent",
        blank=True,
        related_name="rsvps",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("activity", "user")

    def __str__(self):
        return f"{self.user} - {self.activity}"


class Ticket(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("paid", "Paid"),
        ("used", "Used"),
        ("cancelled", "Cancelled"),
    ]

    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tickets")
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name="tickets")
    ticket_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    stripe_session_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_payment_intent_id = models.CharField(
        max_length=255, blank=True, null=True, db_index=True
    )
    qr_code_data_url = models.TextField(blank=True, default="")
    purchased_at = models.DateTimeField(null=True, blank=True)
    redeemed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["buyer"]),
            models.Index(fields=["activity", "status"]),
            models.Index(fields=["stripe_payment_intent_id"]),
        ]

    def __str__(self):
        return f"Ticket({self.ticket_id}) for {self.activity}"

    @property
    def is_redeemable(self):
        return self.status == "paid"

    def get_qr_token(self):
        payload = {
            "ticket_id": str(self.ticket_id),
            "activity_id": self.activity_id,
            "issued_at": timezone.now().isoformat(),
        }
        return signing.dumps(payload, salt="activity-ticket")

    @staticmethod
    def parse_qr_token(token):
        payload = signing.loads(token, salt="activity-ticket")
        return uuid.UUID(payload["ticket_id"]), int(payload["activity_id"])


class TicketRedemptionLog(models.Model):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name="redemption_logs",
    )
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE)
    host = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="ticket_validations",
    )
    scanned_at = models.DateTimeField(auto_now_add=True)
    successful = models.BooleanField(default=False)
    status = models.CharField(max_length=20)
    message = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-scanned_at"]

    def __str__(self):
        return f"Redemption {self.ticket.ticket_id} by {self.host} at {self.scanned_at}"


class Church(models.Model):
    name = models.CharField(max_length=255, unique=True)
    is_verified = models.BooleanField(default=False)
    stripe_connect_account_id = models.CharField(max_length=255, blank=True, default="")
    stripe_connect_payouts_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class HouseholdDependent(models.Model):
    SEX_CHOICES = [("male", "Male"), ("female", "Female")]

    guardian = models.ForeignKey(User, on_delete=models.CASCADE, related_name="dependents")
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150, blank=True, default="")
    birth_date = models.DateField()
    sex = models.CharField(max_length=16, choices=SEX_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["first_name", "last_name", "id"]

    def __str__(self):
        return f"{self.first_name} {self.last_name}".strip()


class EventPhoto(models.Model):
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name="photos")
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="event_photos")
    image = models.ImageField(upload_to="event_photos/%Y/%m/")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def public_url(self, request=None):
        if not self.image:
            return ""
        url = self.image.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url


class Donation(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("paid", "Paid"),
        ("cancelled", "Cancelled"),
    ]

    donor = models.ForeignKey(User, on_delete=models.CASCADE, related_name="donations")
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name="donations")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="pending")
    stripe_session_id = models.CharField(max_length=255, blank=True, default="")
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Donation({self.amount}) for {self.activity_id}"
