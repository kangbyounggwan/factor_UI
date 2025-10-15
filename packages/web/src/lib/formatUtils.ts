/**
 * 공통 포맷팅 유틸리티 함수들
 */

/**
 * 초 단위 시간을 "시간 분 초" 형식으로 변환
 * @param seconds - 초 단위 시간
 * @returns 포맷된 시간 문자열
 */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}시간 ${m}분 ${s}초`;
  }
  return `${m}분 ${s}초`;
}

/**
 * 바이트를 읽기 쉬운 파일 크기로 변환
 * @param bytes - 바이트 단위 크기
 * @returns 포맷된 파일 크기 문자열
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * 온도를 포맷팅 (소수점 1자리)
 * @param temp - 온도 값
 * @returns 포맷된 온도 문자열
 */
export function formatTemperature(temp: number): string {
  return `${temp.toFixed(1)}°C`;
}

/**
 * 퍼센트 값을 정수로 변환
 * @param value - 0~1 사이의 소수 또는 0~100 사이의 숫자
 * @returns 0~100 사이의 정수
 */
export function toPercent(value: number): number {
  if (value <= 1) {
    return Math.round(value * 100);
  }
  return Math.round(value);
}
