from utils.throttles import DynamicAnonRateThrottle, DynamicUserRateThrottle


class AuthAnonThrottle(DynamicAnonRateThrottle):
    scope = "auth_anon"


class AuthUserThrottle(DynamicUserRateThrottle):
    scope = "auth_user"
