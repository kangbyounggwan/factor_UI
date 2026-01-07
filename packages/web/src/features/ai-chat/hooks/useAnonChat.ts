/**
 * 익명 사용자 채팅 관리 훅
 *
 * 책임:
 * - localStorage에서 대화 로드/저장
 * - 익명 ID 관리
 * - 비로그인 사용자 대화 영속성
 */

import { useCallback, useMemo } from 'react';
import {
  getAnonymousId,
  saveAnonChat,
  loadAnonChat,
  clearAnonChat,
  type AnonChatMessage,
} from '@shared/utils/anonymousId';
import type { Message } from '../types';

export interface UseAnonChatOptions {
  userId?: string;
}

export interface UseAnonChatReturn {
  // 상태
  isAnonymous: boolean;
  anonymousId: string;

  // 메시지 로드
  loadAnonMessages: () => Message[];

  // 메시지 저장
  saveAnonMessages: (messages: Message[]) => void;

  // 단일 메시지 추가 저장
  appendAnonMessage: (role: 'user' | 'assistant', content: string) => void;

  // 메시지 초기화
  clearAnonMessages: () => void;

  // 유틸리티
  convertToAnonFormat: (messages: Message[]) => AnonChatMessage[];
  convertFromAnonFormat: (anonMessages: AnonChatMessage[]) => Message[];
}

/**
 * 익명 사용자 채팅 관리 훅
 */
export function useAnonChat({ userId }: UseAnonChatOptions = {}): UseAnonChatReturn {
  const isAnonymous = !userId;
  const anonymousId = useMemo(() => getAnonymousId(), []);

  /**
   * Message[] → AnonChatMessage[] 변환
   */
  const convertToAnonFormat = useCallback((messages: Message[]): AnonChatMessage[] => {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp.getTime(),
    }));
  }, []);

  /**
   * AnonChatMessage[] → Message[] 변환
   */
  const convertFromAnonFormat = useCallback((anonMessages: AnonChatMessage[]): Message[] => {
    return anonMessages.map((m, idx) => ({
      id: `anon-${idx}-${m.timestamp}`,
      role: m.role,
      content: m.content,
      timestamp: new Date(m.timestamp),
    }));
  }, []);

  /**
   * localStorage에서 메시지 로드
   */
  const loadAnonMessages = useCallback((): Message[] => {
    if (!isAnonymous) return [];

    const savedMessages = loadAnonChat();
    return convertFromAnonFormat(savedMessages);
  }, [isAnonymous, convertFromAnonFormat]);

  /**
   * localStorage에 메시지 저장
   */
  const saveAnonMessages = useCallback((messages: Message[]) => {
    if (!isAnonymous) return;

    const anonMessages = convertToAnonFormat(messages);
    saveAnonChat(anonMessages);
  }, [isAnonymous, convertToAnonFormat]);

  /**
   * 단일 메시지 추가 저장 (기존 메시지에 append)
   */
  const appendAnonMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    if (!isAnonymous) return;

    const existingMessages = loadAnonChat();
    const newMessage: AnonChatMessage = {
      role,
      content,
      timestamp: Date.now(),
    };
    saveAnonChat([...existingMessages, newMessage]);
  }, [isAnonymous]);

  /**
   * localStorage 메시지 초기화
   */
  const clearAnonMessages = useCallback(() => {
    if (!isAnonymous) return;
    clearAnonChat();
  }, [isAnonymous]);

  return {
    isAnonymous,
    anonymousId,
    loadAnonMessages,
    saveAnonMessages,
    appendAnonMessage,
    clearAnonMessages,
    convertToAnonFormat,
    convertFromAnonFormat,
  };
}

export default useAnonChat;
