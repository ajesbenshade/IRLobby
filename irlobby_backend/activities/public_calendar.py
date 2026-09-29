"""Public church calendar. No accounts, no RSVP lists, no private profile fields."""

from django.http import HttpResponse
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .foyer import PUBLIC_CALENDAR_FIELDS, public_calendar_queryset, public_event_payload

ICS_PRODID = "-//Franconia Mennonite Church//The Foyer//EN"


def _ics_escape(value: str) -> str:
    return (
        (value or "")
        .replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace(",", "\\,")
        .replace(";", "\\;")
    )


def _ics_stamp(iso_value: str) -> str:
    # YYYYMMDDTHHMMSSZ from an ISO timestamp. Naive values are passed through as UTC.
    cleaned = (iso_value or "").replace("-", "").replace(":", "")
    if cleaned.endswith("+00:00"):
        cleaned = cleaned[: -len("+00:00")] + "Z"
    if "." in cleaned:
        cleaned = cleaned.split(".", 1)[0]
    if not cleaned.endswith("Z"):
        cleaned = f"{cleaned}Z"
    return cleaned


def events_to_ics(events: list[dict]) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{ICS_PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Franconia Mennonite Church",
    ]
    for index, event in enumerate(events, start=1):
        description = event.get("description") or ""
        audience = event.get("audience") or ""
        summary = event.get("title") or "Gathering"
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:foyer-{index}-{_ics_escape(summary)}@franconiamennonite.org",
                f"DTSTART:{_ics_stamp(event.get('start') or '')}",
                f"SUMMARY:{_ics_escape(summary)}",
                f"LOCATION:{_ics_escape(event.get('location') or '')}",
                f"DESCRIPTION:{_ics_escape(description)}\\nAudience: {_ics_escape(audience)}",
            ]
        )
        if event.get("end"):
            lines.append(f"DTEND:{_ics_stamp(event['end'])}")
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


class PublicCalendarView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        events = [
            public_event_payload(activity, request)
            for activity in public_calendar_queryset()
        ]
        for event in events:
            extra = set(event) - set(PUBLIC_CALENDAR_FIELDS)
            if extra:
                raise RuntimeError(f"Public calendar leaked fields: {sorted(extra)}")
        return Response(events)


class PublicCalendarIcsView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        events = [
            public_event_payload(activity, request)
            for activity in public_calendar_queryset()
        ]
        body = events_to_ics(events)
        return HttpResponse(body, content_type="text/calendar; charset=utf-8")
