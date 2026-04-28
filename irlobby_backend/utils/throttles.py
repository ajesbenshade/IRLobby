from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class DynamicThrottleRateMixin:
    """Read throttle rates from current Django settings for each request.

    DRF stores ``DEFAULT_THROTTLE_RATES`` on ``SimpleRateThrottle`` at import
    time. These project throttles are exercised with ``override_settings`` in
    tests, so they must look up the active setting dynamically instead of using
    the imported class attribute.
    """

    def get_rate(self):
        if not getattr(self, "scope", None):
            msg = (
                "You must set either `.scope` or `.rate` for '%s' throttle"
                % self.__class__.__name__
            )
            raise ImproperlyConfigured(msg)

        throttle_rates = getattr(settings, "REST_FRAMEWORK", {}).get("DEFAULT_THROTTLE_RATES", {})
        return throttle_rates.get(self.scope)


class DynamicAnonRateThrottle(DynamicThrottleRateMixin, AnonRateThrottle):
    pass


class DynamicUserRateThrottle(DynamicThrottleRateMixin, UserRateThrottle):
    pass
