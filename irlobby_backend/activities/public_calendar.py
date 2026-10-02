"""Public church-website calendar and per-gathering calendar links.

Approved listings are on the public feed. Every gathering the app can show also
has a calendar file Safari can open with no Authorization header. Member events
that are not on that feed use a stable signed token so ids cannot be enumerated.
"""

from __future__ import annotations

from datetime import timedelta
from datetime import timezone as dt_timezone
from urllib.parse import quote, urlencode, urlsplit, urlunsplit

from django.core.signing import BadSignature, Signer
from django.utils import timezone

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
CHURCH_CALENDAR_NAME = "Franconia Mennonite Church – The Foyer"
CHURCH_TIMEZONE = "America/New_York"
ICS_TOKEN_SALT = "foyer-event-ics"
_SIGNER = Signer(salt=ICS_TOKEN_SALT)


def public_calendar_queryset():
    return (
        Activity.objects.filter(list_on_church_calendar=True, calendar_approved=True)
        .select_related("host", "host_church")
        .prefetch_related("photos")
        .order_by("time", "id")
    )


def is_public_calendar_event(activity) -> bool:
    return bool(activity.list_on_church_calendar and activity.calendar_approved)


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


NO_LOCATION_SUFFIX = ":nl"


def event_ics_token(activity_id: int, *, hide_location: bool = False) -> str:
    """Stable token for one activity. It does not change between requests.

    The ``hide_location`` variant goes to viewers who may not see the address of a
    member-hosted gathering; the .ics it opens leaves LOCATION empty.
    """
    return _SIGNER.sign(f"{activity_id}{NO_LOCATION_SUFFIX if hide_location else ''}")


def activity_id_from_ics_token(token: str) -> int | None:
    if not token:
        return None
    try:
        raw = _SIGNER.unsign(token)
        return int(raw.removesuffix(NO_LOCATION_SUFFIX))
    except (BadSignature, ValueError, TypeError):
        return None


def ics_token_hides_location(token: str) -> bool:
    try:
        return _SIGNER.unsign(token or "").endswith(NO_LOCATION_SUFFIX)
    except BadSignature:
        return False


def event_uid(activity) -> str:
    return f"foyer-activity-{activity.id}@franconiamennonite.org"


def calendar_host_name(activity) -> str:
    name = host_display_name(activity)
    if "@" in name:
        return "Host"
    return name


def event_description(activity) -> str:
    """Host name plus the gathering description. No contact or attendee data."""
    host = calendar_host_name(activity)
    description = (activity.description or "").strip()
    if description:
        return f"Host: {host}\n{description}"
    return f"Host: {host}"


def _as_utc(value):
    if value is None:
        return None
    if timezone.is_naive(value):
        value = timezone.make_aware(value, dt_timezone.utc)
    return value.astimezone(dt_timezone.utc)


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
    utc = _as_utc(value)
    if utc is None:
        return None
    return utc.strftime("%Y%m%dT%H%M%SZ")


def _iso_z(value) -> str:
    return _as_utc(value).strftime("%Y-%m-%dT%H:%M:%SZ")


def _revision(activity):
    return _as_utc(activity.updated_at or activity.created_at or activity.time)


def _sequence(activity) -> int:
    return max(int(_revision(activity).timestamp()), 0)


def _ics_end_stamp(activity):
    """DTEND for a timed event. Missing or non-positive ends are omitted."""
    end = _as_utc(activity.end_time)
    start = _as_utc(activity.time)
    if end is None or end <= start:
        return None
    return end.strftime("%Y%m%dT%H%M%SZ")


def _link_range(activity):
    """Positive UTC range for Google and Outlook. Zero-length becomes one hour."""
    start = _as_utc(activity.time)
    end = _as_utc(activity.end_time)
    if end is None or end <= start:
        end = start + timedelta(hours=1)
    return start, end


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


def _calendar_header(*, name: str | None) -> list[str]:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{ICS_PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-TIMEZONE:{CHURCH_TIMEZONE}",
    ]
    if name:
        lines.append(f"X-WR-CALNAME:{name}")
    return lines


