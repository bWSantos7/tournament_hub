import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { MainStackParamList, MainTabParamList } from '../../navigation/types';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText, Card, EmptyState, LoadingBlock, Screen, SectionHeader } from '../../components/ui';
import { haptic } from '../../hooks/useHaptic';
import { TournamentCard } from '../../components/TournamentCard';
import { listWatchlist, watchlistSummary, removeWatchlist } from '../../services/data';
import { WatchlistItem } from '../../types';

function detectConflicts(items: WatchlistItem[]): Set<number> {
  const conflicting = new Set<number>();
  const active = items.filter((item) => {
    const s = item.edition_detail.dynamic_status || item.edition_detail.status;
    return item.edition_detail.start_date && !['finished', 'canceled'].includes(s);
  });
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i].edition_detail;
      const b = active[j].edition_detail;
      const aStart = new Date(a.start_date!);
      const aEnd = a.end_date ? new Date(a.end_date) : aStart;
      const bStart = new Date(b.start_date!);
      const bEnd = b.end_date ? new Date(b.end_date) : bStart;
      if (aStart <= bEnd && bStart <= aEnd) {
        conflicting.add(active[i].id);
        conflicting.add(active[j].id);
      }
    }
  }
  return conflicting;
}

type Props = BottomTabScreenProps<MainTabParamList, 'Watchlist'>;
type StackNav = NativeStackNavigationProp<MainStackParamList>;

export function WatchlistScreen(_: Props) {
  const { colors } = useTheme();
  const navigation = useNavigation<StackNav>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [conflicts, setConflicts] = useState<Set<number>>(new Set());
  const [removing, setRemoving] = useState<number | null>(null);

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
          const list = wl as WatchlistItem[];
          setItems(list);
          setSummary(sm);
          setConflicts(detectConflicts(list));
        } catch {
          Toast.show({ type: 'error', text1: 'Erro ao carregar agenda' });
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, []),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      const [wl, sm] = await Promise.all([
        listWatchlist().catch(() => []),
        watchlistSummary().catch(() => null),
      ]);
      const list = wl as WatchlistItem[];
      setItems(list);
      setSummary(sm);
      setConflicts(detectConflicts(list));
    } catch {}
    setRefreshing(false);
  }

  function handleRemove(item: WatchlistItem) {
    haptic.warning();
    Alert.alert(
      'Remover da agenda',
      `Remover "${item.edition_detail.title || item.edition_detail.tournament_name || 'este torneio'}" da sua agenda?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setRemoving(item.id);
            try {
              await removeWatchlist(item.id);
              setItems((prev) => prev.filter((i) => i.id !== item.id));
              haptic.success();
              Toast.show({ type: 'success', text1: 'Removido da agenda.' });
            } catch {
              Toast.show({ type: 'error', text1: 'Erro ao remover da agenda.' });
            } finally {
              setRemoving(null);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
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

      {/* Conflict warning */}
      {conflicts.size > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f59e0b18', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#f59e0b44', marginBottom: 4 }}>
          <Ionicons name="warning-outline" size={18} color="#f59e0b" />
          <AppText variant="caption" style={{ flex: 1, color: '#f59e0b' }}>
            {`${conflicts.size} torneio${conflicts.size > 1 ? 's' : ''} com datas sobrepostas na sua agenda.`}
          </AppText>
        </View>
      )}

      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState title="Sua agenda está vazia." subtitle="Adicione torneios pela tela de detalhes." />
      ) : (
        items.map((item) => (
          <View key={item.id}>
            {conflicts.has(item.id) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: -4, paddingHorizontal: 4 }}>
                <Ionicons name="warning" size={12} color="#f59e0b" />
                <AppText variant="caption" style={{ color: '#f59e0b', fontSize: 10 }}>Conflito de datas</AppText>
              </View>
            )}
            <View style={{ position: 'relative' }}>
              <TournamentCard
                edition={item.edition_detail}
                onPress={() => navigation.navigate('TournamentDetail', { id: item.edition_detail.id, edition: item.edition_detail })}
              />
              {/* Remove from agenda button */}
              <Pressable
                onPress={() => handleRemove(item)}
                disabled={removing === item.id}
                style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 8, padding: 6, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}
                hitSlop={8}
              >
                <Ionicons name={removing === item.id ? 'hourglass-outline' : 'trash-outline'} size={14} color="#ef4444" />
              </Pressable>
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}
