from utils.throttles import DynamicUserRateThrottle


class DirectMessageThrottle(DynamicUserRateThrottle):
    """Limits starting 1:1 chats and sending in them. Reads and gathering chats are free."""

    scope = "direct_messages"

    def allow_request(self, request, view):
        if request.method != "POST":
            return True
        conversation_id = view.kwargs.get("conversation_id")
        if conversation_id is not None:
            from .models import Conversation

            direct = Conversation.objects.filter(
                pk=conversation_id, match__activity__isnull=True
            ).exists()
            if not direct:
                return True
        return super().allow_request(request, view)
