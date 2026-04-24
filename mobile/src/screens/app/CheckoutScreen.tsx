import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';
import { checkout, Plan } from '../../services/billing';

type CheckoutRouteProp = RouteProp<MainStackParamList, 'Checkout'>;
type Nav = NativeStackNavigationProp<MainStackParamList>;

type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

const METHOD_CONFIG: Record<PaymentMethod, { label: string; icon: string; description: string }> = {
  pix:         { label: 'Pix',           icon: '⚡', description: 'Aprovação instantânea' },
  credit_card: { label: 'Cartão de crédito', icon: '💳', description: 'Parcelamento disponível' },
  boleto:      { label: 'Boleto',        icon: '🧾', description: 'Vence em 3 dias úteis' },
};

function formatPrice(price: string, period: 'monthly' | 'yearly'): string {
  const n = parseFloat(price);
  if (n === 0) return 'Grátis';
  return `R$ ${n.toFixed(2).replace('.', ',')} / ${period === 'yearly' ? 'ano' : 'mês'}`;
}

export function CheckoutScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<CheckoutRouteProp>();
  const { plan, billingPeriod } = route.params;

  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [loading, setLoading] = useState(false);

  const price = billingPeriod === 'yearly' ? plan.price_yearly : plan.price_monthly;

  async function handleConfirm() {
    if (plan.slug === 'free') {
      setLoading(true);
      try {
        await checkout({ plan_slug: 'free', billing_period: billingPeriod, payment_method: 'pix' });
        Alert.alert('Sucesso', 'Plano Free ativado!');
        navigation.goBack();
      } catch {
        Alert.alert('Erro', 'Não foi possível ativar o plano.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const result = await checkout({
        plan_slug: plan.slug as 'pro' | 'elite',
        billing_period: billingPeriod,
        payment_method: method,
      });

      if (method === 'pix' && result.asaas) {
        // Navigate to Pix QR code screen when Asaas is live
        Alert.alert(
          'Assinatura criada',
          'Sua assinatura foi criada. Realize o pagamento via Pix para ativar.',
        );
      } else if (method === 'boleto' && result.asaas) {
        Alert.alert('Boleto gerado', 'Acesse o boleto pelo link enviado ao seu e-mail.');
      } else {
        Alert.alert('Assinatura criada', 'Aguardando confirmação do pagamento.');
      }
      navigation.navigate('Subscription');
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Não foi possível processar o pagamento.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Finalizar assinatura</Text>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryPlan}>{plan.name}</Text>
        <Text style={styles.summaryPrice}>{formatPrice(price, billingPeriod)}</Text>
        {billingPeriod === 'yearly' && (
          <Text style={styles.savingsNote}>
            Equivale a R$ {(parseFloat(price) / 12).toFixed(2).replace('.', ',')}/mês — 2 meses grátis
          </Text>
        )}
      </View>

      {/* Payment method (only shown for paid plans) */}
      {plan.slug !== 'free' && (
        <>
          <Text style={styles.sectionTitle}>Forma de pagamento</Text>
          {(Object.keys(METHOD_CONFIG) as PaymentMethod[]).map((m) => {
            const cfg = METHOD_CONFIG[m];
            return (
              <TouchableOpacity
                key={m}
                style={[styles.methodRow, method === m && styles.methodRowSelected]}
                onPress={() => setMethod(m)}
              >
                <Text style={styles.methodIcon}>{cfg.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodLabel}>{cfg.label}</Text>
                  <Text style={styles.methodDesc}>{cfg.description}</Text>
                </View>
                <View style={[styles.radio, method === m && styles.radioSelected]} />
              </TouchableOpacity>
            );
          })}
        </>
      )}

      <Text style={styles.disclaimer}>
        Ao confirmar, você concorda com os Termos de Uso. Você pode cancelar sua assinatura a qualquer momento.
      </Text>

      <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.confirmBtnText}>
            {plan.slug === 'free' ? 'Usar plano gratuito' : 'Confirmar assinatura'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelLinkText}>Voltar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content:   { padding: 20, paddingBottom: 40 },
  title:     { fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 20 },

  summaryCard:  { backgroundColor: '#6366F1', borderRadius: 14, padding: 20, marginBottom: 24 },
  summaryPlan:  { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 4 },
  summaryPrice: { color: '#FFF', fontSize: 26, fontWeight: '800' },
  savingsNote:  { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 },

  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 10 },

  methodRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  methodRowSelected: { borderColor: '#6366F1', backgroundColor: '#F0F0FF' },
  methodIcon:  { fontSize: 22, marginRight: 12 },
  methodLabel: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  methodDesc:  { fontSize: 12, color: '#6B7280' },
  radio:         { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D1D5DB' },
  radioSelected: { borderColor: '#6366F1', backgroundColor: '#6366F1' },

  disclaimer: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 12, marginBottom: 20, lineHeight: 16 },

  confirmBtn:     { backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  confirmBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  cancelLink:     { alignItems: 'center' },
  cancelLinkText: { color: '#6B7280', fontSize: 14 },
});
