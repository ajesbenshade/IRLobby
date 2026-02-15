from urllib.parse import parse_qs

from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import UntypedToken

from users.models import User


class JwtAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        close_old_connections()
        token = self._extract_token(scope)

        if token:
            scope['user'] = await self._get_user_from_token(token)

        return await super().__call__(scope, receive, send)

    def _extract_token(self, scope):
        query_string = scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        token_values = query_params.get('token')
        if token_values:
            token = token_values[0].strip()
            if token:
                return token
        return None

    async def _get_user_from_token(self, token):
        try:
            validated_token = UntypedToken(token)
            user_id = validated_token.get('user_id')
            if not user_id:
                return AnonymousUser()
            return await User.objects.aget(id=user_id)
        except (InvalidToken, TokenError, User.DoesNotExist, ValueError):
            return AnonymousUser()
