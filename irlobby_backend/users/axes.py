from axes.helpers import get_cool_off, get_failure_limit
from django.http import JsonResponse


def lockout_response(request, original_response=None, credentials=None):
    cool_off = get_cool_off(request)
    payload = {
        "error": "Too many failed login attempts. Please try again later.",
        "error_code": "login_locked",
        "failure_limit": get_failure_limit(request, credentials),
    }
    if cool_off:
        payload["cooloff_seconds"] = int(cool_off.total_seconds())
    return JsonResponse(payload, status=429)
