from rest_framework.throttling import UserRateThrottle


class MatchReadThrottle(UserRateThrottle):
    scope = "match_reads"
