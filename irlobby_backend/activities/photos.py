"""Compress gathering photos so the API stores and serves files, never base64."""

from __future__ import annotations

import io

from django.core.files.base import ContentFile
from PIL import Image, UnidentifiedImageError

MAX_EDGE = 1600
JPEG_QUALITY = 82


class PhotoProcessingError(Exception):
    pass


def compress_uploaded_image(uploaded) -> ContentFile:
    try:
        image = Image.open(uploaded)
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise PhotoProcessingError("Upload a JPEG, PNG, or WebP photo.") from exc

    rgb: Image.Image
    if image.mode in {"RGBA", "LA", "P"}:
        background = Image.new("RGB", image.size, (255, 255, 255))
        rgba = image.convert("RGBA")
        background.paste(rgba, mask=rgba.getchannel("A"))
        rgb = background
    elif image.mode != "RGB":
        rgb = image.convert("RGB")
    else:
        rgb = image

    rgb.thumbnail((MAX_EDGE, MAX_EDGE))
    buffer = io.BytesIO()
    rgb.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return ContentFile(buffer.getvalue())


def photo_api_path(photo) -> str:
    return f"/api/activities/{photo.activity_id}/photos/{photo.id}/"


def absolute_photo_url(photo, request=None) -> str:
    path = photo_api_path(photo)
    if request is not None:
        return request.build_absolute_uri(path)
    return path


def cover_photo_url(activity, request=None):
    photos = list(activity.photos.all())
    if photos and getattr(photos[0], "image", None):
        return absolute_photo_url(photos[0], request)
    for image in activity.images or []:
        if isinstance(image, str):
            candidate = image.strip()
            if candidate.startswith("https://") and not candidate.startswith("data:"):
                return candidate
    return None
