from datetime import datetime, time, timedelta, timezone

from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import Throttled

from utils.throttles import DynamicUserRateThrottle


class SwipeRateThrottle(DynamicUserRateThrottle):
    scope = "swipe_ops"


def _seconds_until_next_utc_midnight(now=None):
    now = now or datetime.now(timezone.utc)
    tomorrow = now.date() + timedelta(days=1)
    reset_at = datetime.combine(tomorrow, time.min, tzinfo=timezone.utc)
    return max(1, int((reset_at - now).total_seconds()))


def _swipe_daily_key(user, now=None):
    now = now or datetime.now(timezone.utc)
    return f"swipes:daily:{user.pk}:{now.date().isoformat()}"


def get_swipes_remaining_today(user):
    limit = getattr(settings, "SWIPE_DAILY_LIMIT", 500)
    if limit <= 0:
        return None

    try:
        used_count = int(cache.get(_swipe_daily_key(user), 0) or 0)
    except (TypeError, ValueError):
        used_count = 0
    return max(0, limit - used_count)


def check_swipe_daily_limit(user):
    limit = getattr(settings, "SWIPE_DAILY_LIMIT", 500)
    if limit <= 0:
        return

    now = datetime.now(timezone.utc)
    timeout = _seconds_until_next_utc_midnight(now)
    key = _swipe_daily_key(user, now)
    if cache.add(key, 1, timeout=timeout):
        return

    try:
        count = cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=timeout)
        return

    if count > limit:
        raise Throttled(
            wait=timeout,
            detail="Daily swipe limit reached. Please try again after midnight UTC.",
        )
