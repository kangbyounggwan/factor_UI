// Admin AI Analytics Edge Function
// 관리자 AI 분석 대시보드용 데이터 제공

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 타입 정의
interface KeywordData {
  keyword: string;
  count: number;
  source_type: string;
}

interface DailyUsage {
  date: string;
  chat_sessions: number;
  chat_messages: number;
  troubleshoot_sessions: number;
  model_generations: number;
  gcode_analyses: number;
}

interface ToolUsage {
  tool_type: string;
  session_count: number;
  message_count: number;
  avg_messages_per_session: number;
}

interface ModelStats {
  generation_type: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  avg_file_size: number;
}

interface TopUser {
  user_id: string;
  email: string;
  display_name: string;
  total_chat_sessions: number;
  total_models_generated: number;
  total_gcode_analyses: number;
  total_activity: number;
}

interface PopularPrompt {
  prompt: string;
  generation_type: string;
  usage_count: number;
  success_rate: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 인증 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase 클라이언트 생성 (서비스 롤)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 사용자 인증 확인
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 관리자 권한 확인
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 요청 바디 파싱
    let body: {
      action?: string;
      days?: number;
      limit?: number;
      source_type?: string;
      generation_type?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      // 빈 바디 허용
    }

    const action = body.action || 'stats';
    const days = body.days || 30;
    const limit = body.limit || 100;

    // ===== ACTION: stats (전체 통계) =====
    if (action === 'stats') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // 선택된 기간 시작일 계산
      const startDate = new Date(Date.now() - days * 86400000).toISOString();

      // 선택된 기간 내 채팅 세션 조회 (tool_type 포함)
      const { data: allSessions } = await supabaseAdmin
        .from('chat_sessions')
        .select('id, tool_type, created_at')
        .gte('created_at', startDate);

      // 세션을 tool_type별로 분류
      const chatSessionIds: string[] = [];
      const troubleshootSessionIds: string[] = [];
      let chatSessionsLastWeek = 0;
      let troubleshootSessionsLastWeek = 0;

      allSessions?.forEach((session: { id: string; tool_type: string; created_at: string }) => {
        const isLastWeek = new Date(session.created_at) >= sevenDaysAgo;

        if (session.tool_type === 'troubleshoot') {
          troubleshootSessionIds.push(session.id);
          if (isLastWeek) troubleshootSessionsLastWeek++;
        } else {
          chatSessionIds.push(session.id);
          if (isLastWeek) chatSessionsLastWeek++;
        }
      });

      // 일반 채팅 세션의 메시지 수
      let totalChatMessages = 0;
      if (chatSessionIds.length > 0) {
        const { count } = await supabaseAdmin
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .in('session_id', chatSessionIds);
        totalChatMessages = count || 0;
      }

      // 문제진단 세션의 메시지 수
      let totalTroubleshootMessages = 0;
      if (troubleshootSessionIds.length > 0) {
        const { count } = await supabaseAdmin
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .in('session_id', troubleshootSessionIds);
        totalTroubleshootMessages = count || 0;
      }

      const totalChatSessions = chatSessionIds.length;
      const totalTroubleshootSessions = troubleshootSessionIds.length;

