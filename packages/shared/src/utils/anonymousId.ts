/**
 * Anonymous ID 유틸리티
 * 비로그인 사용자 추적을 위한 익명 ID 관리
 */

import { useState, useEffect } from 'react';

const ANONYMOUS_ID_KEY = 'factor_anonymous_id';

/**
 * UUID v4 생성 (crypto.randomUUID 사용)
 */
function generateUUID(): string {
  // 브라우저 환경에서 crypto.randomUUID 사용
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: 수동 UUID v4 생성
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Anonymous ID 가져오기 (없으면 생성)
 */
export function getAnonymousId(): string {
  if (typeof window === 'undefined') return '';

  let id = localStorage.getItem(ANONYMOUS_ID_KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(ANONYMOUS_ID_KEY, id);
  }
  return id;
}

/**
 * Anonymous ID 삭제 (로그인 시 호출 가능)
 */
export function clearAnonymousId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ANONYMOUS_ID_KEY);
}

/**
 * React Hook: Anonymous ID 가져오기
 */
export function useAnonymousId(): string {
  const [id, setId] = useState('');

  useEffect(() => {
    setId(getAnonymousId());
  }, []);

  return id;
}

// ============================================
// 비로그인 사용자 대화 캐싱 (localStorage)
// ============================================

const ANON_CHAT_KEY = 'factor_anon_chat';
const MAX_ANON_MESSAGES = 10; // 비로그인: 최대 10개 메시지 (컨텍스트 윈도우)
export const MAX_LOGGED_IN_MESSAGES = 15; // 로그인: 최대 15개 메시지

/**
 * 비로그인 사용자 대화 메시지 타입
 */
export interface AnonChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * 비로그인 사용자 대화 저장
 * - 최근 20개만 유지
 * - 이미지는 제외 (용량 절약)
 */
export function saveAnonChat(messages: AnonChatMessage[]): void {
  if (typeof window === 'undefined') return;

  // 최근 20개만 저장
  const recent = messages.slice(-MAX_ANON_MESSAGES);
  localStorage.setItem(ANON_CHAT_KEY, JSON.stringify(recent));
}

/**
 * 비로그인 사용자 대화 불러오기
 */
export function loadAnonChat(): AnonChatMessage[] {
  if (typeof window === 'undefined') return [];

  try {
    const saved = localStorage.getItem(ANON_CHAT_KEY);
    if (!saved) return [];
    return JSON.parse(saved) as AnonChatMessage[];
  } catch {
    return [];
  }
}

/**
 * 비로그인 사용자 대화 삭제
 */
export function clearAnonChat(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ANON_CHAT_KEY);
}

/**
 * API 요청용 대화 히스토리 포맷
 * - 최근 N개 메시지를 API 형식으로 변환
 */
export function getConversationHistory(
  messages: AnonChatMessage[],
  limit: number = 10
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .slice(-limit)
    .map(({ role, content }) => ({ role, content }));
}
