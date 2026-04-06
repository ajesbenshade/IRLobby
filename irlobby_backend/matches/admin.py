from django.contrib import admin

from .models import Match


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ("user_a", "user_b", "activity", "created_at")
    search_fields = ("user_a__username", "user_b__username", "activity__title")
    list_filter = ("created_at",)
    raw_id_fields = ("user_a", "user_b", "activity")
