from utils.throttles import DynamicAnonRateThrottle, DynamicUserRateThrottle


class AuthAnonThrottle(DynamicAnonRateThrottle):
    scope = "auth_anon"


class AuthUserThrottle(DynamicUserRateThrottle):
    scope = "auth_user"


class FriendRequestThrottle(DynamicUserRateThrottle):
    """Limits sending friend requests only; reading the inbox is not counted."""

    scope = "friend_requests"

    def allow_request(self, request, view):
        if request.method != "POST":
            return True
        return super().allow_request(request, view)
