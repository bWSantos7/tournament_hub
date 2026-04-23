import React, { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';
import { AppText, Button, Card, EmptyState, LoadingBlock, Screen, SectionHeader } from '../../components/ui';
import { TournamentEditionDetail } from '../../types';
import { getEdition, evaluateEdition, editionHistory } from '../../services/tournaments';
import { listProfiles, toggleWatchlist } from '../../services/data';
import { pickBestProfile } from '../../utils/profile';
import { fmtBRL, fmtDateRange, formatChangeEventDetails, formatChangeEventTitle, translateReason } from '../../utils/format';

type Props = NativeStackScreenProps<MainStackParamList, 'TournamentDetail'>;

export function TournamentDetailScreen({ route, navigation }: Props) {
  const id = route.params.id;
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<TournamentEditionDetail | null>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await getEdition(id);
        setDetail(d);
        const profiles = await listProfiles().catch(() => []);
        const primary = pickBestProfile(profiles as any[]);
        if (primary) setEligibility(await evaluateEdition(id, primary.id).catch(() => null));
        setHistory(await editionHistory(id).catch(() => []));
      } catch {
        Toast.show({ type: 'error', text1: 'Erro ao carregar torneio' });
      } finally { setLoading(false); }
    })();
  }, [id]);

  async function onToggleWatch() {
    try {
      const profiles = await listProfiles().catch(() => []);
      const primary = pickBestProfile(profiles as any[]);
      const result = await toggleWatchlist(id, primary?.id);
      setWatching(result.watching);
      Toast.show({ type: 'success', text1: result.watching ? 'Adicionado à agenda' : 'Removido da agenda' });
    } catch {
      Toast.show({ type: 'error', text1: 'Não foi possível atualizar a agenda' });
    }
  }

  if (loading) return <Screen><LoadingBlock /></Screen>;
  if (!detail) return <Screen><EmptyState title="Torneio não encontrado." /></Screen>;

  return (
    <Screen>
      <Pressable onPress={() => navigation.goBack()}><AppText variant="caption">Voltar</AppText></Pressable>
      <Card>
        <AppText variant="caption">{detail.organization_short || detail.organization_name}</AppText>
        <AppText variant="title">{detail.title}</AppText>
        <AppText variant="caption">{fmtDateRange(detail.start_date, detail.end_date)}</AppText>
        <AppText variant="caption">{[detail.venue_city, detail.venue_state].filter(Boolean).join('/')}</AppText>
        <AppText variant="caption">Superfície: {detail.surface || '—'}</AppText>
        <AppText variant="caption">Inscrição: {fmtBRL(detail.base_price_brl)}</AppText>
        <Button title={watching ? 'Remover da agenda' : 'Adicionar à agenda'} onPress={onToggleWatch} />
        {detail.official_source_url ? <Button title="Abrir página oficial" variant="secondary" onPress={() => Linking.openURL(detail.official_source_url)} /> : null}
      </Card>

      <View>
        <SectionHeader title="Categorias" />
        {detail.categories.length === 0 ? <EmptyState title="Nenhuma categoria encontrada." /> : detail.categories.map((c) => <Card key={c.id}><AppText variant="body" style={{ fontWeight: '700' }}>{c.source_category_text}</AppText><AppText variant="caption">Valor: {fmtBRL(c.price_brl)}</AppText>{c.notes ? <AppText variant="muted">{c.notes}</AppText> : null}</Card>)}
      </View>

      <View>
        <SectionHeader title="Elegibilidade" subtitle="Baseado no seu perfil principal" />
        {!eligibility ? <EmptyState title="Não foi possível avaliar a elegibilidade." /> : eligibility.categories.map((item: any) => <Card key={item.tournament_category_id}><AppText variant="body" style={{ fontWeight: '700' }}>{item.source_text}</AppText><AppText variant="caption">Status: {item.result.status}</AppText>{item.result.reasons?.map((reason: string) => <AppText key={reason} variant="muted">• {translateReason(reason)}</AppText>)}</Card>)}
      </View>

      <View>
        <SectionHeader title="Links" />
        {detail.links.length === 0 ? <EmptyState title="Nenhum link adicional encontrado." /> : detail.links.map((link) => <Card key={link.id}><AppText variant="body" style={{ fontWeight: '700' }}>{link.label || link.link_type}</AppText><Button title="Abrir link" variant="secondary" onPress={() => Linking.openURL(link.url)} /></Card>)}
      </View>

      <View>
        <SectionHeader title="Histórico de alterações" />
        {history.length === 0 ? <EmptyState title="Nenhuma alteração registrada." /> : history.map((event: any) => <Card key={event.id}><AppText variant="body" style={{ fontWeight: '700' }}>{formatChangeEventTitle(event.event_type)}</AppText>{formatChangeEventDetails(event).map((line) => <AppText key={line} variant="muted">• {line}</AppText>)}</Card>)}
      </View>
    </Screen>
  );
}
