"""HTTPS bounce pages for Stripe Checkout and Connect redirects.

Stripe requires http(s) return URLs. The mobile app uses the irlobby:// scheme,
so these pages deep-link back into the app after hosted Stripe flows complete.
"""

from __future__ import annotations

import json
from urllib.parse import urlencode

from django.http import Http404, HttpResponse
from django.utils.html import escape

from utils.client_urls import ALLOWED_APP_SCHEME, ALLOWED_APP_TARGETS


def _app_deep_link(target: str, query_string: str) -> str:
    app_url = f"{ALLOWED_APP_SCHEME}://{target}"
    if query_string:
        app_url = f"{app_url}?{query_string}"
    return app_url


def stripe_app_bounce(request, target):
    if target not in ALLOWED_APP_TARGETS:
        raise Http404("Unknown Stripe return target")

    query_string = request.META.get("QUERY_STRING", "") or ""
    # Drop empty query strings produced by a trailing '?'.
    query_string = query_string.strip()
    if query_string:
        # Keep Stripe's session_id (and any other params) but never allow
        # javascript: style values to be injected via a nested URL param.
        unsafe = ("javascript:", "data:", "vbscript:")
        lowered = query_string.lower()
        if any(token in lowered for token in unsafe):
            query_string = urlencode({"ok": "1"})

    app_url = _app_deep_link(target, query_string)
    safe_html = escape(app_url)
    safe_js = json.dumps(app_url)
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Returning to IRLobby</title>
  <meta http-equiv="refresh" content="0;url={safe_html}">
</head>
<body>
  <p>Opening the IRLobby app…</p>
  <p><a href="{safe_html}">Tap here if the app does not open</a></p>
  <script>window.location.replace({safe_js});</script>
</body>
</html>
"""
    response = HttpResponse(html, content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "no-store"
    return response
