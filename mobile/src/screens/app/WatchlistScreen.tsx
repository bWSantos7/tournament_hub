import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { MainStackParamList, MainTabParamList } from '../../navigation/types';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText, Card, EmptyState, LoadingBlock, Screen, SectionHeader } from '../../components/ui';
import { TournamentCard } from '../../components/TournamentCard';
import { listWatchlist, watchlistSummary } from '../../services/data';
import { WatchlistItem } from '../../types';

type Props = BottomTabScreenProps<MainTabParamList, 'Watchlist'>;
type StackNav = NativeStackNavigationProp<MainStackParamList>;

export function WatchlistScreen(_: Props) {
  const { colors } = useTheme();
  const navigation = useNavigation<StackNav>();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [summary, setSummary] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          const [wl, sm] = await Promise.all([
            listWatchlist().catch(() => []),
            watchlistSummary().catch(() => null),
          ]);
          if (!active) return;
          setItems(wl as WatchlistItem[]);
          setSummary(sm);
        } catch {
          Toast.show({ type: 'error', text1: 'Erro ao carregar agenda' });
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, []),
  );

  return (
    <Screen>
      <SectionHeader title="Agenda" subtitle="Seus torneios acompanhados" />

      {summary ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { icon: 'calendar', label: 'Total', value: summary.total, color: colors.accentNeon },
              { icon: 'time-outline', label: 'Próximos', value: summary.upcoming, color: colors.accentBlue },
              { icon: 'checkmark-done-outline', label: 'Passados', value: summary.past, color: colors.textMuted },
              { icon: 'ticket-outline', label: 'Inscrições', value: summary.active_registrations, color: '#f59e0b' },
            ].map((stat) => (
              <View
                key={stat.label}
                style={{ flex: 1, alignItems: 'center', gap: 4, backgroundColor: colors.bgBase, borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.borderSubtle }}
              >
                <Ionicons name={stat.icon as any} size={18} color={stat.color} />
                <AppText variant="body" style={{ fontWeight: '700', fontSize: 18, color: stat.color }}>{stat.value ?? 0}</AppText>
                <AppText variant="caption" style={{ fontSize: 10, textAlign: 'center', color: colors.textMuted }}>{stat.label}</AppText>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState title="Sua agenda está vazia." subtitle="Adicione torneios pela tela de detalhes." />
      ) : (
        items.map((item) => (
          <TournamentCard
            key={item.id}
            edition={item.edition_detail}
            onPress={() => navigation.navigate('TournamentDetail', { id: item.edition_detail.id, edition: item.edition_detail })}
          />
        ))
      )}
    </Screen>
  );
}
