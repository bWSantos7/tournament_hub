import React, { useEffect, useState } from 'react';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { MainStackParamList, MainTabParamList } from '../../navigation/types';
import { AppText, Card, EmptyState, LoadingBlock, Screen, SectionHeader } from '../../components/ui';
import { TournamentCard } from '../../components/TournamentCard';
import { listWatchlist, watchlistSummary } from '../../services/data';
import { WatchlistItem } from '../../types';

type Props = BottomTabScreenProps<MainTabParamList, 'Watchlist'>;
type StackNav = NativeStackNavigationProp<MainStackParamList>;

export function WatchlistScreen(_: Props) {
  const navigation = useNavigation<StackNav>();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        setItems(await listWatchlist().catch(() => []) as WatchlistItem[]);
        setSummary(await watchlistSummary().catch(() => null));
      } catch {
        Toast.show({ type: 'error', text1: 'Erro ao carregar agenda' });
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <Screen>
      <SectionHeader title="Agenda" subtitle="Seus torneios acompanhados" />
      {summary ? <Card><AppText variant="caption">Total: {summary.total}</AppText><AppText variant="caption">Registros ativos: {summary.active_registrations}</AppText><AppText variant="caption">Próximos: {summary.upcoming}</AppText><AppText variant="caption">Passados: {summary.past}</AppText></Card> : null}
      {loading ? <LoadingBlock /> : items.length === 0 ? <EmptyState title="Sua agenda está vazia." subtitle="Adicione torneios pela tela de detalhes." /> : items.map((item) => <TournamentCard key={item.id} edition={item.edition_detail} onPress={() => navigation.navigate('TournamentDetail', { id: item.edition_detail.id, edition: item.edition_detail })} />)}
    </Screen>
  );
}
