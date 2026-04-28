from rest_framework.throttling import UserRateThrottle


class SwipeRateThrottle(UserRateThrottle):
    scope = "swipe_ops"
