/**
 * Get Payment Methods from Paddle
 *
 * Paddle API를 통해 고객의 저장된 결제 수단을 조회
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Environment variables
const PADDLE_API_KEY = Deno.env.get("PADDLE_API_KEY") || "";
const PADDLE_ENVIRONMENT = Deno.env.get("PADDLE_ENVIRONMENT") || "sandbox";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Paddle API base URL
const PADDLE_API_URL = PADDLE_ENVIRONMENT === "production"
  ? "https://api.paddle.com"
  : "https://sandbox-api.paddle.com";

interface PaddlePaymentMethod {
  id: string;
  customer_id: string;
  address_id: string;
  type: "card" | "paypal" | "google_pay" | "apple_pay" | "alipay" | "wire_transfer";
  card?: {
    type: string; // visa, mastercard, amex, etc.
    last4: string;
    expiry_month: number;
    expiry_year: number;
    cardholder_name?: string;
  };
  paypal?: {
    email: string;
  };
  origin: "saved_during_purchase" | "subscription";
  saved_at: string;
}

interface PaddleResponse {
  data: PaddlePaymentMethod[];
  meta: {
    request_id: string;
    pagination: {
      per_page: number;
      next?: string;
      has_more: boolean;
    };
  };
}

/**
 * Fetch payment methods from Paddle API
 */
async function fetchPaymentMethods(customerId: string): Promise<PaddlePaymentMethod[]> {
  const response = await fetch(
    `${PADDLE_API_URL}/customers/${customerId}/payment-methods`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${PADDLE_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[Paddle] API Error:", response.status, errorBody);
    throw new Error(`Paddle API error: ${response.status}`);
  }

  const result: PaddleResponse = await response.json();
  return result.data;
}

/**
 * Transform Paddle payment method to simplified format
 */
function transformPaymentMethod(method: PaddlePaymentMethod) {
  const base = {
    id: method.id,
    type: method.type,
    saved_at: method.saved_at,
    origin: method.origin,
  };

  if (method.type === "card" && method.card) {
    return {
      ...base,
      card_type: method.card.type,
      last4: method.card.last4,
      expiry_month: method.card.expiry_month,
      expiry_year: method.card.expiry_year,
      cardholder_name: method.card.cardholder_name,
      display_name: `${method.card.type.toUpperCase()} •••• ${method.card.last4}`,
    };
  }

  if (method.type === "paypal" && method.paypal) {
    return {
      ...base,
      email: method.paypal.email,
      display_name: `PayPal (${method.paypal.email})`,
    };
  }

  return {
    ...base,
    display_name: method.type.replace("_", " ").toUpperCase(),
  };
}

// Main handler
serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Initialize Supabase client with user's token
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    console.log("[PaymentMethods] Fetching for user:", user.id);

    // Get user's Paddle customer ID from subscription
    const { data: subscription, error: subError } = await supabase
      .from("user_subscriptions")
      .select("paddle_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subError) {
      console.error("[PaymentMethods] DB Error:", subError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    if (!subscription?.paddle_customer_id) {
      // No Paddle customer ID means no payment methods
      console.log("[PaymentMethods] No Paddle customer ID found");
      return new Response(
        JSON.stringify({ data: [], message: "No payment methods found" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Check if Paddle API key is configured
    if (!PADDLE_API_KEY) {
      console.error("[PaymentMethods] PADDLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Fetch payment methods from Paddle
    const paddleCustomerId = subscription.paddle_customer_id;
    console.log("[PaymentMethods] Fetching from Paddle for customer:", paddleCustomerId);

    const paymentMethods = await fetchPaymentMethods(paddleCustomerId);

    // Transform to simplified format
    const transformedMethods = paymentMethods.map(transformPaymentMethod);

    console.log("[PaymentMethods] Found", transformedMethods.length, "payment methods");

    return new Response(
      JSON.stringify({
        data: transformedMethods,
        count: transformedMethods.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[PaymentMethods] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
