from django.conf import settings
from django.db import models
from django.db.models.functions import Lower


class Circle(models.Model):
    """A church-scoped group. Prayer visibility picks these; whole church is a separate opt-in.

    Joining is a request an admin approves, or an invite the person accepts.
    There is no open join.
    """

    church = models.ForeignKey(
        "activities.Church",
        on_delete=models.CASCADE,
        related_name="circles",
    )
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=280, blank=True, default="")
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
    is_admin = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["circle", "user"],
                name="unique_circle_membership",
            )
        ]

    def __str__(self):
        return f"{self.user_id} in {self.circle_id}"


class CircleJoinRequest(models.Model):
    """A person asking to join a circle. Pending until an admin approves or declines."""

    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_DECLINED = "declined"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_DECLINED, "Declined"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    circle = models.ForeignKey(Circle, on_delete=models.CASCADE, related_name="join_requests")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="circle_join_requests",
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    responded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="circle_join_requests_decided",
    )

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["circle", "status"], name="circle_join_req_status_idx"),
            models.Index(fields=["user", "status"], name="circle_join_req_user_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["circle", "user"],
                condition=models.Q(status="pending"),
                name="unique_pending_circle_join_request",
            )
        ]

    def __str__(self):
        return f"{self.user_id} {self.status} {self.circle_id}"


class CircleInvite(models.Model):
    """An admin invited a person. Accept makes them a member. Decline ends the invite."""

    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_DECLINED = "declined"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_DECLINED, "Declined"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    circle = models.ForeignKey(Circle, on_delete=models.CASCADE, related_name="invites")
    inviter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="circle_invites_sent",
    )
    invitee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="circle_invites_received",
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["circle", "status"], name="circle_invite_status_idx"),
            models.Index(fields=["invitee", "status"], name="circle_invite_invitee_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["circle", "invitee"],
                condition=models.Q(status="pending"),
                name="unique_pending_circle_invite",
            ),
            models.CheckConstraint(
                check=~models.Q(inviter=models.F("invitee")),
                name="circle_invite_not_self",
            ),
        ]

    def __str__(self):
        return f"{self.inviter_id} invited {self.invitee_id} to {self.circle_id}"


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
