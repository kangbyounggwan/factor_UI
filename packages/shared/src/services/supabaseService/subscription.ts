import { createClient } from '@supabase/supabase-js';
import type { SubscriptionPlan, UserSubscription } from '../../types/subscription';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Get user's current subscription
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error) {
      console.error('[subscription] Error fetching user subscription:', error);
      return null;
    }

    return data as UserSubscription;
  } catch (error) {
    console.error('[subscription] Error fetching user subscription:', error);
    return null;
  }
}

/**
 * Get user's current plan (defaults to 'free' if no subscription found)
 */
export async function getUserPlan(userId: string): Promise<SubscriptionPlan> {
  try {
    const subscription = await getUserSubscription(userId);

    if (!subscription || subscription.status !== 'active') {
      return 'free';
    }

    return subscription.plan_name;
  } catch (error) {
    console.error('[subscription] Error getting user plan:', error);
    return 'free';
  }
}

/**
 * Create or update user subscription
 */
export async function upsertUserSubscription(
  userId: string,
  plan: SubscriptionPlan,
  periodStart: Date,
  periodEnd: Date
): Promise<UserSubscription | null> {
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        plan_name: plan,
        status: 'active',
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[subscription] Error upserting user subscription:', error);
      return null;
    }

    return data as UserSubscription;
  } catch (error) {
    console.error('[subscription] Error upserting user subscription:', error);
    return null;
  }
}

/**
 * Cancel user subscription (will expire at period end)
 */
export async function cancelUserSubscription(userId: string): Promise<boolean> {
  try {
    const { error} = await supabase
      .from('user_subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      console.error('[subscription] Error cancelling user subscription:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[subscription] Error cancelling user subscription:', error);
    return false;
  }
}

/**
 * Get user's printer count
 */
export async function getUserPrinterCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('printers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      console.error('[subscription] Error getting printer count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('[subscription] Error getting printer count:', error);
    return 0;
  }
}

/**
 * Create or update subscription (for payment processing)
 */
export async function upsertSubscription(params: {
  userId: string;
  planName: string;
  status: 'active' | 'cancelled' | 'expired' | 'trialing';
  periodStart: Date;
  periodEnd: Date;
  tossPaymentKey?: string;
  tossOrderId?: string;
}): Promise<{ success: boolean; subscription?: UserSubscription; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: params.userId,
        plan_name: params.planName as SubscriptionPlan,
        status: params.status,
        current_period_start: params.periodStart.toISOString(),
        current_period_end: params.periodEnd.toISOString(),
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[subscription] Error upserting subscription:', error);
      return { success: false, error: error.message };
    }

    return { success: true, subscription: data as UserSubscription };
  } catch (error) {
    console.error('[subscription] Error upserting subscription:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Create payment history record
 */
export async function createPaymentHistory(params: {
  userId: string;
  subscriptionId?: string;
  planName: string;
  amount: number;
  currency: string;
  status: string;
  paymentKey?: string;
  orderId?: string;
  paidAt: Date;
}): Promise<{ success: boolean; payment?: any; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('payment_history')
      .insert({
        user_id: params.userId,
        subscription_id: params.subscriptionId,
        plan: params.planName,
        amount: params.amount,
        currency: params.currency,
        status: params.status,
        payment_key: params.paymentKey,
        order_id: params.orderId,
        paid_at: params.paidAt.toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[subscription] Error creating payment history:', error);
      return { success: false, error: error.message };
    }

    return { success: true, payment: data };
  } catch (error) {
    console.error('[subscription] Error creating payment history:', error);
    return { success: false, error: String(error) };
  }
}

export interface PaymentHistory {
  id: string;
  user_id: string;
  subscription_id: string | null;
  plan_name: string;
  amount: number;
  currency: string;
  status: 'success' | 'failed' | 'refunded' | 'pending' | 'canceled';
  payment_method: string | null;
  card_company: string | null;
  card_number: string | null;
  payment_key: string | null;
  order_id: string | null;
  transaction_id: string | null;
  receipt_url: string | null;
  paid_at: string | null;
  created_at: string;
}

/**
 * Get user's payment history
 */
export async function getUserPaymentHistory(
  userId: string,
  limit = 10,
  offset = 0
): Promise<{ data: PaymentHistory[]; total: number }> {
  try {
    const { data, error, count } = await supabase
      .from('payment_history')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[subscription] Error fetching payment history:', error);
      return { data: [], total: 0 };
    }

    return { data: data as PaymentHistory[], total: count || 0 };
  } catch (error) {
    console.error('[subscription] Error fetching payment history:', error);
    return { data: [], total: 0 };
  }
}
