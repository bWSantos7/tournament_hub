from django.db.models import F, Window
from django.db.models.functions import RowNumber
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.players.models import PlayerProfile
from apps.tournaments.models import TournamentEdition, TournamentCategory
from .models import TournamentRegistration
from .serializers import (
    AdminRegistrationSerializer,
    BulkPaymentSerializer,
    MyRegistrationSerializer,
    RegistrationCreateSerializer,
)


def _annotate_slot_positions(qs):
    """Annotate each registration with its sequential slot position within (edition, category)."""
    return qs.annotate(
        slot_position=Window(
            expression=RowNumber(),
            partition_by=[F('edition_id'), F('category_id')],
            order_by=[
                F('ranking_position').asc(nulls_last=True),
                F('registered_at').asc(),
            ],
        )
    )


class RegistrationViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    def _get_primary_profile(self, user):
        try:
            return PlayerProfile.objects.filter(user=user, is_primary=True).first() or \
                   PlayerProfile.objects.filter(user=user).first()
        except PlayerProfile.DoesNotExist:
            return None

    # ── Player endpoints ────────────────────────────────────────────────────

    def create(self, request):
        """POST /api/registrations/ — Inscrever-se em um torneio."""
        profile = self._get_primary_profile(request.user)
        if not profile:
            return Response(
                {'detail': 'Crie um perfil esportivo antes de se inscrever.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = RegistrationCreateSerializer(
            data=request.data, context={'request': request, 'profile': profile}
        )
        serializer.is_valid(raise_exception=True)
        reg = serializer.save()
        qs = _annotate_slot_positions(
            TournamentRegistration.objects.filter(pk=reg.pk).select_related(
                'edition', 'category', 'profile'
            )
        )
        out = MyRegistrationSerializer(qs.first())
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='my')
    def my_registrations(self, request):
        """GET /api/registrations/my/ — Minhas inscrições."""
        profile_ids = list(
            PlayerProfile.objects.filter(user=request.user).values_list('id', flat=True)
        )
        qs = TournamentRegistration.objects.filter(
            profile_id__in=profile_ids
        ).select_related('edition', 'category', 'profile')

        qs = _annotate_slot_positions(qs).order_by('-registered_at')
        serializer = MyRegistrationSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['delete'], url_path='withdraw')
    def withdraw(self, request, pk=None):
        """DELETE /api/registrations/{id}/withdraw/ — Desistir de um torneio."""
        profile_ids = list(
            PlayerProfile.objects.filter(user=request.user).values_list('id', flat=True)
        )
        try:
            reg = TournamentRegistration.objects.get(pk=pk, profile_id__in=profile_ids)
        except TournamentRegistration.DoesNotExist:
            return Response({'detail': 'Inscrição não encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        if reg.is_withdrawn:
            return Response({'detail': 'Inscrição já foi cancelada.'}, status=status.HTTP_400_BAD_REQUEST)
        reg.withdraw()
        return Response({'detail': 'Inscrição cancelada com sucesso.'})

    # ── Admin endpoints ─────────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path=r'edition/(?P<edition_id>\d+)')
    def edition_list(self, request, edition_id=None):
        """GET /api/registrations/edition/{edition_id}/ — Todas as inscrições de uma edição (admin)."""
        if not request.user.is_staff:
            return Response({'detail': 'Acesso negado.'}, status=status.HTTP_403_FORBIDDEN)

        include_withdrawn = request.query_params.get('include_withdrawn', '').lower() == 'true'
        category_id = request.query_params.get('category_id')

        qs = TournamentRegistration.objects.filter(
            edition_id=edition_id
        ).select_related(
            'profile', 'profile__user', 'category', 'payment_confirmed_by', 'edition'
        )
        if not include_withdrawn:
            qs = qs.filter(is_withdrawn=False)
        if category_id:
            qs = qs.filter(category_id=category_id)

        qs = _annotate_slot_positions(qs)
        serializer = AdminRegistrationSerializer(qs, many=True)

        # Summary stats
        total = qs.count()
        paid = sum(1 for r in qs if r.payment_status in ('paid', 'waived'))
        pending = total - paid

        return Response({
            'summary': {'total': total, 'paid': paid, 'pending_payment': pending},
            'registrations': serializer.data,
        })

    @action(detail=True, methods=['post'], url_path='confirm-payment')
    def confirm_payment(self, request, pk=None):
        """POST /api/registrations/{id}/confirm-payment/ — Confirmar pagamento (admin)."""
        if not request.user.is_staff:
            return Response({'detail': 'Acesso negado.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            reg = TournamentRegistration.objects.select_related('category', 'edition').get(pk=pk)
        except TournamentRegistration.DoesNotExist:
            return Response({'detail': 'Inscrição não encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        notes = request.data.get('notes', '')
        reg.confirm_payment(confirmed_by=request.user, notes=notes)
        qs = _annotate_slot_positions(
            TournamentRegistration.objects.filter(pk=reg.pk).select_related(
                'profile', 'profile__user', 'category', 'payment_confirmed_by', 'edition'
            )
        )
        return Response(AdminRegistrationSerializer(qs.first()).data)

    @action(detail=True, methods=['post'], url_path='reset-payment')
    def reset_payment(self, request, pk=None):
        """POST /api/registrations/{id}/reset-payment/ — Resetar pagamento para pendente (admin)."""
        if not request.user.is_staff:
            return Response({'detail': 'Acesso negado.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            reg = TournamentRegistration.objects.select_related('category', 'edition').get(pk=pk)
        except TournamentRegistration.DoesNotExist:
            return Response({'detail': 'Inscrição não encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        reg.reset_payment()
        qs = _annotate_slot_positions(
            TournamentRegistration.objects.filter(pk=reg.pk).select_related(
                'profile', 'profile__user', 'category', 'payment_confirmed_by', 'edition'
            )
        )
        return Response(AdminRegistrationSerializer(qs.first()).data)

    @action(detail=True, methods=['patch'], url_path='update-ranking')
    def update_ranking(self, request, pk=None):
        """PATCH /api/registrations/{id}/update-ranking/ — Atualizar posição no ranking (admin)."""
        if not request.user.is_staff:
            return Response({'detail': 'Acesso negado.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            reg = TournamentRegistration.objects.get(pk=pk)
        except TournamentRegistration.DoesNotExist:
            return Response({'detail': 'Inscrição não encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        ranking = request.data.get('ranking_position')
        if ranking is not None:
            try:
                reg.ranking_position = int(ranking) if ranking != '' else None
                reg.save(update_fields=['ranking_position'])
            except (ValueError, TypeError):
                return Response({'detail': 'ranking_position inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        notes = request.data.get('notes')
        if notes is not None:
            reg.notes = notes
            reg.save(update_fields=['notes'])
        return Response({'detail': 'Atualizado.'})

    @action(detail=False, methods=['post'], url_path='bulk-payment')
    def bulk_payment(self, request):
        """POST /api/registrations/bulk-payment/ — Atualizar pagamento em lote (admin)."""
        if not request.user.is_staff:
            return Response({'detail': 'Acesso negado.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = BulkPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data['registration_ids']
        pay_status = serializer.validated_data['payment_status']
        notes = serializer.validated_data['notes']

        qs = TournamentRegistration.objects.filter(pk__in=ids)
        count = qs.count()
        if count == 0:
            return Response({'detail': 'Nenhuma inscrição encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        update_kwargs = {'payment_status': pay_status}
        if pay_status in ('paid', 'waived'):
            update_kwargs['payment_confirmed_at'] = timezone.now()
            update_kwargs['payment_confirmed_by'] = request.user
        if notes:
            update_kwargs['payment_notes'] = notes

        qs.update(**update_kwargs)
        return Response({'detail': f'{count} inscrições atualizadas para "{pay_status}".'})
