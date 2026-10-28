from django.conf import settings
from django.db import models
from django.db.models.functions import Lower


class Circle(models.Model):
    """A church-scoped group. Prayer visibility picks these; whole church is a separate opt-in."""

    church = models.ForeignKey(
        "activities.Church",
        on_delete=models.CASCADE,
        related_name="circles",
    )
    name = models.CharField(max_length=80)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="circles_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "church",
                name="unique_circle_name_per_church",
            )
        ]

    def __str__(self):
        return self.name


class CircleMembership(models.Model):
    circle = models.ForeignKey(Circle, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="circle_memberships",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["circle", "user"],
                name="unique_circle_membership",
            )
        ]

    def __str__(self):
        return f"{self.user_id} in {self.circle_id}"


class PrayerRequest(models.Model):
    """A prayer request. Never public and never anonymous.

    Visibility is either the author's whole church (opt-in, off by default) or the
    circles they chose. There is no date and no place.
    """

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="prayer_requests",
    )
    church = models.ForeignKey(
        "activities.Church",
        on_delete=models.CASCADE,
        related_name="prayer_requests",
    )
    title = models.CharField(max_length=140)
    details = models.TextField(blank=True, default="")
    whole_church = models.BooleanField(default=False)
    circles = models.ManyToManyField(Circle, blank=True, related_name="prayer_requests")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(
                fields=["church", "whole_church", "created_at"],
                name="prayer_church_feed_idx",
            ),
            models.Index(fields=["author", "created_at"], name="prayer_author_idx"),
        ]

    def __str__(self):
        return self.title


class PrayerParticipant(models.Model):
    """Someone who tapped I'm praying. Stop praying keeps the row and closes the chat."""

    STATUS_PRAYING = "praying"
    STATUS_STOPPED = "stopped"
    STATUS_CHOICES = [
        (STATUS_PRAYING, "Praying"),
        (STATUS_STOPPED, "Stopped"),
    ]

    prayer_request = models.ForeignKey(
        PrayerRequest,
        on_delete=models.CASCADE,
        related_name="participants",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="prayer_participations",
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PRAYING)
    joined_at = models.DateTimeField(auto_now_add=True)
    stopped_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["prayer_request", "user"],
                name="unique_prayer_participant",
            )
        ]

    def __str__(self):
        return f"{self.user_id} {self.status} {self.prayer_request_id}"


class PrayerPass(models.Model):
    """A Discover skip. Pass does not join the chat. Detail and I'm praying still work."""

    prayer_request = models.ForeignKey(
        PrayerRequest,
        on_delete=models.CASCADE,
        related_name="passes",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="prayer_passes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["prayer_request", "user"],
                name="unique_prayer_pass",
            )
        ]

    def __str__(self):
        return f"{self.user_id} passed {self.prayer_request_id}"
