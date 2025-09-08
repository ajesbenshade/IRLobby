from django.urls import path
from . import views

urlpatterns = [
    path('', views.MatchListView.as_view(), name='match-list'),
]
