/**
 * Paddle Webhook Handler
 *
 * Paddle 결제 이벤트를 수신하고 DB에 저장
 * - transaction.completed: 결제 완료
 * - subscription.created: 구독 생성
 * - subscription.updated: 구독 업데이트
 * - subscription.canceled: 구독 취소
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

// Environment variables
const PADDLE_WEBHOOK_SECRET = Deno.env.get("PADDLE_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Verify Paddle webhook signature
 */
function verifyPaddleSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    console.error("[Paddle] Missing signature or secret");
    return false;
  }

  try {
    // Paddle signature format: ts=timestamp;h1=hash
    const parts = signature.split(";");
    const tsMatch = parts.find((p) => p.startsWith("ts="));
    const h1Match = parts.find((p) => p.startsWith("h1="));

    if (!tsMatch || !h1Match) {
      console.error("[Paddle] Invalid signature format");
      return false;
    }

    const timestamp = tsMatch.replace("ts=", "");
    const hash = h1Match.replace("h1=", "");

    // Create signed payload
    const signedPayload = `${timestamp}:${rawBody}`;

    // Calculate expected signature
    const hmac = createHmac("sha256", secret);
    hmac.update(signedPayload);
    const expectedHash = hmac.digest("hex");

    // Compare
    const isValid = hash === expectedHash;

    if (!isValid) {
      console.log("[Paddle] Signature mismatch", { received: hash, expected: expectedHash });
    }

    return isValid;
  } catch (error) {
    console.error("[Paddle] Signature verification error:", error);
    return false;
  }
}

/**
 * Get user ID from Paddle customer email
 */
async function getUserIdByEmail(
  supabase: any,
  email: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (error || !data) {
      // Try auth.users table
      const { data: authData, error: authError } = await supabase.auth.admin.getUserByEmail(email);

      if (authError || !authData?.user) {
        console.error("[Paddle] User not found for email:", email);
        return null;
      }

      return authData.user.id;
    }

    return data.id;
  } catch (error) {
    console.error("[Paddle] Error finding user:", error);
    return null;
  }
}

/**
 * Get plan_id from subscription_plans table by plan_code
 */
async function getPlanId(supabase: any, planCode: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("plan_code", planCode)
    .single();

  if (error || !data) {
    console.error("[Paddle] Plan not found:", planCode);
    return null;
  }

  return data.id;
}

/**
 * Determine plan name from Paddle price/product info
 */
function determinePlanName(data: any): string {
  const items = data.items || [];
  const priceName = items[0]?.price?.name?.toLowerCase() || "";
  const productName = items[0]?.price?.product?.name?.toLowerCase() || "";

  // Check for enterprise
  if (priceName.includes("enterprise") || productName.includes("enterprise")) {
    return "enterprise";
  }

  // Check for pro (default paid plan)
  if (priceName.includes("pro") || productName.includes("pro")) {
    return "pro";
  }

  // Default to pro for any paid subscription
  return "pro";
}

/**
 * Determine billing cycle from Paddle data
 */
function determineBillingCycle(data: any): string {
  const items = data.items || [];
  const interval = items[0]?.price?.billing_cycle?.interval || "";

  if (interval === "year" || items[0]?.price?.name?.toLowerCase().includes("yearly")) {
    return "yearly";
  }

  return "monthly";
}

/**
 * Handle subscription.created event
 */
async function handleSubscriptionCreated(supabase: any, data: any) {
  console.log("[Paddle] Processing subscription.created");

  const customerId = data.customer_id;
  const subscriptionId = data.id;
  const status = data.status;
  const customerEmail = data.customer?.email;
  const customData = data.custom_data || {};

  // Get user ID
  let userId = customData.user_id;
  if (!userId && customerEmail) {
    userId = await getUserIdByEmail(supabase, customerEmail);
  }

  if (!userId) {
    console.error("[Paddle] Cannot find user for subscription:", subscriptionId);
    return { success: false, error: "User not found" };
  }

  // Extract plan info
  const planName = determinePlanName(data);
  const billingCycle = determineBillingCycle(data);

  // Get plan_id from subscription_plans table
  const planId = await getPlanId(supabase, planName);

  // Period dates
  const periodStart = data.current_billing_period?.starts_at
    ? new Date(data.current_billing_period.starts_at)
    : new Date();
  const periodEnd = data.current_billing_period?.ends_at
    ? new Date(data.current_billing_period.ends_at)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default

  // Map Paddle status to our status
  const statusMap: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "active", // Still active but payment failed
    paused: "cancelled",
    canceled: "cancelled",
  };

  // Build subscription data with new columns
  const subscriptionData: Record<string, any> = {
    user_id: userId,
    plan_name: planName,
    status: statusMap[status] || "active",
    billing_cycle: billingCycle,
    provider: "paddle",
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    cancel_at_period_end: false,
    paddle_subscription_id: subscriptionId,
    paddle_customer_id: customerId,
    updated_at: new Date().toISOString(),
  };

  // Add plan_id if found
  if (planId) {
    subscriptionData.plan_id = planId;
  }

  // Handle trial dates if trialing
  if (status === "trialing" && data.trial_dates) {
    subscriptionData.trial_start = data.trial_dates.starts_at;
    subscriptionData.trial_end = data.trial_dates.ends_at;
  }

  const { error } = await supabase.from("user_subscriptions").upsert(
    subscriptionData,
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("[Paddle] Error creating subscription:", error);
    return { success: false, error: error.message };
  }

  console.log("[Paddle] Subscription created for user:", userId, "Plan:", planName, "Cycle:", billingCycle);
  return { success: true };
}

