import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TournamentEditionList, TournamentStatus } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { AppText, Card } from './ui';
import { STATUS_LABELS, fmtBRL, fmtDateRange, fmtRelative } from '../utils/format';

function badge(status: TournamentStatus, colors: ReturnType<typeof useTheme>['colors']) {
  switch (status) {
    case 'open': return { bg: `${colors.statusOpen}22`, border: `${colors.statusOpen}55`, text: colors.statusOpen };
    case 'closing_soon': return { bg: `${colors.statusClosing}22`, border: `${colors.statusClosing}55`, text: colors.statusClosing };
    case 'closed': return { bg: `${colors.statusClosed}22`, border: `${colors.statusClosed}55`, text: colors.statusClosed };
    case 'draws_published': return { bg: `${colors.statusDrawn}22`, border: `${colors.statusDrawn}55`, text: colors.statusDrawn };
    case 'in_progress': return { bg: `${colors.statusProgress}22`, border: `${colors.statusProgress}55`, text: colors.statusProgress };
    case 'finished': return { bg: `${colors.statusFinished}22`, border: `${colors.statusFinished}55`, text: colors.statusFinished };
    case 'canceled': return { bg: `${colors.statusCanceled}22`, border: `${colors.statusCanceled}55`, text: colors.statusCanceled };
    default: return { bg: colors.bgElevated, border: colors.borderSubtle, text: colors.textMuted };
  }
}

export function TournamentCard({ edition, showEligibility = false, onPress }: { edition: TournamentEditionList; showEligibility?: boolean; onPress?: () => void; }) {
  const { colors } = useTheme();
  const status = edition.dynamic_status || edition.status;
  const b = badge(status, colors);
  const location = [edition.venue_city, edition.venue_state].filter(Boolean).join('/');
  return (
    <Pressable onPress={onPress} style={{ marginBottom: 10 }}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <AppText variant="caption" style={{ color: colors.accentBlue, fontWeight: '700', textTransform: 'uppercase' }}>{edition.organization_short || edition.organization_name}</AppText>
              {edition.circuit ? <AppText variant="caption">• {edition.circuit}</AppText> : null}
            </View>
            <AppText variant="body" style={{ fontWeight: '700', fontSize: 16 }} numberOfLines={2}>{edition.title}</AppText>
          </View>
          <View style={{ borderWidth: 1, borderColor: b.border, backgroundColor: b.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' }}>
            <AppText variant="caption" style={{ color: b.text, fontWeight: '700' }}>{STATUS_LABELS[status] || status}</AppText>
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <AppText variant="caption">{fmtDateRange(edition.start_date, edition.end_date)}</AppText>
          </View>
          {location ? <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><Ionicons name="location-outline" size={14} color={colors.textSecondary} /><AppText variant="caption">{location}</AppText></View> : null}
          {edition.entry_close_at ? <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><Ionicons name="time-outline" size={14} color={colors.statusClosing} /><AppText variant="caption" style={{ color: colors.statusClosing }}>Inscrições até {fmtRelative(edition.entry_close_at)}</AppText></View> : null}
          {edition.base_price_brl !== null && edition.base_price_brl !== undefined ? <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><Ionicons name="receipt-outline" size={14} color={colors.textPrimary} /><AppText variant="caption">Inscrição {fmtBRL(edition.base_price_brl)}</AppText></View> : null}
        </View>

        {showEligibility && edition.eligibility ? <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Ionicons name="checkmark-circle-outline" size={16} color={colors.accentNeon} /><AppText variant="caption" style={{ color: colors.accentNeon, fontWeight: '600' }}>{edition.eligibility.compatible_count} compatíveis</AppText></View>
          {edition.eligibility.unknown_count > 0 ? <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Ionicons name="ellipse-outline" size={16} color={colors.textMuted} /><AppText variant="caption">{edition.eligibility.unknown_count} a verificar</AppText></View> : null}
        </View> : null}
      </Card>
    </Pressable>
  );
}
