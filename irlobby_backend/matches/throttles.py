from utils.throttles import DynamicUserRateThrottle


class MatchReadThrottle(DynamicUserRateThrottle):
    scope = "match_reads"
