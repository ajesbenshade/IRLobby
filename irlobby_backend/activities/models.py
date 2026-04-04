import uuid

from django.contrib.gis.db import models
from django.contrib.gis.geos import Point
from django.core.signing import Signer
from django.core.validators import MaxValueValidator, MinValueValidator
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
    capacity = models.PositiveIntegerField(validators=[MaxValueValidator(10)])
    visibility = models.JSONField(default=list)
    is_private = models.BooleanField(default=False)
    requires_approval = models.BooleanField(default=False)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default="USD")
    age_restriction = models.CharField(max_length=32, blank=True, default="")
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
        if self.latitude is not None and self.longitude is not None:
            self.location_point = Point(self.longitude, self.latitude)
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
    qr_code_data_url = models.TextField(blank=True, default="")
    purchased_at = models.DateTimeField(null=True, blank=True)
    redeemed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Ticket({self.ticket_id}) for {self.activity}"

    def get_qr_token(self):
        signer = Signer(salt="activity-ticket")
        payload = f"{self.ticket_id}:{self.activity_id}"
        return signer.sign(payload)

    @staticmethod
    def parse_qr_token(token):
        signer = Signer(salt="activity-ticket")
        unsigned = signer.unsign(token)
        ticket_uuid, activity_id = unsigned.split(":")
        return uuid.UUID(ticket_uuid), int(activity_id)


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
