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


PHOTO_TOKEN_SALT = "foyer-event-photo"
PHOTO_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 3600


def _photo_signer():
    from django.core.signing import TimestampSigner

    return TimestampSigner(salt=PHOTO_TOKEN_SALT)


def make_photo_token(photo) -> str:
    return _photo_signer().sign(f"{photo.activity_id}:{photo.id}")


def photo_token_valid(token: str, activity_id: int, photo_id: int) -> bool:
    from django.core.signing import BadSignature, SignatureExpired

    try:
        value = _photo_signer().unsign(token, max_age=PHOTO_TOKEN_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return False
    return value == f"{activity_id}:{photo_id}"


# Download links serve the original as an attachment and expire sooner than view links.
PHOTO_DOWNLOAD_SALT = "foyer-event-photo-download"
PHOTO_DOWNLOAD_MAX_AGE_SECONDS = 3600


def _download_signer():
    from django.core.signing import TimestampSigner

    return TimestampSigner(salt=PHOTO_DOWNLOAD_SALT)


def make_photo_download_token(photo) -> str:
    return _download_signer().sign(f"{photo.activity_id}:{photo.id}")


def photo_download_token_valid(token: str, activity_id: int, photo_id: int) -> bool:
    from django.core.signing import BadSignature, SignatureExpired

    try:
        value = _download_signer().unsign(token, max_age=PHOTO_DOWNLOAD_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return False
    return value == f"{activity_id}:{photo_id}"


def absolute_photo_download_url(photo, request=None) -> str:
    path = f"{photo_api_path(photo)}download/?t={make_photo_download_token(photo)}"
    return request.build_absolute_uri(path) if request is not None else path


def absolute_photo_url(photo, request=None) -> str:
    path = photo_api_path(photo)
    # Photos of events that are not on the public church calendar are only
    # linked, with a short-lived signed token, to people who are logged in.
    user = getattr(request, "user", None) if request is not None else None
    if user is not None and getattr(user, "is_authenticated", False):
        from activities.public_calendar import is_public_calendar_event

        if not is_public_calendar_event(photo.activity):
            path = f"{path}?t={make_photo_token(photo)}"
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
