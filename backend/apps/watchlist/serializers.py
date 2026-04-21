from rest_framework import serializers
from .models import WatchlistItem
from apps.tournaments.serializers import TournamentEditionListSerializer


class WatchlistItemSerializer(serializers.ModelSerializer):
    edition_detail = TournamentEditionListSerializer(source='edition', read_only=True)

    class Meta:
        model = WatchlistItem
        fields = (
            'id', 'edition', 'edition_detail', 'profile', 'user_status', 'notes',
            'alert_on_deadline', 'alert_on_changes', 'alert_on_draws',
            'created_at', 'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')

    def create(self, validated_data):
        user = self.context['request'].user
        obj, created = WatchlistItem.objects.update_or_create(
            user=user,
            edition=validated_data['edition'],
            defaults={k: v for k, v in validated_data.items() if k != 'edition'},
        )
        return obj
