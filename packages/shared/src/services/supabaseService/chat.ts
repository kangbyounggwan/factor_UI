/**
 * AI 채팅 세션 및 메시지 관리 서비스
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// 도구 타입 정의
export type ChatToolType = 'general' | 'troubleshoot' | 'gcode' | 'modeling' | 'resolve_issue' | 'price_comparison';

// 파일 정보 타입
export interface ChatFileInfo {
  name: string;
  type: string;
  size?: number;
}

// 메시지 메타데이터 타입
export interface ChatMessageMetadata {
  tool?: ChatToolType;
  detected_issues?: string[];
  possible_causes?: string[];
  solutions?: string[];
  image_analysis?: string;
  gcode_stats?: {
    estimated_time?: string;
    filament_used?: string;
    layer_count?: number;
  };
  model_info?: {
    prompt?: string;
    model_url?: string;
  };
  // G-code 분석 보고서 카드 정보
  reportCard?: {
    reportId: string;
    fileName: string;
    overallScore?: number;
    overallGrade?: string;
    totalIssues?: number;
    layerCount?: number;
    printTime?: string;
  };
  [key: string]: unknown;
}

// 타입 정의
export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  tool_type: ChatToolType;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  message_count: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  type: 'user' | 'assistant';
  content: string;
  images?: string[];
  files?: ChatFileInfo[];
  metadata?: ChatMessageMetadata;
  reportId?: string; // G-code 분석 보고서 ID
  created_at: string;
}

// ============================================
// 세션 관리
// ============================================

/**
 * 새 채팅 세션 생성
 */
export async function createChatSession(
  userId: string,
  title: string = '새 대화',
  toolType: ChatToolType = 'general'
): Promise<ChatSession | null> {
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        title,
        tool_type: toolType,
        message_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('[chat] Error creating session:', error);
      return null;
    }

    return data as ChatSession;
  } catch (error) {
    console.error('[chat] Error creating session:', error);
    return null;
  }
}

/**
 * 세션 도구 타입 업데이트
 */
export async function updateChatSessionToolType(
  sessionId: string,
  toolType: ChatToolType
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ tool_type: toolType, updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) {
      console.error('[chat] Error updating session tool type:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[chat] Error updating session tool type:', error);
    return false;
  }
}

/**
 * 사용자의 모든 채팅 세션 조회
 */
export async function getChatSessions(
  userId: string,
  limit = 50
): Promise<ChatSession[]> {
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[chat] Error fetching sessions:', error);
      return [];
    }

    return data as ChatSession[];
  } catch (error) {
    console.error('[chat] Error fetching sessions:', error);
    return [];
  }
}

/**
 * 단일 세션 조회
 */
export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('[chat] Error fetching session:', error);
      return null;
    }

    return data as ChatSession;
  } catch (error) {
    console.error('[chat] Error fetching session:', error);
    return null;
  }
}

/**
 * 세션 제목 업데이트
 */
export async function updateChatSessionTitle(
  sessionId: string,
  title: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) {
      console.error('[chat] Error updating session title:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[chat] Error updating session title:', error);
    return false;
  }
}

/**
 * 세션 메타데이터 업데이트 (G-code 분석 결과 등)
 */
