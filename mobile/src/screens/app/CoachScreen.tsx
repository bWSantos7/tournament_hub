import React, { useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';
import { addAthlete, getAthleteWatchlist, listAthletes, removeAthlete } from '../../services/data';
import { AppText, Button, Card, EmptyState, Input, LoadingBlock, Screen, SectionHeader } from '../../components/ui';
import { CoachAthlete } from '../../types';

type Props = NativeStackScreenProps<MainStackParamList, 'Coach'>;

export function CoachScreen(_: Props) {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [selected, setSelected] = useState<any>(null);

  async function load() {
    setLoading(true);
    try { setAthletes(await listAthletes().catch(() => []) as CoachAthlete[]); }
    catch { Toast.show({ type: 'error', text1: 'Erro ao carregar alunos' }); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function onAdd() {
    try {
      await addAthlete(email);
      setEmail('');
      await load();
      Toast.show({ type: 'success', text1: 'Aluno adicionado.' });
    } catch {
      Toast.show({ type: 'error', text1: 'Não foi possível adicionar o aluno.' });
    }
  }

  async function onRemove(id: number) {
    try {
      await removeAthlete(id);
      await load();
      setSelected(null);
      Toast.show({ type: 'success', text1: 'Aluno removido.' });
    } catch {
      Toast.show({ type: 'error', text1: 'Não foi possível remover o aluno.' });
    }
  }

  async function openWatchlist(id: number) {
    try { setSelected(await getAthleteWatchlist(id)); }
    catch { Toast.show({ type: 'error', text1: 'Não foi possível carregar a watchlist.' }); }
  }

  return (
    <Screen>
      <SectionHeader title="Meus alunos" subtitle="Gerencie os atletas vinculados à sua conta" />
      <Card>
        <Input label="E-mail do atleta" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Button title="Adicionar aluno" onPress={onAdd} />
      </Card>
      {loading ? <LoadingBlock /> : athletes.length === 0 ? <EmptyState title="Nenhum aluno adicionado ainda." /> : athletes.map((link) => <Card key={link.id}><AppText variant="body" style={{ fontWeight: '700' }}>{link.athlete_detail.full_name || link.athlete_detail.email}</AppText><AppText variant="caption">{link.athlete_detail.email}</AppText>{link.notes ? <AppText variant="muted">{link.notes}</AppText> : null}<Button title="Ver watchlist" variant="secondary" onPress={() => openWatchlist(link.id)} /><Button title="Remover aluno" variant="danger" onPress={() => onRemove(link.id)} /></Card>)}
      {selected ? <ViewWatchlist data={selected} /> : null}
    </Screen>
  );
}

function ViewWatchlist({ data }: { data: any }) {
  return (
    <Card>
      <SectionHeader title={`Watchlist de ${data.athlete}`} />
      {data.watchlist?.length ? data.watchlist.map((item: any) => <AppText key={item.id} variant="caption">• {item.edition_detail?.title || item.edition}</AppText>) : <AppText variant="muted">Nenhum torneio acompanhado.</AppText>}
    </Card>
  );
}
