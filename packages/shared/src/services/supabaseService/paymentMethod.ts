import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface PaymentMethod {
  id: string;
  user_id: string;
  card_company: string | null;
  card_number: string;
  card_expiry: string;
  is_default: boolean;
  is_active: boolean;
  toss_billing_key: string | null;
  toss_customer_key: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get user's payment methods
 */
export async function getUserPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[paymentMethod] Error fetching payment methods:', error);
      return [];
    }

    return data as PaymentMethod[];
  } catch (error) {
    console.error('[paymentMethod] Error fetching payment methods:', error);
    return [];
  }
}

/**
 * Get user's default payment method
 */
export async function getDefaultPaymentMethod(userId: string): Promise<PaymentMethod | null> {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('[paymentMethod] Error fetching default payment method:', error);
      return null;
    }

    return data as PaymentMethod;
  } catch (error) {
    console.error('[paymentMethod] Error fetching default payment method:', error);
    return null;
  }
}

/**
 * Add new payment method
 */
export async function addPaymentMethod(params: {
  userId: string;
  cardCompany?: string;
  cardNumber: string;
  cardExpiry: string;
  isDefault?: boolean;
  tossBillingKey?: string;
  tossCustomerKey?: string;
}): Promise<{ success: boolean; paymentMethod?: PaymentMethod; error?: string }> {
  try {
    // If this is the default card, unset other default cards
    if (params.isDefault) {
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('user_id', params.userId)
        .eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('payment_methods')
      .insert({
        user_id: params.userId,
        card_company: params.cardCompany,
        card_number: params.cardNumber,
        card_expiry: params.cardExpiry,
        is_default: params.isDefault || false,
        is_active: true,
        toss_billing_key: params.tossBillingKey,
        toss_customer_key: params.tossCustomerKey,
      })
      .select()
      .single();

    if (error) {
      console.error('[paymentMethod] Error adding payment method:', error);
      return { success: false, error: error.message };
    }

    return { success: true, paymentMethod: data as PaymentMethod };
  } catch (error) {
    console.error('[paymentMethod] Error adding payment method:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Set default payment method
 */
export async function setDefaultPaymentMethod(
  userId: string,
  paymentMethodId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Unset all default payment methods
    await supabase
      .from('payment_methods')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);

    // Set new default
    const { error } = await supabase
      .from('payment_methods')
      .update({ is_default: true })
      .eq('id', paymentMethodId)
      .eq('user_id', userId);

    if (error) {
      console.error('[paymentMethod] Error setting default payment method:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[paymentMethod] Error setting default payment method:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Delete payment method (soft delete)
 */
export async function deletePaymentMethod(
  userId: string,
  paymentMethodId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('payment_methods')
      .update({ is_active: false })
      .eq('id', paymentMethodId)
      .eq('user_id', userId);

    if (error) {
      console.error('[paymentMethod] Error deleting payment method:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[paymentMethod] Error deleting payment method:', error);
    return { success: false, error: String(error) };
  }
}
