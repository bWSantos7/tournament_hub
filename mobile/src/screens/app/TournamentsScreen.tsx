import React, { useEffect, useState } from 'react';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { MainStackParamList, MainTabParamList } from '../../navigation/types';
import { AppText, Button, EmptyState, Input, LoadingBlock, Screen, SectionHeader } from '../../components/ui';
import { TournamentCard } from '../../components/TournamentCard';
import { TournamentEditionList } from '../../types';
import { listEditions } from '../../services/tournaments';

type Props = BottomTabScreenProps<MainTabParamList, 'Tournaments'>;
type StackNav = NativeStackNavigationProp<MainStackParamList>;

export function TournamentsScreen(_: Props) {
  const navigation = useNavigation<StackNav>();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TournamentEditionList[]>([]);
  const [query, setQuery] = useState('');

  async function load() {
    setLoading(true);
    try { const data = await listEditions({ page_size: 20, q: query || undefined }); setItems(data.results || []); }
    catch { Toast.show({ type: 'error', text1: 'Erro ao carregar torneios' }); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <Screen>
      <SectionHeader title="Torneios" subtitle="Explore os torneios agregados pelo hub" />
      <Input value={query} onChangeText={setQuery} placeholder="Buscar por nome, cidade, circuito..." />
      <Button title="Buscar" onPress={load} />
      {loading ? <LoadingBlock /> : items.length === 0 ? <EmptyState title="Nenhum torneio encontrado." subtitle="Tente ajustar sua busca." /> : items.map((ed) => <TournamentCard key={ed.id} edition={ed} onPress={() => navigation.navigate('TournamentDetail', { id: ed.id, edition: ed })} />)}
    </Screen>
  );
}
