/**
 * 채팅 세션 관리 훅
 * - 세션 생성/로드/삭제
 * - 세션 제목 업데이트
 */

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  getChatSessions,
  createChatSession,
  deleteChatSession as deleteDBSession,
  updateChatSessionTitle,
  updateChatSessionToolType,
  type ChatToolType,
} from "@shared/services/supabaseService/chat";
import { generateChatTitle } from "@shared/services/geminiService";
import type { ChatSession } from "@/components/common/AppSidebar";

interface UseChatSessionOptions {
  userId?: string;
}

interface UseChatSessionReturn {
  // 상태
  sessions: ChatSession[];
  currentSessionId: string | null;
  isLoadingSessions: boolean;

  // 액션
  loadSessions: () => Promise<void>;
  ensureSession: (toolType: ChatToolType) => Promise<string | null>;
  updateToolType: (sessionId: string, toolType: ChatToolType) => Promise<void>;
  generateAndUpdateTitle: (sessionId: string, firstMessage: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  setCurrentSessionId: (id: string | null) => void;
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
}

export const useChatSession = ({ userId }: UseChatSessionOptions): UseChatSessionReturn => {
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
        }))
      );
    } catch (error) {
      console.error("[useChatSession] Failed to load sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [userId]);

  /**
   * 세션 확보 (없으면 생성)
   */
  const ensureSession = useCallback(
    async (toolType: ChatToolType): Promise<string | null> => {
      if (!userId) return null;

      // 이미 세션이 있으면 반환
      if (currentSessionId) return currentSessionId;

      // 새 세션 생성
      const tempTitle = t("aiChat.newChat", "새 대화");
      const newSession = await createChatSession(userId, tempTitle, toolType);

      if (newSession) {
        setCurrentSessionId(newSession.id);
        setSessions((prev) => [
          {
            id: newSession.id,
            title: newSession.title,
            timestamp: new Date(newSession.created_at),
            messages: [],
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
   * 도구 타입 업데이트
   */
  const updateToolType = useCallback(
    async (sessionId: string, toolType: ChatToolType) => {
      await updateChatSessionToolType(sessionId, toolType);
    },
    []
  );

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
        console.error("[useChatSession] Failed to generate title:", error);
      }
    },
    [userId]
  );

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
        console.error("[useChatSession] Failed to delete session:", error);
      }
    },
    [userId, currentSessionId]
  );

  return {
    sessions,
    currentSessionId,
    isLoadingSessions,
    loadSessions,
    ensureSession,
    updateToolType,
    generateAndUpdateTitle,
    deleteSession,
    setCurrentSessionId,
    setSessions,
  };
};

export default useChatSession;