export async function updateChatSessionMetadata(
  sessionId: string,
  metadata: Record<string, unknown>
): Promise<boolean> {
  try {
    // 기존 메타데이터 조회
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('metadata')
      .eq('id', sessionId)
      .single();

    // 기존 메타데이터와 병합
    const mergedMetadata = {
      ...(session?.metadata || {}),
      ...metadata,
    };

    const { error } = await supabase
      .from('chat_sessions')
      .update({
        metadata: mergedMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) {
      console.error('[chat] Error updating session metadata:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[chat] Error updating session metadata:', error);
    return false;
  }
}

/**
 * 세션 삭제 (연관된 메시지도 함께 삭제됨 - CASCADE)
 */
export async function deleteChatSession(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.error('[chat] Error deleting session:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[chat] Error deleting session:', error);
    return false;
  }
}

// ============================================
// 메시지 관리
// ============================================

/**
 * 메시지 저장 옵션
 */
export interface SaveMessageOptions {
  images?: string[];
  files?: ChatFileInfo[];
  metadata?: ChatMessageMetadata;
  reportId?: string; // G-code 분석 보고서 ID
}

/**
 * 메시지 저장
 */
export async function saveChatMessage(
  sessionId: string,
  userId: string,
  type: 'user' | 'assistant',
  content: string,
  options?: SaveMessageOptions
): Promise<ChatMessage | null> {
  try {
    // 메시지 저장
    const { data: message, error: msgError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        user_id: userId,
        type,
        content,
        images: options?.images || null,
        files: options?.files || null,
        metadata: options?.metadata || {},
        reportId: options?.reportId || null,
      })
      .select()
      .single();

    if (msgError) {
      console.error('[chat] Error saving message:', msgError);
      return null;
    }

    // 세션 업데이트 (last_message_at, message_count)
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('message_count')
      .eq('id', sessionId)
      .single();

    await supabase
      .from('chat_sessions')
      .update({
        message_count: (session?.message_count || 0) + 1,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return message as ChatMessage;
  } catch (error) {
    console.error('[chat] Error saving message:', error);
    return null;
  }
}

/**
 * 여러 메시지 한번에 저장 (세션 복원 시 사용)
 */
export async function saveChatMessages(
  sessionId: string,
  userId: string,
  messages: Array<{ type: 'user' | 'assistant'; content: string }>
): Promise<boolean> {
  try {
    const messagesToInsert = messages.map(msg => ({
      session_id: sessionId,
      user_id: userId,
      type: msg.type,
      content: msg.content,
    }));

    const { error } = await supabase
      .from('chat_messages')
      .insert(messagesToInsert);

    if (error) {
      console.error('[chat] Error saving messages:', error);
      return false;
    }

    // 세션 메시지 카운트 업데이트
    await supabase
      .from('chat_sessions')
      .update({
        message_count: messages.length,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return true;
  } catch (error) {
    console.error('[chat] Error saving messages:', error);
    return false;
  }
}

/**
 * 세션의 모든 메시지 조회
 */
export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  try {
    console.log('[chat] Fetching messages for session:', sessionId);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    console.log('[chat] Supabase response - data:', data, 'error:', error);

    if (error) {
      console.error('[chat] Error fetching messages:', error);
      return [];
    }

    return data as ChatMessage[];
  } catch (error) {
    console.error('[chat] Error fetching messages:', error);
    return [];
  }
}

/**
 * 세션 메시지 전체 삭제 (세션은 유지)
 */
export async function clearChatMessages(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      console.error('[chat] Error clearing messages:', error);
      return false;
    }

    // 세션 메시지 카운트 초기화
    await supabase
      .from('chat_sessions')
      .update({
        message_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return true;
  } catch (error) {
    console.error('[chat] Error clearing messages:', error);
    return false;
  }
}

/**
 * 메시지의 reportId 업데이트
 */
export async function updateMessageReportId(
  messageId: string,
  reportId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .update({ reportId })
      .eq('id', messageId);

    if (error) {
      console.error('[chat] Error updating message reportId:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[chat] Error updating message reportId:', error);
    return false;
  }
}

// ============================================
// 유틸리티
// ============================================

/**
 * 첫 번째 메시지로 세션 제목 자동 생성
 * (첫 30자 + "..." 형태)
 */
export function generateSessionTitle(firstMessage: string): string {
  const cleaned = firstMessage.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 30) {
    return cleaned;
  }
  return cleaned.substring(0, 30) + '...';
}

/**
 * 세션과 메시지를 함께 조회
 */
export async function getChatSessionWithMessages(
  sessionId: string
): Promise<{ session: ChatSession; messages: ChatMessage[] } | null> {
  try {
    const [session, messages] = await Promise.all([
      getChatSession(sessionId),
      getChatMessages(sessionId),
    ]);

    if (!session) {
      return null;
    }

    return { session, messages };
  } catch (error) {
    console.error('[chat] Error fetching session with messages:', error);
    return null;
  }
}
