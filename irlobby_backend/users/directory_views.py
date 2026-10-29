"""GET /api/directory/ — paginated Franconia church directory."""

from rest_framework import generics, serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated

from .directory import (
    directory_queryset,
    household_children_for,
    viewer_may_see_household_children,
)
from .social import last_initial


class DirectoryEntrySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    first_name = serializers.CharField(allow_blank=True)
    last_initial = serializers.SerializerMethodField()
    avatar_url = serializers.CharField(allow_blank=True)
    household_children = serializers.SerializerMethodField()

    def get_last_initial(self, obj) -> str:
        return last_initial(obj)

    def get_household_children(self, obj) -> list[dict]:
        if not self.context.get("show_household_children"):
            return []
        if not obj.show_household_in_directory:
            return []
        return household_children_for(obj)


class DirectoryListView(generics.ListAPIView):
    """Signed-in Franconia members. Anyone else who is signed in gets an empty page."""

    permission_classes = [IsAuthenticated]
    serializer_class = DirectoryEntrySerializer
    pagination_class = PageNumberPagination

    def get_queryset(self):
        return directory_queryset(self.request.user, self.request.query_params.get("q"))

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["show_household_children"] = viewer_may_see_household_children(self.request.user)
        return context
