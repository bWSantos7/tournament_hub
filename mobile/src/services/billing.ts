import api from './api';

export interface PlanFeature {
  code: string;
  name: string;
  limit: number | null;
}

export interface Plan {
  id: number;
  name: string;
  slug: string;
  price_monthly: string;
  price_yearly: string;
  description: string;
  highlight_label: string;
  display_order: number;
  is_active: boolean;
  features: PlanFeature[];
}

export interface Subscription {
  id: number;
  plan: number;
  plan_name: string;
  plan_slug: string;
  billing_period: 'monthly' | 'yearly';
  status: 'active' | 'pending' | 'canceled' | 'expired' | 'unpaid' | 'trial';
  is_active: boolean;
  start_date: string | null;
  next_due_date: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  asaas_subscription_id: string;
  price_monthly: string;
  price_yearly: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: number;
  amount: string;
  payment_method: string;
  status: string;
  transaction_id: string;
  due_date: string | null;
  paid_at: string | null;
  description: string;
  pix_code: string;
  boleto_url: string;
  created_at: string;
}

export interface FeatureAccess {
  [code: string]: {
    has_access: boolean;
    limit: number | null;
    name: string;
  };
}

export interface CheckoutPayload {
  plan_slug: 'free' | 'pro' | 'elite';
  billing_period: 'monthly' | 'yearly';
  payment_method: 'pix' | 'credit_card' | 'boleto' | 'debit_card';
  card_token?: string;
}

export async function fetchPlans(): Promise<Plan[]> {
  const res = await api.get('/api/billing/plans/');
  return res.data;
}

export async function fetchSubscription(): Promise<Subscription> {
  const res = await api.get('/api/billing/subscription/');
  return res.data;
}

export async function checkout(payload: CheckoutPayload): Promise<Subscription & { asaas?: Record<string, unknown> }> {
  const res = await api.post('/api/billing/subscription/checkout/', payload);
  return res.data;
}

export async function cancelSubscription(immediate = false): Promise<Subscription> {
  const res = await api.post('/api/billing/subscription/cancel/', { immediate });
  return res.data;
}

export async function reactivateSubscription(): Promise<Subscription> {
  const res = await api.post('/api/billing/subscription/reactivate/');
  return res.data;
}

export async function fetchPayments(): Promise<Payment[]> {
  const res = await api.get('/api/billing/payments/');
  return res.data;
}

export async function fetchMyFeatures(): Promise<FeatureAccess> {
  const res = await api.get('/api/billing/features/');
  return res.data;
}
