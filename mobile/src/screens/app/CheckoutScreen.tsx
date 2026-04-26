import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';
import { checkout, CheckoutPayload } from '../../services/billing';

type CheckoutRouteProp = RouteProp<MainStackParamList, 'Checkout'>;
type Nav = NativeStackNavigationProp<MainStackParamList>;

type PaymentMethod = 'pix' | 'credit_card' | 'debit_card';

const METHOD_CONFIG: Record<PaymentMethod, { label: string; icon: string; description: string }> = {
  pix:         { label: 'Pix',               icon: '⚡', description: 'Aprovação instantânea' },
  credit_card: { label: 'Cartão de crédito', icon: '💳', description: 'Parcelamento disponível' },
  debit_card:  { label: 'Cartão de débito',  icon: '🏦', description: 'Débito imediato' },
};

function formatCardNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

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

  // Credit card fields
  const [cardName, setCardName]       = useState('');
  const [cardNumber, setCardNumber]   = useState('');
  const [expiry, setExpiry]           = useState('');
  const [ccv, setCcv]                 = useState('');
  const [cpf, setCpf]                 = useState('');
  const [cep, setCep]                 = useState('');

  const price = billingPeriod === 'yearly' ? plan.price_yearly : plan.price_monthly;

  function buildCardPayload(): Partial<CheckoutPayload> {
    const [expiryMonth, expiryYear] = expiry.split('/');
    return {
      card_holder_name:  cardName.trim(),
      card_number:       cardNumber.replace(/\s/g, ''),
      card_expiry_month: expiryMonth,
      card_expiry_year:  expiryYear ? `20${expiryYear}` : '',
      card_ccv:          ccv,
      card_cpf:          cpf.replace(/\D/g, ''),
      card_postal_code:  cep.replace(/\D/g, ''),
    };
  }

  function validateCard(): string | null {
    if (!cardName.trim())               return 'Informe o nome no cartão.';
    if (cardNumber.replace(/\s/g, '').length < 16) return 'Número do cartão inválido.';
    if (expiry.length < 5)              return 'Informe a validade (MM/AA).';
    if (ccv.length < 3)                 return 'CVV inválido.';
    if (cpf.replace(/\D/g, '').length < 11) return 'CPF inválido.';
    if (cep.replace(/\D/g, '').length < 8)  return 'CEP inválido.';
    return null;
  }

  async function handleConfirm() {
    if (plan.slug === 'free') {
      setLoading(true);
      try {
        await checkout({ plan_slug: 'free', billing_period: billingPeriod, payment_method: 'pix' });
        Alert.alert('Sucesso', 'Plano Free ativado!', [
          { text: 'OK', onPress: () => navigation.navigate('Subscription') },
        ]);
      } catch {
        Alert.alert('Erro', 'Não foi possível ativar o plano.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (method === 'credit_card' || method === 'debit_card') {
      const err = validateCard();
      if (err) { Alert.alert('Dados incompletos', err); return; }
    }

    setLoading(true);
    try {
      const isCard = method === 'credit_card' || method === 'debit_card';
      const payload: CheckoutPayload = {
        plan_slug:      plan.slug as 'pro' | 'elite',
        billing_period: billingPeriod,
        payment_method: method,
        ...(isCard ? buildCardPayload() : {}),
      };

      const result = await checkout(payload);

      if (method === 'pix') {
        if (result.pix?.copia_e_cola || result.pix?.qr_code_image) {
          // Navigate to Pix screen — subscription activates ONLY after webhook confirms
          navigation.replace('PixPayment', { pixData: result.pix! });
        } else {
          Alert.alert(
            'Pix gerado',
            'Sua cobrança foi criada. Acesse sua conta bancária e pague o Pix para ativar o plano.',
            [{ text: 'OK', onPress: () => navigation.navigate('Subscription') }],
          );
        }
      } else if (isCard) {
        const msg = result.status === 'active'
          ? 'Pagamento aprovado! Sua assinatura está ativa.'
          : 'Assinatura criada. Aguardando confirmação do pagamento.';
        Alert.alert('Concluído', msg, [
          { text: 'OK', onPress: () => navigation.navigate('Subscription') },
        ]);
      } else {
        navigation.navigate('Subscription');
      }
    } catch (err: any) {
      let msg = 'Não foi possível processar o pagamento.';
      if (!err?.response) {
        msg = 'Sem conexão com a internet. Verifique sua rede e tente novamente.';
      } else if (err.response.status >= 500) {
        msg = 'Erro interno no servidor. Tente novamente em alguns minutos.';
      } else if (err.response.status === 422 || err.response.status === 400) {
        msg = err.response.data?.detail ?? 'Dados inválidos. Verifique as informações.';
      } else if (err.response.status === 402) {
        msg = 'Pagamento recusado. Verifique os dados do cartão ou escolha outro método.';
      } else if (err.response.data?.detail) {
        msg = err.response.data.detail;
      }
      Alert.alert('Erro no pagamento', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

        {/* Payment method */}
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

        {/* Card form — shown for both credit and debit */}
        {(method === 'credit_card' || method === 'debit_card') && plan.slug !== 'free' && (
          <View style={styles.cardForm}>
            <Text style={styles.sectionTitle}>Dados do cartão</Text>

            <TextInput
              style={styles.input}
              placeholder="Nome no cartão"
              placeholderTextColor="#9CA3AF"
              value={cardName}
              onChangeText={setCardName}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.input}
              placeholder="Número do cartão"
              placeholderTextColor="#9CA3AF"
              value={cardNumber}
              onChangeText={(v) => setCardNumber(formatCardNumber(v))}
              keyboardType="numeric"
              maxLength={19}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.inputHalf]}
                placeholder="Validade (MM/AA)"
                placeholderTextColor="#9CA3AF"
                value={expiry}
                onChangeText={(v) => setExpiry(formatExpiry(v))}
                keyboardType="numeric"
                maxLength={5}
              />
              <TextInput
                style={[styles.input, styles.inputHalf]}
                placeholder="CVV"
                placeholderTextColor="#9CA3AF"
                value={ccv}
                onChangeText={(v) => setCcv(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
                contextMenuHidden={true}
                selectTextOnFocus={false}
              />
            </View>

            <Text style={styles.sectionTitle}>Dados do titular</Text>
            <TextInput
              style={styles.input}
              placeholder="CPF (somente números)"
              placeholderTextColor="#9CA3AF"
              value={cpf}
              onChangeText={(v) => setCpf(v.replace(/\D/g, '').slice(0, 11))}
              keyboardType="numeric"
              maxLength={11}
            />
            <TextInput
              style={styles.input}
              placeholder="CEP (somente números)"
              placeholderTextColor="#9CA3AF"
              value={cep}
              onChangeText={(v) => setCep(v.replace(/\D/g, '').slice(0, 8))}
              keyboardType="numeric"
              maxLength={8}
            />
          </View>
        )}

        <Text style={styles.disclaimer}>
          Ao confirmar, você concorda com os Termos de Uso. Você pode cancelar a qualquer momento.
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
    </KeyboardAvoidingView>
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

  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 10, marginTop: 8 },

  methodRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  methodRowSelected: { borderColor: '#6366F1', backgroundColor: '#F0F0FF' },
  methodIcon:        { fontSize: 22, marginRight: 12 },
  methodLabel:       { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  methodDesc:        { fontSize: 12, color: '#6B7280' },
  radio:             { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D1D5DB' },
  radioSelected:     { borderColor: '#6366F1', backgroundColor: '#6366F1' },

  cardForm: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  input:    { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1F2937', marginBottom: 10 },
  row:      { flexDirection: 'row', gap: 10 },
  inputHalf:{ flex: 1 },

  disclaimer: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 12, marginBottom: 20, lineHeight: 16 },

  confirmBtn:     { backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  confirmBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  cancelLink:     { alignItems: 'center' },
  cancelLinkText: { color: '#6B7280', fontSize: 14 },
});
