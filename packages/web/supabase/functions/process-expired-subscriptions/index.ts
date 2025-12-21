/**
 * Process Expired Subscriptions
 *
 * 만료된 구독을 처리하는 Edge Function
 * - current_period_end가 지난 유료 구독을 찾아서 expired로 변경
 * - Free 플랜으로 다운그레이드
 *
 * Cron: 매일 00:00 UTC에 실행
 * 수동 호출도 가능 (관리자 API 키 필요)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[ExpiredSubscriptions] Starting process...");

    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date().toISOString();

    // 1. 만료된 유료 구독 찾기 (trial/trialing 제외, active 상태만)
    // Free 플랜은 current_period_end가 100년 후로 설정되어 있어서 만료되지 않음
    const { data: expiredSubscriptions, error: fetchError } = await supabase
      .from("user_subscriptions")
      .select("id, user_id, plan_name, status, current_period_end")
      .eq("status", "active")
      .neq("plan_name", "free")
      .lt("current_period_end", now);

    if (fetchError) {
      console.error("[ExpiredSubscriptions] Error fetching expired subscriptions:", fetchError);
      throw fetchError;
    }

    if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
      console.log("[ExpiredSubscriptions] No expired subscriptions found");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No expired subscriptions found",
          processed: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log(`[ExpiredSubscriptions] Found ${expiredSubscriptions.length} expired subscriptions`);

    // 2. Free 플랜 ID 가져오기
    const { data: freePlan, error: planError } = await supabase
      .from("subscription_plans")
      .select("id")
      .eq("plan_code", "free")
      .single();

    if (planError || !freePlan) {
      console.error("[ExpiredSubscriptions] Error fetching free plan:", planError);
      throw planError || new Error("Free plan not found");
    }

    // 3. 만료된 구독 처리
    const results = [];
    for (const subscription of expiredSubscriptions) {
      console.log(`[ExpiredSubscriptions] Processing subscription ${subscription.id} for user ${subscription.user_id}`);

      // 구독을 expired로 변경하고 Free 플랜으로 다운그레이드
      const newPeriodEnd = new Date();
      newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 100); // Free 플랜은 100년 후 만료

      const { error: updateError } = await supabase
        .from("user_subscriptions")
        .update({
          status: "expired",
          plan_name: "free",
          plan_id: freePlan.id,
          provider: "paddle", // 결제 제공자 유지
          current_period_start: now,
          current_period_end: newPeriodEnd.toISOString(),
          cancel_at_period_end: false,
          paddle_subscription_id: null,
          paddle_customer_id: null,
        })
        .eq("id", subscription.id);

      if (updateError) {
        console.error(`[ExpiredSubscriptions] Error updating subscription ${subscription.id}:`, updateError);
        results.push({
          id: subscription.id,
          user_id: subscription.user_id,
          success: false,
          error: updateError.message,
        });
      } else {
        console.log(`[ExpiredSubscriptions] Successfully processed subscription ${subscription.id}`);
        results.push({
          id: subscription.id,
          user_id: subscription.user_id,
          previous_plan: subscription.plan_name,
          success: true,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(`[ExpiredSubscriptions] Completed. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${expiredSubscriptions.length} expired subscriptions`,
        processed: successCount,
        failed: failCount,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[ExpiredSubscriptions] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
