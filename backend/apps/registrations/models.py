from django.db import models
from django.utils import timezone
from apps.core.models import TimestampedModel


class TournamentRegistration(TimestampedModel):
    """
    Inscrição de um jogador (via perfil) em uma edição de torneio.

    Fluxo:
      1. Jogador se inscreve → status pending
      2. Federação confirma pagamento → payment_status = paid
      3. Sistema calcula slot_position pela posição no ranking
      4. Se slot_position <= category.max_participants → in_draw=True
      5. Status final = confirmed / waiting_list / pending_payment / withdrawn
    """

    PAYMENT_PENDING = 'pending'
    PAYMENT_PAID = 'paid'
    PAYMENT_WAIVED = 'waived'
    PAYMENT_REFUNDED = 'refunded'
    PAYMENT_CHOICES = [
        (PAYMENT_PENDING, 'Aguardando pagamento'),
        (PAYMENT_PAID, 'Pago'),
        (PAYMENT_WAIVED, 'Isento'),
        (PAYMENT_REFUNDED, 'Reembolsado'),
    ]

    profile = models.ForeignKey(
        'players.PlayerProfile',
        on_delete=models.CASCADE,
        related_name='registrations',
    )
    edition = models.ForeignKey(
        'tournaments.TournamentEdition',
        on_delete=models.CASCADE,
        related_name='registrations',
    )
    category = models.ForeignKey(
        'tournaments.TournamentCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='registrations',
    )

    registered_at = models.DateTimeField(default=timezone.now, db_index=True)
    ranking_position = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Posição no ranking no momento da inscrição (menor = melhor)',
    )

    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_CHOICES,
        default=PAYMENT_PENDING,
        db_index=True,
    )
    payment_confirmed_at = models.DateTimeField(null=True, blank=True)
    payment_confirmed_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payment_confirmations',
    )
    payment_notes = models.TextField(blank=True)

    is_withdrawn = models.BooleanField(default=False, db_index=True)
    withdrawn_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True, help_text='Observações internas (admin)')

    class Meta:
        ordering = ['ranking_position', 'registered_at']
        unique_together = [('profile', 'edition', 'category')]
        indexes = [
            models.Index(fields=['edition', 'is_withdrawn']),
            models.Index(fields=['profile', 'edition']),
            models.Index(fields=['payment_status']),
        ]

    def __str__(self):
        return f'{self.profile.display_name} @ {self.edition.title}'

    def withdraw(self):
        self.is_withdrawn = True
        self.withdrawn_at = timezone.now()
        self.save(update_fields=['is_withdrawn', 'withdrawn_at'])

    def confirm_payment(self, confirmed_by=None, notes=''):
        self.payment_status = self.PAYMENT_PAID
        self.payment_confirmed_at = timezone.now()
        if confirmed_by:
            self.payment_confirmed_by = confirmed_by
        if notes:
            self.payment_notes = notes
        fields = ['payment_status', 'payment_confirmed_at', 'payment_confirmed_by', 'payment_notes']
        self.save(update_fields=fields)

    def reset_payment(self):
        self.payment_status = self.PAYMENT_PENDING
        self.payment_confirmed_at = None
        self.payment_confirmed_by = None
        self.save(update_fields=['payment_status', 'payment_confirmed_at', 'payment_confirmed_by'])
