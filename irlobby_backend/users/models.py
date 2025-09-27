from django.contrib.auth.models import AbstractUser
from django.db import models

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
