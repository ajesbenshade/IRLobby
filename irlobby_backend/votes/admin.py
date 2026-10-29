from django.contrib import admin

from .models import Ballot, BallotChoice, BallotVote


class BallotChoiceInline(admin.TabularInline):
    model = BallotChoice
    extra = 0


@admin.register(Ballot)
class BallotAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "church",
        "author",
        "whole_church",
        "results_mode",
        "closes_at",
        "closed_at",
        "created_at",
    )
    list_filter = ("whole_church", "results_mode")
    search_fields = ("title", "description", "author__username")
    raw_id_fields = ("author", "church")
    filter_horizontal = ("circles",)
    inlines = [BallotChoiceInline]


@admin.register(BallotVote)
class BallotVoteAdmin(admin.ModelAdmin):
    list_display = ("user", "ballot", "choice", "created_at")
    raw_id_fields = ("user", "ballot", "choice")
