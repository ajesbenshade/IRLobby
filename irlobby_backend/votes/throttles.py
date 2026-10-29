from utils.throttles import DynamicUserRateThrottle


class BallotCreateThrottle(DynamicUserRateThrottle):
    """Limits creating ballots. Listing is not counted."""

    scope = "ballot_create"

    def allow_request(self, request, view):
        if request.method != "POST":
            return True
        return super().allow_request(request, view)
