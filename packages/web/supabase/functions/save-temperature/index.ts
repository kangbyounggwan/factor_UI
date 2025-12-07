// Temperature Data Storage Edge Function
// WebSocket Proxy Server에서 호출되어 3초마다 온도 데이터 저장
// printer_temperature_logs에 INSERT → DB 트리거가 800개 도달 시 자동 아카이브

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Supabase 클라이언트 생성
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // service_role로 RLS 우회
    );

    const { printer_id, temperature_info, state, flags } = await req.json();

    // PRINTING 상태일 때만 저장 (flags.operational && flags.printing)
    const isPrinting = flags?.operational && flags?.printing;

    if (!isPrinting) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Not printing (only save during printing)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 온도 데이터 추출
    const tool = temperature_info?.tool?.tool0 ?? temperature_info?.tool;
    const bed = temperature_info?.bed;

    if (!tool && !bed) {
      return new Response(
        JSON.stringify({ success: false, error: 'No temperature data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // printer_temperature_logs에 INSERT
    // DB 트리거(check_and_archive_logs)가 800개 도달 시 자동으로 sessions로 아카이브
    const { data: insertedLog, error: insertError } = await supabase
      .from('printer_temperature_logs')
      .insert({
        printer_id,
        nozzle_temp: tool?.actual || 0,
        nozzle_target: tool?.target || 0,
        bed_temp: bed?.actual || 0,
        bed_target: bed?.target || 0,
        recorded_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[EdgeFunction] Failed to insert temperature log:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[EdgeFunction] Inserted temperature log: ${insertedLog.id} for printer ${printer_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        log_id: insertedLog.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[EdgeFunction] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
