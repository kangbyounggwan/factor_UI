/**
 * 문자열 관련 유틸리티 함수
 * chat.ts, troubleshooting.ts에서 중복된 함수 통합
 */

/**
 * 첫 번째 메시지로 세션 제목 자동 생성
 * @param firstMessage - 첫 번째 메시지 내용
 * @param maxLength - 최대 길이 (기본값: 30)
 * @returns 세션 제목 (maxLength 초과 시 "..." 추가)
 */
export function generateSessionTitle(firstMessage: string, maxLength: number = 30): string {
  const cleaned = firstMessage.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.substring(0, maxLength) + '...';
}

/**
 * 텍스트를 지정된 길이로 자르고 말줄임표 추가
 * @param text - 원본 텍스트
 * @param maxLength - 최대 길이
 * @returns 잘린 텍스트 (필요시 "..." 추가)
 */
export function truncateText(text: string, maxLength: number): string {
  const cleaned = text.trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.substring(0, maxLength) + '...';
}

/**
 * 마지막 완전한 단어까지만 자르기 (영문 텍스트용)
 * @param text - 원본 텍스트
 * @param maxLength - 최대 길이
 * @param minLength - 최소 길이 (기본값: maxLength의 절반)
 * @returns 단어 경계에서 잘린 텍스트
 */
export function truncateAtWordBoundary(
  text: string,
  maxLength: number,
  minLength: number = Math.floor(maxLength / 2)
): string {
  const cleaned = text.trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const truncated = cleaned.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  if (lastSpaceIndex > minLength) {
    return truncated.substring(0, lastSpaceIndex) + '...';
  }

  return truncated + '...';
}
