"""Join, leave, skip, and post in a prayer chat. Kept apart from gathering RSVP."""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from chat.models import Conversation, Message
from chat.serializers import MessageSerializer
from users.push_notifications import send_new_message_notification
from users.social import blocked_user_ids
from utils.sanitize import strip_html

from .models import PrayerParticipant, PrayerPass

MAX_MESSAGE_LENGTH = 2000


def ensure_conversation(prayer) -> Conversation:
    try:
        with transaction.atomic():
            conversation, _created = Conversation.objects.get_or_create(prayer_request=prayer)
    except IntegrityError:
        conversation = Conversation.objects.get(prayer_request=prayer)
    return conversation


def start_praying(user, prayer):
    """I'm praying. Returns (conversation, changed). changed is false when already praying."""
    with transaction.atomic():
        participant = (
            PrayerParticipant.objects.select_for_update()
            .filter(prayer_request=prayer, user=user)
            .first()
        )
        if participant is None:
            try:
                with transaction.atomic():
                    participant = PrayerParticipant.objects.create(
                        prayer_request=prayer,
                        user=user,
                        status=PrayerParticipant.STATUS_PRAYING,
                    )
                changed = True
            except IntegrityError:
                participant = PrayerParticipant.objects.select_for_update().get(
                    prayer_request=prayer, user=user
                )
                changed = participant.status != PrayerParticipant.STATUS_PRAYING
        else:
            changed = participant.status != PrayerParticipant.STATUS_PRAYING
        if participant.status != PrayerParticipant.STATUS_PRAYING:
            participant.status = PrayerParticipant.STATUS_PRAYING
            participant.stopped_at = None
            participant.save(update_fields=["status", "stopped_at"])
        PrayerPass.objects.filter(prayer_request=prayer, user=user).delete()
        conversation = ensure_conversation(prayer)
    return conversation, changed


def stop_praying(user, prayer) -> PrayerParticipant:
    """Stop praying. Idempotent once stopped. Raises if they never joined."""
    with transaction.atomic():
        participant = (
            PrayerParticipant.objects.select_for_update()
            .filter(prayer_request=prayer, user=user)
            .first()
        )
        if participant is None:
            raise ValidationError({"detail": "You are not praying for this."})
        if participant.status != PrayerParticipant.STATUS_STOPPED:
            participant.status = PrayerParticipant.STATUS_STOPPED
            participant.stopped_at = timezone.now()
            participant.save(update_fields=["status", "stopped_at"])
    return participant


def pass_prayer(user, prayer) -> PrayerPass:
    """Skip this card on Discover. Does not join the chat."""
    if prayer.author_id == user.id:
        raise ValidationError({"detail": "You can't pass a prayer request you posted."})
    if PrayerParticipant.objects.filter(
        prayer_request=prayer, user=user, status=PrayerParticipant.STATUS_PRAYING
    ).exists():
        raise ValidationError({"detail": "You're already praying. Stop praying to leave."})
    row, _created = PrayerPass.objects.get_or_create(prayer_request=prayer, user=user)
    return row


def _clean_message(raw) -> str:
    text = strip_html(str(raw or "")).strip()
    if not text:
        raise ValidationError({"message": "Message is required."})
    if len(text) > MAX_MESSAGE_LENGTH:
        raise ValidationError(
            {"message": f"Message must be {MAX_MESSAGE_LENGTH} characters or fewer."}
        )
    return text


def post_message(user, prayer, raw):
    text = _clean_message(raw)
    conversation = ensure_conversation(prayer)
    message = Message.objects.create(conversation=conversation, sender=user, text=text)
    send_new_message_notification(message)
    return message


def chat_payload(prayer, user) -> dict:
    conversation = ensure_conversation(prayer)
    messages = conversation.messages.select_related("sender").order_by("created_at", "id")
    hidden = blocked_user_ids(user)
    if hidden:
        messages = messages.exclude(sender_id__in=hidden)
    count = getattr(prayer, "praying_count", None)
    if count is None:
        count = prayer.participants.filter(status=PrayerParticipant.STATUS_PRAYING).count()
    return {
        "conversation_id": conversation.id,
        "kind": "prayer_chat",
        "label": "Prayer chat",
        "praying_for": prayer.title,
        "praying_count": count,
        "messages": MessageSerializer(messages, many=True).data,
    }
