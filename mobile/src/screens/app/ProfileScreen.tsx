import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { MainStackParamList, MainTabParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { deleteAccount, logout, uploadAvatar } from '../../services/auth';
import { deleteProfile, listProfiles, setPrimary, updateProfile } from '../../services/data';
import { extractApiError, mediaUrl } from '../../services/api';
import { PlayerProfile } from '../../types';
import { AppText, Button, Card, EmptyState, Input, LoadingBlock, Screen, SectionHeader } from '../../components/ui';

type Props = BottomTabScreenProps<MainTabParamList, 'Profile'>;
type StackNav = NativeStackNavigationProp<MainStackParamList>;

export function ProfileScreen(_: Props) {
  const { colors, theme, toggle } = useTheme();
  const { user, setUser } = useAuth();
  const navigation = useNavigation<StackNav>();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
  const [editing, setEditing] = useState<PlayerProfile | null>(null);

  async function load() {
    setLoading(true);
    try { setProfiles(await listProfiles().catch(() => []) as PlayerProfile[]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleAvatarChange() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets[0]) return;
    try {
      const updated = await uploadAvatar(result.assets[0]);
      setUser(updated);
      Toast.show({ type: 'success', text1: 'Avatar atualizado!' });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Erro ao enviar avatar', text2: extractApiError(err) });
    }
  }

  async function makePrimaryProfile(id: number) {
    try { await setPrimary(id); await load(); Toast.show({ type: 'success', text1: 'Perfil principal atualizado.' }); }
    catch { Toast.show({ type: 'error', text1: 'Não foi possível definir o perfil principal.' }); }
  }

  async function removeProfile(id: number) {
    try { await deleteProfile(id); await load(); Toast.show({ type: 'success', text1: 'Perfil removido.' }); }
    catch (err) { Toast.show({ type: 'error', text1: 'Erro ao remover perfil', text2: extractApiError(err) }); }
  }

  async function handleDeleteAccount() {
    try { await deleteAccount(); setUser(null); Toast.show({ type: 'success', text1: 'Conta excluída.' }); }
    catch (err) { Toast.show({ type: 'error', text1: 'Erro ao excluir conta', text2: extractApiError(err) }); }
  }

  const avatarLetter = (user?.full_name || user?.email || 'U').slice(0, 1).toUpperCase();

  return (
    <Screen>
      <SectionHeader title="Perfil" subtitle="Conta, perfis esportivos e privacidade" />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pressable onPress={handleAvatarChange} style={{ position: 'relative' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: `${colors.accentNeon}22`, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              {user?.avatar ? <Image source={{ uri: mediaUrl(user.avatar) }} style={{ width: '100%', height: '100%' }} /> : <AppText variant="body" style={{ color: colors.accentNeon, fontWeight: '700', fontSize: 22 }}>{avatarLetter}</AppText>}
            </View>
            <View style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accentNeon, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bgBase }}>
              <Ionicons name="camera" size={11} color={colors.bgBase} />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={{ fontWeight: '700', fontSize: 16 }}>{user?.full_name || '—'}</AppText>
            <AppText variant="caption">{user?.email}</AppText>
            <AppText variant="muted">{user?.role}</AppText>
          </View>
        </View>
      </Card>

      <Card>
        <SectionHeader title="Ações da conta" />
        <Button title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'} variant="secondary" onPress={toggle} />
        {user?.role === 'coach' ? <Button title="Meus alunos" variant="secondary" onPress={() => navigation.navigate('Coach')} /> : null}
        {user?.is_staff ? <Button title="Painel admin" variant="secondary" onPress={() => navigation.navigate('AdminPanel')} /> : null}
        <Button title="Novo perfil esportivo" variant="secondary" onPress={() => navigation.navigate('Onboarding')} />
        <Button title="Sair" variant="ghost" onPress={logout} />
      </Card>

      <View>
        <SectionHeader title="Perfis esportivos" />
        {loading ? <LoadingBlock /> : profiles.length === 0 ? <EmptyState title="Nenhum perfil criado." subtitle="Crie um perfil para ver torneios compatíveis, agenda e resultados." /> : profiles.map((p) => editing?.id === p.id ? <ProfileEditor key={p.id} profile={p} onSaved={async () => { setEditing(null); await load(); }} onCancel={() => setEditing(null)} /> : <Card key={p.id}><AppText variant="body" style={{ fontWeight: '700' }}>{p.display_name}</AppText>{p.birth_year ? <AppText variant="caption">Nascimento: {p.birth_year} (idade esportiva: {p.sporting_age})</AppText> : null}{p.gender ? <AppText variant="caption">Gênero: {p.gender === 'M' ? 'Masculino' : 'Feminino'}</AppText> : null}{p.tennis_class ? <AppText variant="caption">Classe: {p.tennis_class}</AppText> : null}{p.home_state ? <AppText variant="caption">Local: {p.home_city ? `${p.home_city}/` : ''}{p.home_state} (raio {p.travel_radius_km}km)</AppText> : null}<AppText variant="caption">Nível: {p.competitive_level}</AppText>{p.is_primary ? <AppText variant="caption">Principal</AppText> : null}<Button title="Editar" variant="secondary" onPress={() => setEditing(p)} />{!p.is_primary ? <Button title="Tornar principal" variant="ghost" onPress={() => makePrimaryProfile(p.id)} /> : null}<Button title="Remover" variant="danger" onPress={() => removeProfile(p.id)} /></Card>)}
      </View>

      <Card>
        <SectionHeader title="Sua privacidade" />
        <AppText variant="muted">Você pode solicitar a exclusão da sua conta e seus dados a qualquer momento (LGPD).</AppText>
        <Button title="Excluir minha conta" variant="danger" onPress={handleDeleteAccount} />
      </Card>
    </Screen>
  );
}

function ProfileEditor({ profile, onSaved, onCancel }: { profile: PlayerProfile; onSaved: () => Promise<void>; onCancel: () => void; }) {
  const [form, setForm] = useState({
    display_name: profile.display_name,
    birth_year: profile.birth_year ? String(profile.birth_year) : '',
    gender: profile.gender,
    home_state: profile.home_state,
    home_city: profile.home_city,
    travel_radius_km: String(profile.travel_radius_km),
    tennis_class: profile.tennis_class,
    competitive_level: profile.competitive_level,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateProfile(profile.id, { ...form, birth_year: form.birth_year ? Number(form.birth_year) : null, travel_radius_km: Number(form.travel_radius_km) || 0 } as any);
      Toast.show({ type: 'success', text1: 'Perfil atualizado' });
      await onSaved();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Erro ao salvar', text2: extractApiError(err) });
    } finally { setSaving(false); }
  }

  return (
    <Card>
      <Input label="Nome" value={form.display_name} onChangeText={(v) => setForm({ ...form, display_name: v })} />
      <Input label="Ano de nascimento" value={form.birth_year} onChangeText={(v) => setForm({ ...form, birth_year: v })} keyboardType="number-pad" />
      <Input label="Gênero" value={form.gender} onChangeText={(v) => setForm({ ...form, gender: v as any })} />
      <Input label="UF" value={form.home_state} onChangeText={(v) => setForm({ ...form, home_state: v.toUpperCase().slice(0,2) })} />
      <Input label="Cidade" value={form.home_city} onChangeText={(v) => setForm({ ...form, home_city: v })} />
      <Input label="Raio (km)" value={form.travel_radius_km} onChangeText={(v) => setForm({ ...form, travel_radius_km: v })} keyboardType="number-pad" />
      <Input label="Classe" value={form.tennis_class} onChangeText={(v) => setForm({ ...form, tennis_class: v })} />
      <Input label="Nível" value={form.competitive_level} onChangeText={(v) => setForm({ ...form, competitive_level: v as any })} />
      <Button title="Salvar" onPress={save} loading={saving} />
      <Button title="Cancelar" variant="ghost" onPress={onCancel} />
    </Card>
  );
}
