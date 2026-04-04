import base64
import io
import logging
from datetime import timedelta

import qrcode
from celery import shared_task
from django.utils import timezone
from qrcode.image.svg import SvgPathImage

from .models import Activity, ActivityParticipant, Ticket

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


@shared_task
def generate_ticket_qr_code(ticket_id):
    try:
        ticket = Ticket.objects.select_related("activity").get(id=ticket_id)
    except Ticket.DoesNotExist:
        logger.warning("Ticket %s not found for QR generation", ticket_id)
        return None

    payload = ticket.get_qr_token()
    buffer = io.BytesIO()

    try:
        image = qrcode.make(payload)
        image.save(buffer, format="PNG")
        mime_type = "image/png"
    except Exception:
        # Fallback to SVG path output if Pillow is unavailable.
        buffer = io.BytesIO()
        qr = qrcode.QRCode(box_size=10, border=4)
        qr.add_data(payload)
        qr.make(fit=True)
        image = qr.make_image(image_factory=SvgPathImage)
        image.save(buffer)
        mime_type = "image/svg+xml"

    buffer.seek(0)
    data_url = f"data:{mime_type};base64,{base64.b64encode(buffer.read()).decode('ascii')}"
    ticket.qr_code_data_url = data_url
    ticket.save(update_fields=["qr_code_data_url"])
    return ticket.qr_code_data_url
