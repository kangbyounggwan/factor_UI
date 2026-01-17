/**
 * AI Troubleshooting 서비스
 * 세션 및 메시지 CRUD + 컨텍스트 윈도우 관리
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  TroubleshootingSession,
  TroubleshootingMessage,
  CreateSessionInput,
  CreateMessageInput,
  ListSessionsOptions,
  SessionWithMessages,
  ContextWindow,
  ContextOptions,
  SessionStatus,
} from '../../types/troubleshootingTypes';

// =====================================================
// 세션 CRUD
// =====================================================

/**
 * 새 세션 생성
 */
export async function createSession(
  supabase: SupabaseClient,
  userId: string,
  input: CreateSessionInput
): Promise<TroubleshootingSession> {
  const { data, error } = await supabase
    .from('troubleshooting_sessions')
    .insert({
      user_id: userId,
      title: input.title || null,
      printer_manufacturer: input.printer_manufacturer || null,
      printer_series: input.printer_series || null,
      printer_model_id: input.printer_model_id || null,
      printer_model_name: input.printer_model_name || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[Troubleshooting] Failed to create session:', error);
    throw error;
  }

  return data;
}

/**
 * 세션 조회
 */
export async function getSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<TroubleshootingSession | null> {
  const { data, error } = await supabase
    .from('troubleshooting_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('[Troubleshooting] Failed to get session:', error);
    throw error;
  }

  return data;
}

/**
 * 세션 목록 조회
 */
export async function listSessions(
  supabase: SupabaseClient,
  userId: string,
  options: ListSessionsOptions = {}
): Promise<TroubleshootingSession[]> {
  const { status, limit = 50, offset = 0 } = options;

  let query = supabase
    .from('troubleshooting_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Troubleshooting] Failed to list sessions:', error);
    throw error;
  }

  return data || [];
}

/**
 * 세션 업데이트
 */
export async function updateSession(
  supabase: SupabaseClient,
  sessionId: string,
  updates: Partial<Pick<TroubleshootingSession,
    'title' | 'status' | 'resolved_issue' | 'summary' |
    'printer_manufacturer' | 'printer_series' | 'printer_model_id' | 'printer_model_name'
  >>
): Promise<TroubleshootingSession> {
  const updateData: Record<string, unknown> = { ...updates };

  // summary 업데이트 시 timestamp도 함께
  if (updates.summary !== undefined) {
    updateData.summary_updated_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('troubleshooting_sessions')
    .update(updateData)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    console.error('[Troubleshooting] Failed to update session:', error);
    throw error;
  }

  return data;
}

/**
 * 세션 삭제
 */
export async function deleteSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  const { error } = await supabase
    .from('troubleshooting_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    console.error('[Troubleshooting] Failed to delete session:', error);
    throw error;
  }
}

// =====================================================
// 메시지 CRUD
// =====================================================

/**
 * 메시지 추가
 */
export async function addMessage(
  supabase: SupabaseClient,
  input: CreateMessageInput
): Promise<TroubleshootingMessage> {
  const { data, error } = await supabase
    .from('troubleshooting_messages')
    .insert({
      session_id: input.session_id,
      role: input.role,
      content: input.content,
      token_count: input.token_count || estimateTokens(input.content),
      has_images: input.has_images || false,
      image_urls: input.image_urls || null,
      image_analysis: input.image_analysis || null,
      importance_score: input.importance_score || 0.5,
      is_key_message: input.is_key_message || false,
      metadata: input.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('[Troubleshooting] Failed to add message:', error);
    throw error;
  }

  return data;
}

/**
 * 세션의 모든 메시지 조회
 */
export async function getMessages(
  supabase: SupabaseClient,
  sessionId: string
): Promise<TroubleshootingMessage[]> {
  const { data, error } = await supabase
    .from('troubleshooting_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Troubleshooting] Failed to get messages:', error);
    throw error;
  }

  return data || [];
}

/**
 * 세션 + 메시지 함께 조회
 */
export async function getSessionWithMessages(
  supabase: SupabaseClient,
  sessionId: string
): Promise<SessionWithMessages | null> {
  const session = await getSession(supabase, sessionId);
  if (!session) return null;

  const messages = await getMessages(supabase, sessionId);

  return {
    ...session,
    messages,
  };
}

/**
 * 메시지 중요도 업데이트
 */
export async function updateMessageImportance(
  supabase: SupabaseClient,
  messageId: string,
  importanceScore: number,
  isKeyMessage: boolean
): Promise<void> {
  const { error } = await supabase
    .from('troubleshooting_messages')
    .update({
      importance_score: Math.max(0, Math.min(1, importanceScore)),
      is_key_message: isKeyMessage,
    })
    .eq('id', messageId);

  if (error) {
    console.error('[Troubleshooting] Failed to update message importance:', error);
    throw error;
  }
}

// =====================================================
// 컨텍스트 윈도우 관리
// =====================================================

/**
 * 컨텍스트 메시지 가져오기 (DB 함수 사용)
 */
