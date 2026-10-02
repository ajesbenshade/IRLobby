import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Greatest, Least


class User(AbstractUser):
    bio = models.TextField(blank=True)
    avatar_url = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    preferences = models.JSONField(default=dict)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    # OAuth fields
    oauth_provider = models.CharField(max_length=50, blank=True, null=True)
    oauth_id = models.CharField(max_length=100, blank=True, null=True)

    # Password reset fields. password_reset_token stores a hash, never the emailed token.
    password_reset_token = models.CharField(max_length=100, blank=True, null=True)
    token_created_at = models.DateTimeField(null=True, blank=True)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    privacy_accepted_at = models.DateTimeField(null=True, blank=True)
    # Which version of the terms/privacy text the client showed when they accepted.
    terms_version = models.CharField(max_length=32, blank=True, default="")
    privacy_version = models.CharField(max_length=32, blank=True, default="")

    # Stripe Connect (marketplace host payouts)
    stripe_connect_account_id = models.CharField(max_length=255, blank=True, default="")
    stripe_connect_payouts_enabled = models.BooleanField(default=False)
    stripe_connect_details_submitted = models.BooleanField(default=False)

    # Profile fields used for gathering eligibility. Nullable so existing accounts migrate.
    date_of_birth = models.DateField(null=True, blank=True)
    sex = models.CharField(max_length=16, blank=True, default="")
    church = models.ForeignKey(
        "activities.Church",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="members",
    )

    # Social profile (The Foyer). Everything defaults to private.
    PROFILE_VISIBILITY_CHOICES = [
        ("only_me", "Only me"),
        ("friends", "Friends"),
        ("church", "My church"),
        ("public", "Public"),
    ]
    profile_visibility = models.CharField(
        max_length=10, choices=PROFILE_VISIBILITY_CHOICES, default="only_me"
    )
    # Normalized E.164 (for example +12155550123). Empty when unset. Never serialized
    # outside the owner's own profile and the visibility-gated profile endpoint.
    phone = models.CharField(max_length=16, blank=True, default="")
    show_email = models.BooleanField(default=False)
    show_phone = models.BooleanField(default=False)
    # Adults only: let people who attended a shared event with you start a 1:1 chat.
    dm_from_shared_events = models.BooleanField(default=False)

    class Meta:
        # Add unique constraint on email to prevent duplicates
        constraints = [models.UniqueConstraint(fields=["email"], name="unique_user_email")]

    def __str__(self):
        return self.username


class Friendship(models.Model):
    """One row per pair of users, whichever direction the request went."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("declined", "Declined"),
    ]

    requester = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="friend_requests_sent"
    )
    recipient = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="friend_requests_received"
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["requester", "recipient"], name="unique_friendship_direction"
            ),
            # Blocks A->B and B->A both existing: the unordered pair is unique.
            models.UniqueConstraint(
                Least("requester", "recipient"),
                Greatest("requester", "recipient"),
                name="unique_friendship_pair",
            ),
            models.CheckConstraint(
                check=~models.Q(requester=models.F("recipient")),
                name="friendship_not_self",
            ),
        ]

    def __str__(self):
        return f"Friendship({self.requester_id}->{self.recipient_id}, {self.status})"


class SocialAuthIdentity(models.Model):
    PROVIDER_CHOICES = [
        ("apple", "Apple"),
        ("google", "Google"),
        ("twitter", "Twitter/X"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="social_identities")
    provider = models.CharField(max_length=32, choices=PROVIDER_CHOICES)
    provider_user_id = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "provider_user_id"],
                name="unique_social_auth_identity",
            ),
            models.UniqueConstraint(
                fields=["user", "provider"],
                name="unique_user_social_provider",
            ),
        ]

    def __str__(self):
        return f"{self.provider}:{self.provider_user_id} -> user {self.user_id}"


class Invite(models.Model):
    CHANNEL_CHOICES = [
        ("email", "Email"),
        ("sms", "SMS"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
    ]

    inviter = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_invites")
    invitee = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="accepted_invites",
        null=True,
        blank=True,
    )
    contact_name = models.CharField(max_length=120, blank=True)
    contact_value = models.CharField(max_length=255)
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Invite({self.channel}) by {self.inviter_id} to {self.contact_value}"


class PushDeviceToken(models.Model):
    PLATFORM_CHOICES = [
        ("ios", "iOS"),
        ("android", "Android"),
        ("web", "Web"),
        ("unknown", "Unknown"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="push_tokens")
    token = models.CharField(max_length=255, unique=True)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default="unknown")
    device_id = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-last_seen_at"]

    def __str__(self):
        return f"PushDeviceToken(user={self.user_id}, platform={self.platform}, active={self.is_active})"
