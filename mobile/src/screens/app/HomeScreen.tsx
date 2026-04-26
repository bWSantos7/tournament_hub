import React, { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { MainStackParamList, MainTabParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText, Button, EmptyState, LoadingBlock, Screen, SectionHeader } from '../../components/ui';
import { TournamentCard } from '../../components/TournamentCard';
import { listProfiles, unreadAlerts } from '../../services/data';
import { closingSoon, compatibleForProfile, listEditions } from '../../services/tournaments';
import { PlayerProfile, TournamentEditionList } from '../../types';
import { pickBestProfile } from '../../utils/profile';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;
type StackNav = NativeStackNavigationProp<MainStackParamList>;

export function HomeScreen(_: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<StackNav>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [compat, setCompat] = useState<TournamentEditionList[]>([]);
  const [closing, setClosing] = useState<TournamentEditionList[]>([]);
  const [recent, setRecent] = useState<TournamentEditionList[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const hasLoadedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!hasLoadedRef.current) setLoading(true);
        try {
          const [profiles, closingData, recentData, alerts] = await Promise.all([
            listProfiles().catch(() => []),
            closingSoon(14).catch(() => []),
            listEditions({ page_size: 8, ordering: '-created_at' }).catch(() => ({ results: [] } as any)),
            unreadAlerts().catch(() => []),
          ]);
          if (!active) return;
          const primary = pickBestProfile(profiles as PlayerProfile[]);
          setHasProfile((profiles as PlayerProfile[]).length > 0);
          setProfile(primary);
          setClosing((closingData as TournamentEditionList[]).slice(0, 6));
          const HIDDEN_STATUSES = ['finished', 'canceled'];
          setRecent(((recentData.results || []) as TournamentEditionList[]).filter((ed) => !HIDDEN_STATUSES.includes(ed.dynamic_status || ed.status)).slice(0, 6));
          setUnreadCount((alerts || []).length);
          if (primary) {
            const compatData = await compatibleForProfile(primary.id, { page_size: 8 }).catch(() => ({ results: [] as TournamentEditionList[] }));
            if (!active) return;
            setCompat((compatData.results || []).slice(0, 8));
          }
          hasLoadedRef.current = true;
        } catch {
          Toast.show({ type: 'error', text1: 'Erro ao carregar início' });
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, []),
  );

  if (loading) return <Screen><LoadingBlock /></Screen>;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" style={{ color: colors.textMuted }}>Olá,</AppText>
          <AppText variant="title">{user?.full_name || profile?.display_name || user?.email?.split('@')[0] || 'Jogador'}</AppText>
          {profile ? <AppText variant="caption" style={{ marginTop: 4 }}>{profile.tennis_class ? `Classe ${profile.tennis_class}` : ''}{profile.sporting_age ? ` • ${profile.sporting_age} anos esportivos` : ''}{profile.home_state ? ` • ${profile.home_state}` : ''}</AppText> : null}
        </View>
        <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Alerts' } as never)} style={{ padding: 8 }}>
          <View>
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            {unreadCount > 0 ? <View style={{ position: 'absolute', right: -4, top: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accentNeon, alignItems: 'center', justifyContent: 'center' }}><AppText variant="caption" style={{ color: colors.bgBase, fontWeight: '700', fontSize: 10 }}>{unreadCount > 9 ? '9+' : unreadCount}</AppText></View> : null}
          </View>
        </Pressable>
      </View>

      {!hasProfile ? (
        <View style={{ borderWidth: 1, borderColor: `${colors.accentNeon}55`, backgroundColor: `${colors.accentNeon}10`, borderRadius: 20, padding: 16, flexDirection: 'row', gap: 12 }}>
          <Ionicons name="sparkles-outline" size={20} color={colors.accentNeon} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={{ fontWeight: '600' }}>Complete seu perfil</AppText>
            <AppText variant="muted" style={{ marginTop: 4 }}>Informe sua categoria, idade e localização para ver torneios compatíveis com você.</AppText>
          </View>
          <Button title="Configurar" onPress={() => navigation.navigate('Onboarding')} />
        </View>
      ) : null}

      {profile ? (
        <View>
          <SectionHeader title="Compatíveis com você" subtitle="Baseado no seu perfil, categoria e localização" />
          {compat.length === 0 ? <EmptyState title="Nenhum torneio compatível encontrado ainda." subtitle="Verifique se seu perfil está completo ou aguarde novas ingestões." /> : compat.map((ed) => <TournamentCard key={ed.id} edition={ed} showEligibility onPress={() => navigation.navigate('TournamentDetail', { id: ed.id, edition: ed })} />)}
        </View>
      ) : null}

      <View>
        <SectionHeader title="Inscrições fechando" subtitle="Próximos 14 dias" />
        {closing.length === 0 ? <EmptyState title="Nenhum prazo se aproximando." /> : closing.map((ed) => <TournamentCard key={ed.id} edition={ed} onPress={() => navigation.navigate('TournamentDetail', { id: ed.id, edition: ed })} />)}
      </View>

      <View>
        <SectionHeader title="Recentemente adicionados" subtitle="Últimos torneios agregados pelas fontes" />
        {recent.length === 0 ? <EmptyState title="Nenhum torneio na base ainda." subtitle="As ingestões acontecem automaticamente a cada hora." /> : recent.map((ed) => <TournamentCard key={ed.id} edition={ed} onPress={() => navigation.navigate('TournamentDetail', { id: ed.id, edition: ed })} />)}
      </View>

      {/* Circuit Explorer — spec requirement: "Explorar por circuito" */}
      <View>
        <SectionHeader title="Explorar por circuito" subtitle="Selecione um circuito para ver torneios" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CIRCUITS.map((c) => (
            <Pressable
              key={c.key}
              onPress={() => navigation.navigate('Tabs', { screen: 'Tournaments', params: { circuit: c.key } } as never)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: `${c.color}18`, borderWidth: 1, borderColor: `${c.color}44` }}
            >
              <AppText variant="caption" style={{ color: c.color, fontWeight: '700', fontSize: 13 }}>{c.label}</AppText>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const CIRCUITS = [
  { key: 'FPT',   label: 'FPT',   color: '#39ff14' },
  { key: 'CBT',   label: 'CBT',   color: '#3b82f6' },
  { key: 'COSAT', label: 'COSAT', color: '#f59e0b' },
  { key: 'ITF',   label: 'ITF',   color: '#8b5cf6' },
  { key: 'UTR',   label: 'UTR',   color: '#ef4444' },
  { key: 'FCT',   label: 'FCT',   color: '#06b6d4' },
];
