/**
 * 채팅 메시지 저장 훅
 * - DB 저장 (로그인 사용자)
 * - localStorage 저장 (비로그인 사용자)
 */

import { useCallback } from "react";
import {
  saveChatMessage,
  type ChatToolType,
  type ChatFileInfo,
  type ChatMessageMetadata,
} from "@shared/services/supabaseService/chat";
import {
  saveAnonChat,
  loadAnonChat,
  clearAnonChat,
  type AnonChatMessage,
} from "@shared/utils/anonymousId";
import type { Message } from "./useChatUtils";

interface UseChatPersistenceOptions {
  userId?: string;
}

interface SaveUserMessageParams {
  sessionId: string;
  content: string;
  images?: string[];
  files?: ChatFileInfo[];
  toolType: ChatToolType;
}

interface SaveAssistantMessageParams {
  sessionId: string;
  content: string;
  metadata?: ChatMessageMetadata;
}

interface UseChatPersistenceReturn {
  // DB 저장 (로그인 사용자)
  saveUserMessageToDB: (params: SaveUserMessageParams) => Promise<string | null>;
  saveAssistantMessageToDB: (params: SaveAssistantMessageParams) => Promise<string | null>;

  // localStorage 저장 (비로그인 사용자)
  saveToLocalStorage: (messages: Message[], userContent: string, assistantContent: string) => void;
  loadFromLocalStorage: () => AnonChatMessage[];
  clearLocalStorage: () => void;
}

export const useChatPersistence = ({
  userId,
}: UseChatPersistenceOptions): UseChatPersistenceReturn => {
  /**
   * 사용자 메시지 DB 저장
   */
  const saveUserMessageToDB = useCallback(
    async (params: SaveUserMessageParams): Promise<string | null> => {
      if (!userId) return null;

      try {
        const savedMsg = await saveChatMessage(
          params.sessionId,
          userId,
          "user",
          params.content,
          {
            images: params.images,
            files: params.files,
            metadata: { tool: params.toolType },
          }
        );
        return savedMsg?.id || null;
      } catch (error) {
        console.error("[useChatPersistence] Failed to save user message:", error);
        return null;
      }
    },
    [userId]
  );

  /**
   * AI 응답 메시지 DB 저장
   */
  const saveAssistantMessageToDB = useCallback(
    async (params: SaveAssistantMessageParams): Promise<string | null> => {
      if (!userId) return null;

      try {
        const savedMsg = await saveChatMessage(
          params.sessionId,
          userId,
          "assistant",
          params.content,
          {
            metadata: params.metadata,
          }
        );
        return savedMsg?.id || null;
      } catch (error) {
        console.error("[useChatPersistence] Failed to save assistant message:", error);
        return null;
      }
    },
    [userId]
  );

  /**
   * 비로그인 사용자용 localStorage 저장
   */
  const saveToLocalStorage = useCallback(
    (messages: Message[], userContent: string, assistantContent: string) => {
      if (userId) return; // 로그인 사용자는 DB 사용

      const now = Date.now();
      const updatedMessages: AnonChatMessage[] = [
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.getTime(),
        })),
        { role: "user" as const, content: userContent, timestamp: now },
        { role: "assistant" as const, content: assistantContent, timestamp: now + 1 },
      ];
      saveAnonChat(updatedMessages);
    },
    [userId]
  );

  /**
   * localStorage에서 로드
   */
  const loadFromLocalStorage = useCallback((): AnonChatMessage[] => {
    return loadAnonChat();
  }, []);

  /**
   * localStorage 초기화
   */
  const clearLocalStorage = useCallback(() => {
    clearAnonChat();
  }, []);

  return {
    saveUserMessageToDB,
    saveAssistantMessageToDB,
    saveToLocalStorage,
    loadFromLocalStorage,
    clearLocalStorage,
  };
};

export default useChatPersistence;
