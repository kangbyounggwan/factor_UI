/**
 * 채팅 세션 관리 훅
 *
 * 책임:
 * - 세션 생성/로드/삭제
 * - 세션 제목 업데이트
 * - 현재 세션 관리
 *
 * 기존 useChatSession 기반으로 리팩토링
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getChatSessions,
  createChatSession,
  deleteChatSession as deleteDBSession,
  updateChatSessionTitle,
  updateChatSessionToolType,
  type ChatToolType,
} from '@shared/services/supabaseService/chat';
import { generateChatTitle } from '@shared/services/geminiService';
import type { ChatSession, ChatTool } from '../types';

export interface UseChatSessionsOptions {
  userId?: string;
}

export interface UseChatSessionsReturn {
  // 상태
  sessions: ChatSession[];
  currentSessionId: string | null;
  isLoadingSessions: boolean;

  // 세션 로드
  loadSessions: () => Promise<void>;

  // 세션 생성/확보
  ensureSession: (toolType: ChatTool) => Promise<string | null>;
  createNewSession: (toolType?: ChatTool) => Promise<string | null>;

  // 세션 업데이트
  updateToolType: (sessionId: string, toolType: ChatTool) => Promise<void>;
  generateAndUpdateTitle: (sessionId: string, firstMessage: string) => Promise<void>;
  updateSessionTitle: (sessionId: string, title: string) => void;
  addSession: (session: ChatSession) => void;

  // 세션 삭제
  deleteSession: (sessionId: string) => Promise<void>;

  // 상태 설정
  setCurrentSessionId: (id: string | null) => void;
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;

  // 유틸리티
  getCurrentSession: () => ChatSession | undefined;
  clearCurrentSession: () => void;
}

/**
 * 채팅 세션 관리 훅
 */
export function useChatSessions({ userId }: UseChatSessionsOptions = {}): UseChatSessionsReturn {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  /**
   * 세션 목록 로드
   */
  const loadSessions = useCallback(async () => {
    if (!userId) return;

    setIsLoadingSessions(true);
    try {
      const dbSessions = await getChatSessions(userId);
      setSessions(
        dbSessions.map((s) => ({
          id: s.id,
          title: s.title,
          timestamp: new Date(s.created_at),
          messages: [],
          toolType: s.tool_type as ChatTool | undefined,
        }))
      );
    } catch (error) {
      console.error('[useChatSessions] Failed to load sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [userId]);

  /**
   * 세션 확보 (없으면 생성)
   */
  const ensureSession = useCallback(
    async (toolType: ChatTool): Promise<string | null> => {
      if (!userId) return null;

      // 이미 세션이 있으면 반환
      if (currentSessionId) return currentSessionId;

      // 새 세션 생성
      const tempTitle = t('aiChat.newChat', '새 대화');
      const newSession = await createChatSession(userId, tempTitle, toolType as ChatToolType);

      if (newSession) {
        setCurrentSessionId(newSession.id);
        setSessions((prev) => [
          {
            id: newSession.id,
            title: newSession.title,
            timestamp: new Date(newSession.created_at),
            messages: [],
            toolType,
          },
          ...prev,
        ]);
        return newSession.id;
      }

      return null;
    },
    [userId, currentSessionId, t]
  );

  /**
   * 새 세션 생성 (강제)
   */
  const createNewSession = useCallback(
    async (toolType: ChatTool = 'general'): Promise<string | null> => {
      if (!userId) return null;

      const tempTitle = t('aiChat.newChat', '새 대화');
      const newSession = await createChatSession(userId, tempTitle, toolType as ChatToolType);

      if (newSession) {
        const session: ChatSession = {
          id: newSession.id,
          title: newSession.title,
          timestamp: new Date(newSession.created_at),
          messages: [],
          toolType,
        };

        setSessions((prev) => [session, ...prev]);
        setCurrentSessionId(newSession.id);
        return newSession.id;
      }

      return null;
    },
    [userId, t]
  );

  /**
   * 도구 타입 업데이트
   */
  const updateToolType = useCallback(async (sessionId: string, toolType: ChatTool) => {
    await updateChatSessionToolType(sessionId, toolType as ChatToolType);
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, toolType } : s))
    );
  }, []);

  /**
   * AI로 제목 생성 및 업데이트
   */
  const generateAndUpdateTitle = useCallback(
    async (sessionId: string, firstMessage: string) => {
      if (!userId) return;

      try {
        const title = await generateChatTitle(firstMessage);
        await updateChatSessionTitle(sessionId, title);
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
        );
      } catch (error) {
        console.error('[useChatSessions] Failed to generate title:', error);
      }
    },
    [userId]
  );

  /**
   * 세션 제목 업데이트 (로컬 상태만)
   */
  const updateSessionTitle = useCallback((sessionId: string, title: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
    );
  }, []);

  /**
   * 세션 추가 (로컬 상태)
   */
  const addSession = useCallback((session: ChatSession) => {
    setSessions((prev) => [session, ...prev]);
  }, []);

  /**
   * 세션 삭제
   */
  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (!userId) return;

      try {
        await deleteDBSession(sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));

        // 현재 세션이 삭제되면 초기화
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
        }
      } catch (error) {
        console.error('[useChatSessions] Failed to delete session:', error);
      }
    },
    [userId, currentSessionId]
  );

  /**
   * 현재 세션 가져오기
   */
  const getCurrentSession = useCallback((): ChatSession | undefined => {
    if (!currentSessionId) return undefined;
    return sessions.find((s) => s.id === currentSessionId);
  }, [sessions, currentSessionId]);

  /**
   * 현재 세션 초기화
   */
  const clearCurrentSession = useCallback(() => {
    setCurrentSessionId(null);
  }, []);

  return {
    sessions,
    currentSessionId,
    isLoadingSessions,
    loadSessions,
    ensureSession,
    createNewSession,
    updateToolType,
    generateAndUpdateTitle,
    updateSessionTitle,
    addSession,
    deleteSession,
    setCurrentSessionId,
    setSessions,
    getCurrentSession,
    clearCurrentSession,
  };
}

export default useChatSessions;
