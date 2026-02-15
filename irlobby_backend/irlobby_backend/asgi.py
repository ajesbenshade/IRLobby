"""
ASGI config for irlobby_backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
import django
from django.conf import settings

# Configure Django settings before any Django imports
if not settings.configured:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'irlobby_backend.settings')
    django.setup()

# Now safe to import Django components
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from chat.middleware import JwtAuthMiddleware

# Import routing after Django is set up
import chat.routing

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": JwtAuthMiddleware(
        AuthMiddlewareStack(
            URLRouter(
                chat.routing.websocket_urlpatterns
            )
        )
    ),
})
