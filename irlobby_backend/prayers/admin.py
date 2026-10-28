from django.contrib import admin

from .models import Circle, CircleMembership, PrayerParticipant, PrayerPass, PrayerRequest


@admin.register(Circle)
class CircleAdmin(admin.ModelAdmin):
    list_display = ("name", "church", "created_by", "created_at")
    search_fields = ("name", "church__name")
    raw_id_fields = ("church", "created_by")


@admin.register(CircleMembership)
class CircleMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "circle", "joined_at")
    search_fields = ("user__username", "circle__name")
    raw_id_fields = ("user", "circle")


@admin.register(PrayerRequest)
class PrayerRequestAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "church", "whole_church", "created_at")
    search_fields = ("title", "details", "author__username")
    list_filter = ("whole_church",)
    raw_id_fields = ("author", "church")
    filter_horizontal = ("circles",)


@admin.register(PrayerParticipant)
class PrayerParticipantAdmin(admin.ModelAdmin):
    list_display = ("user", "prayer_request", "status", "joined_at", "stopped_at")
    list_filter = ("status",)
    raw_id_fields = ("user", "prayer_request")


@admin.register(PrayerPass)
class PrayerPassAdmin(admin.ModelAdmin):
    list_display = ("user", "prayer_request", "created_at")
    raw_id_fields = ("user", "prayer_request")