def _vevent_lines(
    activity, *, description: str, dtstamp: str, hide_location: bool = False
) -> list[str]:
    lines = [
        "BEGIN:VEVENT",
        f"UID:{event_uid(activity)}",
        f"DTSTAMP:{dtstamp}",
        f"LAST-MODIFIED:{_ics_stamp(_revision(activity))}",
        f"SEQUENCE:{_sequence(activity)}",
        f"DTSTART:{_ics_stamp(activity.time)}",
    ]
    end_stamp = _ics_end_stamp(activity)
    if end_stamp:
        lines.append(f"DTEND:{end_stamp}")
    lines.extend(
        [
            f"SUMMARY:{_ics_escape(activity.title)}",
            f"LOCATION:{_ics_escape('' if hide_location else activity.location or '')}",
            f"DESCRIPTION:{_ics_escape(description)}",
            "END:VEVENT",
        ]
    )
    return lines


def _render(lines: list[str]) -> str:
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"


def _public_feed_description(activity) -> str:
    payload = public_event_payload(activity)
    parts = [
        f"Host: {calendar_host_name(activity)}",
        f"Audience: {payload['audience']}",
        payload["description"] or "",
    ]
    if payload["cover_photo_url"]:
        parts.append(f"Photo: {payload['cover_photo_url']}")
    return "\n".join(parts)


def public_calendar_ics(activities) -> str:
    dtstamp = _ics_stamp(timezone.now())
    lines = _calendar_header(name=CHURCH_CALENDAR_NAME)
    for activity in activities:
        lines.extend(
            _vevent_lines(activity, description=_public_feed_description(activity), dtstamp=dtstamp)
        )
    lines.append("END:VCALENDAR")
    return _render(lines)


def event_ics(activity, *, hide_location: bool = False) -> str:
    """One gathering. Title, start, end, location, description, and host name only."""
    dtstamp = _ics_stamp(timezone.now())
    lines = _calendar_header(name=None)
    lines.extend(
        _vevent_lines(
            activity,
            description=event_description(activity),
            dtstamp=dtstamp,
            hide_location=hide_location,
        )
    )
    lines.append("END:VCALENDAR")
    return _render(lines)


def _query(params: dict[str, str]) -> str:
    return urlencode(params, quote_via=quote, safe="/")


def private_event_ics_path(activity_id: int, *, hide_location: bool = False) -> str:
    token = event_ics_token(activity_id, hide_location=hide_location)
    return "/api/public/event.ics?" + _query({"token": token})


def to_webcal(url: str) -> str:
    parsed = urlsplit(url)
    if parsed.scheme in ("http", "https"):
        return urlunsplit(("webcal", parsed.netloc, parsed.path, parsed.query, parsed.fragment))
    return url


def google_calendar_url(activity, *, hide_location: bool = False) -> str:
    start, end = _link_range(activity)
    query = _query(
        {
            "action": "TEMPLATE",
            "text": activity.title or "",
            "dates": f"{_ics_stamp(start)}/{_ics_stamp(end)}",
            "details": event_description(activity),
            "location": "" if hide_location else activity.location or "",
        }
    )
    return f"https://calendar.google.com/calendar/render?{query}"


def outlook_calendar_url(activity, *, hide_location: bool = False) -> str:
    start, end = _link_range(activity)
    query = _query(
        {
            "subject": activity.title or "",
            "body": event_description(activity),
            "startdt": _iso_z(start),
            "enddt": _iso_z(end),
            "location": "" if hide_location else activity.location or "",
        }
    )
    return f"https://outlook.live.com/calendar/0/deeplink/compose?{query}"


def build_calendar_links(activity, request, *, hide_location: bool = False) -> dict[str, str]:
    if is_public_calendar_event(activity):
        path = f"/api/public/events/{activity.id}.ics"
    else:
        path = private_event_ics_path(activity.id, hide_location=hide_location)
    if request is not None:
        ics_url = request.build_absolute_uri(path)
    else:
        ics_url = path
    return {
        "ics_url": ics_url,
        "webcal_url": to_webcal(ics_url),
        "google_url": google_calendar_url(activity, hide_location=hide_location),
        "outlook_url": outlook_calendar_url(activity, hide_location=hide_location),
    }
