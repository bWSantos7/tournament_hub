"""
Admin panel: consolidated endpoints used by the admin web UI:
- Dashboard counters
- Review queue (low-confidence / recently changed / missing-link editions)
- User management (list, edit, delete)
- Statistics (time-series charts)
"""
from datetime import timedelta, date
from django.contrib.auth import get_user_model
from django.db.models import Q, Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.core.permissions import IsAdmin
from apps.tournaments.models import TournamentEdition
from apps.sources.models import DataSource
from apps.ingestion.models import IngestionRun
from apps.audit.models import AuditLog
from apps.alerts.models import Alert
from apps.tournaments.serializers import TournamentEditionListSerializer

User = get_user_model()


class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            'id', 'email', 'full_name', 'phone', 'role',
            'is_active', 'is_staff', 'is_superuser',
            'email_verified',
            'marketing_consent', 'created_at', 'last_login',
        )
        read_only_fields = ('id', 'email', 'created_at', 'last_login', 'is_superuser')


@api_view(['GET'])
@permission_classes([IsAdmin])
def user_list(request):
    """List all users with optional search."""
    qs = User.objects.order_by('-created_at')
    q = request.query_params.get('q', '').strip()
    if q:
        qs = qs.filter(Q(email__icontains=q) | Q(full_name__icontains=q))
    return Response(AdminUserSerializer(qs, many=True).data)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdmin])
def user_detail(request, pk):
    """Edit or delete a single user. Cannot act on your own account."""
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'detail': 'Usuário não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    if user.pk == request.user.pk:
        return Response({'detail': 'Você não pode editar ou deletar sua própria conta aqui.'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        if user.is_superuser:
            return Response({'detail': 'Não é possível deletar um superusuário.'}, status=status.HTTP_400_BAD_REQUEST)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH
    ser = AdminUserSerializer(user, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    # Prevent promoting to superuser via API
    ser.save(is_superuser=user.is_superuser)
    return Response(ser.data)


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
def stats(request):
    """Platform statistics for charts."""
    now = timezone.now()
    days = int(request.query_params.get('days', 30))
    since = now - timedelta(days=days)

    # Daily new registrations
    reg_qs = (
        User.objects
        .filter(created_at__gte=since)
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )
    reg_by_day = {str(r['day']): r['count'] for r in reg_qs}
    all_days = [(since.date() + timedelta(days=i)).isoformat() for i in range(days + 1)]
    registrations = [{'date': d, 'registrations': reg_by_day.get(d, 0)} for d in all_days]

    # Users by role
    roles = (
        User.objects
        .values('role')
        .annotate(count=Count('id'))
        .order_by('-count')
    )
    role_labels = {'player': 'Jogador', 'coach': 'Treinador', 'parent': 'Pai/Resp.', 'admin': 'Admin'}
    users_by_role = [{'role': role_labels.get(r['role'], r['role']), 'count': r['count']} for r in roles]

    # Tournaments by status
    from apps.tournaments.models import TournamentEdition
    status_qs = (
        TournamentEdition.objects
        .values('status')
        .annotate(count=Count('id'))
        .order_by('-count')
    )
    status_labels = {
        'open': 'Aberto', 'closing_soon': 'Fechando', 'closed': 'Encerrado',
        'in_progress': 'Em andamento', 'finished': 'Finalizado',
        'announced': 'Anunciado', 'canceled': 'Cancelado', 'unknown': 'Desconhecido',
        'draws_published': 'Chaves pub.',
    }
    tournaments_by_status = [
        {'status': status_labels.get(s['status'], s['status']), 'count': s['count']}
        for s in status_qs
    ]

    # Watchlist items by user_status
    from apps.watchlist.models import WatchlistItem
    wl_qs = (
        WatchlistItem.objects
        .values('user_status')
        .annotate(count=Count('id'))
        .order_by('-count')
    )
    wl_labels = {
        'none': 'Nenhum', 'intended': 'Pretende', 'registered_declared': 'Inscrito',
        'withdrawn': 'Desistiu', 'completed': 'Concluído',
    }
    watchlist_by_status = [
        {'status': wl_labels.get(w['user_status'], w['user_status']), 'count': w['count']}
        for w in wl_qs
    ]

    return Response({
        'registrations': registrations,
        'users_by_role': users_by_role,
        'tournaments_by_status': tournaments_by_status,
        'watchlist_by_status': watchlist_by_status,
        'totals': {
            'users': User.objects.count(),
            'active_users': User.objects.filter(is_active=True).count(),
            'new_users_period': User.objects.filter(created_at__gte=since).count(),
        },
    })


@api_view(['GET'])
@permission_classes([IsAdmin])
def review_queue(request):
    """Editions that need human curation."""
    from apps.tournaments.models import TournamentChangeEvent

    base_qs = TournamentEdition.objects.select_related(
        'tournament__organization', 'venue', 'data_source'
    ).prefetch_related('categories__normalized_category', 'links')

    low_conf = base_qs.filter(
        data_confidence=TournamentEdition.CONFIDENCE_LOW,
        is_manual_override=False,
    ).order_by('-fetched_at')[:20]

    no_link = base_qs.filter(
        Q(official_source_url='') | Q(official_source_url__isnull=True),
        is_manual_override=False,
    ).order_by('-fetched_at')[:20]

    cutoff = timezone.now() - timedelta(days=2)
    recent_ids = (
        TournamentChangeEvent.objects
        .filter(detected_at__gte=cutoff)
        .values_list('edition_id', flat=True)
        .distinct()[:20]
    )
    recently_changed = base_qs.filter(id__in=list(recent_ids)).order_by('-updated_at')

    return Response({
        'low_confidence': TournamentEditionListSerializer(low_conf, many=True).data,
        'missing_official_url': TournamentEditionListSerializer(no_link, many=True).data,
        'recently_changed': TournamentEditionListSerializer(recently_changed, many=True).data,
    })
