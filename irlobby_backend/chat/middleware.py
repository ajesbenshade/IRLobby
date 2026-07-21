from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class JwtAuthMiddleware(BaseMiddleware):
    def __init__(self, inner):
        super().__init__(inner)
        self.jwt_auth = JWTAuthentication()

    async def __call__(self, scope, receive, send):
        close_old_connections()
        scope["user"] = AnonymousUser()
        token = self._extract_token(scope)

        if token:
            scope["user"] = await self._get_user_from_token(token)

        return await super().__call__(scope, receive, send)

    def _extract_token(self, scope):
        for header_name, header_value in scope.get("headers", []):
            if header_name == b"authorization":
                auth_header = header_value.decode("utf-8").strip()
                parts = auth_header.split()
                if len(parts) == 2 and parts[0].lower() == "bearer":
                    return parts[1].strip()

        query_string = scope.get("query_string", b"").decode("utf-8")
        query_params = parse_qs(query_string)
        for key in ["token", "access_token"]:
            token_values = query_params.get(key)
            if token_values:
                token = token_values[0].strip()
                if token:
                    return token
        return None

    @database_sync_to_async
    def _get_user_from_token(self, token):
        try:
            validated_token = self.jwt_auth.get_validated_token(token)
            user = self.jwt_auth.get_user(validated_token)
            if not user.is_active:
                return AnonymousUser()
            return user
        except (AuthenticationFailed, InvalidToken, TokenError, ValueError):
            return AnonymousUser()
