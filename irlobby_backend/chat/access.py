"""Who may open, read, and write in a conversation (REST and websocket share this).

Three kinds of conversation share one model:
- Gathering chats: ``match.activity`` is set; access follows the gathering rules.
- Direct (1:1) chats: ``match`` is set and ``match.activity`` is None; access follows the
  friend / DM rules in users/social.py. Each person also has a ConversationUserState.
- Prayer chats: ``prayer_request`` is set and ``match`` is null. Only people currently
  praying, and not blocked with the author, may read or send.
"""

from __future__ import annotations

from activities.access import user_can_access_activity_chat
from matches.models import Match
from users.social import can_direct_message, is_blocked_either_way

from .models import Conversation, ConversationUserState


def is_direct(conversation) -> bool:
    return conversation.match_id is not None and conversation.match.activity_id is None


def other_participant(conversation, user):
    match = conversation.match
    return match.user_b if match.user_a_id == user.id else match.user_a


def user_state(conversation, user) -> ConversationUserState:
    state, _ = ConversationUserState.objects.get_or_create(conversation=conversation, user=user)
    return state


def can_read_conversation(user, conversation) -> bool:
    """Participant, and for a direct chat: not left and not blocked either way."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if conversation.prayer_request_id:
        from prayers.access import can_access_prayer_chat

        return can_access_prayer_chat(user, conversation.prayer_request)
    match = conversation.match
    if match is None or user.id not in (match.user_a_id, match.user_b_id):
        return False
    if not is_direct(conversation):
        return user_can_access_activity_chat(user, match.activity)
    other = other_participant(conversation, user)
    if is_blocked_either_way(user.id, other.id):
        return False
    return not ConversationUserState.objects.filter(
        conversation=conversation, user=user, left=True
    ).exists()


def can_send_in_conversation(user, conversation) -> bool:
    if not can_read_conversation(user, conversation):
        return False
    if not is_direct(conversation):
        return True
    other = other_participant(conversation, user)
    replying = conversation.messages.filter(sender=other).exists()
    return can_direct_message(user, other, recipient_has_messaged_sender=replying)


def direct_conversation_for(user, other, *, create=False):
    """The single 1:1 conversation between two users (or None)."""
    user_a, user_b = sorted([user, other], key=lambda u: u.id)
    match = Match.objects.filter(user_a=user_a, user_b=user_b, activity__isnull=True).first()
    if match is None:
        if not create:
            return None
        match = Match.objects.create(user_a=user_a, user_b=user_b, activity=None)
    conversation, _ = Conversation.objects.get_or_create(match=match)
    return conversation
