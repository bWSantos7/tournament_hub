import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { MainStackParamList } from '../../navigation/types';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText, Card, EmptyState, LoadingBlock, Screen, SectionHeader } from '../../components/ui';
import { FederationCategoryGroup, FederationEntry } from '../../types';
import { federationRegistrations } from '../../services/registrations';

type Props = NativeStackScreenProps<MainStackParamList, 'RegistrationList'>;

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  confirmed:      { color: '#39ff14', icon: 'checkmark-circle', label: 'Na chave' },
  waiting_list:   { color: '#f59e0b', icon: 'time',             label: 'Lista de espera' },
  pending_payment:{ color: '#3b82f6', icon: 'card-outline',     label: 'Pag. pendente' },
};

const PAYMENT_COLORS: Record<string, string> = {
  paid:    '#39ff14',
  pending: '#f59e0b',
  unknown: '#6b7280',
};

export function RegistrationListScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { editionId, editionTitle } = route.params;
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<FederationCategoryGroup[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await federationRegistrations(editionId);
        setCategories(data.categories);
        // Auto-expand first category
        if (data.categories.length > 0) {
          setExpanded(new Set([data.categories[0].category_text]));
        }
      } catch {
        Toast.show({ type: 'error', text1: 'Erro ao carregar lista de inscritos' });
      } finally {
        setLoading(false);
      }
    })();
  }, [editionId]);

  function toggleCategory(text: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(text)) {
        next.delete(text);
      } else {
        next.add(text);
      }
      return next;
    });
  }

  return (
    <Screen>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="body" style={{ fontWeight: '700' }}>Lista de inscritos</AppText>
          <AppText variant="caption" numberOfLines={1}>{editionTitle}</AppText>
        </View>
      </View>

      {loading ? (
        <LoadingBlock />
      ) : categories.length === 0 ? (
        <EmptyState
          title="Lista ainda não publicada"
          subtitle="A federação ainda não divulgou as inscrições deste torneio."
        />
      ) : (
        categories.map((cat) => (
          <CategorySection
            key={cat.category_text}
            cat={cat}
            expanded={expanded.has(cat.category_text)}
            onToggle={() => toggleCategory(cat.category_text)}
            colors={colors}
          />
        ))
      )}
    </Screen>
  );
}

function CategorySection({
  cat,
  expanded,
  onToggle,
  colors,
}: {
  cat: FederationCategoryGroup;
  expanded: boolean;
  onToggle: () => void;
  colors: any;
}) {
  const { summary, max_participants } = cat;
  const drawFull = max_participants != null && summary.paid >= max_participants;

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Category header */}
      <Pressable
        onPress={onToggle}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}
      >
        <View style={{ flex: 1 }}>
          <AppText variant="body" style={{ fontWeight: '700' }}>{cat.category_text}</AppText>
          {max_participants ? (
            <AppText variant="caption" style={{ marginTop: 2 }}>
              Vagas: {summary.in_draw}/{max_participants}
              {drawFull ? ' • Chave completa' : ` • ${max_participants - summary.in_draw} vagas restantes`}
            </AppText>
          ) : null}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>

      {/* Summary pills */}
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 12 }}>
        {[
          { label: `${summary.total} inscritos`, color: colors.textMuted },
          { label: `${summary.paid} pagos`, color: '#39ff14' },
          { label: `${summary.pending} pendentes`, color: '#f59e0b' },
        ].map((pill) => (
          <View
            key={pill.label}
            style={{ backgroundColor: `${pill.color}18`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: `${pill.color}40` }}
          >
            <AppText variant="caption" style={{ color: pill.color, fontWeight: '600', fontSize: 11 }}>{pill.label}</AppText>
          </View>
        ))}
      </View>

      {/* Entry list */}
      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
          {cat.entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} maxP={max_participants} colors={colors} />
          ))}
        </View>
      )}
    </Card>
  );
}

function EntryRow({ entry, maxP, colors }: { entry: FederationEntry; maxP: number | null; colors: any }) {
  const sc = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.pending_payment;
  const payColor = PAYMENT_COLORS[entry.payment_status] ?? '#6b7280';
  const isInDraw = entry.in_draw === true;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
        backgroundColor: isInDraw ? `${sc.color}08` : 'transparent',
      }}
    >
      {/* Slot position */}
      <View style={{ width: 36, alignItems: 'center' }}>
        <AppText
          variant="caption"
          style={{ fontWeight: '700', fontSize: 15, color: isInDraw ? sc.color : colors.textMuted }}
        >
          {entry.slot_position != null ? `#${entry.slot_position}` : '—'}
        </AppText>
      </View>

      {/* Player name + category info */}
      <View style={{ flex: 1, marginLeft: 8 }}>
        <AppText variant="body" style={{ fontWeight: '600' }}>{entry.player_name}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {entry.ranking_position != null ? (
            <AppText variant="caption" style={{ color: colors.textMuted }}>
              Ranking {entry.ranking_position}
            </AppText>
          ) : null}
          {entry.notes ? (
            <AppText variant="caption" style={{ color: colors.textMuted }}>• {entry.notes}</AppText>
          ) : null}
        </View>
      </View>

      {/* Payment + status */}
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name={sc.icon as any} size={14} color={sc.color} />
          <AppText variant="caption" style={{ color: sc.color, fontWeight: '600', fontSize: 10 }}>{sc.label}</AppText>
        </View>
        <View style={{ backgroundColor: `${payColor}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
          <AppText variant="caption" style={{ color: payColor, fontWeight: '600', fontSize: 10 }}>
            {entry.payment_status_label}
          </AppText>
        </View>
      </View>
    </View>
  );
}
