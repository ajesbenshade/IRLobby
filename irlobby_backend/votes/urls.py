from django.urls import path

from . import views

urlpatterns = [
    path("ballots/", views.BallotListCreateView.as_view(), name="ballot-list"),
    path("ballots/<int:pk>/", views.BallotDetailView.as_view(), name="ballot-detail"),
    path("ballots/<int:pk>/vote/", views.BallotVoteView.as_view(), name="ballot-vote"),
    path("ballots/<int:pk>/close/", views.BallotCloseView.as_view(), name="ballot-close"),
]
