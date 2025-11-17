// Supabase Edge Function to send push notifications via Firebase Cloud Messaging
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Firebase Admin SDK credentials (from Service Account)
const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "factor-f38b9";
const FIREBASE_PRIVATE_KEY = Deno.env.get("FIREBASE_PRIVATE_KEY");
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL");

// Supabase configuration
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  type: string; // 알림 타입 (필수)
  relatedId?: string;
  relatedType?: string;
  data?: Record<string, string>;
  imageUrl?: string;
  priority?: "high" | "normal";
  messageEn?: string; // 영어 메시지 (선택)
}

/**
 * Get Firebase access token using Service Account credentials
 */
async function getAccessToken(): Promise<string> {
  if (!FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
    throw new Error("Firebase credentials not configured");
  }

  const jwtHeader = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));

  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = {
    iss: FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const jwtClaimSetEncoded = btoa(JSON.stringify(jwtClaimSet));

  // Import private key
  const privateKeyPem = FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKeyPem.substring(
    pemHeader.length,
    privateKeyPem.length - pemFooter.length
  );
  const binaryDerString = atob(pemContents.trim());
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Sign JWT
  const dataToSign = `${jwtHeader}.${jwtClaimSetEncoded}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(dataToSign)
  );
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = `${dataToSign}.${signatureBase64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Send FCM notification to a single device token
 */
async function sendFCMNotification(
  accessToken: string,
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  imageUrl?: string,
  priority: "high" | "normal" = "high"
): Promise<{ success: boolean; error?: string }> {
  const message: any = {
    message: {
      token: deviceToken,
      notification: {
        title,
        body,
      },
      android: {
        priority,
        notification: {
          channel_id: "factor_default",
          sound: "default",
          ...(imageUrl && { image: imageUrl }),
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: "default",
            ...(imageUrl && { "mutable-content": 1 }),
          },
        },
        ...(imageUrl && { fcm_options: { image: imageUrl } }),
      },
      ...(data && { data }),
    },
  };

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(message),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("FCM API error:", error);
    return { success: false, error };
  }

  return { success: true };
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: PushNotificationPayload = await req.json();
    const {
      userId,
      title,
      body,
      type,
      relatedId,
      relatedType,
      data,
      imageUrl,
      priority = "high",
      messageEn,
    } = payload;

    // Validate required fields
    if (!userId || !title || !body || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, title, body, type" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. DB에 알림 먼저 저장 (필수)
    console.log(`[Push] Saving notification to DB for user ${userId}`);
    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title,
        message: body,
        message_en: messageEn,
        type,
        related_id: relatedId,
        related_type: relatedType,
        metadata: data,
      })
      .select()
      .single();

    if (notificationError) {
      console.error("Error saving notification to DB:", notificationError);
      return new Response(
        JSON.stringify({ error: "Failed to save notification to database" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    console.log(`[Push] Notification saved to DB: ${notification.id}`);

    // 2. 사용자의 활성 FCM 토큰 조회
    const { data: deviceTokens, error: dbError } = await supabase
      .from("user_device_tokens")
      .select("device_token, platform")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch device tokens" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // 3. FCM 토큰이 없어도 성공 (DB 저장이 중요)
    if (!deviceTokens || deviceTokens.length === 0) {
      console.log(`[Push] No active device tokens for user ${userId}, but notification saved to DB`);
      return new Response(
        JSON.stringify({
          success: true,
          notificationId: notification.id,
          message: "Notification saved to DB, but no active device tokens found",
          totalDevices: 0,
          successCount: 0,
          failureCount: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // 4. Firebase access token 가져오기
    const accessToken = await getAccessToken();

    // 5. 모든 활성 디바이스에 FCM 푸시 전송
    console.log(`[Push] Sending FCM to ${deviceTokens.length} device(s)`);
    const results = await Promise.all(
      deviceTokens.map(({ device_token }) =>
        sendFCMNotification(accessToken, device_token, title, body, data, imageUrl, priority)
      )
    );

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(`[Push] FCM sent: ${successCount} succeeded, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        notificationId: notification.id,
        totalDevices: deviceTokens.length,
        successCount,
        failureCount,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error sending push notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
