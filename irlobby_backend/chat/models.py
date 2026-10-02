from django.db import models

from matches.models import Match
from users.models import User


class Conversation(models.Model):
    match = models.OneToOneField(Match, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Conversation for {self.match}"


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Message from {self.sender} in {self.conversation}"


class ConversationUserState(models.Model):
    """Per-user flags for a conversation (used by 1:1 chats)."""

    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="user_states"
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="conversation_states")
    muted = models.BooleanField(default=False)
    left = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["conversation", "user"], name="unique_conversation_user_state"
            )
        ]

    def __str__(self):
        return f"State({self.conversation_id}, user={self.user_id}, muted={self.muted}, left={self.left})"
