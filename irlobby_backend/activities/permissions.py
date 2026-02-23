from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsHostOrReadOnly(BasePermission):
    message = "Only the activity host may modify this activity."

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return obj.host_id == request.user.id