      // AI 모델 통계 (선택된 기간 내)
      const { count: totalAiModels } = await supabaseAdmin
        .from('ai_generated_models')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate);

      const { count: textTo3dCount } = await supabaseAdmin
        .from('ai_generated_models')
        .select('*', { count: 'exact', head: true })
        .eq('generation_type', 'text_to_3d')
        .gte('created_at', startDate);

      const { count: imageTo3dCount } = await supabaseAdmin
        .from('ai_generated_models')
        .select('*', { count: 'exact', head: true })
        .eq('generation_type', 'image_to_3d')
        .gte('created_at', startDate);

      const { count: textToImageCount } = await supabaseAdmin
        .from('ai_generated_models')
        .select('*', { count: 'exact', head: true })
        .eq('generation_type', 'text_to_image')
        .gte('created_at', startDate);

      const { count: aiModelsLastWeek } = await supabaseAdmin
        .from('ai_generated_models')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());

      // G-code 분석 통계 (선택된 기간 내)
      const { count: totalGcodeReports } = await supabaseAdmin
        .from('gcode_analysis_reports')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate);

      const { data: gcodeScoreData } = await supabaseAdmin
        .from('gcode_analysis_reports')
        .select('overall_score')
        .not('overall_score', 'is', null)
        .gte('created_at', startDate);

      const avgGcodeScore = gcodeScoreData && gcodeScoreData.length > 0
        ? gcodeScoreData.reduce((sum, r) => sum + (r.overall_score || 0), 0) / gcodeScoreData.length
        : 0;

      // 사용량 통계는 전체 누적 (user_usage 테이블은 기간 필터링 어려움)
      const { data: usageData } = await supabaseAdmin
        .from('user_usage')
        .select('ai_model_generation, ai_image_generation');

      const totalModelGenerations = usageData?.reduce((sum, u) => sum + (u.ai_model_generation || 0), 0) || 0;
      const totalImageGenerations = usageData?.reduce((sum, u) => sum + (u.ai_image_generation || 0), 0) || 0;

      return new Response(
        JSON.stringify({
          chat: {
            totalSessions: totalChatSessions,
            totalMessages: totalChatMessages,
            sessionsLastWeek: chatSessionsLastWeek,
          },
          troubleshoot: {
            totalSessions: totalTroubleshootSessions,
            totalMessages: totalTroubleshootMessages,
            sessionsLastWeek: troubleshootSessionsLastWeek,
          },
          aiModels: {
            total: totalAiModels || 0,
            textTo3d: textTo3dCount || 0,
            imageTo3d: imageTo3dCount || 0,
            textToImage: textToImageCount || 0,
            lastWeek: aiModelsLastWeek || 0,
          },
          gcode: {
            totalReports: totalGcodeReports || 0,
            avgScore: Math.round(avgGcodeScore),
          },
          usage: {
            totalModelGenerations,
            totalImageGenerations,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== ACTION: keywords (키워드 클라우드) =====
    if (action === 'keywords') {
      const sourceType = body.source_type || null;
      const startDate = new Date(Date.now() - days * 86400000).toISOString();

      // 불용어 목록
      const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for',
        'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
        'before', 'after', 'above', 'below', 'between', 'under', 'again',
        'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
        'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
        'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
        'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
        '이', '그', '저', '것', '수', '등', '때', '중', '및', '내', '더', '잘',
        '네', '예', '아', '음', '어', '응', '좀', '제', '안', '못', '다', '또'
      ]);

      // 키워드 추출 함수
      const extractKeywords = (text: string): string[] => {
        if (!text) return [];
        // 한글, 영문, 숫자만 남기고 공백으로 분리
        const words = text
          .toLowerCase()
          .replace(/[^\uAC00-\uD7A3a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 1 && !stopWords.has(word));
        return words;
      };

      const keywordMap = new Map<string, { count: number; source_type: string }>();

      // 채팅 메시지에서 키워드 추출 (troubleshoot이 아닌 일반 채팅만)
      if (!sourceType || sourceType === 'chat') {
        // 일반 채팅 세션 ID 가져오기 (troubleshoot 제외)
        const { data: chatSessions } = await supabaseAdmin
          .from('chat_sessions')
          .select('id')
          .neq('tool_type', 'troubleshoot')
          .gte('created_at', startDate);

        const chatSessionIds = chatSessions?.map(s => s.id) || [];

        if (chatSessionIds.length > 0) {
          const { data: chatMessages } = await supabaseAdmin
            .from('chat_messages')
            .select('content')
            .eq('type', 'user')
            .in('session_id', chatSessionIds)
            .limit(1000);

          chatMessages?.forEach((msg: { content: string }) => {
            const words = extractKeywords(msg.content);
            words.forEach(word => {
              const key = `${word}|chat`;
              const existing = keywordMap.get(key);
              if (existing) {
                existing.count++;
              } else {
                keywordMap.set(key, { count: 1, source_type: 'chat' });
              }
            });
          });
        }
      }

      // 트러블슈팅 메시지에서 키워드 추출 (chat_sessions의 tool_type = 'troubleshoot'인 세션의 메시지)
      if (!sourceType || sourceType === 'troubleshoot') {
        // 먼저 troubleshoot 타입의 세션 ID 가져오기
        const { data: troubleshootSessions } = await supabaseAdmin
          .from('chat_sessions')
          .select('id')
          .eq('tool_type', 'troubleshoot')
          .gte('created_at', startDate);

        const sessionIds = troubleshootSessions?.map(s => s.id) || [];

        if (sessionIds.length > 0) {
          // 해당 세션들의 메시지 가져오기
          const { data: troubleshootMessages } = await supabaseAdmin
            .from('chat_messages')
            .select('content')
            .eq('type', 'user')
            .in('session_id', sessionIds)
            .limit(1000);

          troubleshootMessages?.forEach((msg: { content: string }) => {
            const words = extractKeywords(msg.content);
            words.forEach(word => {
              const key = `${word}|troubleshoot`;
              const existing = keywordMap.get(key);
              if (existing) {
                existing.count++;
              } else {
                keywordMap.set(key, { count: 1, source_type: 'troubleshoot' });
              }
            });
          });
        }
      }

      // 모델 프롬프트에서 키워드 추출
      if (!sourceType || sourceType === 'model_prompt') {
        const { data: modelPrompts } = await supabaseAdmin
          .from('ai_generated_models')
          .select('prompt')
          .not('prompt', 'is', null)
          .gte('created_at', startDate)
          .limit(500);

        modelPrompts?.forEach((model: { prompt: string }) => {
          const words = extractKeywords(model.prompt);
          words.forEach(word => {
            const key = `${word}|model_prompt`;
            const existing = keywordMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              keywordMap.set(key, { count: 1, source_type: 'model_prompt' });
            }
          });
        });
      }

      // G-code 분석에서 키워드 추출 (파일명 또는 관련 텍스트)
      if (!sourceType || sourceType === 'gcode') {
        const { data: gcodeReports } = await supabaseAdmin
          .from('gcode_analysis_reports')
          .select('file_name')
          .gte('created_at', startDate)
          .limit(500);

        gcodeReports?.forEach((report: { file_name: string }) => {
          const words = extractKeywords(report.file_name);
          words.forEach(word => {
            const key = `${word}|gcode`;
            const existing = keywordMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              keywordMap.set(key, { count: 1, source_type: 'gcode' });
            }
          });
        });
      }

      // 결과 정렬 및 제한
      const keywords = Array.from(keywordMap.entries())
        .map(([key, data]) => ({
          keyword: key.split('|')[0],
          count: data.count,
          source_type: data.source_type,
        }))
        .filter(k => k.count >= 2) // 최소 2회 이상 등장한 키워드만
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return new Response(
        JSON.stringify({
          keywords,
          source: 'direct_extraction'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== ACTION: daily-usage (일별 사용량 추이) =====
    if (action === 'daily-usage') {
      // 직접 계산 (chat_sessions의 tool_type 기반으로 통일)
      const startDate = new Date(Date.now() - days * 86400000).toISOString();

      // 모든 chat_sessions 데이터를 한 번에 가져옴
      const { data: allChatSessions } = await supabaseAdmin
        .from('chat_sessions')
        .select('created_at, tool_type')
        .gte('created_at', startDate);

      // 모든 ai_generated_models 데이터
      const { data: allModels } = await supabaseAdmin
        .from('ai_generated_models')
        .select('created_at')
        .gte('created_at', startDate);

      // 모든 gcode_analysis_reports 데이터
      const { data: allGcode } = await supabaseAdmin
        .from('gcode_analysis_reports')
        .select('created_at')
        .gte('created_at', startDate);

      // 일별 집계
      const dailyMap = new Map<string, DailyUsage>();

      // 날짜 범위 초기화
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - 1 - i));
        const dateStr = date.toISOString().split('T')[0];
        dailyMap.set(dateStr, {
          date: dateStr.slice(5), // MM-DD
          chat_sessions: 0,
          chat_messages: 0,
          troubleshoot_sessions: 0,
          model_generations: 0,
          gcode_analyses: 0,
        });
      }

      // chat_sessions 집계 (tool_type 기반)
      allChatSessions?.forEach((session: { created_at: string; tool_type: string }) => {
        const dateStr = session.created_at.split('T')[0];
        const daily = dailyMap.get(dateStr);
        if (daily) {
          // tool_type이 troubleshoot인 경우 troubleshoot_sessions에 카운트
          if (session.tool_type === 'troubleshoot') {
            daily.troubleshoot_sessions++;
          } else {
            // 그 외는 chat_sessions에 카운트 (general, gcode, modeling, comparison 등)
            daily.chat_sessions++;
          }
        }
      });

      // ai_generated_models 집계
      allModels?.forEach((model: { created_at: string }) => {
        const dateStr = model.created_at.split('T')[0];
        const daily = dailyMap.get(dateStr);
        if (daily) {
          daily.model_generations++;
        }
      });

      // gcode_analysis_reports 집계
      allGcode?.forEach((report: { created_at: string }) => {
        const dateStr = report.created_at.split('T')[0];
        const daily = dailyMap.get(dateStr);
        if (daily) {
          daily.gcode_analyses++;
        }
      });

      const dailyUsage = Array.from(dailyMap.values());

      return new Response(
        JSON.stringify({ dailyUsage, source: 'direct_query' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== ACTION: tool-usage (도구별 사용량 - 스탯 카드와 동일한 데이터) =====
    if (action === 'tool-usage') {
      const startDate = new Date(Date.now() - days * 86400000).toISOString();

      // 스탯 카드와 동일한 방식으로 데이터 계산
      // 1. 채팅 세션 조회 (tool_type 포함)
      const { data: allSessions } = await supabaseAdmin
        .from('chat_sessions')
        .select('id, tool_type')
        .gte('created_at', startDate);

      // 세션을 분류
      const chatSessionIds: string[] = [];
      const troubleshootSessionIds: string[] = [];
      const priceComparisonSessionIds: string[] = [];

      allSessions?.forEach((session: { id: string; tool_type: string }) => {
        if (session.tool_type === 'troubleshoot') {
          troubleshootSessionIds.push(session.id);
        } else if (session.tool_type === 'price_comparison') {
          priceComparisonSessionIds.push(session.id);
        } else {
          chatSessionIds.push(session.id);
        }
      });

      // 2. 일반 채팅 메시지 수 (troubleshoot, price_comparison 제외한 모든 세션)
      let chatMessages = 0;
      if (chatSessionIds.length > 0) {
        const { count } = await supabaseAdmin
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .in('session_id', chatSessionIds);
        chatMessages = count || 0;
      }

      // 3. 문제진단 메시지 수
      let troubleshootMessages = 0;
      if (troubleshootSessionIds.length > 0) {
        const { count } = await supabaseAdmin
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .in('session_id', troubleshootSessionIds);
        troubleshootMessages = count || 0;
      }

      // 4. 가격 비교 메시지 수
      let priceComparisonMessages = 0;
      if (priceComparisonSessionIds.length > 0) {
        const { count } = await supabaseAdmin
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .in('session_id', priceComparisonSessionIds);
        priceComparisonMessages = count || 0;
      }

      // 5. AI 모델 생성 횟수
      const { count: aiModelCount } = await supabaseAdmin
        .from('ai_generated_models')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate);

      // 6. G-code 분석 횟수
      const { count: gcodeCount } = await supabaseAdmin
        .from('gcode_analysis_reports')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate);

      // 도넛 차트 데이터 구성 (스탯 카드와 동일)
      const toolUsage: ToolUsage[] = [
        {
          tool_type: 'chat',
          session_count: chatSessionIds.length,
          message_count: chatMessages,
          avg_messages_per_session: chatSessionIds.length > 0 ? Math.round(chatMessages / chatSessionIds.length * 10) / 10 : 0,
        },
        {
          tool_type: 'troubleshoot',
          session_count: troubleshootSessionIds.length,
          message_count: troubleshootMessages,
          avg_messages_per_session: troubleshootSessionIds.length > 0 ? Math.round(troubleshootMessages / troubleshootSessionIds.length * 10) / 10 : 0,
        },
        {
          tool_type: 'ai_model',
          session_count: aiModelCount || 0,
          message_count: aiModelCount || 0,
          avg_messages_per_session: 1,
        },
        {
          tool_type: 'gcode',
          session_count: gcodeCount || 0,
          message_count: gcodeCount || 0,
          avg_messages_per_session: 1,
        },
        {
          tool_type: 'price_comparison',
          session_count: priceComparisonSessionIds.length,
          message_count: priceComparisonMessages,
          avg_messages_per_session: priceComparisonSessionIds.length > 0 ? Math.round(priceComparisonMessages / priceComparisonSessionIds.length * 10) / 10 : 0,
        },
      ].filter(item => item.message_count > 0);

      // message_count 기준 내림차순 정렬
      toolUsage.sort((a, b) => b.message_count - a.message_count);

      return new Response(
        JSON.stringify({ toolUsage, source: 'stats_matched' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== ACTION: model-stats (모델 생성 통계) =====
    if (action === 'model-stats') {
      const { data: modelData, error: modelError } = await supabaseAdmin
        .rpc('get_model_generation_stats', { p_days: days });

      if (modelError) {
        // 직접 쿼리
        const { data: models } = await supabaseAdmin
          .from('ai_generated_models')
          .select('generation_type, status, file_size')
          .gte('created_at', new Date(Date.now() - days * 86400000).toISOString());

        const statsMap = new Map<string, ModelStats>();
        models?.forEach((m: { generation_type: string; status: string; file_size: number }) => {
          if (!statsMap.has(m.generation_type)) {
            statsMap.set(m.generation_type, {
              generation_type: m.generation_type,
              total_count: 0,
              success_count: 0,
              failed_count: 0,
              avg_file_size: 0,
            });
          }
          const stat = statsMap.get(m.generation_type)!;
          stat.total_count++;
          if (m.status === 'completed') stat.success_count++;
          if (m.status === 'failed') stat.failed_count++;
        });

        return new Response(
          JSON.stringify({
            modelStats: Array.from(statsMap.values()),
            source: 'direct_query'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ modelStats: modelData, source: 'rpc_function' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== ACTION: top-users (상위 사용자) =====
    if (action === 'top-users') {
      // 기간별로 직접 쿼리 (days 파라미터 지원)
      const startDate = new Date(Date.now() - days * 86400000).toISOString();

      // 각 활동 유형별로 기간 내 사용량 조회
      const { data: chatData } = await supabaseAdmin
        .from('chat_sessions')
        .select('user_id')
        .gte('created_at', startDate);

      const { data: modelData } = await supabaseAdmin
        .from('ai_generated_models')
        .select('user_id')
        .gte('created_at', startDate);

      const { data: gcodeData } = await supabaseAdmin
        .from('gcode_analysis_reports')
        .select('user_id')
        .gte('created_at', startDate);

      // 사용자별 활동 집계
      const userActivityMap = new Map<string, {
        chat: number;
        models: number;
        gcode: number;
      }>();

      chatData?.forEach((item: { user_id: string }) => {
        if (!item.user_id) return;
        if (!userActivityMap.has(item.user_id)) {
          userActivityMap.set(item.user_id, { chat: 0, models: 0, gcode: 0 });
        }
        userActivityMap.get(item.user_id)!.chat++;
      });

      modelData?.forEach((item: { user_id: string }) => {
        if (!item.user_id) return;
        if (!userActivityMap.has(item.user_id)) {
          userActivityMap.set(item.user_id, { chat: 0, models: 0, gcode: 0 });
        }
        userActivityMap.get(item.user_id)!.models++;
      });

      gcodeData?.forEach((item: { user_id: string }) => {
        if (!item.user_id) return;
        if (!userActivityMap.has(item.user_id)) {
          userActivityMap.set(item.user_id, { chat: 0, models: 0, gcode: 0 });
        }
        userActivityMap.get(item.user_id)!.gcode++;
      });

      // 총 활동량 기준 정렬 및 상위 N명 선택
      const sortedUsers = Array.from(userActivityMap.entries())
        .map(([userId, activity]) => ({
          user_id: userId,
          total_chat_sessions: activity.chat,
          total_models_generated: activity.models,
          total_gcode_analyses: activity.gcode,
          total_activity: activity.chat + activity.models + activity.gcode,
        }))
        .sort((a, b) => b.total_activity - a.total_activity)
        .slice(0, limit);

      // 프로필 정보 조회
      const userIds = sortedUsers.map(u => u.user_id);
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const topUsers = sortedUsers.map(u => ({
        ...u,
        email: profileMap.get(u.user_id)?.email || '',
        display_name: profileMap.get(u.user_id)?.display_name || '',
      }));

      return new Response(
        JSON.stringify({ topUsers, source: 'direct_query_with_days' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== ACTION: popular-prompts (인기 프롬프트) =====
    if (action === 'popular-prompts') {
      const generationType = body.generation_type || null;

      const { data: promptsData, error: promptsError } = await supabaseAdmin
        .rpc('get_popular_prompts', {
          p_generation_type: generationType,
          p_days: days,
          p_limit: limit
        });

      if (promptsError) {
        // 직접 쿼리
        const { data: models } = await supabaseAdmin
          .from('ai_generated_models')
          .select('prompt, generation_type, status')
          .not('prompt', 'is', null)
          .gte('created_at', new Date(Date.now() - days * 86400000).toISOString())
          .limit(500);

        const promptMap = new Map<string, PopularPrompt>();
        models?.forEach((m: { prompt: string; generation_type: string; status: string }) => {
          const key = `${m.prompt}|${m.generation_type}`;
          if (!promptMap.has(key)) {
            promptMap.set(key, {
              prompt: m.prompt,
              generation_type: m.generation_type,
              usage_count: 0,
              success_rate: 0,
            });
          }
          const p = promptMap.get(key)!;
          p.usage_count++;
        });

        const popularPrompts = Array.from(promptMap.values())
          .sort((a, b) => b.usage_count - a.usage_count)
          .slice(0, limit);

        return new Response(
          JSON.stringify({ popularPrompts, source: 'direct_query' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ popularPrompts: promptsData, source: 'rpc_function' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== ACTION: chat-analytics (채팅 분석) =====
    if (action === 'chat-analytics') {
      // 도구별 세션 수
      const { data: toolSessions } = await supabaseAdmin
        .from('chat_sessions')
        .select('tool_type')
        .gte('created_at', new Date(Date.now() - days * 86400000).toISOString());

      const toolCounts = new Map<string, number>();
      toolSessions?.forEach((s: { tool_type: string }) => {
        const type = s.tool_type || 'general';
        toolCounts.set(type, (toolCounts.get(type) || 0) + 1);
      });

      // 이미지 첨부 비율
      const { count: totalMsgs } = await supabaseAdmin
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'user')
        .gte('created_at', new Date(Date.now() - days * 86400000).toISOString());

      const { count: imageMsgs } = await supabaseAdmin
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'user')
        .not('images', 'is', null)
        .gte('created_at', new Date(Date.now() - days * 86400000).toISOString());

      // 평균 세션 메시지 수
      const { data: sessionMsgCounts } = await supabaseAdmin
        .from('chat_sessions')
        .select('message_count')
        .gte('created_at', new Date(Date.now() - days * 86400000).toISOString());

      const avgMessagesPerSession = sessionMsgCounts && sessionMsgCounts.length > 0
        ? sessionMsgCounts.reduce((sum, s) => sum + (s.message_count || 0), 0) / sessionMsgCounts.length
        : 0;

      // 공유된 채팅 수
      const { count: sharedChats } = await supabaseAdmin
        .from('shared_chats')
        .select('*', { count: 'exact', head: true });

      return new Response(
        JSON.stringify({
          toolDistribution: Array.from(toolCounts.entries()).map(([type, count]) => ({
            tool_type: type,
            count,
            percentage: Math.round((count / (toolSessions?.length || 1)) * 100),
          })),
          imageAttachmentRate: totalMsgs ? Math.round(((imageMsgs || 0) / totalMsgs) * 100) : 0,
          avgMessagesPerSession: Math.round(avgMessagesPerSession * 10) / 10,
          totalSharedChats: sharedChats || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== ACTION: shared-chats (공유된 채팅 목록) =====
    if (action === 'shared-chats') {
      const startDate = new Date(Date.now() - days * 86400000).toISOString();

      // 공유된 채팅 목록 조회
      const { data: sharedChats } = await supabaseAdmin
        .from('shared_chats')
        .select('id, share_id, title, messages, view_count, created_at, user_id')
        .eq('is_public', true)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false })
        .limit(limit);

      // 사용자 정보 조회
      const userIds = [...new Set(sharedChats?.map(c => c.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length > 0
        ? await supabaseAdmin
            .from('profiles')
            .select('user_id, display_name, email')
            .in('user_id', userIds)
        : { data: [] };

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const result = sharedChats?.map(chat => ({
        id: chat.id,
        share_id: chat.share_id,
        title: chat.title,
        message_count: Array.isArray(chat.messages) ? chat.messages.length : 0,
        view_count: chat.view_count || 0,
        created_at: chat.created_at,
        user_email: profileMap.get(chat.user_id)?.email || null,
        user_name: profileMap.get(chat.user_id)?.display_name || null,
      })) || [];

      return new Response(
        JSON.stringify({ sharedChats: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== 기본 응답 =====
    return new Response(
      JSON.stringify({
        error: 'Unknown action',
        availableActions: [
          'stats',
          'keywords',
          'daily-usage',
          'tool-usage',
          'model-stats',
          'top-users',
          'popular-prompts',
          'shared-chats',
          'chat-analytics'
        ]
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
