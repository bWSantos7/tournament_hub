from django.contrib import admin
from .models import TournamentRegistration


@admin.register(TournamentRegistration)
class TournamentRegistrationAdmin(admin.ModelAdmin):
    list_display = (
        'profile', 'edition', 'category', 'ranking_position',
        'payment_status', 'is_withdrawn', 'registered_at',
    )
    list_filter = ('payment_status', 'is_withdrawn', 'edition__season_year')
    search_fields = ('profile__display_name', 'profile__user__email', 'edition__title')
    raw_id_fields = ('profile', 'edition', 'category', 'payment_confirmed_by')
    ordering = ('edition', 'ranking_position', 'registered_at')
    readonly_fields = ('registered_at', 'payment_confirmed_at', 'withdrawn_at', 'created_at', 'updated_at')

    actions = ['confirm_payment', 'reset_payment']

    def confirm_payment(self, request, queryset):
        for reg in queryset:
            reg.confirm_payment(confirmed_by=request.user)
        self.message_user(request, f'{queryset.count()} inscrições confirmadas.')
    confirm_payment.short_description = 'Confirmar pagamento'

    def reset_payment(self, request, queryset):
        for reg in queryset:
            reg.reset_payment()
        self.message_user(request, f'{queryset.count()} inscrições resetadas para pendente.')
    reset_payment.short_description = 'Resetar pagamento para pendente'
