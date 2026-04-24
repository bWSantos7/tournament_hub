import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { MainStackParamList } from '../../navigation/types';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText, Button, Card, EmptyState, LoadingBlock, Screen, SectionHeader } from '../../components/ui';
import api, { extractApiError } from '../../services/api';

type Props = NativeStackScreenProps<MainStackParamList, 'AdminPanel'>;
type Tab = 'dashboard' | 'stats' | 'users';

interface Dashboard {
  counts: {
    tournaments_total: number;
    tournaments_open: number;
    tournaments_closing_soon: number;
    data_sources_enabled: number;
    data_sources_total: number;
    manual_overrides: number;
    low_confidence: number;
    missing_official_url: number;
  };
  ingestion: { runs_24h: number; failed_24h: number };
  alerts: { total_7d: number; failed_7d: number };
  audit: { actions_24h: number };
}

interface AdminStats {
  registrations: { date: string; registrations: number }[];
  users_by_role: { role: string; count: number }[];
  tournaments_by_status: { status: string; count: number }[];
  totals: { users: number; active_users: number; new_users_period: number };
}

interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  email_verified: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  player: 'Jogador',
  coach: 'Treinador',
  parent: 'Pai/Resp.',
  admin: 'Admin',
};

export function AdminPanelScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('dashboard');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'stats', label: 'Estatísticas' },
    { key: 'users', label: 'Usuários' },
  ];

  return (
    <Screen scroll={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View>
          <AppText variant="title">Painel admin</AppText>
          <AppText variant="muted">Curadoria, ingestão e usuários</AppText>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, marginBottom: 8 }}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: tab === t.key ? colors.accentNeon : 'transparent', marginBottom: -1 }}
          >
            <AppText variant="caption" style={{ color: tab === t.key ? colors.accentNeon : colors.textMuted, fontWeight: tab === t.key ? '700' : '400' }}>
              {t.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'stats' && <StatsTab />}
      {tab === 'users' && <UsersTab />}
    </Screen>
  );
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab() {
  const { colors } = useTheme();
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<Dashboard>('/api/admin-panel/dashboard/');
      setDash(res.data);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Erro ao carregar dashboard', text2: extractApiError(err) });
    } finally {
      setLoading(false);
    }
  }

  async function runIngestion() {
    setRunning(true);
    try {
      await api.post('/api/ingestion/runs/run-all/');
      Toast.show({ type: 'success', text1: 'Ingestão disparada!' });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Erro ao iniciar ingestão', text2: extractApiError(err) });
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingBlock />;
  if (!dash) return <EmptyState title="Não foi possível carregar o dashboard." />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Button title="Atualizar" variant="secondary" onPress={load} />
        <Button title={running ? 'Ingerindo...' : 'Ingerir agora'} onPress={runIngestion} loading={running} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatCard label="Torneios" value={dash.counts.tournaments_total} colors={colors} />
        <StatCard label="Abertos" value={dash.counts.tournaments_open} accent colors={colors} />
        <StatCard label="Fechando" value={dash.counts.tournaments_closing_soon} warn colors={colors} />
        <StatCard label="Fontes" value={`${dash.counts.data_sources_enabled}/${dash.counts.data_sources_total}`} colors={colors} />
        <StatCard label="Overrides" value={dash.counts.manual_overrides} colors={colors} />
        <StatCard label="Baixa conf." value={dash.counts.low_confidence} warn colors={colors} />
        <StatCard label="Sem URL" value={dash.counts.missing_official_url} warn colors={colors} />
        <StatCard label="Execuções 24h" value={`${dash.ingestion.runs_24h} (${dash.ingestion.failed_24h} falhas)`} colors={colors} />
      </View>

      <SectionHeader title="Alertas (7d)" />
      <Card>
        <AppText variant="body">Total: <AppText variant="body" style={{ fontWeight: '700' }}>{dash.alerts.total_7d}</AppText></AppText>
        <AppText variant="caption">Falhas: {dash.alerts.failed_7d}</AppText>
      </Card>

      <SectionHeader title="Auditoria (24h)" />
      <Card>
        <AppText variant="body">Ações: <AppText variant="body" style={{ fontWeight: '700' }}>{dash.audit.actions_24h}</AppText></AppText>
      </Card>
    </ScrollView>
  );
}

// ─── Stats Tab ─────────────────────────────────────────────────────────────────

