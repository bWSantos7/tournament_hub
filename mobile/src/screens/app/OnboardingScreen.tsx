import React, { useState } from 'react';
import Toast from 'react-native-toast-message';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';
import { createProfile } from '../../services/data';
import { extractApiError } from '../../services/api';
import { AppText, Button, Card, Input, Screen } from '../../components/ui';

type Props = NativeStackScreenProps<MainStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    display_name: '',
    birth_year: '',
    gender: '',
    home_state: 'SP',
    home_city: '',
    travel_radius_km: '100',
    competitive_level: 'amateur',
    tennis_class: '',
    dominant_hand: '',
  });

  async function finish() {
    setSubmitting(true);
    try {
      await createProfile({
        display_name: form.display_name || 'Jogador',
        birth_year: form.birth_year ? Number(form.birth_year) : null,
        gender: (form.gender || undefined) as any,
        home_state: form.home_state,
        home_city: form.home_city,
        travel_radius_km: Number(form.travel_radius_km) || 100,
        competitive_level: form.competitive_level as any,
        tennis_class: form.tennis_class,
        dominant_hand: (form.dominant_hand || undefined) as any,
        is_primary: true,
      } as any);
      Toast.show({ type: 'success', text1: 'Perfil criado!' });
      navigation.goBack();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Erro ao criar perfil', text2: extractApiError(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Card>
        <AppText variant="section">Vamos começar</AppText>
        <Input label="Nome (como aparece)" value={form.display_name} onChangeText={(v) => setForm({ ...form, display_name: v })} />
        <Input label="Ano de nascimento" value={form.birth_year} onChangeText={(v) => setForm({ ...form, birth_year: v })} keyboardType="number-pad" />
        <Input label="Gênero (M/F)" value={form.gender} onChangeText={(v) => setForm({ ...form, gender: v.toUpperCase().slice(0,1) })} />
        <Input label="UF" value={form.home_state} onChangeText={(v) => setForm({ ...form, home_state: v.toUpperCase().slice(0,2) })} />
        <Input label="Cidade" value={form.home_city} onChangeText={(v) => setForm({ ...form, home_city: v })} />
        <Input label="Raio de viagem (km)" value={form.travel_radius_km} onChangeText={(v) => setForm({ ...form, travel_radius_km: v })} keyboardType="number-pad" />
        <Input label="Nível" value={form.competitive_level} onChangeText={(v) => setForm({ ...form, competitive_level: v })} />
        <Input label="Classe" value={form.tennis_class} onChangeText={(v) => setForm({ ...form, tennis_class: v })} />
        <Input label="Mão dominante (R/L)" value={form.dominant_hand} onChangeText={(v) => setForm({ ...form, dominant_hand: v.toUpperCase().slice(0,1) })} />
        <Button title="Salvar perfil" onPress={finish} loading={submitting} />
      </Card>
    </Screen>
  );
}
