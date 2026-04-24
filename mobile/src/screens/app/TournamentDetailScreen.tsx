import React, { useEffect, useState } from 'react';
import { Linking, Pressable, Share, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { MainStackParamList } from '../../navigation/types';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText, Button, Card, EmptyState, LoadingBlock, Screen, SectionHeader } from '../../components/ui';
import { TournamentEditionDetail } from '../../types';
import { getEdition, evaluateEdition, editionHistory } from '../../services/tournaments';
import { listProfiles, toggleWatchlist } from '../../services/data';
import { pickBestProfile } from '../../utils/profile';
import { fmtBRL, fmtDateRange, formatChangeEventDetails, formatChangeEventTitle, translateReason, STATUS_LABELS } from '../../utils/format';
import { extractApiError } from '../../services/api';

type Props = NativeStackScreenProps<MainStackParamList, 'TournamentDetail'>;

const STATUS_COLORS: Record<string, string> = {
  open: '#39ff14',
  closing_soon: '#f59e0b',
  closed: '#ef4444',
  registration_open: '#39ff14',
  registration_closed: '#ef4444',
  in_progress: '#3b82f6',
  finished: '#6b7280',
  canceled: '#ef4444',
  draw_published: '#8b5cf6',
};

export function TournamentDetailScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const id = route.params.id;
  const preloaded = route.params.edition;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TournamentEditionDetail | null>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [watching, setWatching] = useState(false);
  const [togglingWatch, setTogglingWatch] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const d = await getEdition(id);
      setDetail(d);
      const [profiles, hist] = await Promise.all([
        listProfiles().catch(() => []),
        editionHistory(id).catch(() => []),
      ]);
      setHistory(hist as any[]);
      const primary = pickBestProfile(profiles as any[]);
      if (primary) {
        const elig = await evaluateEdition(id, primary.id).catch(() => null);
        setEligibility(elig);
      }
    } catch (err) {
      setError(extractApiError(err));
      Toast.show({ type: 'error', text1: 'Erro ao carregar torneio', text2: extractApiError(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function onToggleWatch() {
    if (!detail) return;
    setTogglingWatch(true);
    try {
      const profiles = await listProfiles().catch(() => []);
      const primary = pickBestProfile(profiles as any[]);
      const result = await toggleWatchlist(id, primary?.id);
      setWatching(result.watching);
      Toast.show({ type: 'success', text1: result.watching ? 'Adicionado à agenda' : 'Removido da agenda' });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Não foi possível atualizar a agenda', text2: extractApiError(err) });
    } finally {
      setTogglingWatch(false);
    }
  }

  async function onShare() {
    if (!detail) return;
    try {
      await Share.share({
        title: detail.title,
        message: `${detail.title}${detail.official_source_url ? `\n${detail.official_source_url}` : ''}`,
        url: detail.official_source_url || undefined,
      });
    } catch {}
  }

  const statusColor = detail ? (STATUS_COLORS[detail.status] ?? colors.textMuted) : colors.textMuted;
  const statusLabel = detail ? (STATUS_LABELS[detail.status] ?? detail.status) : '';

  if (loading) {
    return (
      <Screen scroll={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <AppText variant="body" style={{ fontWeight: '600' }}>{preloaded?.title ?? 'Carregando...'}</AppText>
        </View>
        <LoadingBlock />
      </Screen>
    );
  }

  if (error || !detail) {
    return (
      <Screen scroll={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <AppText variant="body" style={{ fontWeight: '600' }}>Erro</AppText>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <AppText variant="body" style={{ textAlign: 'center', fontWeight: '600' }}>Não foi possível carregar o torneio</AppText>
          <AppText variant="muted" style={{ textAlign: 'center' }}>{error ?? 'Torneio não encontrado.'}</AppText>
          <Button title="Tentar novamente" onPress={load} />
          <Button title="Voltar" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

  const visibleCategories = showAllCategories ? detail.categories : detail.categories.slice(0, 3);

  return (
    <Screen>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Pressable onPress={onShare} style={{ padding: 4 }}>
          <Ionicons name="share-outline" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* Main info card */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <AppText variant="muted" style={{ fontSize: 12 }}>{detail.organization_short || detail.organization_name}</AppText>
          <View style={{ backgroundColor: `${statusColor}20`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
            <AppText variant="muted" style={{ fontSize: 11, color: statusColor, fontWeight: '600' }}>{statusLabel}</AppText>
          </View>
        </View>

        <AppText variant="title" style={{ marginBottom: 12 }}>{detail.title}</AppText>

        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
            <AppText variant="caption">{fmtDateRange(detail.start_date, detail.end_date)}</AppText>
          </View>
          {(detail.venue_city || detail.venue_state) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="location-outline" size={14} color={colors.textMuted} />
              <AppText variant="caption">{[detail.venue_city, detail.venue_state].filter(Boolean).join(' / ')}</AppText>
            </View>
          )}
          {detail.surface && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="tennisball-outline" size={14} color={colors.textMuted} />
              <AppText variant="caption">Superfície: {detail.surface}</AppText>
            </View>
          )}
          {detail.base_price_brl != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="cash-outline" size={14} color={colors.textMuted} />
              <AppText variant="caption">Inscrição: {fmtBRL(detail.base_price_brl)}</AppText>
            </View>
          )}
          {detail.entry_close_at && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <AppText variant="caption">Prazo: {fmtDateRange(detail.entry_close_at, detail.entry_close_at)}</AppText>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Button
            title={watching ? 'Na agenda' : 'Adicionar à agenda'}
            onPress={onToggleWatch}
            loading={togglingWatch}
          />
          {detail.official_source_url ? (
            <Button
              title="Página oficial"
              variant="secondary"
              onPress={() => Linking.openURL(detail.official_source_url)}
            />
          ) : null}
        </View>
      </Card>

      {/* Eligibility */}
      {eligibility && (
        <View>
          <SectionHeader title="Elegibilidade" subtitle="Baseado no seu perfil principal" />
          {eligibility.categories?.map((item: any) => {
            const isEligible = item.result?.status === 'eligible';
            const iconName = isEligible ? 'checkmark-circle' : 'close-circle';
            const iconColor = isEligible ? colors.accentNeon : '#ef4444';
            return (
              <Card key={item.tournament_category_id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Ionicons name={iconName} size={16} color={iconColor} />
                  <AppText variant="body" style={{ fontWeight: '700', flex: 1 }}>{item.source_text}</AppText>
                </View>
                {item.result?.reasons?.map((reason: string) => (
                  <AppText key={reason} variant="muted" style={{ marginLeft: 24 }}>• {translateReason(reason)}</AppText>
                ))}
              </Card>
            );
          })}
        </View>
      )}

      {/* Categories */}
      <SectionHeader title="Categorias" />
      {detail.categories.length === 0 ? (
        <EmptyState title="Nenhuma categoria encontrada." />
      ) : (
        <View>
          {visibleCategories.map((c) => (
            <Card key={c.id}>
              <AppText variant="body" style={{ fontWeight: '700' }}>{c.source_category_text}</AppText>
              {c.price_brl != null && <AppText variant="caption">Valor: {fmtBRL(c.price_brl)}</AppText>}
              {c.notes ? <AppText variant="muted">{c.notes}</AppText> : null}
            </Card>
          ))}
          {detail.categories.length > 3 && (
            <Pressable onPress={() => setShowAllCategories(!showAllCategories)} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <AppText variant="caption" style={{ color: colors.accentNeon }}>
                {showAllCategories ? 'Ver menos' : `Ver mais ${detail.categories.length - 3} categorias`}
              </AppText>
            </Pressable>
          )}
        </View>
      )}

      {/* Links */}
      {detail.links?.length > 0 && (
        <View>
          <SectionHeader title="Links" />
          {detail.links.map((link) => (
            <Card key={link.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <AppText variant="body" style={{ fontWeight: '600' }}>{link.label || link.link_type}</AppText>
                <Pressable onPress={() => Linking.openURL(link.url)}>
                  <Ionicons name="open-outline" size={18} color={colors.accentNeon} />
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* History */}
      {history.length > 0 && (
        <View>
          <SectionHeader title="Histórico de alterações" />
          {history.slice(0, 5).map((event: any) => (
            <Card key={event.id}>
              <AppText variant="body" style={{ fontWeight: '700' }}>{formatChangeEventTitle(event.event_type)}</AppText>
              {formatChangeEventDetails(event).map((line) => (
                <AppText key={line} variant="muted">• {line}</AppText>
              ))}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
