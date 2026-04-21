"""Seeds Organizations and DataSources for piloto integrations."""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.sources.models import Organization, DataSource


ORGANIZATIONS = [
    {
        'name': 'Confederacao Brasileira de Tenis',
        'short_name': 'CBT',
        'type': Organization.TYPE_CONFEDERATION,
        'website_url': 'https://cbt-tenis.com.br',
        'state': '',
        'description': 'Confederacao Brasileira de Tenis - entidade nacional.',
    },
    {
        'name': 'Federacao Paulista de Tenis',
        'short_name': 'FPT',
        'type': Organization.TYPE_FEDERATION,
        'website_url': 'https://fpt.com.br',
        'state': 'SP',
    },
    {
        'name': 'Federacao Mineira de Tenis',
        'short_name': 'FMT',
        'type': Organization.TYPE_FEDERATION,
        'website_url': 'https://www.fmtenis.com.br',
        'state': 'MG',
    },
    {
        'name': 'Federacao Catarinense de Tenis',
        'short_name': 'FCT',
        'type': Organization.TYPE_FEDERATION,
        'website_url': 'https://fct.org.br',
        'state': 'SC',
    },
    {
        'name': 'Tenis Integrado',
        'short_name': 'TI',
        'type': Organization.TYPE_PLATFORM,
        'website_url': 'https://www.tenisintegrado.com.br',
    },
    {
        'name': 'LetzPlay',
        'short_name': 'LZP',
        'type': Organization.TYPE_PLATFORM,
        'website_url': 'https://letzplay.me',
    },
]


DATA_SOURCES = [
    {
        'org_short': 'CBT',
        'source_name': 'CBT - Tournaments Central',
        'slug': 'cbt-public',
        'source_type': DataSource.SOURCE_TYPE_HTML,
        'base_url': 'https://cbt-tenis.com.br',
        'connector_key': 'cbt_public',
        'fetch_schedule_cron': '0 */2 * * *',
        'priority': 'P0',
        'config_json': {
            'sections': ['youth', 'professional', 'beachtennis', 'wheelchair', 'seniors', 'kids'],
        },
    },
    {
        'org_short': 'FPT',
        'source_name': 'FPT - Area Publica (sisfpt) + tenispaulista',
        'slug': 'fpt-public',
        'source_type': DataSource.SOURCE_TYPE_HTML,
        'base_url': 'https://sisfpt.com.br',
        'connector_key': 'fpt_public',
        'fetch_schedule_cron': '15 */2 * * *',
        'priority': 'P0',
        'config_json': {
            'urls': [
                'https://sisfpt.com.br/area-publica/torneios/abertos',
                'https://www.tenispaulista.com.br/category/calendario/',
            ],
        },
    },
    {
        'org_short': 'FCT',
        'source_name': 'FCT - Torneios publicos via Tenis Integrado',
        'slug': 'fct-public',
        'source_type': DataSource.SOURCE_TYPE_HTML,
        'base_url': 'https://www.tenisintegrado.com.br',
        'connector_key': 'fct_public',
        'fetch_schedule_cron': '30 */2 * * *',
        'priority': 'P1',
        'config_json': {
            'site_id': 4183,
            'entity_type': 2,
            'state_id': 24,
            'months_ahead': 5,
        },
    },
]


class Command(BaseCommand):
    help = 'Seeds Organizations and DataSources for the MVP pilot.'

    @transaction.atomic
    def handle(self, *args, **options):
        org_by_short = {}
        for entry in ORGANIZATIONS:
            obj, _ = Organization.objects.update_or_create(
                short_name=entry['short_name'],
                defaults={k: v for k, v in entry.items() if k != 'short_name'},
            )
            org_by_short[entry['short_name']] = obj

        for entry in DATA_SOURCES:
            org = org_by_short.get(entry['org_short'])
            if not org:
                self.stderr.write(f'Org {entry["org_short"]} not found, skipping')
                continue
            DataSource.objects.update_or_create(
                slug=entry['slug'],
                defaults={
                    'organization': org,
                    'source_name': entry['source_name'],
                    'source_type': entry['source_type'],
                    'base_url': entry['base_url'],
                    'connector_key': entry['connector_key'],
                    'fetch_schedule_cron': entry['fetch_schedule_cron'],
                    'priority': entry['priority'],
                    'config_json': entry['config_json'],
                    'enabled': True,
                },
            )

        self.stdout.write(self.style.SUCCESS(
            f'Organizations: {len(ORGANIZATIONS)} | DataSources: {len(DATA_SOURCES)}'
        ))
