"""Compress event photos and store them as files, not feed blobs."""

from __future__ import annotations

import base64
from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image
from rest_framework import serializers

from .foyer import MAX_EVENT_PHOTOS
from .models import EventPhoto


def compress_image(file_obj, name="event.jpg"):
    image = Image.open(file_obj)
    image = image.convert("RGB")
    image.thumbnail((1600, 1600))
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=80, optimize=True)
    return ContentFile(buffer.getvalue(), name=name)


def _content_from_data_url(data_url: str):
    _header, separator, payload = data_url.partition(",")
    if not separator:
        raise serializers.ValidationError("Invalid image data URL.")
    try:
        raw = base64.b64decode(payload, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise serializers.ValidationError("Image data URLs must be base64 encoded.") from exc
    return compress_image(BytesIO(raw))


def materialize_images(activity, images, user):
    """Turn creation-time uploads into EventPhoto files and drop base64 from the row."""
    for ref in images or []:
        if activity.photos.count() >= MAX_EVENT_PHOTOS:
            break
        if isinstance(ref, str) and ref.startswith("data:"):
            EventPhoto.objects.create(
                activity=activity,
                uploaded_by=user,
                image=_content_from_data_url(ref),
            )
    if activity.images:
        activity.images = []
        activity.save(update_fields=["images"])


def save_uploaded_photo(activity, user, uploaded):
    if activity.photos.count() >= MAX_EVENT_PHOTOS:
        raise serializers.ValidationError(f"At most {MAX_EVENT_PHOTOS} photos are allowed.")
    content = compress_image(uploaded, name="event.jpg")
    return EventPhoto.objects.create(activity=activity, uploaded_by=user, image=content)
