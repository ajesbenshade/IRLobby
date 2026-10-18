from utils.throttles import DynamicAnonRateThrottle, DynamicUserRateThrottle


class PublicCalendarThrottle(DynamicAnonRateThrottle):
    """Per-IP limit on the unauthenticated church calendar JSON and .ics files.

    The client is identified the same way as the other anonymous throttles
    (``X-Forwarded-For`` set by nginx, falling back to ``REMOTE_ADDR``).
    """

    scope = "public_calendar"


class EventPhotoUploadThrottle(DynamicUserRateThrottle):
    """Per-user limit on gathering photo uploads (default 30 an hour)."""

    scope = "event_photo_upload"
