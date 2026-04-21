from django.db.models import Q
from django_filters import rest_framework as filters
from .models import TournamentEdition


class TournamentEditionFilter(filters.FilterSet):
    from_date = filters.DateFilter(field_name='start_date', lookup_expr='gte')
    to_date = filters.DateFilter(field_name='start_date', lookup_expr='lte')
    state = filters.CharFilter(field_name='venue__state', lookup_expr='iexact')
    city = filters.CharFilter(field_name='venue__city', lookup_expr='icontains')
    organization = filters.NumberFilter(field_name='tournament__organization_id')
    organization_slug = filters.CharFilter(method='filter_org_slug')
    modality = filters.CharFilter(field_name='tournament__modality')
    circuit = filters.CharFilter(field_name='tournament__circuit', lookup_expr='icontains')
    surface = filters.CharFilter(field_name='surface')
    status = filters.CharFilter(field_name='status')
    q = filters.CharFilter(method='filter_search')

    class Meta:
        model = TournamentEdition
        fields = [
            'from_date', 'to_date', 'state', 'city', 'organization',
            'organization_slug', 'modality', 'circuit', 'surface',
            'status', 'q',
        ]

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(title__icontains=value)
            | Q(tournament__canonical_name__icontains=value)
            | Q(venue__name__icontains=value)
            | Q(venue__city__icontains=value)
        )

    def filter_org_slug(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(tournament__organization__short_name__iexact=value)
