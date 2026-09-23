from django.conf import settings
from waffle import flag_is_active


def ticketing_enabled(request):
    return flag_is_active(request, "ticketed_events_enabled") or settings.ENABLE_TICKETING
