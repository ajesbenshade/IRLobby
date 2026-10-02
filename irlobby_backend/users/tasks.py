"""Daily "birthday today" push for friends of adults who chose to share their birthday."""

import calendar
import logging

from celery import shared_task
from django.db.models import Q

from activities.eligibility import ny_today

from .models import User
from .push_notifications import send_push_to_user
from .social import birthday_is_shareable, birthday_visible_to, blocked_user_ids, friend_ids

logger = logging.getLogger(__name__)


def _born_today_filter(today):
    """Month/day match for today; Feb 29 birthdays are celebrated on Feb 28 in non-leap years."""
    match = Q(date_of_birth__month=today.month, date_of_birth__day=today.day)
    if today.month == 2 and today.day == 28 and not calendar.isleap(today.year):
        match |= Q(date_of_birth__month=2, date_of_birth__day=29)
    return match


@shared_task
def send_birthday_notifications():
    """Notify each friend allowed to see the birthday. Same rules as GET /api/friends/birthdays/:
    show_birthday on, owner 18+, visibility level includes the friend, not blocked either way.
    Respects each recipient's pushNotifications preference (via send_push_to_user)."""
    today = ny_today()
    celebrants = User.objects.filter(
        _born_today_filter(today), is_active=True, show_birthday=True, date_of_birth__isnull=False
    )
    sent = 0
    for celebrant in celebrants:
        if not birthday_is_shareable(celebrant, today=today):
            continue
        name = (celebrant.first_name or "").strip() or "A friend"
        recipients = User.objects.filter(
            id__in=friend_ids(celebrant) - blocked_user_ids(celebrant), is_active=True
        )
        for friend in recipients:
            if not birthday_visible_to(friend, celebrant, today=today):
                continue
            send_push_to_user(
                friend,
                f"It's {name}'s birthday",
                f"Today is {name}'s birthday. Send them a note!",
                {"type": "friend_birthday", "userId": celebrant.id, "screen": "Profile"},
            )
            sent += 1
    logger.info(
        "Birthday notifications date=%s celebrants=%s sent=%s", today, len(celebrants), sent
    )
    return {"celebrants": len(celebrants), "sent": sent}
