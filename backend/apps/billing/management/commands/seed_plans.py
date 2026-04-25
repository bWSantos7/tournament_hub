"""
Seed Free / Pro / Elite plans with features.

Usage:
    python manage.py seed_plans
    python manage.py seed_plans --reset   # wipe and recreate
"""
from django.core.management.base import BaseCommand
from apps.billing.models import Feature, Plan, PlanFeature


FEATURES = [
    ('tournament_creation',     'Criação de torneios',               'Criar e gerenciar torneios'),
    ('profile_highlight',       'Destaque no perfil',                'Perfil destacado nos resultados de busca'),
    ('advanced_stats',          'Estatísticas avançadas',            'Acesso a estatísticas e análises detalhadas'),
    ('ranking_access',          'Acesso ao ranking',                 'Visualizar rankings regionais e nacionais'),
    ('unlimited_registrations', 'Inscrições ilimitadas',             'Sem limite de inscrições em torneios'),
    ('advanced_filters',        'Filtros avançados',                 'Filtros por nível, distância, tipo e mais'),
    ('match_priority',          'Prioridade em partidas',            'Prioridade na formação de duplas e partidas'),
    ('premium_tournaments',     'Torneios premium',                  'Acesso a torneios exclusivos premium'),
    ('export_data',             'Exportar dados',                    'Exportar histórico e estatísticas em CSV/PDF'),
    ('coach_module',            'Módulo de treinador',               'Ferramentas de gestão de atletas para coaches'),
    ('multi_profile',           'Múltiplos perfis',                  'Gerenciar até 3 perfis de jogo distintos'),
    ('watchlist_unlimited',     'Watchlist ilimitada',               'Acompanhar atletas sem limite de quantidade'),
]

PLANS = [
    {
        'name': 'Free',
        'slug': 'free',
        'price_monthly': '0.00',
        'price_yearly': '0.00',
        'description': 'Para começar a explorar o mundo dos torneios.',
        'highlight_label': '',
        'display_order': 0,
        'features': {
            # code → limit (None = unlimited, integer = capped)
            'ranking_access':          None,
            'advanced_filters':        None,
            'tournament_creation':     3,
            'unlimited_registrations': 5,
        },
    },
    {
        'name': 'Pro',
        'slug': 'pro',
        'price_monthly': '0.50',
        'price_yearly': '5.00',
        'description': 'Para atletas competitivos que querem evoluir.',
        'highlight_label': 'Mais popular',
        'display_order': 1,
        'features': {
            'ranking_access':          None,
            'advanced_filters':        None,
            'tournament_creation':     None,
            'unlimited_registrations': None,
            'advanced_stats':          None,
            'profile_highlight':       None,
            'match_priority':          None,
            'export_data':             None,
        },
    },
    {
        'name': 'Elite',
        'slug': 'elite',
        'price_monthly': '1.00',
        'price_yearly': '10.00',
        'description': 'Tudo que o Pro oferece, mais ferramentas exclusivas.',
        'highlight_label': 'Completo',
        'display_order': 2,
        'features': {
            'ranking_access':          None,
            'advanced_filters':        None,
            'tournament_creation':     None,
            'unlimited_registrations': None,
            'advanced_stats':          None,
            'profile_highlight':       None,
            'match_priority':          None,
            'export_data':             None,
            'premium_tournaments':     None,
            'coach_module':            None,
            'multi_profile':           None,
            'watchlist_unlimited':     None,
        },
    },
]


class Command(BaseCommand):
    help = 'Seed billing plans and features'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Delete existing plans and features before seeding')

    def handle(self, *args, **options):
        if options['reset']:
            PlanFeature.objects.all().delete()
            Plan.objects.all().delete()
            Feature.objects.all().delete()
            self.stdout.write(self.style.WARNING('Existing billing data deleted.'))

        # Upsert features
        feature_map = {}
        for code, name, description in FEATURES:
            f, created = Feature.objects.update_or_create(
                code=code,
                defaults={'name': name, 'description': description},
            )
            feature_map[code] = f
            action = 'Created' if created else 'Updated'
            self.stdout.write(f'  {action} feature: {code}')

        # Upsert plans
        for plan_data in PLANS:
            features = plan_data.pop('features')
            plan, created = Plan.objects.update_or_create(
                slug=plan_data['slug'],
                defaults=plan_data,
            )
            action = 'Created' if created else 'Updated'
            self.stdout.write(f'  {action} plan: {plan.slug}')

            desired_feature_ids = []
            for code, limit in features.items():
                pf, _ = PlanFeature.objects.update_or_create(
                    plan=plan,
                    feature=feature_map[code],
                    defaults={'limit': limit},
                )
                desired_feature_ids.append(pf.pk)

            removed, _ = PlanFeature.objects.filter(plan=plan).exclude(pk__in=desired_feature_ids).delete()
            if removed:
                self.stdout.write(f'  Removed {removed} orphaned feature(s) from plan: {plan.slug}')

        self.stdout.write(self.style.SUCCESS('Plans seeded successfully.'))
