import React, { useEffect, useState } from 'react';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../../navigation/types';
import { AppText, Card, EmptyState, LoadingBlock, Screen, SectionHeader } from '../../components/ui';
import { listWatchlist } from '../../services/data';
import { WatchlistItem } from '../../types';

type Props = BottomTabScreenProps<MainTabParamList, 'Results'>;

export function ResultsScreen(_: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    (async () => {
      const list = await listWatchlist().catch(() => []);
      setItems((list as WatchlistItem[]).filter((item) => !!item.result));
      setLoading(false);
    })();
  }, []);

  return (
    <Screen>
      <SectionHeader title="Resultados" subtitle="Resultados salvos na sua agenda" />
      {loading ? <LoadingBlock /> : items.length === 0 ? <EmptyState title="Nenhum resultado registrado ainda." subtitle="Quando você salvar resultados na agenda, eles aparecerão aqui." /> : items.map((item) => <Card key={item.id}><AppText variant="body" style={{ fontWeight: '700' }}>{item.edition_detail.title}</AppText>{item.result ? <><AppText variant="caption">Categoria: {item.result.category_played || '—'}</AppText><AppText variant="caption">Posição: {item.result.position ?? '—'}</AppText><AppText variant="caption">Vitórias: {item.result.wins} • Derrotas: {item.result.losses}</AppText>{item.result.notes ? <AppText variant="muted">{item.result.notes}</AppText> : null}</> : null}</Card>)}
    </Screen>
  );
}
