from urllib.parse import urlparse

from rest_framework import serializers

ALLOWED_DATA_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}
MAX_DATA_URL_LENGTH = 1_200_000
MAX_HTTPS_IMAGE_URL_LENGTH = 2048


def validate_image_reference(value, *, field_name="image"):
    """Accept only https image URLs or jpeg/png/webp data URLs."""
    if not isinstance(value, str):
        raise serializers.ValidationError(f"Invalid {field_name}.")

    candidate = value.strip()
    if not candidate:
        raise serializers.ValidationError("Image cannot be blank.")

    if candidate.startswith("data:"):
        if len(candidate) > MAX_DATA_URL_LENGTH:
            raise serializers.ValidationError("Image is too large.")
        header, separator, _payload = candidate.partition(",")
        if not separator:
            raise serializers.ValidationError("Invalid image data URL.")
        mime = header[5:].split(";", 1)[0].strip().lower()
        if mime not in ALLOWED_DATA_IMAGE_MIMES:
            raise serializers.ValidationError("Unsupported image type.")
        if "base64" not in header.lower():
            raise serializers.ValidationError("Image data URLs must be base64 encoded.")
        return candidate

    if len(candidate) > MAX_HTTPS_IMAGE_URL_LENGTH:
        raise serializers.ValidationError("Image URL is too long.")

    parsed = urlparse(candidate)
    if parsed.scheme != "https" or not parsed.hostname:
        raise serializers.ValidationError("Images must be https or image data URLs.")
    if parsed.username or parsed.password:
        raise serializers.ValidationError("Image URL cannot include credentials.")
    if parsed.hostname.lower() in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}:
        raise serializers.ValidationError("Image URL host is not allowed.")
    return candidate


def validate_image_reference_list(values, *, max_items, field_name="images"):
    if values is None:
        return values
    if not isinstance(values, list):
        raise serializers.ValidationError("Images must be a list.")
    if len(values) > max_items:
        raise serializers.ValidationError(f"At most {max_items} images are allowed.")
    return [validate_image_reference(item, field_name=field_name) for item in values]
