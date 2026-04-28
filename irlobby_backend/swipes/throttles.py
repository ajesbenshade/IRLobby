from utils.throttles import DynamicUserRateThrottle


class SwipeRateThrottle(DynamicUserRateThrottle):
    scope = "swipe_ops"