/**
 * Handle subscription.updated event
 */
async function handleSubscriptionUpdated(supabase: any, data: any) {
  console.log("[Paddle] Processing subscription.updated");

  const customerEmail = data.customer?.email;
  const customData = data.custom_data || {};
  const status = data.status;
  const subscriptionId = data.id;
  const customerId = data.customer_id;

  // Get user ID
  let userId = customData.user_id;
  if (!userId && customerEmail) {
    userId = await getUserIdByEmail(supabase, customerEmail);
  }

  if (!userId) {
    console.error("[Paddle] Cannot find user for subscription update");
    return { success: false, error: "User not found" };
  }

  // Check if plan changed
  const planName = determinePlanName(data);
  const billingCycle = determineBillingCycle(data);
  const planId = await getPlanId(supabase, planName);

  // Period dates
  const periodStart = data.current_billing_period?.starts_at
    ? new Date(data.current_billing_period.starts_at)
    : undefined;
  const periodEnd = data.current_billing_period?.ends_at
    ? new Date(data.current_billing_period.ends_at)
    : undefined;

  const statusMap: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "active",
    paused: "cancelled",
    canceled: "cancelled",
  };

  const updateData: Record<string, any> = {
    status: statusMap[status] || status,
    plan_name: planName,
    billing_cycle: billingCycle,
    paddle_subscription_id: subscriptionId,
    paddle_customer_id: customerId,
    updated_at: new Date().toISOString(),
  };

  // Add plan_id if found
  if (planId) {
    updateData.plan_id = planId;
  }

  if (periodStart) updateData.current_period_start = periodStart.toISOString();
  if (periodEnd) updateData.current_period_end = periodEnd.toISOString();

  // Check for scheduled cancellation
  if (data.scheduled_change?.action === "cancel") {
    updateData.cancel_at_period_end = true;
  }

  const { error } = await supabase
    .from("user_subscriptions")
    .update(updateData)
    .eq("user_id", userId);

  if (error) {
    console.error("[Paddle] Error updating subscription:", error);
    return { success: false, error: error.message };
  }

  console.log("[Paddle] Subscription updated for user:", userId, "Plan:", planName);
  return { success: true };
}

/**
 * Handle subscription.canceled event
 */
