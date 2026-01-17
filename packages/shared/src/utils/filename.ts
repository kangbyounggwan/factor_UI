/**
 * 파일명 관련 유틸리티 함수
 * claudeService.ts, geminiService.ts에서 중복된 함수 통합
 */

/**
 * 파일명에 .gcode 확장자 추가
 * @param shortName - 확장자 없는 파일명
 * @returns .gcode 확장자가 붙은 파일명
 */
export function toGcodeFilename(shortName: string): string {
  return `${shortName}.gcode`;
}

/**
 * 텍스트에서 안전한 파일명 추출 (fallback용)
 * @param text - 파일명을 추출할 텍스트
 * @returns 안전한 파일명 (영문, 숫자, 언더스코어만 포함)
 */
export function extractFallbackFilename(text: string): string {
  const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'it', 'its'];

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s_-]/g, '')
    .split(/[_\-\s]+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));

  // 첫 번째 의미있는 단어 반환
  const filename = words[0] || `model_${Date.now().toString(36).slice(-4)}`;

  return filename.replace(/[^a-z0-9_]/g, '').slice(0, 20);
}

/**
 * 고유한 모델 파일명 생성
 * @returns 타임스탬프 기반 고유 파일명
 */
export function generateUniqueModelFilename(): string {
  return `model_${Date.now().toString(36).slice(-4)}`;
}
