"""Shared rules for the Foyer social layer: blocks, friends, minors, shared events.

Everything that decides "may A see / contact B" lives here so profile, friends, chat
(REST and websocket) and attendee lists apply the same answer.
"""

from __future__ import annotations

import calendar
import re
from datetime import date

from django.db.models import Q
from django.utils import timezone

from activities.eligibility import age_on, ny_today
from moderation.models import BlockedUser

from .models import Friendship

# Why two checks for the same idea: "minor" is only known when a birth date is on file.
# Accounts without one are treated as adults (the app asks every new account for it).


def user_age(user) -> int | None:
    return age_on(user.date_of_birth, ny_today())


def is_minor(user) -> bool:
    age = user_age(user)
    return age is not None and age < 18


def blocked_user_ids(user) -> set[int]:
    """Ids of everyone who blocked `user` or whom `user` blocked."""
    rows = BlockedUser.objects.filter(Q(blocker=user) | Q(blocked=user)).values_list(
        "blocker_id", "blocked_id"
    )
    ids = {value for row in rows for value in row}
    ids.discard(user.id)
    return ids


def is_blocked_either_way(user_a_id: int, user_b_id: int) -> bool:
    return BlockedUser.objects.filter(
        Q(blocker_id=user_a_id, blocked_id=user_b_id)
        | Q(blocker_id=user_b_id, blocked_id=user_a_id)
    ).exists()


def friendship_between(user_a, user_b) -> Friendship | None:
    return Friendship.objects.filter(
        Q(requester=user_a, recipient=user_b) | Q(requester=user_b, recipient=user_a)
    ).first()


def are_friends(user_a, user_b) -> bool:
    return Friendship.objects.filter(
        Q(requester=user_a, recipient=user_b) | Q(requester=user_b, recipient=user_a),
        status="accepted",
    ).exists()


def friend_ids(user) -> set[int]:
    rows = Friendship.objects.filter(
        Q(requester=user) | Q(recipient=user), status="accepted"
    ).values_list("requester_id", "recipient_id")
    ids = {value for row in rows for value in row}
    ids.discard(user.id)
    return ids


def friendship_state(viewer, other) -> str:
    """none | friends | pending_outgoing | pending_incoming | self.

    A declined request still reads as pending_outgoing to the requester so a decline is
    never revealed to them.
    """
    if viewer.id == other.id:
        return "self"
    row = friendship_between(viewer, other)
    if row is None:
        return "none"
    if row.status == "accepted":
        return "friends"
    if row.requester_id == viewer.id:
        return "pending_outgoing"
    return "pending_incoming" if row.status == "pending" else "none"


def attended_activity_ids(user) -> set[int]:
    """Gatherings that have started where the user was hosting or had a going RSVP."""
    from activities.models import Activity, ActivityParticipant

    now = timezone.now()
    going = (
        ActivityParticipant.objects.filter(user=user, status="confirmed", activity__time__lte=now)
        .filter(Q(include_self=True) | Q(dependents__isnull=False))
        .values_list("activity_id", flat=True)
    )
    hosted = Activity.objects.filter(host=user, time__lte=now).values_list("id", flat=True)
    return set(going) | set(hosted)


def have_shared_event(user_a, user_b) -> bool:
    return bool(attended_activity_ids(user_a) & attended_activity_ids(user_b))


def same_church(user_a, user_b) -> bool:
    return user_a.church_id is not None and user_a.church_id == user_b.church_id


def level_allows(viewer, owner) -> bool:
    """Does the owner's chosen visibility level include this viewer?

    only_me = nobody else, friends = accepted friends, church = same church (friends
    included, since each level contains the one below it), public = any logged-in user.
    """
    if viewer.id == owner.id:
        return True
    level = owner.profile_visibility
    if level == "public":
        return True
    if level == "church":
        return same_church(viewer, owner) or are_friends(viewer, owner)
    if level == "friends":
        return are_friends(viewer, owner)
    return False


def can_view_profile(viewer, owner) -> bool:
    """Visibility gate for GET /api/users/<id>/profile/ (block check is the caller's job).

    Minors are visible only to accepted friends, whatever their setting says.
    """
    if viewer.id == owner.id:
        return True
    if is_minor(owner):
        return are_friends(viewer, owner)
    return level_allows(viewer, owner)


