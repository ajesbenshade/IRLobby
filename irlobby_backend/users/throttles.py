from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AuthAnonThrottle(AnonRateThrottle):
    scope = 'auth_anon'


class AuthUserThrottle(UserRateThrottle):
    scope = 'auth_user'
