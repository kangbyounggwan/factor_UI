// Supabase Edge Function to send feedback emails
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FEEDBACK_EMAIL = "factor@factor.io.kr";

interface FeedbackPayload {
  type: "issue" | "idea";
  title: string;
  description: string;
  userEmail: string;
  userName: string;
  printerName?: string;
  printerModel?: string;
  imageUrls?: string[];
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
    const payload: FeedbackPayload = await req.json();
    const { type, title, description, userEmail, userName, printerName, printerModel, imageUrls } = payload;

    // Determine email subject and type label
    const typeLabel = type === "issue" ? "문제 보고" : "아이디어 제안";
    const typeEmoji = type === "issue" ? "🔴" : "💡";

    // Build email HTML
    let emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .field { margin-bottom: 16px; }
    .label { font-weight: bold; color: #6b7280; margin-bottom: 4px; }
    .value { background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; }
    .images { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 12px; }
    .images img { width: 100%; height: auto; border-radius: 6px; border: 1px solid #e5e7eb; }
    .footer { text-align: center; padding: 16px; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">${typeEmoji} ${typeLabel}</h2>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">FACTOR 피드백 시스템</p>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">제목</div>
        <div class="value">${title}</div>
      </div>
      <div class="field">
        <div class="label">내용</div>
        <div class="value" style="white-space: pre-wrap;">${description}</div>
      </div>
      <div class="field">
        <div class="label">작성자</div>
        <div class="value">${userName} (${userEmail})</div>
      </div>
      ${printerName ? `
      <div class="field">
        <div class="label">관련 프린터</div>
        <div class="value">${printerName}${printerModel ? ` (${printerModel})` : ''}</div>
      </div>
      ` : ''}
      ${imageUrls && imageUrls.length > 0 ? `
      <div class="field">
        <div class="label">첨부 이미지 (${imageUrls.length}개)</div>
        <div class="images">
          ${imageUrls.map(url => `<img src="${url}" alt="Feedback Image" />`).join('')}
        </div>
      </div>
      ` : ''}
      <div class="field">
        <div class="label">제출 시간</div>
        <div class="value">${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</div>
      </div>
    </div>
    <div class="footer">
      이 이메일은 FACTOR 피드백 시스템에서 자동으로 전송되었습니다.
    </div>
  </div>
</body>
</html>
    `;

    // Send email using Resend API
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "FACTOR Feedback <noreply@factor.io.kr>",
        to: [FEEDBACK_EMAIL],
        reply_to: userEmail,
        subject: `[FACTOR ${typeLabel}] ${title}`,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Resend API error:", error);
      throw new Error(`Failed to send email: ${error}`);
    }

    const data = await res.json();
    console.log("Email sent successfully:", data);

    return new Response(
      JSON.stringify({ success: true, emailId: data.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error sending feedback email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
