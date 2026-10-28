from utils.throttles import DynamicUserRateThrottle


class CircleCreateThrottle(DynamicUserRateThrottle):
    """Limits creating circles. Listing and search are not counted."""

    scope = "circle_create"

    def allow_request(self, request, view):
        if request.method != "POST":
            return True
        return super().allow_request(request, view)


class CircleInviteThrottle(DynamicUserRateThrottle):
    """Limits sending invites. Reading sent invites is not counted."""

    scope = "circle_invite"

    def allow_request(self, request, view):
        if request.method != "POST":
            return True
        return super().allow_request(request, view)
