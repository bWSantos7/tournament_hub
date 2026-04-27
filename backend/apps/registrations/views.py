from collections import defaultdict

from django.db.models import F, Window
from django.db.models.functions import RowNumber
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.players.models import PlayerProfile
from apps.tournaments.models import TournamentEdition, TournamentCategory
from .models import FederationEntry, TournamentRegistration
from .serializers import (
    AdminRegistrationSerializer,
    BulkPaymentSerializer,
    FederationEntrySerializer,
    FederationEntryWriteSerializer,
    MyRegistrationSerializer,
    REGISTRATION_STATUS_LABELS,
    RegistrationCreateSerializer,
    compute_registration_status,
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

    # ── Federation registration list (public) ──────────────────────────────

    @action(detail=False, methods=['get'], url_path=r'edition/(?P<edition_id>\d+)/public')
    def public_list(self, request, edition_id=None):
        """
        GET /api/registrations/edition/{edition_id}/public/
        Lista pública de inscrições publicadas pela federação, agrupadas por categoria.
        Qualquer usuário autenticado pode visualizar.
        """
        try:
            edition = TournamentEdition.objects.get(pk=edition_id)
        except TournamentEdition.DoesNotExist:
            return Response({'detail': 'Torneio não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        # Build max_participants lookup per category_text from TournamentCategory
        cat_max = {
            tc.source_category_text: tc.max_participants
            for tc in edition.categories.all()
        }

        entries = FederationEntry.objects.filter(edition=edition).order_by(
            'category_text',
            F('ranking_position').asc(nulls_last=True),
            'created_at',
        )

        # Annotate slot_position per (edition, category_text) using Window
        entries = entries.annotate(
            slot_position=Window(
                expression=RowNumber(),
                partition_by=[F('edition_id'), F('category_text')],
                order_by=[
                    F('ranking_position').asc(nulls_last=True),
                    F('created_at').asc(),
                ],
            )
        )

        # Group by category
        grouped = defaultdict(list)
        for entry in entries:
            entry._max_participants = cat_max.get(entry.category_text)
            grouped[entry.category_text].append(entry)

        result = []
        for cat_text, cat_entries in grouped.items():
            max_p = cat_max.get(cat_text)
            paid = sum(1 for e in cat_entries if e.payment_status == FederationEntry.PAYMENT_PAID)
            in_draw = sum(1 for e in cat_entries
                         if (e.slot_position or 0) <= (max_p or float('inf')) and e.payment_status == FederationEntry.PAYMENT_PAID)
            result.append({
                'category_text': cat_text,
                'max_participants': max_p,
                'summary': {
                    'total': len(cat_entries),
                    'paid': paid,
                    'pending': len(cat_entries) - paid,
                    'in_draw': in_draw,
                    'waiting_list': paid - in_draw,
                },
                'entries': FederationEntrySerializer(cat_entries, many=True).data,
            })

        if not result:
            regs = _annotate_slot_positions(
                TournamentRegistration.objects
                .filter(edition=edition, is_withdrawn=False)
                .select_related('profile', 'category')
                .order_by(
                    'category__source_category_text',
                    F('ranking_position').asc(nulls_last=True),
                    'registered_at',
                )
            )
            local_grouped = defaultdict(list)
            for reg in regs:
                cat_text = reg.category.source_category_text if reg.category else 'Sem categoria específica'
                local_grouped[cat_text].append(reg)

            for cat_text, cat_regs in local_grouped.items():
                max_p = cat_regs[0].category.max_participants if cat_regs[0].category else None
                entries_data = []
                paid = 0
                in_draw = 0
                for reg in cat_regs:
                    slot = getattr(reg, 'slot_position', None)
                    is_paid = reg.payment_status in (
                        TournamentRegistration.PAYMENT_PAID,
                        TournamentRegistration.PAYMENT_WAIVED,
                    )
                    if is_paid:
                        paid += 1
                    draw_member = slot is not None and ((max_p is None) or slot <= max_p)
                    if is_paid and draw_member:
                        in_draw += 1
                    status_key = compute_registration_status(reg, slot, max_p)
                    entries_data.append({
                        'id': reg.id,
                        'category_text': cat_text,
                        'player_name': reg.profile.display_name or 'Atleta inscrito',
                        'player_external_id': '',
                        'ranking_position': reg.ranking_position,
                        'payment_status': 'paid' if is_paid else 'pending',
                        'payment_status_label': 'Pago' if is_paid else 'Aguardando pagamento',
                        'source': 'app',
                        'notes': '',
                        'synced_at': reg.updated_at,
                        'slot_position': slot,
                        'in_draw': draw_member if slot is not None else None,
                        'status': status_key,
                        'status_label': REGISTRATION_STATUS_LABELS.get(status_key, ''),
                    })

                result.append({
                    'category_text': cat_text,
                    'max_participants': max_p,
                    'summary': {
                        'total': len(cat_regs),
                        'paid': paid,
                        'pending': len(cat_regs) - paid,
                        'in_draw': in_draw,
                        'waiting_list': max(paid - in_draw, 0),
                    },
                    'entries': entries_data,
                })

        return Response({
            'edition_id': edition.id,
            'edition_title': edition.title,
            'categories': result,
        })


class FederationEntryViewSet(viewsets.GenericViewSet):
    """ViewSet para gerenciar inscrições publicadas pela federação."""
    permission_classes = [IsAuthenticated]

    def _require_staff(self, request):
        if not request.user.is_staff:
            return Response({'detail': 'Acesso negado.'}, status=status.HTTP_403_FORBIDDEN)

    def create(self, request):
        """POST /api/federation-entries/ — Admin: adicionar inscrição manualmente."""
        err = self._require_staff(request)
        if err:
            return err
        serializer = FederationEntryWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = serializer.save()
        return Response(FederationEntryWriteSerializer(entry).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        """PATCH /api/federation-entries/{id}/ — Admin: atualizar inscrição."""
        err = self._require_staff(request)
        if err:
            return err
        try:
            entry = FederationEntry.objects.get(pk=pk)
        except FederationEntry.DoesNotExist:
            return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = FederationEntryWriteSerializer(entry, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, pk=None):
        """DELETE /api/federation-entries/{id}/ — Admin: remover inscrição."""
        err = self._require_staff(request)
        if err:
            return err
        try:
            FederationEntry.objects.get(pk=pk).delete()
        except FederationEntry.DoesNotExist:
            return Response({'detail': 'Não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='bulk-import')
    def bulk_import(self, request):
        """
        POST /api/federation-entries/bulk-import/
        Admin: importar lista de inscrições em lote.

        Payload: { "edition_id": int, "source": str, "entries": [...] }
        Cada entry: { "category_text", "player_name", "player_external_id"?,
                      "ranking_position"?, "payment_status"?, "notes"? }
        """
        err = self._require_staff(request)
        if err:
            return err

        edition_id = request.data.get('edition_id')
        source = request.data.get('source', FederationEntry.SOURCE_MANUAL)
        entries_data = request.data.get('entries', [])

        if not edition_id:
            return Response({'detail': 'edition_id obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)
        if not entries_data:
            return Response({'detail': 'entries não pode ser vazio.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            edition = TournamentEdition.objects.get(pk=edition_id)
        except TournamentEdition.DoesNotExist:
            return Response({'detail': 'Edição não encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        created_count = 0
        updated_count = 0
        errors = []

        for i, entry_data in enumerate(entries_data):
            try:
                player_name = (entry_data.get('player_name') or '').strip()
                category_text = (entry_data.get('category_text') or '').strip()
                external_id = (entry_data.get('player_external_id') or '').strip()

                if not player_name or not category_text:
                    errors.append(f'Linha {i + 1}: player_name e category_text são obrigatórios.')
                    continue

                obj, was_created = FederationEntry.objects.update_or_create(
                    edition=edition,
                    category_text=category_text,
                    player_external_id=external_id,
                    source=source,
                    defaults={
                        'player_name': player_name,
                        'ranking_position': entry_data.get('ranking_position'),
                        'payment_status': entry_data.get('payment_status', FederationEntry.PAYMENT_UNKNOWN),
                        'notes': entry_data.get('notes', ''),
                        'raw_data': entry_data,
                    },
                )
                if was_created:
                    created_count += 1
                else:
                    updated_count += 1
            except Exception as exc:
                errors.append(f'Linha {i + 1}: {exc}')

        return Response({
            'created': created_count,
            'updated': updated_count,
            'errors': errors,
            'detail': f'{created_count} criadas, {updated_count} atualizadas, {len(errors)} erros.',
        })

    @action(detail=False, methods=['delete'], url_path=r'clear/(?P<edition_id>\d+)')
    def clear_edition(self, request, edition_id=None):
        """DELETE /api/federation-entries/clear/{edition_id}/ — Admin: limpar todas as entradas de uma edição."""
        err = self._require_staff(request)
        if err:
            return err
        source = request.query_params.get('source')
        qs = FederationEntry.objects.filter(edition_id=edition_id)
        if source:
            qs = qs.filter(source=source)
        count, _ = qs.delete()
        return Response({'deleted': count})
