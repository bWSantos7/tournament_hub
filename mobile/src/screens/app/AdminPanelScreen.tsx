import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';
import { AppText, Card, Screen, SectionHeader } from '../../components/ui';

type Props = NativeStackScreenProps<MainStackParamList, 'AdminPanel'>;

export function AdminPanelScreen(_: Props) {
  return (
    <Screen>
      <SectionHeader title="Painel admin" subtitle="Versão mobile do painel administrativo" />
      <Card>
        <AppText variant="body" style={{ fontWeight: '700' }}>Painel administrativo</AppText>
        <AppText variant="muted">
          Esta versão mobile mantém o acesso de navegação e pode ser expandida com as mesmas métricas,
          gráficos e ações do painel web conforme a API administrativa evoluir.
        </AppText>
      </Card>
    </Screen>
  );
}
