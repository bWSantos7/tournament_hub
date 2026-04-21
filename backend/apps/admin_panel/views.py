"""
Admin panel: consolidated endpoints used by the admin web UI:
- Dashboard counters
- Review queue (low-confidence / recently changed / missing-link editions)
"""
from datetime import timedelta
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.core.permissions import IsAdmin
from apps.tournaments.models import TournamentEdition
from apps.sources.models import DataSource
from apps.ingestion.models import IngestionRun
from apps.audit.models import AuditLog
from apps.alerts.models import Alert
from apps.tournaments.serializers import TournamentEditionListSerializer


@api_view(['GET'])
@permission_classes([IsAdmin])
def dashboard(request):
    now = timezone.now()
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)

    editions_qs = TournamentEdition.objects.all()
    return Response({
        'counts': {
            'tournaments_total': editions_qs.count(),
            'tournaments_open': editions_qs.filter(status=TournamentEdition.STATUS_OPEN).count(),
            'tournaments_closing_soon': editions_qs.filter(
                status__in=[
                    TournamentEdition.STATUS_CLOSING_SOON,
                    TournamentEdition.STATUS_OPEN,
                ],
                entry_close_at__gt=now,
                entry_close_at__lt=now + timedelta(days=7),
            ).count(),
            'data_sources_enabled': DataSource.objects.filter(enabled=True).count(),
            'data_sources_total': DataSource.objects.count(),
            'manual_overrides': editions_qs.filter(is_manual_override=True).count(),
            'low_confidence': editions_qs.filter(
                data_confidence=TournamentEdition.CONFIDENCE_LOW
            ).count(),
            'missing_official_url': editions_qs.filter(
                Q(official_source_url='') | Q(official_source_url__isnull=True)
            ).count(),
        },
        'ingestion': {
            'runs_24h': IngestionRun.objects.filter(started_at__gte=last_24h).count(),
            'failed_24h': IngestionRun.objects.filter(
                started_at__gte=last_24h, status=IngestionRun.STATUS_FAILED
            ).count(),
            'partial_24h': IngestionRun.objects.filter(
                started_at__gte=last_24h, status=IngestionRun.STATUS_PARTIAL
            ).count(),
        },
        'alerts': {
            'total_7d': Alert.objects.filter(created_at__gte=last_7d).count(),
            'failed_7d': Alert.objects.filter(
                created_at__gte=last_7d, status=Alert.STATUS_FAILED
            ).count(),
        },
        'audit': {
            'actions_24h': AuditLog.objects.filter(created_at__gte=last_24h).count(),
        },
    })


@api_view(['GET'])
@permission_classes([IsAdmin])
def review_queue(request):
    """Editions that need human curation."""
    low_conf = TournamentEdition.objects.filter(
        data_confidence=TournamentEdition.CONFIDENCE_LOW,
        is_manual_override=False,
    ).order_by('-fetched_at')[:50]

    no_link = TournamentEdition.objects.filter(
        Q(official_source_url='') | Q(official_source_url__isnull=True),
        is_manual_override=False,
    ).order_by('-fetched_at')[:50]

    recently_changed = TournamentEdition.objects.annotate(
        recent_changes=Count(
            'change_events',
            filter=Q(change_events__detected_at__gte=timezone.now() - timedelta(days=2)),
        )
    ).filter(recent_changes__gt=0).order_by('-updated_at')[:50]

    return Response({
        'low_confidence': TournamentEditionListSerializer(low_conf, many=True).data,
        'missing_official_url': TournamentEditionListSerializer(no_link, many=True).data,
        'recently_changed': TournamentEditionListSerializer(recently_changed, many=True).data,
    })
