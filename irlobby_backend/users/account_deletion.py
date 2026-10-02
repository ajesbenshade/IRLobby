"""Delete an account (Apple App Store guideline 5.1.1(v)).

What ``delete_account`` REMOVES (and the terms say so):
- the account itself: profile (name, email, phone, bio, birth date, sex, avatar, church, social
  and notification settings), login identities (email, Apple, Google), device push tokens and
  sign-in sessions;
- friends, friend requests and blocks, in both directions;
- family members (household dependents);
- every RSVP, join request and swipe, plus tickets bought;
- 1:1 chats, including what the other person sent in them;
- the user's own messages in gathering chats;
- reviews written by or about the user;
- every photo the user uploaded, as database rows and as files on disk;
- every gathering the user hosted, with its RSVPs, chats and photos. Upcoming ones are cancelled
  first: attendees and pending requesters get a push and a chat note ("The host deleted their
  account.") before the gathering is deleted;
- contact details in invites other people sent to the user's email or phone number (the invite
  rows stay for the inviter but are blanked);
- the Sign in with Apple link, which is revoked at Apple when we hold a token for it.

What it KEEPS:
- Gathering chats other people are still part of: only the user's messages leave.
- Abuse reports the user filed, and reports filed about the user, for moderation: reporter and
  reported-user links are cleared, leaving the report id, reason, description, date, status, what
  was reported (type, id, a short text snapshot) and admin notes. No name or email.
- Invites the user sent are deleted; invites others sent them are kept but blanked (above).
- Server logs and database backups age out on their normal schedule.

Everything runs in a few small transactions so a push or Apple failure never blocks deletion.
"""

from __future__ import annotations

import logging

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .apple_signin import revoke_refresh_token
from .models import Invite, SocialAuthIdentity
from .social import normalize_phone

logger = logging.getLogger(__name__)

DELETED_HOST_REASON = "The host deleted their account."


def cancel_upcoming_hosted_events(user) -> list[int]:
    """Mark the user's upcoming, not-yet-cancelled gatherings cancelled and note it in the chat.

    Returns the ids to notify. Same effect as ``cancel_event``; the actor is the user.
    """
    from activities.foyer_views import _post_cancel_chat_message
    from activities.models import Activity

    cancelled_ids = []
    now = timezone.now()
    with transaction.atomic():
        upcoming = (
            Activity.objects.select_for_update()
            .filter(host=user, is_cancelled=False, time__gt=now)
            .exclude(end_time__lte=now)
        )
        for activity in upcoming:
            activity.is_cancelled = True
            activity.cancelled_at = now
            activity.cancel_reason = DELETED_HOST_REASON
            activity.save(update_fields=["is_cancelled", "cancelled_at", "cancel_reason"])
            _post_cancel_chat_message(activity, user, DELETED_HOST_REASON)
            cancelled_ids.append(activity.id)
    return cancelled_ids


def notify_cancelled(user, activity_ids) -> None:
    """Push to attendees and pending requesters. Delivery problems are logged, never raised."""
    from activities.foyer_views import _notify_cancelled_attendees

    for activity_id in activity_ids:
        try:
            _notify_cancelled_attendees(activity_id, user.id, DELETED_HOST_REASON)
        except Exception:  # pragma: no cover - defensive; the push helper already logs
            logger.exception("Cancel notification failed activity_id=%s", activity_id)


def scrub_invites_addressed_to(user) -> int:
    """Blank contact details in invites other people sent to this user's email or phone."""
    matches = Q(invitee=user)
    if user.email:
        matches |= Q(channel="email", contact_value__iexact=user.email.strip())
    invites = list(Invite.objects.filter(matches).exclude(inviter=user))
    if user.phone:
        for invite in Invite.objects.filter(channel="sms").exclude(inviter=user):
            try:
                if normalize_phone(invite.contact_value) == user.phone:
                    invites.append(invite)
            except ValueError:
                continue
    ids = {invite.id for invite in invites}
    if not ids:
        return 0
    return Invite.objects.filter(id__in=ids).update(contact_name="", contact_value="")


def keep_gathering_chats(user) -> None:
    """Keep other people's gathering chats alive when the user is one of the chat's anchors.

    A gathering chat hangs off a Match (two anchor users + the activity). Deleting an anchor
    would cascade away every message. Instead: delete this user's messages, then re-anchor the
    chat to the first and last remaining confirmed attendees (the pair the chat endpoints use).
    With fewer than two attendees left nobody can open the chat, so it is deleted. Chats of
    gatherings the user hosted are skipped: those gatherings are deleted entirely.
    """
    from activities.models import Activity, ActivityParticipant
    from chat.models import Conversation, Message
    from matches.models import Match

    hosted = Activity.objects.filter(host=user).values_list("id", flat=True)
    anchored = (
        Match.objects.filter(activity__isnull=False)
        .filter(Q(user_a=user) | Q(user_b=user))
        .exclude(activity_id__in=list(hosted))
        .order_by("id")
    )
    for match in anchored:
        Message.objects.filter(conversation__match=match, sender=user).delete()
        remaining = list(
            ActivityParticipant.objects.filter(activity_id=match.activity_id, status="confirmed")
            .exclude(user=user)
            .order_by("joined_at", "id")
            .values_list("user_id", flat=True)
        )
        if len(remaining) < 2:
            match.delete()
            continue
        user_a, user_b = sorted([remaining[0], remaining[-1]])
        existing = (
            Match.objects.filter(activity_id=match.activity_id, user_a_id=user_a, user_b_id=user_b)
            .exclude(pk=match.pk)
            .first()
        )
        if existing is None:
            match.user_a_id, match.user_b_id = user_a, user_b
            match.save(update_fields=["user_a", "user_b"])
            continue
        # The target pair already has a chat: fold this one into it.
        target, _ = Conversation.objects.get_or_create(match=existing)
        Message.objects.filter(conversation__match=match).update(conversation=target)
        match.delete()


def delete_uploaded_photos(user) -> None:
    """Photos the user uploaded to anyone's gathering. The post_delete signal removes the files."""
    from activities.models import EventPhoto

    for photo in EventPhoto.objects.filter(uploaded_by=user):
        photo.delete()


def apple_refresh_tokens(user) -> list[str]:
    return list(
        SocialAuthIdentity.objects.filter(user=user, provider="apple")
        .exclude(apple_refresh_token="")
        .values_list("apple_refresh_token", flat=True)
    )


def delete_account(user) -> None:
    """Delete ``user`` and everything listed in the module docstring."""
    from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

    # 1. Tell attendees first, while the gatherings still exist.
    cancelled = cancel_upcoming_hosted_events(user)
    notify_cancelled(user, cancelled)

    tokens = apple_refresh_tokens(user)
    with transaction.atomic():
        # 2. Files, invites and chats that would otherwise be orphaned or cascade too far.
        delete_uploaded_photos(user)
        scrub_invites_addressed_to(user)
        keep_gathering_chats(user)
        OutstandingToken.objects.filter(user=user).delete()
        # 3. Everything else goes with the account row (foreign keys cascade or clear).
        user.delete()

    # 4. Apple asks apps to revoke the Sign in with Apple token. Best effort.
    for token in tokens:
        revoke_refresh_token(token)
