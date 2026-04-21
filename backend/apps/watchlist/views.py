from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import WatchlistItem
from .serializers import WatchlistItemSerializer
from apps.tournaments.models import TournamentEdition


class WatchlistViewSet(viewsets.ModelViewSet):
    serializer_class = WatchlistItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ('user_status',)

    def get_queryset(self):
        return (
            WatchlistItem.objects
            .filter(user=self.request.user)
            .select_related('edition__tournament__organization', 'edition__venue', 'profile')
            .order_by('-created_at')
        )

    @action(detail=False, methods=['get'])
    def summary(self, request):
        qs = self.get_queryset()
        now = timezone.now()
        soon = now + timedelta(days=14)
        today = now.date()
        upcoming = qs.filter(edition__start_date__gte=today)
        active = qs.filter(
            edition__entry_close_at__gte=now,
            edition__entry_close_at__lte=soon,
        )
        past = qs.filter(edition__end_date__lt=today)
        return Response({
            'total': qs.count(),
            'active_registrations': active.count(),
            'upcoming': upcoming.count(),
            'past': past.count(),
            'by_status': {
                s[0]: qs.filter(user_status=s[0]).count()
                for s in WatchlistItem.STATUS_CHOICES
            },
        })

    @action(detail=False, methods=['post'], url_path='toggle')
    def toggle(self, request):
        """Toggle membership: if exists, remove; else create with defaults."""
        edition_id = request.data.get('edition_id')
        profile_id = request.data.get('profile_id')
        if not edition_id:
            return Response({'error': 'edition_id obrigatório'}, status=400)
        try:
            edition = TournamentEdition.objects.get(pk=edition_id)
        except TournamentEdition.DoesNotExist:
            return Response({'error': 'Edição não encontrada'}, status=404)
        item = WatchlistItem.objects.filter(user=request.user, edition=edition).first()
        if item:
            item.delete()
            return Response({'watching': False, 'edition_id': edition_id})
        item = WatchlistItem.objects.create(
            user=request.user,
            edition=edition,
            profile_id=profile_id,
        )
        return Response({
            'watching': True,
            'edition_id': edition_id,
            'item': WatchlistItemSerializer(item).data,
        }, status=status.HTTP_201_CREATED)
