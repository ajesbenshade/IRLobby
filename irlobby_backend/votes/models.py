from django.conf import settings
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone


class Ballot(models.Model):
    """A church ballot. Never public. One account, one cast, no edits after the vote.

    Audience matches prayer circles: chosen circles, and/or the whole church.
    Whole church is church-admin only. A circle admin creates for circles they admin.
    """

    RESULTS_AFTER_CLOSE = "after_close"
    RESULTS_LIVE = "live"
    RESULTS_CHOICES = [
        (RESULTS_AFTER_CLOSE, "After close"),
        (RESULTS_LIVE, "Live while open"),
    ]

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ballots_created",
    )
    church = models.ForeignKey(
        "activities.Church",
        on_delete=models.CASCADE,
        related_name="ballots",
    )
    title = models.CharField(max_length=140)
    description = models.TextField(blank=True, default="")
    whole_church = models.BooleanField(default=False)
    circles = models.ManyToManyField("prayers.Circle", blank=True, related_name="ballots")
    closes_at = models.DateTimeField()
    closed_at = models.DateTimeField(null=True, blank=True)
    results_mode = models.CharField(
        max_length=12, choices=RESULTS_CHOICES, default=RESULTS_AFTER_CLOSE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["church", "created_at"], name="ballot_church_created_idx"),
            models.Index(fields=["closes_at"], name="ballot_closes_at_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(results_mode__in=["after_close", "live"]),
                name="ballot_results_mode_valid",
            )
        ]

    def __str__(self):
        return self.title

    def is_open_at(self, now=None) -> bool:
        now = now or timezone.now()
        return self.closed_at is None and self.closes_at > now


class BallotChoice(models.Model):
    ballot = models.ForeignKey(Ballot, on_delete=models.CASCADE, related_name="choices")
    label = models.CharField(max_length=80)
    position = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["ballot", "position"],
                name="unique_ballot_choice_position",
            ),
            models.UniqueConstraint(
                Lower("label"),
                "ballot",
                name="unique_ballot_choice_label",
            ),
        ]

    def __str__(self):
        return self.label


class BallotVote(models.Model):
    """One row per account per ballot. The choice cannot be changed."""

    ballot = models.ForeignKey(Ballot, on_delete=models.CASCADE, related_name="votes")
    choice = models.ForeignKey(BallotChoice, on_delete=models.CASCADE, related_name="votes")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ballot_votes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["ballot", "user"],
                name="unique_ballot_vote",
            )
        ]

    def __str__(self):
        return f"{self.user_id} on {self.ballot_id}"
