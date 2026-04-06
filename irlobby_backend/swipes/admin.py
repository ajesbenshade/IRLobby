from django.contrib import admin

from .models import Swipe


@admin.register(Swipe)
class SwipeAdmin(admin.ModelAdmin):
    list_display = ("user", "activity", "direction", "created_at")
    search_fields = ("user__username", "activity__title")
    list_filter = ("direction", "created_at")
    raw_id_fields = ("user", "activity")
