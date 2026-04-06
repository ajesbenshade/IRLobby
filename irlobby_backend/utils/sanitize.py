import re

_HTML_TAG_RE = re.compile(r"<[^>]+>")


def strip_html(text: str) -> str:
    """Remove HTML tags from user-supplied text to prevent XSS."""
    if not text:
        return text
    return _HTML_TAG_RE.sub("", text).strip()
