import { supabase } from "@shared/integrations/supabase/client";

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  message_count: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  type: 'user' | 'ai';
  content: string;
  created_at: string;
}

// 채팅 세션 관련 함수들
export const chatService = {
  // 사용자의 모든 채팅 세션 가져오기
  async getUserChatSessions(): Promise<ChatSession[]> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('last_message_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching chat sessions:', error);
      throw error;
    }
    
    return data || [];
  },

  // 새 채팅 세션 생성
  async createChatSession(title: string): Promise<ChatSession> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert([
        {
          user_id: user.id,
          title: title || '새 채팅',
          message_count: 0
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating chat session:', error);
      throw error;
    }
    
    return data;
  },

  // 채팅 세션 제목 업데이트
  async updateChatSessionTitle(sessionId: string, title: string): Promise<void> {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ title })
      .eq('id', sessionId);
    
    if (error) {
      console.error('Error updating chat session title:', error);
      throw error;
    }
  },

  // 채팅 세션 삭제
  async deleteChatSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);
    
    if (error) {
      console.error('Error deleting chat session:', error);
      throw error;
    }
  },

  // 특정 세션의 메시지들 가져오기
  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching chat messages:', error);
      throw error;
    }
    
    return (data || []).map(msg => ({
      ...msg,
      type: msg.type as 'user' | 'ai'
    }));
  },

  // 새 메시지 추가
  async addChatMessage(
    sessionId: string, 
    type: 'user' | 'ai', 
    content: string
  ): Promise<ChatMessage> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert([
        {
          session_id: sessionId,
          user_id: user.id,
          type,
          content
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.error('Error adding chat message:', error);
      throw error;
    }
    
    return {
      ...data,
      type: data.type as 'user' | 'ai'
    };
  },

  // 첫 번째 사용자 메시지를 기반으로 세션 제목 자동 생성
  generateSessionTitle(firstMessage: string): string {
    // 첫 번째 메시지에서 의미있는 제목 추출
    const cleanMessage = firstMessage.trim();
    
    if (cleanMessage.length <= 30) {
      return cleanMessage;
    }
    
    // 30자까지 자르고 마지막 완전한 단어까지만 포함
    const truncated = cleanMessage.substring(0, 30);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > 15) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }
    
    return truncated + '...';
  }
};