export interface PlanFeature {
  code: string;
  name: string;
  limit: number | null;
}

export interface Plan {
  id: number;
  name: string;
  slug: 'free' | 'pro' | 'elite';
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
  plan_slug: 'free' | 'pro' | 'elite';
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
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'overdue';
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

export type BillingPaymentMethod = 'pix' | 'credit_card' | 'boleto' | 'debit_card';

export interface CheckoutPayload {
  plan_slug: 'free' | 'pro' | 'elite';
  billing_period: 'monthly' | 'yearly';
  payment_method: BillingPaymentMethod;
  card_token?: string;
}
