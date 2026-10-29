"""Who may see a ballot, cast a vote, or close it.

Visibility follows prayer circles, then the voting-member gate:

- Whole-church ballots are visible to voting members of that church.
- Otherwise only voting members of the chosen circles, plus the author.
- A church admin who is a voting member sees every ballot in their church.
- Someone outside the circle, in another church, or not a voting member gets nothing.
  Household children are not accounts. A voting member has a non-null
  ``voting_member_attested_at``. Age 18 in America/New_York is only the fallback
  when that column is absent.

Casting is stricter than seeing: the account must be in the audience (a chosen
circle, or the church when the ballot is whole-church). Church-admin sight does
not by itself cast a vote. One account, one cast.

Closing and early results are circle-admin powers for a ballot's circles, and
church-admin powers for every ballot in that church.
"""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from rest_framework.exceptions import NotFound

from activities.access import is_church_admin
from prayers.models import CircleMembership

from .eligibility import is_voting_member
from .models import Ballot, BallotChoice, BallotVote

BALLOT_CLOSED = "This ballot is closed."
BALLOT_CLOSED_CODE = "ballot_closed"
ALREADY_VOTED = "You already voted on this ballot."
ALREADY_VOTED_CODE = "already_voted"
NOT_ELIGIBLE = "You are not in the group that votes on this ballot."
NOT_ELIGIBLE_CODE = "not_eligible"
NOT_BALLOT_ADMIN = "Only a circle admin can close this ballot."
NOT_BALLOT_ADMIN_CODE = "not_ballot_admin"
BAD_CHOICE = "Choose one of this ballot's choices."


class BallotActionError(Exception):
    def __init__(self, status_code: int, data: dict):
        self.status_code = status_code
        self.data = data


def viewer_flags(user) -> dict:
    member_ids: set[int] = set()
    admin_ids: set[int] = set()
    if getattr(user, "is_authenticated", False):
        for circle_id, is_admin in CircleMembership.objects.filter(user=user).values_list(
            "circle_id", "is_admin"
        ):
            member_ids.add(circle_id)
            if is_admin:
                admin_ids.add(circle_id)
    return {
        "member_circle_ids": member_ids,
        "admin_circle_ids": admin_ids,
        "church_admin": is_church_admin(user),
        "voting_member": is_voting_member(user),
    }


def visible_ballot_ids(user):
    if not is_voting_member(user):
        return Ballot.objects.none().values("id")
    member_circles = CircleMembership.objects.filter(user=user).values("circle_id")
    visibility = Q(author=user) | Q(circles__in=member_circles)
    if user.church_id:
        visibility |= Q(whole_church=True, church_id=user.church_id)
        if is_church_admin(user):
            visibility |= Q(church_id=user.church_id)
    return Ballot.objects.filter(visibility).values("id").distinct()


def annotated_ballots(user):
    choice_qs = BallotChoice.objects.annotate(vote_count=Count("votes")).order_by("position", "id")
    viewer_votes = BallotVote.objects.filter(user_id=user.id)
    return (
        Ballot.objects.filter(id__in=visible_ballot_ids(user))
        .select_related("author")
        .prefetch_related(
            "circles",
            Prefetch("choices", queryset=choice_qs),
            Prefetch("votes", queryset=viewer_votes, to_attr="viewer_votes"),
        )
        .annotate(total_votes=Count("votes"))
        .order_by("-created_at", "-id")
    )


def user_in_audience(user, ballot) -> bool:
    if ballot.whole_church and user.church_id and user.church_id == ballot.church_id:
        return True
    return CircleMembership.objects.filter(user=user, circle__ballots=ballot).exists()


def user_can_manage(user, ballot) -> bool:
    if not is_voting_member(user):
        return False
    if user.church_id and user.church_id == ballot.church_id and is_church_admin(user):
        return True
    return CircleMembership.objects.filter(
        user=user, is_admin=True, circle__ballots=ballot
    ).exists()


def visible_ballot(user, pk) -> Ballot:
    ballot = annotated_ballots(user).filter(pk=pk).first()
    if ballot is None:
        raise NotFound()
    return ballot


def _lock_ballot(pk) -> Ballot | None:
    return Ballot.objects.select_for_update().filter(pk=pk).first()


def cast_vote(user, ballot_id: int, choice_id: int) -> None:
    with transaction.atomic():
        ballot = _lock_ballot(ballot_id)
        if (
            ballot is None
            or not Ballot.objects.filter(pk=ballot.pk, id__in=visible_ballot_ids(user)).exists()
        ):
            raise NotFound()
        if not ballot.is_open_at():
            raise BallotActionError(400, {"detail": BALLOT_CLOSED, "code": BALLOT_CLOSED_CODE})
        if not user_in_audience(user, ballot):
            raise BallotActionError(403, {"detail": NOT_ELIGIBLE, "code": NOT_ELIGIBLE_CODE})
        choice = BallotChoice.objects.filter(pk=choice_id, ballot=ballot).first()
        if choice is None:
            raise BallotActionError(400, {"choice_id": BAD_CHOICE})
        try:
            with transaction.atomic():
                BallotVote.objects.create(ballot=ballot, choice=choice, user=user)
        except IntegrityError:
            raise BallotActionError(
                400, {"detail": ALREADY_VOTED, "code": ALREADY_VOTED_CODE}
            ) from None


def close_ballot(user, ballot_id: int) -> None:
    with transaction.atomic():
        ballot = _lock_ballot(ballot_id)
        if (
            ballot is None
            or not Ballot.objects.filter(pk=ballot.pk, id__in=visible_ballot_ids(user)).exists()
        ):
            raise NotFound()
        if not user_can_manage(user, ballot):
            raise BallotActionError(
                403, {"detail": NOT_BALLOT_ADMIN, "code": NOT_BALLOT_ADMIN_CODE}
            )
        if ballot.is_open_at():
            ballot.closed_at = timezone.now()
            ballot.save(update_fields=["closed_at"])


def split_ballots(user):
    """Open and closed lists, each newest first."""
    now = timezone.now()
    base = annotated_ballots(user)
    open_ballots = base.filter(closed_at__isnull=True, closes_at__gt=now)
    closed_ballots = base.filter(Q(closed_at__isnull=False) | Q(closes_at__lte=now))
    return open_ballots, closed_ballots
