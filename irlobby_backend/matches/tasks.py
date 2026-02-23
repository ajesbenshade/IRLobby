import logging

from activities.models import ActivityParticipant
from celery import shared_task
from django.db import transaction

from .models import Match

logger = logging.getLogger(__name__)


@shared_task
def run_matchmaking():
    activities = (
        ActivityParticipant.objects.filter(status="confirmed")
        .values_list("activity_id", flat=True)
        .distinct()
    )

    created_matches = 0
    for activity_id in activities:
        participants = (
            ActivityParticipant.objects.filter(
                activity_id=activity_id,
                status="confirmed",
            )
            .select_related("user")
            .order_by("joined_at", "id")
        )
        if participants.count() < 2:
            continue

        user_a = participants[0].user
        user_b = participants[1].user

        with transaction.atomic():
            match, created = Match.get_or_create_normalized(
                activity_id=activity_id,
                user_one=user_a,
                user_two=user_b,
            )
        if created:
            created_matches += 1

    logger.info("Matchmaking created_matches=%s", created_matches)
    return {"created": created_matches}
