from django.urls import path
from .views import dashboard, review_queue, stats, user_list, user_detail

urlpatterns = [
    path('dashboard/', dashboard, name='admin-dashboard'),
    path('review-queue/', review_queue, name='admin-review-queue'),
    path('stats/', stats, name='admin-stats'),
    path('users/', user_list, name='admin-user-list'),
    path('users/<int:pk>/', user_detail, name='admin-user-detail'),
]
