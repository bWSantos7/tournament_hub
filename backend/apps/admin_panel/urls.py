from django.urls import path
from .views import dashboard, review_queue

urlpatterns = [
    path('dashboard/', dashboard, name='admin-dashboard'),
    path('review-queue/', review_queue, name='admin-review-queue'),
]
