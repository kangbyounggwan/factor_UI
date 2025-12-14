import { supabase } from '../../integrations/supabase/client';

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'google_pay' | 'apple_pay' | 'alipay' | 'wire_transfer';
  saved_at: string;
  origin: 'saved_during_purchase' | 'subscription';
  // Card specific
  card_type?: string;
  last4?: string;
  expiry_month?: number;
  expiry_year?: number;
  cardholder_name?: string;
  // PayPal specific
  email?: string;
  // Display
  display_name: string;
}

/**
 * Get user's payment methods from Paddle via Edge Function
 */
export async function getUserPaymentMethods(): Promise<PaymentMethod[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      console.log('[paymentMethod] No session, returning empty');
      return [];
    }

    const { data, error } = await supabase.functions.invoke('get-payment-methods', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('[paymentMethod] Error fetching payment methods:', error);
      return [];
    }

    return data?.data || [];
  } catch (error) {
    console.error('[paymentMethod] Error fetching payment methods:', error);
    return [];
  }
}

/**
 * Get user's default/primary payment method
 */
export async function getDefaultPaymentMethod(): Promise<PaymentMethod | null> {
  const methods = await getUserPaymentMethods();

  // Return the first one (most recently saved) or null
  return methods.length > 0 ? methods[0] : null;
}

/**
 * Format card display string
 */
export function formatCardDisplay(method: PaymentMethod): string {
  if (method.type === 'card' && method.card_type && method.last4) {
    return `${method.card_type.toUpperCase()} •••• ${method.last4}`;
  }
  return method.display_name;
}

/**
 * Format card expiry
 */
export function formatCardExpiry(method: PaymentMethod): string | null {
  if (method.expiry_month && method.expiry_year) {
    const month = method.expiry_month.toString().padStart(2, '0');
    const year = method.expiry_year.toString().slice(-2);
    return `${month}/${year}`;
  }
  return null;
}

/**
 * Check if card is expired
 */
export function isCardExpired(method: PaymentMethod): boolean {
  if (method.type !== 'card' || !method.expiry_month || !method.expiry_year) {
    return false;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (method.expiry_year < currentYear) {
    return true;
  }

  if (method.expiry_year === currentYear && method.expiry_month < currentMonth) {
    return true;
  }

  return false;
}

/**
 * Get card brand icon name
 */
export function getCardBrandIcon(cardType: string): string {
  const brandMap: Record<string, string> = {
    visa: 'visa',
    mastercard: 'mastercard',
    amex: 'amex',
    discover: 'discover',
    diners: 'diners',
    jcb: 'jcb',
    unionpay: 'unionpay',
  };

  return brandMap[cardType.toLowerCase()] || 'card';
}
