from collections import defaultdict
from datetime import timedelta
import hashlib
import time

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import IsAdmin
from .filters import TournamentEditionFilter
from .models import Tournament, TournamentCategory, TournamentEdition
from .serializers import (
    TournamentCategorySerializer,
    TournamentEditionAdminSerializer,
    TournamentEditionDetailSerializer,
    TournamentEditionListSerializer,
    TournamentSerializer,
)

_COMPATIBLE_PAYLOAD_CACHE: dict[str, tuple[float, dict]] = {}


class TournamentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tournament.objects.select_related('organization').all()
    serializer_class = TournamentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ('organization', 'modality', 'circuit')
    search_fields = ('canonical_name', 'canonical_slug', 'circuit')


class TournamentEditionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    filterset_class = TournamentEditionFilter
    search_fields = ('title', 'tournament__canonical_name')
    ordering_fields = ('start_date', 'entry_close_at', 'created_at')
    ordering = ('start_date',)

    def get_queryset(self):
        return (
            TournamentEdition.objects
            .select_related('tournament', 'tournament__organization', 'venue', 'data_source')
            .prefetch_related('categories__normalized_category', 'links')
            .annotate(categories_count=Count('categories'))
        )

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TournamentEditionDetailSerializer
        return TournamentEditionListSerializer

    def _build_compatible_candidate_filter(self, profile):
        from apps.players.models import PlayerCategory

        category_filter = Q(categories__normalized_category__taxonomy=PlayerCategory.TAXONOMY_OPEN)

        sporting_age = profile.sporting_age
        if sporting_age is not None:
            category_filter |= Q(
                categories__normalized_category__taxonomy__in=[
                    PlayerCategory.TAXONOMY_CBT_AGE,
                    PlayerCategory.TAXONOMY_FPT_AGE,
                    PlayerCategory.TAXONOMY_KIDS,
                ],
                categories__normalized_category__min_age__lte=sporting_age,
                categories__normalized_category__max_age__gte=sporting_age,
            )
            category_filter |= Q(
                categories__normalized_category__taxonomy=PlayerCategory.TAXONOMY_SENIORS,
                categories__normalized_category__min_age__lte=sporting_age,
            )

        tennis_class = (profile.tennis_class or '').upper().strip()
        if tennis_class:
            if tennis_class == 'PR':
                category_filter |= Q(
                    categories__normalized_category__taxonomy=PlayerCategory.TAXONOMY_FPT_CLASS,
                    categories__normalized_category__class_level=5,
                )
            elif tennis_class.isdigit():
                player_class = int(tennis_class)
                allowed_levels = [player_class]
                if player_class > 1:
                    allowed_levels.append(player_class - 1)
                category_filter |= Q(
                    categories__normalized_category__taxonomy=PlayerCategory.TAXONOMY_FPT_CLASS,
                    categories__normalized_category__class_level__in=allowed_levels,
                )

        if profile.gender:
            category_filter &= Q(
                categories__normalized_category__gender_scope__in=[profile.gender, '*', 'X']
            )

        return category_filter

    @action(detail=False, methods=['get'])
    def closing_soon(self, request):
        days = int(request.query_params.get('days', 14))
        now = timezone.now()
        end = now + timedelta(days=days)
        qs = self.get_queryset().filter(
            entry_close_at__isnull=False,
            entry_close_at__gte=now,
            entry_close_at__lte=end,
        ).exclude(
            status__in=[
                TournamentEdition.STATUS_CANCELED,
                TournamentEdition.STATUS_FINISHED,
            ]
        ).order_by('entry_close_at')
        page = self.paginate_queryset(qs)
        serializer = TournamentEditionListSerializer(page or qs, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def calendar(self, request):
        qs = self.filter_queryset(self.get_queryset()).filter(start_date__isnull=False)
        buckets = defaultdict(list)
        for edition in qs[:500]:
            key = edition.start_date.strftime('%Y-%m')
            buckets[key].append(TournamentEditionListSerializer(edition).data)
        return Response([{'month': key, 'items': value} for key, value in sorted(buckets.items())])

    @action(detail=False, methods=['get'])
    def compatible(self, request):
        from apps.eligibility.services import EligibilityEngine
        from apps.eligibility.location import within_profile_radius
        from apps.players.models import PlayerProfile

        profile_id = request.query_params.get('profile_id')
        if not profile_id:
            return Response({'error': 'profile_id e obrigatorio'}, status=400)

        try:
            profile = PlayerProfile.objects.get(pk=profile_id, user=request.user)
        except PlayerProfile.DoesNotExist:
            return Response({'error': 'Perfil nao encontrado'}, status=404)

        cache_key = hashlib.md5(
            f'compatible:{request.user.id}:{profile.id}:{request.get_full_path()}'.encode('utf-8')
        ).hexdigest()
        cached_entry = _COMPATIBLE_PAYLOAD_CACHE.get(cache_key)
        if cached_entry and cached_entry[0] > time.time():
            cached_payload = cached_entry[1]
            return Response(cached_payload)

        qs = self.filter_queryset(self.get_queryset()).exclude(
            status__in=[
                TournamentEdition.STATUS_CANCELED,
                TournamentEdition.STATUS_FINISHED,
            ]
        )
        category_filter = self._build_compatible_candidate_filter(profile)
        candidate_qs = qs.filter(category_filter).distinct().order_by('start_date', 'id')

        engine = EligibilityEngine(profile)
        compatible = []
        for edition in candidate_qs:
            result = engine.evaluate_edition(edition)
            if result['compatible_count'] <= 0:
                continue
            if not within_profile_radius(profile, edition):
                continue
            data = self.get_serializer(edition).data
            data['eligibility'] = {
                'compatible_count': result['compatible_count'],
                'unknown_count': result['unknown_count'],
                'total_count': result['total_count'],
            }
            compatible.append(data)

        page = self.paginate_queryset(compatible)
        if page is not None:
            response = self.get_paginated_response(page)
            _COMPATIBLE_PAYLOAD_CACHE[cache_key] = (time.time() + 300, response.data)
            return response

        payload = {'count': len(compatible), 'results': compatible}
        _COMPATIBLE_PAYLOAD_CACHE[cache_key] = (time.time() + 300, payload)
        return Response(payload)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        from .serializers import TournamentChangeEventSerializer

        edition = self.get_object()
        events = edition.change_events.all().order_by('-detected_at')[:100]
        return Response(TournamentChangeEventSerializer(events, many=True).data)


class TournamentEditionAdminViewSet(viewsets.ModelViewSet):
    queryset = TournamentEdition.objects.all()
    serializer_class = TournamentEditionAdminSerializer
    permission_classes = [IsAdmin]

    def perform_update(self, serializer):
        serializer.save(
            reviewed_by=self.request.user,
            reviewed_at=timezone.now(),
            is_manual_override=True,
        )
        from apps.audit.models import AuditLog

        AuditLog.objects.create(
            actor=self.request.user,
            action=AuditLog.ACTION_UPDATE,
            entity_type='tournament_edition',
            entity_id=str(serializer.instance.id),
            diff={key: str(value) for key, value in serializer.validated_data.items()},
        )
