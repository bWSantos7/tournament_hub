from django.urls import path
from .views import (
    dashboard, review_queue, stats,
    user_list, user_detail,
    edition_patch,
    data_sources_list, data_source_patch,
    ingestion_runs_list, execution_logs,
)

urlpatterns = [
    path('dashboard/', dashboard, name='admin-dashboard'),
    path('review-queue/', review_queue, name='admin-review-queue'),
    path('stats/', stats, name='admin-stats'),
    path('users/', user_list, name='admin-user-list'),
    path('users/<int:pk>/', user_detail, name='admin-user-detail'),
    path('editions/<int:pk>/', edition_patch, name='admin-edition-patch'),
    path('sources/', data_sources_list, name='admin-sources-list'),
    path('sources/<int:pk>/', data_source_patch, name='admin-source-patch'),
    path('runs/', ingestion_runs_list, name='admin-runs-list'),
    path('execution-logs/', execution_logs, name='admin-execution-logs'),
]
