from rest_framework.permissions import SAFE_METHODS, BasePermission

from .access import is_activity_host


class IsHostOrReadOnly(BasePermission):
    message = "Only the activity host may modify this activity."

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return is_activity_host(request.user, obj)
