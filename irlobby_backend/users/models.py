from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid

class User(AbstractUser):
    bio = models.TextField(blank=True)
    avatar_url = models.URLField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    preferences = models.JSONField(default=dict)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    # OAuth fields
    oauth_provider = models.CharField(max_length=50, blank=True, null=True)
    oauth_id = models.CharField(max_length=100, blank=True, null=True)

    # Password reset fields
    password_reset_token = models.CharField(max_length=100, blank=True, null=True)
    token_created_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # Add unique constraint on email to prevent duplicates
        constraints = [
            models.UniqueConstraint(fields=['email'], name='unique_user_email')
        ]

    def __str__(self):
        return self.username


class Invite(models.Model):
    CHANNEL_CHOICES = [
        ('email', 'Email'),
        ('sms', 'SMS'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
    ]

    inviter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_invites')
    invitee = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='accepted_invites',
        null=True,
        blank=True,
    )
    contact_name = models.CharField(max_length=120, blank=True)
    contact_value = models.CharField(max_length=255)
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Invite({self.channel}) by {self.inviter_id} to {self.contact_value}"


class PushDeviceToken(models.Model):
    PLATFORM_CHOICES = [
        ('ios', 'iOS'),
        ('android', 'Android'),
        ('web', 'Web'),
        ('unknown', 'Unknown'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_tokens')
    token = models.CharField(max_length=255, unique=True)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default='unknown')
    device_id = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-last_seen_at']

    def __str__(self):
        return f"PushDeviceToken(user={self.user_id}, platform={self.platform}, active={self.is_active})"
