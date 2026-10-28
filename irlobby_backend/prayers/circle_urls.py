from django.urls import path

from . import views

urlpatterns = [
    path("", views.CircleListCreateView.as_view(), name="circle-list"),
    path("<int:pk>/join/", views.join_circle, name="circle-join"),
    path("<int:pk>/leave/", views.leave_circle, name="circle-leave"),
]
