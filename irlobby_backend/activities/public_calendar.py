"""Public church-website calendar. Approved listings only, no private fields."""

from __future__ import annotations

from datetime import timezone as dt_timezone

from activities.eligibility import audience_label, host_display_name
from activities.models import Activity
from activities.photos import cover_photo_url

PUBLIC_EVENT_FIELDS = (
    "title",
    "start",
    "end",
    "location",
    "host_name",
    "audience",
    "description",
    "cover_photo_url",
)
ICS_PRODID = "-//Franconia Mennonite Church//The Foyer//EN"


def public_calendar_queryset():
    return (
        Activity.objects.filter(list_on_church_calendar=True, calendar_approved=True)
        .select_related("host", "host_church")
        .prefetch_related("photos")
        .order_by("time", "id")
    )


def public_event_payload(activity, request=None) -> dict:
    end = activity.end_time.isoformat() if activity.end_time else None
    return {
        "title": activity.title,
        "start": activity.time.isoformat(),
        "end": end,
        "location": activity.location,
        "host_name": host_display_name(activity),
        "audience": audience_label(activity),
        "description": activity.description,
        "cover_photo_url": cover_photo_url(activity, request),
    }


def _ics_escape(value: str) -> str:
    return (
        (value or "")
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


def _ics_stamp(value):
    if value is None:
        return None
    from django.utils import timezone

    if timezone.is_naive(value):
        value = timezone.make_aware(value, dt_timezone.utc)
    return value.astimezone(dt_timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _fold(line: str) -> str:
    # RFC 5545: lines longer than 75 octets should be folded.
    encoded = line.encode("utf-8")
    if len(encoded) <= 75:
        return line
    chunks = []
    remaining = line
    limit = 75
    while remaining:
        piece = remaining
        while len(piece.encode("utf-8")) > limit and piece:
            piece = piece[:-1]
        if not piece:
            piece = remaining[:1]
        chunks.append(piece)
        remaining = remaining[len(piece) :]
        limit = 74
    return "\r\n ".join(chunks)


def public_calendar_ics(activities) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{ICS_PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:The Foyer",
    ]
    for activity in activities:
        payload = public_event_payload(activity)
        description_parts = [
            f"Host: {payload['host_name']}",
            f"Audience: {payload['audience']}",
            payload["description"] or "",
        ]
        if payload["cover_photo_url"]:
            description_parts.append(f"Photo: {payload['cover_photo_url']}")
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:foyer-activity-{activity.id}@franconiamennonite.org",
                f"DTSTAMP:{_ics_stamp(activity.created_at or activity.time)}",
                f"DTSTART:{_ics_stamp(activity.time)}",
            ]
        )
        if activity.end_time:
            lines.append(f"DTEND:{_ics_stamp(activity.end_time)}")
        lines.append(f"SUMMARY:{_ics_escape(payload['title'])}")
        lines.append(f"LOCATION:{_ics_escape(payload['location'])}")
        lines.append(f"DESCRIPTION:{_ics_escape(chr(10).join(description_parts))}")
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    body = "\r\n".join(_fold(line) for line in lines) + "\r\n"
    return body
