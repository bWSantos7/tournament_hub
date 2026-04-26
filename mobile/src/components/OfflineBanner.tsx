import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function OfflineBanner() {
  const { isOffline } = useNetworkStatus();
  if (!isOffline) return null;
  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <AppText variant="caption" style={styles.text}>Sem conexão — exibindo dados salvos</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#374151',
    paddingVertical: 6,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  text: { color: '#fff', fontWeight: '600', fontSize: 12 },
});
