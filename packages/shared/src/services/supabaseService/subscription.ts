import { supabase } from "../../integrations/supabase/client";

/**
 * 사용자 구독 정보 타입
 */
export interface UserSubscription {
  id: string;
  user_id: string;
  plan_name: string;
  status: 'active' | 'canceled' | 'expired' | 'trial';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  toss_payment_key?: string;
  toss_order_id?: string;
  toss_billing_key?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 결제 내역 타입
 */
export interface PaymentHistory {
  id: string;
  user_id: string;
  subscription_id?: string;
  plan_name: string;
  amount: number;
  currency: string;
  status: 'success' | 'failed' | 'refunded' | 'pending' | 'canceled';
  payment_method?: string;
  card_company?: string;
  card_number?: string;
  payment_key?: string;
  order_id?: string;
  transaction_id?: string;
  receipt_url?: string;
  refund_reason?: string;
  refunded_amount?: number;
  paid_at?: string;
  refunded_at?: string;
  canceled_at?: string;
  created_at: string;
}

/**
 * 사용자의 현재 구독 정보 조회
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching user subscription:', error);
    return null;
  }

  return data;
}

/**
 * 구독 생성 또는 업데이트
 */
export async function upsertSubscription(params: {
  userId: string;
  planName: string;
  status?: 'active' | 'canceled' | 'expired' | 'trial';
  periodStart?: Date;
  periodEnd?: Date;
  tossPaymentKey?: string;
  tossOrderId?: string;
  tossBillingKey?: string;
}): Promise<{ success: boolean; error?: any; subscription?: UserSubscription }> {
  const {
    userId,
    planName,
    status = 'active',
    periodStart = new Date(),
    periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 기본 1개월
    tossPaymentKey,
    tossOrderId,
    tossBillingKey,
  } = params;

  // 기존 구독 확인
  const existing = await getUserSubscription(userId);

  const subscriptionData = {
    user_id: userId,
    plan_name: planName,
    status,
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    cancel_at_period_end: false,
    toss_payment_key: tossPaymentKey,
    toss_order_id: tossOrderId,
    toss_billing_key: tossBillingKey,
  };

  if (existing) {
    // 업데이트
    const { data, error } = await supabase
      .from('user_subscriptions')
      .update(subscriptionData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating subscription:', error);
      return { success: false, error };
    }

    return { success: true, subscription: data };
  } else {
    // 새로 생성
    const { data, error } = await supabase
      .from('user_subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (error) {
      console.error('Error creating subscription:', error);
      return { success: false, error };
    }

    return { success: true, subscription: data };
  }
}

/**
 * 결제 내역 생성
 */
export async function createPaymentHistory(params: {
  userId: string;
  subscriptionId?: string;
  planName: string;
  amount: number;
  currency?: string;
  status: 'success' | 'failed' | 'refunded' | 'pending' | 'canceled';
  paymentMethod?: string;
  cardCompany?: string;
  cardNumber?: string;
  paymentKey?: string;
  orderId?: string;
  transactionId?: string;
  receiptUrl?: string;
  paidAt?: Date;
}): Promise<{ success: boolean; error?: any; payment?: PaymentHistory }> {
  const {
    userId,
    subscriptionId,
    planName,
    amount,
    currency = 'KRW',
    status,
    paymentMethod,
    cardCompany,
    cardNumber,
    paymentKey,
    orderId,
    transactionId,
    receiptUrl,
    paidAt,
  } = params;

  const paymentData = {
    user_id: userId,
    subscription_id: subscriptionId,
    plan_name: planName,
    amount,
    currency,
    status,
    payment_method: paymentMethod,
    card_company: cardCompany,
    card_number: cardNumber,
    payment_key: paymentKey,
    order_id: orderId,
    transaction_id: transactionId,
    receipt_url: receiptUrl,
    paid_at: paidAt?.toISOString(),
  };

  const { data, error } = await supabase
    .from('payment_history')
    .insert(paymentData)
    .select()
    .single();

  if (error) {
    console.error('Error creating payment history:', error);
    return { success: false, error };
  }

  return { success: true, payment: data };
}

/**
 * 사용자의 결제 내역 조회
 */
export async function getUserPaymentHistory(
  userId: string,
  limit: number = 10
): Promise<PaymentHistory[]> {
  const { data, error } = await supabase
    .from('payment_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching payment history:', error);
    return [];
  }

  return data || [];
}

/**
 * 구독 취소
 */
export async function cancelSubscription(
  userId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<{ success: boolean; error?: any }> {
  const updateData = cancelAtPeriodEnd
    ? { cancel_at_period_end: true }
    : { status: 'canceled' as const, cancel_at_period_end: false };

  const { error } = await supabase
    .from('user_subscriptions')
    .update(updateData)
    .eq('user_id', userId);

  if (error) {
    console.error('Error canceling subscription:', error);
    return { success: false, error };
  }

  return { success: true };
}

/**
 * 구독 재개 (취소 예약 해제)
 */
export async function resumeSubscription(userId: string): Promise<{ success: boolean; error?: any }> {
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      cancel_at_period_end: false,
      status: 'active'
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error resuming subscription:', error);
    return { success: false, error };
  }

  return { success: true };
}
