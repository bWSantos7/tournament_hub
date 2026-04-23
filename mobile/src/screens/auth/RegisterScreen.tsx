import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { createProfile } from '../../services/data';
import { extractApiError } from '../../services/api';
import { register, sendEmailOtp, verifyEmailOtp } from '../../services/auth';
import { User } from '../../types';
import { AppText, Button, Card, Input, Screen } from '../../components/ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
type Step = 'form' | 'otp' | 'profile';

export function RegisterScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { setUser } = useAuth();
  const [step, setStep] = useState<Step>('form');
  const [registeredUser, setRegisteredUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    password_confirm: '',
    role: 'player',
    accept_terms: false,
    marketing_consent: false,
  });
  const [emailCode, setEmailCode] = useState('');
  const [profile, setProfile] = useState({
    display_name: '',
    birth_year: '',
    gender: '',
    home_state: 'SP',
    home_city: '',
    travel_radius_km: '100',
    competitive_level: 'amateur',
    tennis_class: '',
  });

  async function onRegister() {
    if (form.password !== form.password_confirm) return Toast.show({ type: 'error', text1: 'As senhas não conferem' });
    setSubmitting(true);
    try {
      const data = await register({ ...form });
      setRegisteredUser(data.user);
      setProfile((p) => ({ ...p, display_name: form.full_name }));
      setStep('otp');
      Toast.show({ type: 'success', text1: 'Conta criada! Verifique seu e-mail.' });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Erro ao criar conta', text2: extractApiError(err) });
    } finally { setSubmitting(false); }
  }

  async function onVerify() {
    setSubmitting(true);
    try {
      await verifyEmailOtp(emailCode.trim());
      setStep('profile');
      Toast.show({ type: 'success', text1: 'E-mail verificado!' });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Erro na verificação', text2: extractApiError(err) });
    } finally { setSubmitting(false); }
  }

  async function onFinish() {
    setSubmitting(true);
    try {
      await createProfile({
        display_name: profile.display_name || form.full_name || 'Jogador',
        birth_year: profile.birth_year ? Number(profile.birth_year) : null,
        gender: (profile.gender || undefined) as any,
        home_state: profile.home_state,
        home_city: profile.home_city,
        travel_radius_km: Number(profile.travel_radius_km) || 100,
        competitive_level: profile.competitive_level as any,
        tennis_class: profile.tennis_class,
        is_primary: true,
      } as any);
      if (registeredUser) setUser(registeredUser);
      Toast.show({ type: 'success', text1: 'Perfil criado! Bem-vindo!' });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Erro ao finalizar cadastro', text2: extractApiError(err) });
    } finally { setSubmitting(false); }
  }

  async function resendOtp() {
    setResending(true);
    try { await sendEmailOtp(); Toast.show({ type: 'success', text1: 'Novo código enviado.' }); }
    catch { Toast.show({ type: 'error', text1: 'Não foi possível reenviar.' }); }
    finally { setResending(false); }
  }

  return (
    <Screen>
      <Card>
        <AppText variant="section">Criar conta</AppText>
        {step === 'form' ? <>
          <Input label="Nome completo" value={form.full_name} onChangeText={(v) => setForm({ ...form, full_name: v })} />
          <Input label="E-mail" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} autoCapitalize="none" keyboardType="email-address" />
          <Input label="Celular" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v.replace(/\D/g, '') })} keyboardType="phone-pad" />
          <Input label="Senha" value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} secureTextEntry />
          <Input label="Confirme a senha" value={form.password_confirm} onChangeText={(v) => setForm({ ...form, password_confirm: v })} secureTextEntry />
          <Button title="Criar conta" onPress={onRegister} loading={submitting} />
        </> : null}

        {step === 'otp' ? <>
          <AppText variant="body">Enviamos um código para {form.email}. Digite-o abaixo para continuar.</AppText>
          <Input label="Código de verificação" value={emailCode} onChangeText={setEmailCode} keyboardType="number-pad" placeholder="000000" />
          <Button title="Confirmar e-mail" onPress={onVerify} loading={submitting} />
          <Button title="Reenviar código" variant="secondary" onPress={resendOtp} loading={resending} />
        </> : null}

        {step === 'profile' ? <>
          <Input label="Nome (como aparece)" value={profile.display_name} onChangeText={(v) => setProfile({ ...profile, display_name: v })} />
          <Input label="Ano de nascimento" value={profile.birth_year} onChangeText={(v) => setProfile({ ...profile, birth_year: v })} keyboardType="number-pad" />
          <Input label="Gênero (M/F)" value={profile.gender} onChangeText={(v) => setProfile({ ...profile, gender: v.toUpperCase().slice(0,1) })} />
          <Input label="UF" value={profile.home_state} onChangeText={(v) => setProfile({ ...profile, home_state: v.toUpperCase().slice(0,2) })} />
          <Input label="Cidade" value={profile.home_city} onChangeText={(v) => setProfile({ ...profile, home_city: v })} />
          <Input label="Raio de viagem (km)" value={profile.travel_radius_km} onChangeText={(v) => setProfile({ ...profile, travel_radius_km: v })} keyboardType="number-pad" />
          <Input label="Nível" value={profile.competitive_level} onChangeText={(v) => setProfile({ ...profile, competitive_level: v })} />
          <Input label="Classe" value={profile.tennis_class} onChangeText={(v) => setProfile({ ...profile, tennis_class: v })} />
          <Button title="Finalizar cadastro" onPress={onFinish} loading={submitting} />
        </> : null}
      </Card>
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
        <AppText variant="body" style={{ color: colors.textSecondary }}>Já possui conta?</AppText>
        <Pressable onPress={() => navigation.navigate('Login')}>
          <AppText variant="body" style={{ color: colors.accentNeon, fontWeight: '600' }}>Entrar</AppText>
        </Pressable>
      </View>
    </Screen>
  );
}
