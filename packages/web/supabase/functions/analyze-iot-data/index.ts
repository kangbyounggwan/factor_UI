import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sensorData } = await req.json();

    if (!sensorData || sensorData.length === 0) {
      return new Response(
        JSON.stringify({ 
          status: "error",
          summary: "분석할 센서 데이터가 없습니다.",
          recommendations: [],
          anomalies: []
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // OpenAI API를 사용하여 센서 데이터 분석
    const prompt = `
다음은 IoT 프린터 모니터링 시스템의 센서 데이터입니다. 이 데이터를 분석하여 다음 형식으로 응답해주세요:

센서 데이터:
${JSON.stringify(sensorData, null, 2)}

다음 형식으로 JSON 응답을 제공해주세요:
{
  "status": "normal|warning|critical",
  "summary": "전체적인 상태 요약 (한국어)",
  "recommendations": ["권장사항1", "권장사항2"],
  "anomalies": ["이상징후1", "이상징후2"]
}

분석 기준:
- 온도가 정상 범위(20-30°C)를 벗어나면 warning 또는 critical
- 습도가 30-70% 범위를 벗어나면 warning
- 진동 값이 0.05 이상이면 warning, 0.1 이상이면 critical
- 배터리가 20% 이하면 warning, 10% 이하면 critical
- 신호 강도가 50% 이하면 warning

반드시 JSON 형식으로만 응답하고, 한국어로 작성해주세요.
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are an industrial IoT data analyst. Always respond with valid JSON in Korean.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('AI Response:', aiResponse);

    // JSON 파싱 시도
    let analysisResult;
    try {
      analysisResult = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // 기본 응답 제공
      analysisResult = {
        status: "normal",
        summary: "AI 분석 결과를 파싱하는 중 오류가 발생했습니다. 수동으로 데이터를 확인해주세요.",
        recommendations: ["시스템 관리자에게 문의하세요."],
        anomalies: []
      };
    }

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-iot-data function:', error);
    
    return new Response(
      JSON.stringify({ 
        status: "error",
        summary: "AI 분석 중 오류가 발생했습니다.",
        recommendations: ["시스템을 다시 시도하거나 관리자에게 문의하세요."],
        anomalies: []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});