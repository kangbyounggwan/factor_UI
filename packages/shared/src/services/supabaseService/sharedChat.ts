/**
 * 공유 채팅 서비스
 */
import { supabase } from '../../integrations/supabase/client';

// 공유 메시지 타입
export interface SharedMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  images?: string[];
  files?: { name: string; type: string }[];
}

// 공유 채팅 타입
export interface SharedChat {
  id: string;
  share_id: string;
  user_id: string | null;
  title: string | null;
  messages: SharedMessage[];
  created_at: string;
  expires_at: string | null;
  view_count: number;
  is_public: boolean;
}

// 짧은 공유 ID 생성 (8자)
function generateShareId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 선택한 메시지들로 공유 링크 생성
 */
export async function createSharedChat(
  messages: SharedMessage[],
  options?: {
    userId?: string;
    title?: string;
    expiresInDays?: number;
  }
): Promise<{ shareId: string; shareUrl: string } | null> {
  try {
    const shareId = generateShareId();
    const expiresAt = options?.expiresInDays
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error } = await supabase
      .from('shared_chats')
      .insert({
        share_id: shareId,
        user_id: options?.userId || null,
        title: options?.title || null,
        messages: messages,
        expires_at: expiresAt,
        is_public: true,
      })
      .select('share_id')
      .single();

    if (error) {
      console.error('[sharedChat] Error creating shared chat:', error);
      return null;
    }

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return {
      shareId: data.share_id,
      shareUrl: `${baseUrl}/share/${data.share_id}`,
    };
  } catch (error) {
    console.error('[sharedChat] Error creating shared chat:', error);
    return null;
  }
}

/**
 * 공유 ID로 채팅 조회
 */
export async function getSharedChat(shareId: string): Promise<SharedChat | null> {
  try {
    const { data, error } = await supabase
      .from('shared_chats')
      .select('*')
      .eq('share_id', shareId)
      .eq('is_public', true)
      .single();

    if (error) {
      console.error('[sharedChat] Error fetching shared chat:', error);
      return null;
    }

    // 만료 체크
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null;
    }

    // 조회수 증가
    await supabase.rpc('increment_share_view_count', { p_share_id: shareId });

    return data as SharedChat;
  } catch (error) {
    console.error('[sharedChat] Error fetching shared chat:', error);
    return null;
  }
}

/**
 * 사용자의 공유 채팅 목록 조회
 */
export async function getUserSharedChats(userId: string): Promise<SharedChat[]> {
  try {
    const { data, error } = await supabase
      .from('shared_chats')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[sharedChat] Error fetching user shared chats:', error);
      return [];
    }

    return data as SharedChat[];
  } catch (error) {
    console.error('[sharedChat] Error fetching user shared chats:', error);
    return [];
  }
}

/**
 * 공유 채팅 삭제
 */
export async function deleteSharedChat(shareId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('shared_chats')
      .delete()
      .eq('share_id', shareId)
      .eq('user_id', userId);

    if (error) {
      console.error('[sharedChat] Error deleting shared chat:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[sharedChat] Error deleting shared chat:', error);
    return false;
  }
}
