from utils.throttles import DynamicAnonRateThrottle


class PublicCalendarThrottle(DynamicAnonRateThrottle):
    """Per-IP limit on the unauthenticated church calendar JSON and .ics files.

    The client is identified the same way as the other anonymous throttles
    (``X-Forwarded-For`` set by nginx, falling back to ``REMOTE_ADDR``).
    """

    scope = "public_calendar"
