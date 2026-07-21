from utils.throttles import DynamicUserRateThrottle


class ReviewCreateThrottle(DynamicUserRateThrottle):
    scope = "review_create"
