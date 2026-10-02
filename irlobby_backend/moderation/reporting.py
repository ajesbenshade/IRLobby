"""Filing content reports: one place for validation, duplicates, and the support email."""

from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail
from rest_framework import status
from rest_framework.response import Response

from utils.sanitize import strip_html

from .models import AbuseReport

logger = logging.getLogger(__name__)

MAX_DESCRIPTION_LENGTH = 500
MAX_SNAPSHOT_LENGTH = 200


def snapshot_text(value) -> str:
    return " ".join(str(value or "").split())[:MAX_SNAPSHOT_LENGTH]


def report_body(report) -> dict:
    return {
        "id": report.id,
        "status": report.status,
        "target_type": report.target_type,
        "target_id": report.target_id,
    }


def notify_support_of_report(report) -> None:
    """Email FOYER_SUPPORT_EMAIL about a new report. Best effort: never raises."""
    recipient = (getattr(settings, "FOYER_SUPPORT_EMAIL", "") or "").strip()
    if not recipient:
        return
    try:
        reported = report.reported_user
        lines = [
            f"Report #{report.id} ({report.reason}) on {report.target_type} {report.target_id}",
            f"Reporter: user {report.reporter_id}",
            f"Reported user: {reported.id if reported else 'unknown'}",
            f"Content: {report.target_snapshot or '(none)'}",
            f"Details: {report.description or '(none)'}",
            "Review it in the admin under Moderation > Abuse reports.",
        ]
        send_mail(
            subject=f"[The Foyer] New report #{report.id}: {report.target_type} ({report.reason})",
            message="\n".join(lines),
            from_email=None,
            recipient_list=[recipient],
            fail_silently=True,
        )
    except Exception:  # pragma: no cover - defensive; a report must never fail on email
        logger.exception("Could not email support about report_id=%s", report.id)


def parse_report_input(request):
    """Return (reason, description, error_response)."""
    reason = request.data.get("reason") or "other"
    reason = reason.strip() if isinstance(reason, str) else ""
    if reason not in dict(AbuseReport.REASON_CHOICES):
        return (
            None,
            None,
            Response({"reason": "Unknown reason."}, status=status.HTTP_400_BAD_REQUEST),
        )
    raw = request.data.get("description") or ""
    description = strip_html(str(raw)).strip()
    if len(description) > MAX_DESCRIPTION_LENGTH:
        return (
            None,
            None,
            Response(
                {
                    "description": f"Description must be {MAX_DESCRIPTION_LENGTH} characters or fewer."
                },
                status=status.HTTP_400_BAD_REQUEST,
            ),
        )
    return reason, description, None


def file_report(request, *, target_type, target_id, reported_user, snapshot=""):
    """Create the report (or return the reporter's existing one for the same target).

    201 with the new report, 200 with the existing one, 400 for a bad reason, a long
    description, or reporting yourself.
    """
    reporter = request.user
    if reported_user is not None and reported_user.id == reporter.id:
        return Response(
            {"detail": "You cannot report yourself."}, status=status.HTTP_400_BAD_REQUEST
        )
    reason, description, error = parse_report_input(request)
    if error is not None:
        return error
    existing = AbuseReport.objects.filter(
        reporter=reporter, target_type=target_type, target_id=target_id
    ).first()
    if existing is not None:
        return Response(report_body(existing), status=status.HTTP_200_OK)
    report = AbuseReport.objects.create(
        reporter=reporter,
        reported_user=reported_user,
        reason=reason,
        description=description,
        target_type=target_type,
        target_id=target_id,
        target_snapshot=snapshot_text(snapshot),
    )
    notify_support_of_report(report)
    return Response(report_body(report), status=status.HTTP_201_CREATED)