export async function getContextMessages(
  supabase: SupabaseClient,
  sessionId: string,
  recentCount: number = 10,
  maxTokens: number = 4000
): Promise<TroubleshootingMessage[]> {
  const { data, error } = await supabase
    .rpc('get_context_messages', {
      p_session_id: sessionId,
      p_recent_count: recentCount,
      p_max_tokens: maxTokens,
    });

  if (error) {
    console.error('[Troubleshooting] Failed to get context messages:', error);
    // Fallback: 직접 최근 메시지만 가져오기
    return getMessages(supabase, sessionId).then(msgs =>
      msgs.slice(-recentCount)
    );
  }

  return data || [];
}

/**
 * 컨텍스트 윈도우 구성
 */
export async function buildContextWindow(
  supabase: SupabaseClient,
  sessionId: string,
  currentInput: string,
  currentImages: string[] = [],
  options: ContextOptions = {}
): Promise<ContextWindow> {
  const {
    maxTokens = 4000,
    recentMessageCount = 10,
    includeImages = true,
    includeSummary = true,
  } = options;

  // 세션 정보 가져오기
  const session = await getSession(supabase, sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // 컨텍스트 메시지 가져오기
  const contextMessages = await getContextMessages(
    supabase,
    sessionId,
    recentMessageCount,
    maxTokens
  );

  // 최근 메시지와 핵심 메시지 분리
  const recentMessages = contextMessages.filter(m => !m.is_key_message);
  const keyMessages = contextMessages.filter(m => m.is_key_message);

  // 프린터 컨텍스트 구성
  let printerContext: string | null = null;
  if (session.printer_manufacturer || session.printer_model_name) {
    printerContext = `프린터 정보: ${[
      session.printer_manufacturer,
      session.printer_series,
      session.printer_model_name,
    ].filter(Boolean).join(' ')}`;
  }

  // 시스템 프롬프트
  const systemPrompt = buildSystemPrompt(printerContext);

  // 토큰 추정
  let estimatedTokens = estimateTokens(systemPrompt);
  if (includeSummary && session.summary) {
    estimatedTokens += estimateTokens(session.summary);
  }
  estimatedTokens += contextMessages.reduce((sum, m) => sum + (m.token_count || 0), 0);
  estimatedTokens += estimateTokens(currentInput);

  return {
    systemPrompt,
    printerContext,
    sessionSummary: includeSummary ? session.summary : null,
    recentMessages,
    keyMessages,
    currentInput,
    currentImages: includeImages ? currentImages : undefined,
    estimatedTokens,
  };
}

// =====================================================
// 유틸리티 함수
// =====================================================

/**
 * 토큰 수 추정 (간단한 근사)
 * 실제로는 tiktoken 등 사용 권장
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // 한국어는 글자당 약 2-3 토큰, 영어는 단어당 약 1.3 토큰
  // 간단히 4글자당 1토큰으로 계산
  return Math.ceil(text.length / 4);
}

/**
 * 시스템 프롬프트 생성
 */
function buildSystemPrompt(printerContext: string | null): string {
  let prompt = `당신은 3D 프린터 전문 AI 어시스턴트입니다.
사용자의 프린터 문제를 분석하고 해결 방법을 제시합니다.

역할:
1. 업로드된 이미지를 분석하여 문제점을 파악합니다
2. 문제의 원인을 진단합니다
3. 단계별 해결 방법을 제시합니다
4. 추가 질문이 있으면 명확히 답변합니다

응답 형식:
- 문제가 감지되면 **감지된 문제**, **가능한 원인**, **해결 방안** 섹션으로 나눠 답변
- 간결하고 명확하게 답변
- 전문 용어는 쉽게 설명`;

  if (printerContext) {
    prompt += `\n\n${printerContext}`;
  }

  return prompt;
}

/**
 * 메시지를 LLM API 형식으로 변환
 */
export function formatMessagesForLLM(
  contextWindow: ContextWindow
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  // 1. 시스템 프롬프트
  messages.push({
    role: 'system',
    content: contextWindow.systemPrompt,
  });

  // 2. 세션 요약 (있으면)
  if (contextWindow.sessionSummary) {
    messages.push({
      role: 'system',
      content: `[이전 대화 요약]\n${contextWindow.sessionSummary}`,
    });
  }

  // 3. 핵심 메시지들 (있으면)
  if (contextWindow.keyMessages.length > 0) {
    const keyContent = contextWindow.keyMessages
      .map(m => `[${m.role}] ${m.content}`)
      .join('\n');
    messages.push({
      role: 'system',
      content: `[핵심 정보]\n${keyContent}`,
    });
  }

  // 4. 최근 대화
  for (const msg of contextWindow.recentMessages) {
    let content = msg.content;

    // 이미지 분석 결과 포함
    if (msg.has_images && msg.image_analysis) {
      content = `[이미지 분석: ${msg.image_analysis}]\n${content}`;
    }

    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content,
    });
  }

  // 5. 현재 입력
  messages.push({
    role: 'user',
    content: contextWindow.currentInput,
  });

  return messages;
}

// generateSessionTitle 함수는 utils/string.ts로 이동됨
// 하위 호환성을 위해 re-export
export { generateSessionTitle } from '../../utils/string';
