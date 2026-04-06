from django.contrib import admin

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("reviewer", "reviewee", "activity", "rating", "created_at")
    search_fields = ("reviewer__username", "reviewee__username", "activity__title")
    list_filter = ("rating", "created_at")
    raw_id_fields = ("reviewer", "reviewee", "activity")
