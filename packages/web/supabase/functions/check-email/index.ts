/**
 * Check Email Edge Function
 *
 * 이메일 중복 확인 API
 * - auth.users 테이블에서 이메일 존재 여부 확인
 * - 소셜 로그인(Google, Apple) 및 이메일 가입 여부 반환
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    console.log("[check-email] Checking email:", email);

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Supabase Admin 클라이언트로 auth.users 확인
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // admin API로 이메일로 사용자 조회
    const { data, error } = await supabase.auth.admin.getUserByEmail(email);

    console.log("[check-email] getUserByEmail result:", { data: !!data, error: error?.message });

    if (error) {
      // User not found 에러는 사용자가 없다는 의미
      const errorMsg = error.message?.toLowerCase() || "";
      if (errorMsg.includes("user not found") || errorMsg.includes("not found")) {
        console.log("[check-email] User not found, email available");
        return new Response(
          JSON.stringify({
            exists: false,
            providers: [],
            message: "Email available",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      console.error("[check-email] Error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to check email", details: error.message }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    if (data?.user) {
      // 사용자 존재 - provider 정보 추출
      const user = data.user;
      const providers: string[] = [];
      const identities = user.identities || [];

      console.log("[check-email] User found, identities:", identities.length);

      for (const identity of identities) {
        if (identity.provider === "google") {
          providers.push("google");
        } else if (identity.provider === "apple") {
          providers.push("apple");
        } else if (identity.provider === "email") {
          providers.push("email");
        }
      }

      // 이메일 인증 여부
      const emailConfirmed = !!user.email_confirmed_at;

      return new Response(
        JSON.stringify({
          exists: true,
          providers,
          emailConfirmed,
          message: "Account exists",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // 사용자 없음 (data가 있지만 user가 없는 경우)
    console.log("[check-email] No user data, email available");
    return new Response(
      JSON.stringify({
        exists: false,
        providers: [],
        message: "Email available",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("[check-email] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
