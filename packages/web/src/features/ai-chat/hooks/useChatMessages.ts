/**
 * 채팅 메시지 상태 관리 훅
 *
 * 책임:
 * - 메시지 배열 상태 관리
 * - 메시지 추가/수정/삭제
 * - 세션 메시지 로드
 * - 스트리밍 메시지 업데이트
 */

import { useState, useCallback, useRef } from 'react';
import type { Message, ReportCardData, CodeFix, ReferenceInfo, SuggestedAction } from '../types';
import type { ReferenceImages, PriceComparisonData } from '@shared/services/chatApiService';

export interface UseChatMessagesOptions {
  initialMessages?: Message[];
}

export interface UseChatMessagesReturn {
  // 상태
  messages: Message[];
  isStreaming: boolean;

  // 메시지 추가
  addMessage: (message: Message) => void;

  addUserMessage: (content: string, options?: {
    images?: string[];
    files?: { name: string; type: string }[];
  }) => Message;

  addAssistantMessage: (content: string, options?: {
    references?: ReferenceInfo[];
    referenceImages?: ReferenceImages;
    suggestedActions?: SuggestedAction[];
    priceComparisonData?: PriceComparisonData;
    reportCard?: ReportCardData;
    codeFixes?: CodeFix[];
    analysisReportId?: string;
    gcodeContext?: string;
  }) => Message;

  // 메시지 업데이트
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  updateLastAssistantMessage: (updates: Partial<Message>) => void;

  // 스트리밍 지원
  startStreaming: () => string;
  appendToStream: (messageId: string, chunk: string) => void;
  finishStreaming: (messageId: string, finalContent?: string) => void;

  // 리포트 카드 업데이트
  updateMessageReportCard: (messageId: string, reportCard: ReportCardData) => void;

  // DB 연동
  setMessageDbId: (messageId: string, dbMessageId: string) => void;

  // 세션 메시지 로드
  loadSessionMessages: (messages: Message[]) => void;

  // 초기화
  clearMessages: () => void;

  // 마지막 메시지 참조
  lastMessageRef: React.RefObject<Message | null>;
}

/**
 * 메시지 ID 생성
 */
const generateMessageId = (role: 'user' | 'assistant'): string => {
  return `${role}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * 채팅 메시지 관리 훅
 */
export function useChatMessages(options: UseChatMessagesOptions = {}): UseChatMessagesReturn {
  const { initialMessages = [] } = options;

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const lastMessageRef = useRef<Message | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

  /**
   * 메시지 직접 추가 (이미 생성된 Message 객체)
   */
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
    lastMessageRef.current = message;
  }, []);

  /**
   * 사용자 메시지 추가
   */
  const addUserMessage = useCallback((
    content: string,
    options?: {
      images?: string[];
      files?: { name: string; type: string }[];
    }
  ): Message => {
    const message: Message = {
      id: generateMessageId('user'),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      images: options?.images,
      files: options?.files,
    };

    setMessages(prev => [...prev, message]);
    lastMessageRef.current = message;

    return message;
  }, []);

  /**
   * AI 응답 메시지 추가
   */
  const addAssistantMessage = useCallback((
    content: string,
    options?: {
      references?: ReferenceInfo[];
      referenceImages?: ReferenceImages;
      suggestedActions?: SuggestedAction[];
      priceComparisonData?: PriceComparisonData;
      reportCard?: ReportCardData;
      codeFixes?: CodeFix[];
      analysisReportId?: string;
      gcodeContext?: string;
    }
  ): Message => {
    const message: Message = {
      id: generateMessageId('assistant'),
      role: 'assistant',
      content,
      timestamp: new Date(),
      references: options?.references,
      referenceImages: options?.referenceImages,
      suggestedActions: options?.suggestedActions,
      priceComparisonData: options?.priceComparisonData,
      reportCard: options?.reportCard,
      codeFixes: options?.codeFixes,
      analysisReportId: options?.analysisReportId,
      gcodeContext: options?.gcodeContext,
    };

    setMessages(prev => [...prev, message]);
    lastMessageRef.current = message;

    return message;
  }, []);

  /**
   * 메시지 업데이트
   */
  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, ...updates } : msg
    ));
  }, []);

  /**
   * 마지막 어시스턴트 메시지 업데이트
   */
  const updateLastAssistantMessage = useCallback((updates: Partial<Message>) => {
    setMessages(prev => {
      const lastIndex = [...prev].reverse().findIndex(m => m.role === 'assistant');
      if (lastIndex === -1) return prev;

      const actualIndex = prev.length - 1 - lastIndex;
      return prev.map((msg, idx) =>
        idx === actualIndex ? { ...msg, ...updates } : msg
      );
    });
  }, []);

  /**
   * 스트리밍 시작 - 빈 어시스턴트 메시지 생성
   */
  const startStreaming = useCallback((): string => {
    const messageId = generateMessageId('assistant');
    const message: Message = {
      id: messageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, message]);
    setIsStreaming(true);
    streamingMessageIdRef.current = messageId;

    return messageId;
  }, []);

  /**
   * 스트리밍 청크 추가
   */
  const appendToStream = useCallback((messageId: string, chunk: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId
        ? { ...msg, content: msg.content + chunk }
        : msg
    ));
  }, []);

  /**
   * 스트리밍 종료
   */
  const finishStreaming = useCallback((messageId: string, finalContent?: string) => {
    if (finalContent !== undefined) {
      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content: finalContent }
          : msg
      ));
    }

    setIsStreaming(false);
    streamingMessageIdRef.current = null;
  }, []);

  /**
   * 리포트 카드 업데이트 (G-code 분석용)
   */
  const updateMessageReportCard = useCallback((messageId: string, reportCard: ReportCardData) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, reportCard } : msg
    ));
  }, []);

  /**
   * DB 메시지 ID 설정
   */
  const setMessageDbId = useCallback((messageId: string, dbMessageId: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, dbMessageId } : msg
    ));
  }, []);

  /**
   * 세션 메시지 로드 (히스토리 복원)
   */
  const loadSessionMessages = useCallback((loadedMessages: Message[]) => {
    setMessages(loadedMessages);
    if (loadedMessages.length > 0) {
      lastMessageRef.current = loadedMessages[loadedMessages.length - 1];
    }
  }, []);

  /**
   * 메시지 초기화
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    lastMessageRef.current = null;
    setIsStreaming(false);
    streamingMessageIdRef.current = null;
  }, []);

  return {
    messages,
    isStreaming,
    addMessage,
    addUserMessage,
    addAssistantMessage,
    updateMessage,
    updateLastAssistantMessage,
    startStreaming,
    appendToStream,
    finishStreaming,
    updateMessageReportCard,
    setMessageDbId,
    loadSessionMessages,
    clearMessages,
    lastMessageRef,
  };
}
