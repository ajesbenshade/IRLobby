"""Beta limits: how often a member may create gatherings, and how fast photos may be uploaded.

Error bodies share one shape: ``code`` and ``detail`` always, ``retry_after`` (seconds) on every
429, plus limit-specific fields. Every 429 also carries a ``Retry-After`` header.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from .access import is_church_admin

NY = ZoneInfo("America/New_York")


def event_create_limit() -> int:
    return int(getattr(settings, "FOYER_EVENT_CREATE_LIMIT", 1))


def event_create_window() -> timedelta:
    return timedelta(days=int(getattr(settings, "FOYER_EVENT_CREATE_WINDOW_DAYS", 7)))


def event_limit_exempt_emails() -> set[str]:
    raw = getattr(settings, "FOYER_EVENT_LIMIT_EXEMPT_EMAILS", []) or []
    return {email.strip().lower() for email in raw if isinstance(email, str) and email.strip()}


def is_event_limit_exempt(user) -> bool:
    """Church admins, staff, superusers and the listed accounts (e.g. Apple's review login).

    Being on the exempt list does NOT make someone a church admin.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_staff or user.is_superuser or is_church_admin(user):
        return True
    email = (getattr(user, "email", "") or "").strip().lower()
    return bool(email) and email in event_limit_exempt_emails()


def next_host_available_at(user, now: datetime | None = None) -> datetime | None:
    """When ``user`` may create their next gathering, or None if they can now (or are exempt).

    Counts every gathering they created in the rolling window, cancelled and deleted ones too.
    """
    if is_event_limit_exempt(user):
        return None
    from .models import EventCreationLog

    limit = event_create_limit()
    window = event_create_window()
    now = now or timezone.now()
    stamps = list(
        EventCreationLog.objects.filter(user=user, created_at__gt=now - window)
        .order_by("created_at")
        .values_list("created_at", flat=True)
    )
    if len(stamps) < limit:
        return None
    # The slot frees up once enough of the oldest counted rows have aged out of the window.
    return stamps[len(stamps) - limit] + window


def _retry_seconds(until: datetime, now: datetime) -> int:
    return max(1, math.ceil((until - now).total_seconds()))


def _limit_period() -> str:
    days = event_create_window().days
    return "week" if days == 7 else f"{days} days"


def event_limit_response(next_allowed: datetime, now: datetime | None = None) -> Response:
    now = now or timezone.now()
    retry_after = _retry_seconds(next_allowed, now)
    limit = event_create_limit()
    local = next_allowed.astimezone(NY)
    when = f"{local:%A, %B} {local.day} at {local:%I:%M %p}".replace(" 0", " ")
    noun = "event" if limit == 1 else "events"
    period = _limit_period()
    per = f"a {period}" if period == "week" else f"every {period}"
    response = Response(
        {
            "code": "event_limit_reached",
            "limit": limit,
            "period": period,
            "retry_after": retry_after,
            "next_allowed_at": next_allowed.isoformat(),
            "detail": f"You can create {limit} {noun} {per}. You can create your next one on {when}.",
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )
    response["Retry-After"] = str(retry_after)
    return response


def throttled_response(wait_seconds: float | None) -> Response:
    retry_after = max(1, math.ceil(wait_seconds or 1))
    response = Response(
        {
            "code": "throttled",
            "detail": f"You're uploading photos too quickly. Try again in {retry_after} seconds.",
            "retry_after": retry_after,
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )
    response["Retry-After"] = str(retry_after)
    return response
