"""Public legal pages for App Store review (Privacy Policy and Support)."""

from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404

LEGAL_DIR = Path(settings.BASE_DIR) / "deploy" / "oracle" / "legal"
_ALLOWED = {"privacy.html", "support.html"}


def _legal_page(filename: str):
    if filename not in _ALLOWED:
        raise Http404("Legal page not found")
    path = (LEGAL_DIR / filename).resolve()
    if path.parent != LEGAL_DIR.resolve() or not path.is_file():
        raise Http404("Legal page not found")
    response = FileResponse(path.open("rb"), content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "public, max-age=300"
    return response


def privacy_policy(_request):
    return _legal_page("privacy.html")


def support_page(_request):
    return _legal_page("support.html")