function StatsTab() {
  const { colors } = useTheme();
  const [data, setData] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  async function load(d = days) {
    setLoading(true);
    try {
      const res = await api.get<AdminStats>(`/api/admin-panel/stats/?days=${d}`);
      setData(res.data);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Erro ao carregar stats', text2: extractApiError(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingBlock />;
  if (!data) return <EmptyState title="Sem dados de estatísticas." />;

  const maxReg = Math.max(...data.registrations.map((r) => r.registrations), 1);
  const maxRole = Math.max(...data.users_by_role.map((r) => r.count), 1);
  const maxStatus = Math.max(...data.tournaments_by_status.map((r) => r.count), 1);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Period selector */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {[7, 30, 90].map((d) => (
          <Pressable
            key={d}
            onPress={() => { setDays(d); load(d); }}
            style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: days === d ? colors.accentNeon : colors.borderSubtle, backgroundColor: days === d ? `${colors.accentNeon}15` : 'transparent' }}
          >
            <AppText variant="caption" style={{ color: days === d ? colors.accentNeon : colors.textMuted }}>{d}d</AppText>
          </Pressable>
        ))}
      </View>

      {/* Totals */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <View style={{ flex: 1, backgroundColor: colors.bgCard, borderRadius: 16, padding: 12, alignItems: 'center' }}>
          <AppText variant="muted" style={{ fontSize: 10 }}>USUÁRIOS</AppText>
          <AppText variant="title" style={{ color: colors.accentNeon }}>{data.totals.users}</AppText>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.bgCard, borderRadius: 16, padding: 12, alignItems: 'center' }}>
          <AppText variant="muted" style={{ fontSize: 10 }}>ATIVOS</AppText>
          <AppText variant="title">{data.totals.active_users}</AppText>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.bgCard, borderRadius: 16, padding: 12, alignItems: 'center' }}>
          <AppText variant="muted" style={{ fontSize: 10 }}>NOVOS ({days}d)</AppText>
          <AppText variant="title" style={{ color: colors.accentBlue }}>{data.totals.new_users_period}</AppText>
        </View>
      </View>

      {/* Registrations chart */}
      <Card>
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: 12 }}>Cadastros por dia</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 80 }}>
            {data.registrations.slice(-20).map((r) => (
              <View key={r.date} style={{ alignItems: 'center', gap: 2 }}>
                <View style={{ width: 14, height: Math.max(4, (r.registrations / maxReg) * 64), backgroundColor: colors.accentNeon, borderRadius: 3 }} />
                <AppText variant="muted" style={{ fontSize: 8 }}>{r.date.slice(5)}</AppText>
              </View>
            ))}
          </View>
        </ScrollView>
      </Card>

      {/* Users by role */}
      <Card>
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: 12 }}>Usuários por perfil</AppText>
        {data.users_by_role.map((r, i) => {
          const colors2 = ['#39ff14', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
          return (
            <View key={r.role} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <AppText variant="caption">{ROLE_LABELS[r.role] ?? r.role}</AppText>
                <AppText variant="caption" style={{ fontWeight: '700' }}>{r.count}</AppText>
              </View>
              <View style={{ height: 6, backgroundColor: `${colors2[i % colors2.length]}30`, borderRadius: 3 }}>
                <View style={{ height: 6, width: `${(r.count / maxRole) * 100}%`, backgroundColor: colors2[i % colors2.length], borderRadius: 3 }} />
              </View>
            </View>
          );
        })}
      </Card>

      {/* Tournaments by status */}
      <Card>
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: 12 }}>Torneios por status</AppText>
        {data.tournaments_by_status.map((r) => (
          <View key={r.status} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <AppText variant="caption">{r.status}</AppText>
              <AppText variant="caption" style={{ fontWeight: '700' }}>{r.count}</AppText>
            </View>
            <View style={{ height: 6, backgroundColor: `${colors.accentBlue}30`, borderRadius: 3 }}>
              <View style={{ height: 6, width: `${(r.count / maxStatus) * 100}%`, backgroundColor: colors.accentBlue, borderRadius: 3 }} />
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

// ─── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const { colors } = useTheme();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);

  async function load(q = '') {
    setLoading(true);
    try {
      const res = await api.get<AdminUser[]>('/api/admin-panel/users/', { params: q ? { q } : {} });
      setUsers(res.data);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Erro ao carregar usuários', text2: extractApiError(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(user: AdminUser) {
    try {
      await api.delete(`/api/admin-panel/users/${user.id}/`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      Toast.show({ type: 'success', text1: `${user.email} removido.` });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Erro ao remover usuário', text2: extractApiError(err) });
    }
  }

  function onSaved(updated: AdminUser) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setEditing(null);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.borderSubtle }}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, color: colors.textPrimary, fontSize: 14 }}
          placeholder="Buscar por e-mail ou nome..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={(v) => { setSearch(v); load(v); }}
        />
      </View>

      {loading ? <LoadingBlock /> : users.length === 0 ? <EmptyState title="Nenhum usuário encontrado." /> : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {users.map((u) => (
            <View key={u.id} style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.accentNeon}20`, alignItems: 'center', justifyContent: 'center' }}>
                <AppText variant="body" style={{ color: colors.accentNeon, fontWeight: '700' }}>
                  {(u.full_name || u.email)[0].toUpperCase()}
                </AppText>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AppText variant="body" style={{ fontWeight: '600', fontSize: 13 }}>{u.full_name || '—'}</AppText>
                  {u.is_superuser && <View style={{ backgroundColor: `${colors.accentNeon}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}><AppText variant="muted" style={{ fontSize: 10, color: colors.accentNeon }}>Super</AppText></View>}
                  {u.is_staff && !u.is_superuser && <View style={{ backgroundColor: `${colors.accentBlue}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}><AppText variant="muted" style={{ fontSize: 10, color: colors.accentBlue }}>Staff</AppText></View>}
                  {!u.is_active && <View style={{ backgroundColor: '#ef444420', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}><AppText variant="muted" style={{ fontSize: 10, color: '#ef4444' }}>Inativo</AppText></View>}
                </View>
                <AppText variant="muted" style={{ fontSize: 11 }}>{u.email}</AppText>
                <AppText variant="muted" style={{ fontSize: 11 }}>{ROLE_LABELS[u.role] ?? u.role}</AppText>
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <Pressable onPress={() => setEditing(u)} style={{ padding: 6, borderRadius: 8, backgroundColor: colors.bgElevated }}>
                  <Ionicons name="create-outline" size={16} color={colors.textMuted} />
                </Pressable>
                {!u.is_superuser && (
                  <Pressable onPress={() => handleDelete(u)} style={{ padding: 6, borderRadius: 8, backgroundColor: colors.bgElevated }}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
    </View>
  );
}

// ─── Edit User Modal ───────────────────────────────────────────────────────────

function EditUserModal({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: (u: AdminUser) => void }) {
  const { colors } = useTheme();
  const [form, setForm] = useState({ full_name: user.full_name, role: user.role, is_active: user.is_active, is_staff: user.is_staff });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await api.patch<AdminUser>(`/api/admin-panel/users/${user.id}/`, form);
      Toast.show({ type: 'success', text1: 'Usuário atualizado.' });
      onSaved(res.data);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Erro ao salvar', text2: extractApiError(err) });
    } finally {
      setSaving(false);
    }
  }

  const roles = ['player', 'coach', 'parent', 'admin'];

  return (
    <View style={{ position: 'absolute', inset: 0, top: -200, bottom: -200, left: -16, right: -16, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 100 }}>
      <View style={{ backgroundColor: colors.bgCard, borderRadius: 20, padding: 20, width: '100%', maxWidth: 360 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <AppText variant="body" style={{ fontWeight: '700', fontSize: 16 }}>Editar usuário</AppText>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.textMuted} /></Pressable>
        </View>
        <AppText variant="muted" style={{ marginBottom: 16 }}>{user.email}</AppText>

        <AppText variant="caption" style={{ marginBottom: 4 }}>Nome</AppText>
        <TextInput
          style={{ backgroundColor: colors.bgElevated, borderRadius: 10, padding: 10, color: colors.textPrimary, marginBottom: 12, fontSize: 14 }}
          value={form.full_name}
          onChangeText={(v) => setForm({ ...form, full_name: v })}
          placeholderTextColor={colors.textMuted}
        />

        <AppText variant="caption" style={{ marginBottom: 4 }}>Perfil</AppText>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {roles.map((r) => (
            <Pressable
              key={r}
              onPress={() => setForm({ ...form, role: r })}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: form.role === r ? colors.accentNeon : colors.bgElevated }}
            >
              <AppText variant="caption" style={{ color: form.role === r ? colors.bgBase : colors.textSecondary }}>{ROLE_LABELS[r]}</AppText>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <Pressable onPress={() => setForm({ ...form, is_active: !form.is_active })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: colors.bgElevated, borderRadius: 10 }}>
            <Ionicons name={form.is_active ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={form.is_active ? colors.accentNeon : colors.textMuted} />
            <AppText variant="caption">Ativa</AppText>
          </Pressable>
          {!user.is_superuser && (
            <Pressable onPress={() => setForm({ ...form, is_staff: !form.is_staff })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: colors.bgElevated, borderRadius: 10 }}>
              <Ionicons name={form.is_staff ? 'shield-checkmark' : 'shield-outline'} size={18} color={form.is_staff ? colors.accentBlue : colors.textMuted} />
              <AppText variant="caption">Staff</AppText>
            </Pressable>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Cancelar" variant="secondary" onPress={onClose} />
          <Button title="Salvar" onPress={save} loading={saving} />
        </View>
      </View>
    </View>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent, warn, colors }: { label: string; value: number | string; accent?: boolean; warn?: boolean; colors: any }) {
  return (
    <View style={{ width: '47%', backgroundColor: colors.bgCard, borderRadius: 16, padding: 12 }}>
      <AppText variant="muted" style={{ fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>{label}</AppText>
      <AppText variant="body" style={{ fontSize: 20, fontWeight: '700', color: accent ? colors.accentNeon : warn ? '#f59e0b' : colors.textPrimary }}>{value}</AppText>
    </View>
  );
}
