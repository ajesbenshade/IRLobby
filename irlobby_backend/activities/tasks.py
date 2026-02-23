import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .models import Activity, ActivityParticipant

logger = logging.getLogger(__name__)


@shared_task
def notify_upcoming_activities():
    now = timezone.now()
    window_end = now + timedelta(hours=1)
    upcoming = Activity.objects.filter(time__gte=now, time__lte=window_end)
    participant_count = ActivityParticipant.objects.filter(
        activity__in=upcoming,
        status="confirmed",
    ).count()
    logger.info(
        "Upcoming activities window=%s-%s activities=%s participants=%s",
        now.isoformat(),
        window_end.isoformat(),
        upcoming.count(),
        participant_count,
    )
    return {
        "activities": upcoming.count(),
        "participants": participant_count,
    }
