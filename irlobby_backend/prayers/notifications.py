"""Best-effort pushes for circle invites and join requests. A failed push never fails the API."""

from __future__ import annotations

import logging

from users.push_notifications import send_push_to_user
from users.social import blocked_user_ids

from .models import CircleMembership
from .serializers import author_card

logger = logging.getLogger(__name__)


def notify_join_request(circle, requester) -> None:
    try:
        label = author_card(requester)["display_name"]
        hidden = blocked_user_ids(requester)
        admins = (
            CircleMembership.objects.filter(circle=circle, is_admin=True)
            .exclude(user_id=requester.id)
            .select_related("user")
        )
        payload = {"type": "circle_join_request", "circleId": circle.id, "screen": "Circles"}
        for membership in admins:
            if membership.user_id in hidden:
                continue
            send_push_to_user(
                membership.user,
                "Request to join",
                f"{label} asked to join {circle.name}.",
                payload,
            )
    except Exception:
        logger.exception("Circle join-request push failed circle_id=%s", circle.id)


def notify_join_decision(circle, recipient, *, approved: bool) -> None:
    try:
        verdict = "approved" if approved else "declined"
        body = f"Your request to join {circle.name} was {verdict}."
        send_push_to_user(
            recipient,
            f"Your request to join {circle.name} was {verdict}",
            body,
            {
                "type": f"circle_join_request_{verdict}",
                "circleId": circle.id,
                "screen": "Circles",
            },
        )
    except Exception:
        logger.exception("Circle join-decision push failed circle_id=%s", circle.id)


def notify_circle_invite(invite) -> None:
    try:
        inviter_name = author_card(invite.inviter)["display_name"]
        send_push_to_user(
            invite.invitee,
            "Circle invite",
            f"{inviter_name} invited you to {invite.circle.name}.",
            {
                "type": "circle_invite",
                "circleId": invite.circle_id,
                "inviteId": invite.id,
                "screen": "Circles",
            },
        )
    except Exception:
        logger.exception("Circle invite push failed invite_id=%s", getattr(invite, "id", None))
