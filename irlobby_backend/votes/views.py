from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .access import (
    BallotActionError,
    cast_vote,
    close_ballot,
    split_ballots,
    viewer_flags,
    visible_ballot,
)
from .eligibility import NOT_VOTING_MEMBER_CODE, is_voting_member, not_voting_member_detail
from .serializers import BallotCreateSerializer, BallotSerializer, BallotVoteSerializer
from .throttles import BallotCreateThrottle


def _context(request):
    return {"request": request, "flags": viewer_flags(request.user)}


def _present(request, ballot_id):
    ballot = visible_ballot(request.user, ballot_id)
    return BallotSerializer(ballot, context=_context(request)).data


def _not_voting_member():
    return Response(
        {"detail": not_voting_member_detail(), "code": NOT_VOTING_MEMBER_CODE},
        status=status.HTTP_403_FORBIDDEN,
    )


class BallotListCreateView(APIView):
    """Voting tab. Open and closed sections, newest first. No public list."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [BallotCreateThrottle]

    def get(self, request):
        open_ballots, closed_ballots = split_ballots(request.user)
        context = _context(request)
        return Response(
            {
                "open": BallotSerializer(open_ballots, many=True, context=context).data,
                "closed": BallotSerializer(closed_ballots, many=True, context=context).data,
            }
        )

    def post(self, request):
        if not is_voting_member(request.user):
            return _not_voting_member()
        serializer = BallotCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        ballot = serializer.save()
        return Response(_present(request, ballot.pk), status=status.HTTP_201_CREATED)


class BallotDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        return Response(_present(request, pk))


class BallotVoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        visible_ballot(request.user, pk)
        serializer = BallotVoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            cast_vote(request.user, pk, serializer.validated_data["choice_id"])
        except BallotActionError as exc:
            return Response(exc.data, status=exc.status_code)
        return Response(_present(request, pk), status=status.HTTP_201_CREATED)


class BallotCloseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        visible_ballot(request.user, pk)
        try:
            close_ballot(request.user, pk)
        except BallotActionError as exc:
            return Response(exc.data, status=exc.status_code)
        return Response(_present(request, pk))