async function handleSubscriptionCanceled(supabase: any, data: any) {
  console.log("[Paddle] Processing subscription.canceled");

  const customerEmail = data.customer?.email;
  const customData = data.custom_data || {};

  let userId = customData.user_id;
  if (!userId && customerEmail) {
    userId = await getUserIdByEmail(supabase, customerEmail);
  }

  if (!userId) {
    console.error("[Paddle] Cannot find user for cancellation");
    return { success: false, error: "User not found" };
  }

  // Get free plan ID for downgrade
  const freePlanId = await getPlanId(supabase, "free");

  const updateData: Record<string, any> = {
    status: "cancelled",
    cancel_at_period_end: true,
    cancelled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Note: We keep the current plan until period_end
  // A separate cron job should downgrade to free after period ends

  const { error } = await supabase
    .from("user_subscriptions")
    .update(updateData)
    .eq("user_id", userId);

  if (error) {
    console.error("[Paddle] Error canceling subscription:", error);
    return { success: false, error: error.message };
  }

  console.log("[Paddle] Subscription canceled for user:", userId);
  return { success: true };
}

/**
 * Handle transaction.completed event
 */
async function handleTransactionCompleted(supabase: any, data: any) {
  console.log("[Paddle] Processing transaction.completed");

  const transactionId = data.id;
  const customerEmail = data.customer?.email;
  const customData = data.custom_data || {};

  // Get user ID
  let userId = customData.user_id;
  if (!userId && customerEmail) {
    userId = await getUserIdByEmail(supabase, customerEmail);
  }

  if (!userId) {
    console.error("[Paddle] Cannot find user for transaction:", transactionId);
    return { success: false, error: "User not found" };
  }

  // Get subscription ID if exists
  const subscriptionId = data.subscription_id;

  // Extract payment details
  const totals = data.details?.totals || {};
  const amount = parseFloat(totals.total || "0") / 100; // Paddle uses cents
  const currency = data.currency_code || "USD";

  // Get plan name from items
  const items = data.items || [];
  const planName = items[0]?.price?.product?.name?.toLowerCase().includes("pro") ? "pro" : "pro";

  // Check if transaction already exists (prevent duplicates)
  const { data: existingPayment } = await supabase
    .from("payment_history")
    .select("id")
    .eq("transaction_id", transactionId)
    .single();

  if (existingPayment) {
    console.log("[Paddle] Transaction already recorded:", transactionId);
    return { success: true, message: "Already processed" };
  }

  // Create payment history record
  const { error } = await supabase.from("payment_history").insert({
    user_id: userId,
    subscription_id: null, // Our internal subscription_id, not Paddle's
    plan_name: planName,
    amount: amount,
    currency: currency,
    status: "success",
    payment_method: data.payments?.[0]?.method_details?.type || "card",
    transaction_id: transactionId,
    receipt_url: data.receipt_data?.receipt_url || null,
    paid_at: data.billed_at || new Date().toISOString(),
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[Paddle] Error creating payment history:", error);
    return { success: false, error: error.message };
  }

  console.log("[Paddle] Payment recorded for user:", userId, "Amount:", amount, currency);
  return { success: true };
}

/**
 * Handle transaction.payment_failed event
 */
async function handlePaymentFailed(supabase: any, data: any) {
  console.log("[Paddle] Processing transaction.payment_failed");

  const transactionId = data.id;
  const customerEmail = data.customer?.email;
  const customData = data.custom_data || {};

  let userId = customData.user_id;
  if (!userId && customerEmail) {
    userId = await getUserIdByEmail(supabase, customerEmail);
  }

  if (!userId) {
    console.error("[Paddle] Cannot find user for failed transaction");
    return { success: false, error: "User not found" };
  }

  const totals = data.details?.totals || {};
  const amount = parseFloat(totals.total || "0") / 100;
  const currency = data.currency_code || "USD";

  const { error } = await supabase.from("payment_history").insert({
    user_id: userId,
    plan_name: "pro",
    amount: amount,
    currency: currency,
    status: "failed",
    transaction_id: transactionId,
    paid_at: null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[Paddle] Error recording failed payment:", error);
    return { success: false, error: error.message };
  }

  console.log("[Paddle] Failed payment recorded for user:", userId);
  return { success: true };
}

// Main handler
serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paddle-signature",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("paddle-signature");
    const rawBody = await req.text();

    console.log("[Paddle] Webhook received");

    // Verify signature (skip in development if needed)
    if (PADDLE_WEBHOOK_SECRET) {
      const isValid = verifyPaddleSignature(rawBody, signature, PADDLE_WEBHOOK_SECRET);
      if (!isValid) {
        console.error("[Paddle] Invalid signature");
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 401,
          }
        );
      }
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event_type;
    const eventData = event.data;

    console.log("[Paddle] Event type:", eventType);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let result = { success: true };

    // Handle events
    switch (eventType) {
      case "subscription.created":
        result = await handleSubscriptionCreated(supabase, eventData);
        break;

      case "subscription.activated":
        // Same as created for our purposes
        result = await handleSubscriptionCreated(supabase, eventData);
        break;

      case "subscription.updated":
        result = await handleSubscriptionUpdated(supabase, eventData);
        break;

      case "subscription.canceled":
        result = await handleSubscriptionCanceled(supabase, eventData);
        break;

      case "subscription.past_due":
        // Update status but keep subscription active
        result = await handleSubscriptionUpdated(supabase, eventData);
        break;

      case "transaction.completed":
        result = await handleTransactionCompleted(supabase, eventData);
        break;

      case "transaction.paid":
        // Same handling as completed
        result = await handleTransactionCompleted(supabase, eventData);
        break;

      case "transaction.payment_failed":
        result = await handlePaymentFailed(supabase, eventData);
        break;

      default:
        console.log("[Paddle] Unhandled event type:", eventType);
    }

    return new Response(
      JSON.stringify({ received: true, ...result }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[Paddle] Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
