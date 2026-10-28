"""Join policy A: admins approve requests, invites skip the queue, open join does not exist.

Church-scoped. A circle always keeps at least one admin. The creator starts as that admin.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from users.social import blocked_user_ids, is_blocked_either_way

from .models import Circle, CircleInvite, CircleJoinRequest, CircleMembership
from .serializers import author_card

User = get_user_model()

LAST_ADMIN_MESSAGE = "Circles need at least one admin."
LAST_ADMIN_CODE = "last_admin"
OPEN_JOIN_MESSAGE = "Open join is closed. Request to join and wait for an admin to approve."
OPEN_JOIN_CODE = "open_join_closed"
ALREADY_MEMBER = "You are already in this circle."
ALREADY_INVITED = "You already have an invite to this circle. Accept it to join."
INVITE_CAP = 50
INVITE_CAP_MESSAGE = "This circle already has 50 pending invites."
INVITE_BATCH_MAX = 50
PEOPLE_SEARCH_LIMIT = 20
MEMBER_PREVIEW_LIMIT = 8

NOT_IN_CIRCLE = "That person is not in this circle."


def annotated_circles(user):
    """Church circles with membership flags for `user`. Empty when they have no church."""
    if not getattr(user, "church_id", None):
        return Circle.objects.none()
    member_rows = CircleMembership.objects.filter(circle=OuterRef("pk"), user_id=user.id)
    admin_rows = CircleMembership.objects.filter(
        circle=OuterRef("pk"), user_id=user.id, is_admin=True
    )
    return (
        Circle.objects.filter(church_id=user.church_id)
        .annotate(
            member_count=Count("memberships"),
            is_member=Exists(member_rows),
            is_admin=Exists(admin_rows),
            has_pending_request=Exists(
                CircleJoinRequest.objects.filter(
                    circle=OuterRef("pk"),
                    user_id=user.id,
                    status=CircleJoinRequest.STATUS_PENDING,
                )
            ),
            has_pending_invite=Exists(
                CircleInvite.objects.filter(
                    circle=OuterRef("pk"),
                    invitee_id=user.id,
                    status=CircleInvite.STATUS_PENDING,
                )
            ),
        )
        .order_by("name", "id")
    )


def circle_or_404(user, pk) -> Circle:
    if not getattr(user, "church_id", None):
        raise NotFound()
    circle = Circle.objects.filter(pk=pk, church_id=user.church_id).first()
    if circle is None:
        raise NotFound()
    return circle


def require_admin(user, circle) -> CircleMembership:
    membership = CircleMembership.objects.filter(circle=circle, user=user, is_admin=True).first()
    if membership is None:
        raise PermissionDenied("Only a circle admin can do that.")
    return membership


def hand_off_last_admin(user) -> None:
    """Promote the earliest other member in circles where `user` is the only admin.

    Called before the account row is deleted, which cascades their membership away.
    A circle with no other members is left empty.
    """
    circle_ids = list(
        CircleMembership.objects.filter(user=user, is_admin=True).values_list(
            "circle_id", flat=True
        )
    )
    for circle_id in circle_ids:
        if (
            CircleMembership.objects.filter(circle_id=circle_id, is_admin=True)
            .exclude(user=user)
            .exists()
        ):
            continue
        successor = (
            CircleMembership.objects.filter(circle_id=circle_id)
            .exclude(user=user)
            .order_by("joined_at", "id")
            .first()
        )
        if successor is not None and not successor.is_admin:
            successor.is_admin = True
            successor.save(update_fields=["is_admin"])


def reported_user_for_circle(circle, reporter):
    """The person named on a circle report. Never the reporter (that would be a self-report)."""
    if circle.created_by_id and circle.created_by_id != reporter.id:
        return circle.created_by
    other = (
        CircleMembership.objects.filter(circle=circle, is_admin=True)
        .exclude(user_id=reporter.id)
        .select_related("user")
        .order_by("joined_at", "id")
        .first()
    )
    return other.user if other is not None else None


def member_payload(membership) -> dict:
    card = author_card(membership.user)
    card["is_admin"] = membership.is_admin
    card["joined_at"] = membership.joined_at
    return card


def member_rows(circle, *, limit=None):
    rows = list(
        CircleMembership.objects.filter(circle=circle).select_related("user").order_by("id")
    )
    rows.sort(key=lambda row: (author_card(row.user)["display_name"].casefold(), row.user_id))
    if limit is not None:
        return rows[:limit]
    return rows


def join_request_payload(row) -> dict:
    return {
        "id": row.id,
        "circle_id": row.circle_id,
        "status": row.status,
        "user": author_card(row.user),
        "created_at": row.created_at,
    }


def invite_payload(invite, *, include_circle=False) -> dict:
    data = {
        "id": invite.id,
        "circle_id": invite.circle_id,
        "status": invite.status,
        "invitee": author_card(invite.invitee),
        "inviter": author_card(invite.inviter) if invite.inviter_id else None,
        "created_at": invite.created_at,
    }
    if include_circle:
        circle = invite.circle
        data["circle"] = {
            "id": circle.id,
            "name": circle.name,
            "description": circle.description,
            "member_count": circle.memberships.count(),
        }
    return data


def _lock_circle(circle_id) -> Circle:
    return Circle.objects.select_for_update().get(pk=circle_id)


def _last_admin_error():
    raise ValidationError({"detail": LAST_ADMIN_MESSAGE, "code": LAST_ADMIN_CODE})


def _raise_if_last_admin(circle, membership) -> None:
    if not membership.is_admin:
        return
    other_admin = (
        CircleMembership.objects.filter(circle=circle, is_admin=True)
        .exclude(pk=membership.pk)
        .exists()
    )
    if not other_admin:
        _last_admin_error()


def _grant_membership(circle, user) -> CircleMembership:
    """Add `user` as a regular member. Does not remove an admin flag they already have."""
    membership = (
        CircleMembership.objects.select_for_update().filter(circle=circle, user=user).first()
    )
    if membership is not None:
        return membership
    try:
        with transaction.atomic():
            return CircleMembership.objects.create(circle=circle, user=user, is_admin=False)
    except IntegrityError:
        return CircleMembership.objects.select_for_update().get(circle=circle, user=user)


def _close_pending_invites(circle, user, *, status) -> None:
    CircleInvite.objects.filter(
        circle=circle, invitee=user, status=CircleInvite.STATUS_PENDING
    ).update(status=status, responded_at=timezone.now())


def _close_pending_requests(circle, user, *, status, responded_by=None) -> None:
    CircleJoinRequest.objects.filter(
        circle=circle, user=user, status=CircleJoinRequest.STATUS_PENDING
    ).update(status=status, responded_at=timezone.now(), responded_by=responded_by)


def request_to_join(user, circle):
    """Return (row, created). A second request while one is pending returns the same row."""
    with transaction.atomic():
        _lock_circle(circle.pk)
        if CircleMembership.objects.filter(circle=circle, user=user).exists():
            raise ValidationError({"detail": ALREADY_MEMBER})
        if CircleInvite.objects.filter(
            circle=circle, invitee=user, status=CircleInvite.STATUS_PENDING
        ).exists():
            raise ValidationError({"detail": ALREADY_INVITED})
        existing = (
            CircleJoinRequest.objects.select_for_update()
            .filter(circle=circle, user=user, status=CircleJoinRequest.STATUS_PENDING)
            .select_related("user")
            .first()
        )
        if existing is not None:
            return existing, False
        try:
            with transaction.atomic():
                row = CircleJoinRequest.objects.create(
                    circle=circle, user=user, status=CircleJoinRequest.STATUS_PENDING
                )
        except IntegrityError:
            row = CircleJoinRequest.objects.select_related("user").get(
                circle=circle, user=user, status=CircleJoinRequest.STATUS_PENDING
            )
            return row, False
    row = CircleJoinRequest.objects.select_related("user").get(pk=row.pk)
    return row, True


def pending_join_requests(circle, admin):
    hidden = blocked_user_ids(admin)
    rows = CircleJoinRequest.objects.filter(
        circle=circle, status=CircleJoinRequest.STATUS_PENDING
    ).select_related("user")
    if hidden:
        rows = rows.exclude(user_id__in=hidden)
    return rows


def _pending_request_for_update(circle, request_id, admin):
    row = (
        CircleJoinRequest.objects.select_for_update()
        .select_related("user")
        .filter(pk=request_id, circle=circle, status=CircleJoinRequest.STATUS_PENDING)
        .first()
    )
    if row is None or is_blocked_either_way(admin.id, row.user_id):
        raise NotFound()
    return row


def approve_join_request(admin, circle, request_id):
    with transaction.atomic():
        _lock_circle(circle.pk)
        row = _pending_request_for_update(circle, request_id, admin)
        if row.user.church_id != circle.church_id:
            raise ValidationError({"detail": "That person is no longer in your church."})
        _grant_membership(circle, row.user)
        now = timezone.now()
        row.status = CircleJoinRequest.STATUS_APPROVED
        row.responded_at = now
        row.responded_by = admin
        row.save(update_fields=["status", "responded_at", "responded_by"])
        _close_pending_invites(circle, row.user, status=CircleInvite.STATUS_CANCELLED)
    return row


def decline_join_request(admin, circle, request_id):
    with transaction.atomic():
        _lock_circle(circle.pk)
        row = _pending_request_for_update(circle, request_id, admin)
        row.status = CircleJoinRequest.STATUS_DECLINED
        row.responded_at = timezone.now()
        row.responded_by = admin
        row.save(update_fields=["status", "responded_at", "responded_by"])
    return row


def parse_invite_user_ids(raw) -> list[int]:
    if not isinstance(raw, list) or not raw:
        raise ValidationError({"user_ids": "Choose at least one person."})
    if len(raw) > INVITE_BATCH_MAX:
        raise ValidationError({"user_ids": "Send up to 50 invites at a time."})
    ids: list[int] = []
    seen: set[int] = set()
    for item in raw:
        if isinstance(item, bool) or not isinstance(item, (int, str)):
            raise ValidationError({"user_ids": "Send user ids."})
        try:
            uid = int(item)
        except (TypeError, ValueError):
            raise ValidationError({"user_ids": "Send user ids."}) from None
        if uid not in seen:
            seen.add(uid)
            ids.append(uid)
    if not ids:
        raise ValidationError({"user_ids": "Choose at least one person."})
    return ids


def send_invites(admin, circle, user_ids):
    """Return (created, already_pending, errors).

    An invite replaces a pending join request: Accept makes them a member with no queue.
    At most 50 invites stay pending on a circle.
    """
    ids = parse_invite_user_ids(user_ids)
    created = []
    already = []
    errors = []
    hidden = blocked_user_ids(admin)
    with transaction.atomic():
        _lock_circle(circle.pk)
        pending_count = CircleInvite.objects.filter(
            circle=circle, status=CircleInvite.STATUS_PENDING
        ).count()
        people = {person.id: person for person in User.objects.filter(id__in=ids, is_active=True)}
        member_ids = set(
            CircleMembership.objects.filter(circle=circle, user_id__in=ids).values_list(
                "user_id", flat=True
            )
        )
        pending = {
            invite.invitee_id: invite
            for invite in CircleInvite.objects.filter(
                circle=circle,
                invitee_id__in=ids,
                status=CircleInvite.STATUS_PENDING,
            ).select_related("inviter", "invitee", "circle")
        }
        for uid in ids:
            person = people.get(uid)
            if person is None or person.church_id != circle.church_id or uid in hidden:
                errors.append({"user_id": uid, "detail": "Not found."})
                continue
            if uid == admin.id:
                errors.append({"user_id": uid, "detail": "You can't invite yourself."})
                continue
            if uid in member_ids:
                errors.append({"user_id": uid, "detail": "Already a member."})
                continue
            if uid in pending:
                already.append(pending[uid])
                continue
            if pending_count >= INVITE_CAP:
                errors.append({"user_id": uid, "detail": INVITE_CAP_MESSAGE})
                continue
            invite = CircleInvite.objects.create(
                circle=circle,
                inviter=admin,
                invitee=person,
                status=CircleInvite.STATUS_PENDING,
            )
            pending_count += 1
            _close_pending_requests(
                circle,
                person,
                status=CircleJoinRequest.STATUS_CANCELLED,
                responded_by=admin,
            )
            created.append(invite)
    if created:
        fetched = {
            row.pk: row
            for row in CircleInvite.objects.filter(
                pk__in=[row.pk for row in created]
            ).select_related("inviter", "invitee", "circle")
        }
        created = [fetched[row.pk] for row in created]
    return created, already, errors


def pending_invites_for_admin(circle):
    return CircleInvite.objects.filter(
        circle=circle, status=CircleInvite.STATUS_PENDING
    ).select_related("inviter", "invitee", "circle")


def inbox_invites(user):
    if not user.church_id:
        return CircleInvite.objects.none()
    hidden = blocked_user_ids(user)
    rows = CircleInvite.objects.filter(
        invitee=user,
        status=CircleInvite.STATUS_PENDING,
        circle__church_id=user.church_id,
    ).select_related("inviter", "invitee", "circle")
    if hidden:
        rows = rows.exclude(inviter_id__in=hidden)
    return rows


def _pending_invite_for_update(user, invite_id) -> CircleInvite:
    invite = (
        CircleInvite.objects.select_for_update()
        .select_related("circle", "inviter", "invitee")
        .filter(pk=invite_id, invitee=user, status=CircleInvite.STATUS_PENDING)
        .first()
    )
    if invite is None:
        raise NotFound()
    if user.church_id != invite.circle.church_id:
        raise NotFound()
    if invite.inviter_id and is_blocked_either_way(user.id, invite.inviter_id):
        raise NotFound()
    return invite


def accept_invite(user, invite_id) -> CircleInvite:
    preview = CircleInvite.objects.filter(
        pk=invite_id, invitee=user, status=CircleInvite.STATUS_PENDING
    ).first()
    if preview is None:
        raise NotFound()
    with transaction.atomic():
        # Lock the circle before the invite row so this cannot deadlock with approve.
        _lock_circle(preview.circle_id)
        invite = _pending_invite_for_update(user, invite_id)
        _grant_membership(invite.circle, user)
        invite.status = CircleInvite.STATUS_ACCEPTED
        invite.responded_at = timezone.now()
        invite.save(update_fields=["status", "responded_at"])
        _close_pending_requests(invite.circle, user, status=CircleJoinRequest.STATUS_CANCELLED)
    return invite


def decline_invite(user, invite_id) -> CircleInvite:
    with transaction.atomic():
        invite = _pending_invite_for_update(user, invite_id)
        invite.status = CircleInvite.STATUS_DECLINED
        invite.responded_at = timezone.now()
        invite.save(update_fields=["status", "responded_at"])
    return invite


def leave_circle(user, circle) -> None:
    with transaction.atomic():
        _lock_circle(circle.pk)
        membership = (
            CircleMembership.objects.select_for_update().filter(circle=circle, user=user).first()
        )
        if membership is None:
            return
        _raise_if_last_admin(circle, membership)
        membership.delete()


def _membership_for_update(circle, user_id) -> CircleMembership:
    membership = (
        CircleMembership.objects.select_for_update()
        .select_related("user")
        .filter(circle=circle, user_id=user_id)
        .first()
    )
    if membership is None:
        raise NotFound(NOT_IN_CIRCLE)
    return membership


def remove_member(circle, user_id) -> None:
    with transaction.atomic():
        _lock_circle(circle.pk)
        membership = _membership_for_update(circle, user_id)
        _raise_if_last_admin(circle, membership)
        membership.delete()


def make_admin(circle, user_id) -> CircleMembership:
    with transaction.atomic():
        _lock_circle(circle.pk)
        membership = _membership_for_update(circle, user_id)
        if not membership.is_admin:
            membership.is_admin = True
            membership.save(update_fields=["is_admin"])
    return membership


def remove_admin(circle, user_id) -> CircleMembership:
    with transaction.atomic():
        _lock_circle(circle.pk)
        membership = _membership_for_update(circle, user_id)
        if not membership.is_admin:
            raise ValidationError({"detail": "That person is not an admin."})
        _raise_if_last_admin(circle, membership)
        membership.is_admin = False
        membership.save(update_fields=["is_admin"])
    return membership


def search_people(circle, viewer, query: str):
    """Church people an admin may invite. Members and blocked people are left out."""
    hidden = blocked_user_ids(viewer)
    member_ids = CircleMembership.objects.filter(circle=circle).values("user_id")
    people = User.objects.filter(church_id=circle.church_id, is_active=True).exclude(
        id__in=member_ids
    )
    people = people.exclude(id=viewer.id)
    if hidden:
        people = people.exclude(id__in=hidden)
    q = " ".join((query or "").split())[:80]
    if q:
        people = people.filter(
            Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(username__icontains=q)
        )
    people = list(people.order_by("first_name", "last_name", "id")[:PEOPLE_SEARCH_LIMIT])
    invited = set()
    if people:
        invited = set(
            CircleInvite.objects.filter(
                circle=circle,
                status=CircleInvite.STATUS_PENDING,
                invitee_id__in=[person.id for person in people],
            ).values_list("invitee_id", flat=True)
        )
    results = []
    for person in people:
        card = author_card(person)
        card["invite_state"] = "invited" if person.id in invited else "none"
        results.append(card)
    return results
