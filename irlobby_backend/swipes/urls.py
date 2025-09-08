from django.urls import path
from . import views

urlpatterns = [
    path('', views.SwipeListView.as_view(), name='swipe-list'),
    path('<int:pk>/swipe/', views.swipe_activity, name='swipe-activity'),
]