def can_send_friend_request(sender, target) -> bool:
    """Target must be reachable: shared attended event, same church, or public.

    A minor target is never reachable through "public" alone.
    """
    if sender.id == target.id or is_blocked_either_way(sender.id, target.id):
        return False
    if have_shared_event(sender, target) or same_church(sender, target):
        return True
    return target.profile_visibility == "public" and not is_minor(target)


def can_direct_message(sender, recipient, *, recipient_has_messaged_sender=False) -> bool:
    """May `sender` send a 1:1 message to `recipient` right now?

    Friends: yes. Otherwise only adults who attended a shared event, and only when the
    recipient opted in (dm_from_shared_events), or when the sender opted in and the
    recipient already wrote to them (so an opted-in person can reply). Any minor on
    either side means friends only. Blocks cut both ways.
    """
    if sender.id == recipient.id or is_blocked_either_way(sender.id, recipient.id):
        return False
    if are_friends(sender, recipient):
        return True
    if is_minor(sender) or is_minor(recipient):
        return False
    opted_in = recipient.dm_from_shared_events or (
        sender.dm_from_shared_events and recipient_has_messaged_sender
    )
    return bool(opted_in and have_shared_event(sender, recipient))


_PHONE_STRIP = re.compile(r"[\s().\-]")


def normalize_phone(value: str) -> str:
    """Return E.164 (+<country><number>) or raise ValueError. Empty clears the phone.

    10 digits (or 11 starting with 1) are read as US numbers.
    """
    raw = (value or "").strip()
    if not raw:
        return ""
    cleaned = _PHONE_STRIP.sub("", raw)
    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]
    if cleaned.startswith("+"):
        digits = cleaned[1:]
    else:
        digits = cleaned
        if len(digits) == 10:
            digits = "1" + digits
        elif not (len(digits) == 11 and digits.startswith("1")):
            raise ValueError("Enter a phone number with country code, like +12155550123.")
    if not digits.isdigit() or not 8 <= len(digits) <= 15 or digits.startswith("0"):
        raise ValueError("Enter a valid phone number, like +12155550123.")
    return f"+{digits}"


def short_name(user) -> str:
    """First name plus last initial; never a username or email."""
    first = (user.first_name or "").strip()
    last = (user.last_name or "").strip()
    if first and last:
        return f"{first} {last[0]}."
    return first or "Guest"


def full_name(user) -> str:
    full = f"{user.first_name} {user.last_name}".strip()
    return full or "Guest"


# ---- Birthdays -----------------------------------------------------------------------
# Only an adult's own month and day, only when they switched it on, only to people the
# profile visibility level lets in. The year is never shared. Children's birthdays are
# never shared at all (household members have no such setting).

BIRTHDAY_MINOR_ERROR = "Birthdays can only be shared by accounts 18 and older."
BIRTHDAY_NO_DOB_ERROR = "Add your birth date before sharing your birthday."


def birthday_in_year(dob: date, year: int) -> date:
    """The day `dob` is celebrated in `year`. Feb 29 falls on Feb 28 in non-leap years."""
    if dob.month == 2 and dob.day == 29 and not calendar.isleap(year):
        return date(year, 2, 28)
    return date(year, dob.month, dob.day)


def next_birthday(dob: date, today: date) -> date:
    """Today if it is the birthday, otherwise the next one (rolls into next year)."""
    upcoming = birthday_in_year(dob, today.year)
    if upcoming < today:
        upcoming = birthday_in_year(dob, today.year + 1)
    return upcoming


def days_until_birthday(dob: date, today: date) -> int:
    return (next_birthday(dob, today) - today).days


def birthday_is_shareable(owner, *, today: date | None = None) -> bool:
    """The owner turned sharing on, has a birth date, and is 18 or older."""
    if not owner.show_birthday or owner.date_of_birth is None:
        return False
    age = age_on(owner.date_of_birth, today or ny_today())
    return age is not None and age >= 18


def birthday_visible_to(viewer, owner, *, today: date | None = None) -> bool:
    """May `viewer` see `owner`'s month and day? Never for yourself (you have the full
    profile), blocked pairs, minors, or anyone outside the owner's visibility level."""
    if viewer.id == owner.id or not birthday_is_shareable(owner, today=today):
        return False
    if is_blocked_either_way(viewer.id, owner.id):
        return False
    return level_allows(viewer, owner)
