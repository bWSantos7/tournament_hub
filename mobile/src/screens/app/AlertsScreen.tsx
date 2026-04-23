import React, { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import Toast from 'react-native-toast-message';
import { MainTabParamList } from '../../navigation/types';
import { Alert } from '../../types';
import { listAlerts, markAlertRead, markAllAlertsRead } from '../../services/data';
import { AppText, Button, Card, EmptyState, LoadingBlock, Screen, SectionHeader } from '../../components/ui';
import { fmtDateTime } from '../../utils/format';

type Props = BottomTabScreenProps<MainTabParamList, 'Alerts'>;

export function AlertsScreen(_: Props) {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  async function load() {
    setLoading(true);
    try { setAlerts(await listAlerts().catch(() => []) as Alert[]); }
    catch { Toast.show({ type: 'error', text1: 'Erro ao carregar alertas' }); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function readOne(id: number) {
    try { await markAlertRead(id); setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: 'read', read_at: new Date().toISOString() } : a)); }
    catch { Toast.show({ type: 'error', text1: 'Não foi possível marcar o alerta' }); }
  }

  async function readAll() {
    try { await markAllAlertsRead(); setAlerts((prev) => prev.map((a) => ({ ...a, status: 'read', read_at: new Date().toISOString() }))); }
    catch { Toast.show({ type: 'error', text1: 'Não foi possível concluir a ação' }); }
  }

  return (
    <Screen>
      <SectionHeader title="Alertas" subtitle="Central de alertas e notificações" action={<Button title="Marcar tudo" variant="ghost" onPress={readAll} />} />
      {loading ? <LoadingBlock /> : alerts.length === 0 ? <EmptyState title="Nenhum alerta por enquanto." /> : alerts.map((alert) => <Pressable key={alert.id} onPress={() => alert.status !== 'read' ? readOne(alert.id) : undefined}><Card><AppText variant="body" style={{ fontWeight: '700' }}>{alert.title}</AppText><AppText variant="caption">{alert.body}</AppText><AppText variant="muted">{fmtDateTime(alert.created_at)}</AppText>{alert.edition_title ? <AppText variant="caption">Torneio: {alert.edition_title}</AppText> : null}</Card></Pressable>)}
    </Screen>
  );
}
