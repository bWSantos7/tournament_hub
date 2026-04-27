import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';
import { fetchSubscription } from '../../services/billing';

type PixRoute = RouteProp<MainStackParamList, 'PixPayment'>;
type Nav = NativeStackNavigationProp<MainStackParamList>;

const POLL_INTERVAL = 5000;

export function PixPaymentScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<PixRoute>();
  const { pixData } = route.params;

  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paymentState, setPaymentState] = useState<'waiting' | 'confirmed' | 'expired' | 'error'>('waiting');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;

    pollRef.current = setInterval(async () => {
      if (!mounted) return;
      try {
        const sub = await fetchSubscription();
        if (mounted && sub.status === 'active') {
          setPaymentState('confirmed');
          clearInterval(pollRef.current!);
          Alert.alert('Pagamento confirmado!', 'Sua assinatura está ativa.', [
            { text: 'OK', onPress: () => { if (mounted) navigation.replace('Subscription'); } },
          ]);
        }
      } catch {
        if (mounted) setPaymentState('error');
      }
    }, POLL_INTERVAL);

    return () => {
      mounted = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pixData.expiration) return;
    const expiresAt = new Date(pixData.expiration).getTime();
    if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
      setPaymentState('expired');
    }
  }, [pixData.expiration]);

  async function handleCopy() {
    await Share.share({ message: pixData.copia_e_cola });
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  async function handleCheckManually() {
    setChecking(true);
    try {
      const sub = await fetchSubscription();
      if (sub.status === 'active') {
        setPaymentState('confirmed');
        navigation.replace('Subscription');
      } else {
        setPaymentState('waiting');
        Alert.alert('Pagamento pendente', 'Ainda não identificamos seu pagamento. Aguarde alguns instantes.');
      }
    } catch {
      setPaymentState('error');
      Alert.alert('Erro', 'Não foi possível verificar o pagamento.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pague com Pix</Text>
      <Text style={styles.subtitle}>
        Escaneie o QR code ou copie o código abaixo no seu banco.
        A confirmação é automática em até 1 minuto.
      </Text>

      <View style={[
        styles.stateBadge,
        paymentState === 'confirmed' ? styles.stateConfirmed : paymentState === 'expired' || paymentState === 'error' ? styles.stateError : styles.stateWaiting,
      ]}>
        <Text style={styles.stateText}>
          {paymentState === 'confirmed' ? 'Pagamento confirmado'
            : paymentState === 'expired' ? 'Pix expirado'
            : paymentState === 'error' ? 'Erro ao verificar pagamento'
            : 'Aguardando pagamento'}
        </Text>
      </View>

      {pixData.qr_code_image ? (
        <View style={styles.qrContainer}>
          {/* iVBOR is the base64 magic number for PNG — validate before rendering */}
          {pixData.qr_code_image.startsWith('iVBOR') ? (
            <Image
              source={{ uri: `data:image/png;base64,${pixData.qr_code_image}` }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={{ color: '#EF4444', textAlign: 'center' }}>QR code inválido. Use o código Copia e Cola.</Text>
          )}
        </View>
      ) : (
        <View style={styles.qrPlaceholder}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.qrPlaceholderText}>Gerando QR code...</Text>
        </View>
      )}

      {pixData.copia_e_cola ? (
        <View style={styles.copiaContainer}>
          <Text style={styles.copiaLabel}>Pix Copia e Cola</Text>
          <Text style={styles.copiaCode} numberOfLines={3} ellipsizeMode="middle">
            {pixData.copia_e_cola}
          </Text>
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
            <Text style={styles.copyBtnText}>{copied ? 'Código aberto para copiar' : 'Copiar código Pix'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {pixData.expiration ? (
        <Text style={styles.expiration}>
          Válido até: {new Date(pixData.expiration).toLocaleString('pt-BR')}
        </Text>
      ) : null}

      {paymentState !== 'expired' ? <View style={styles.pollInfo}>
        <ActivityIndicator size="small" color="#6366F1" style={{ marginRight: 8 }} />
        <Text style={styles.pollText}>Verificando pagamento automaticamente...</Text>
      </View> : null}

      <TouchableOpacity style={styles.checkBtn} onPress={handleCheckManually} disabled={checking}>
        {checking ? (
          <ActivityIndicator color="#6366F1" />
        ) : (
          <Text style={styles.checkBtnText}>Já paguei — verificar agora</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.navigate('Subscription')}>
        <Text style={styles.cancelLinkText}>Pagar depois</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content:   { padding: 24, paddingBottom: 40, alignItems: 'center' },

  title:    { fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  stateBadge: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 18, borderWidth: 1 },
  stateWaiting: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  stateConfirmed: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  stateError: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  stateText: { fontSize: 12, fontWeight: '700', color: '#374151' },

  qrContainer:      { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  qrImage:          { width: 220, height: 220 },
  qrPlaceholder:    { width: 220, height: 220, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  qrPlaceholderText:{ marginTop: 12, color: '#9CA3AF', fontSize: 14 },

  copiaContainer: { width: '100%', backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  copiaLabel:     { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  copiaCode:      { fontSize: 12, color: '#374151', fontFamily: 'monospace', marginBottom: 12, lineHeight: 18 },
  copyBtn:        { backgroundColor: '#EEF2FF', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  copyBtnText:    { color: '#6366F1', fontWeight: '600', fontSize: 14 },

  expiration: { fontSize: 12, color: '#9CA3AF', marginBottom: 24 },

  pollInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  pollText: { fontSize: 13, color: '#6B7280' },

  checkBtn:     { width: '100%', backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  checkBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  cancelLink:   { paddingVertical: 8 },
  cancelLinkText:{ color: '#9CA3AF', fontSize: 14 },
});
