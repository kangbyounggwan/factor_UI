/**
 * G-code Line Number Parsing Utilities
 * G-code 분석 결과에서 라인 번호를 파싱하고 처리하는 유틸리티
 *
 * @module shared/utils/ai/gcodeAnalytics/lineNumberUtils
 */

/**
 * 라인 번호와 코드가 포함된 문자열 파싱 결과
 */
export interface ParsedLineNumber {
  lineNumber: string | null;
  code: string;
  originalLine: string;
}

/**
 * 마크된 라인 (>>> ... <<<) 파싱 결과
 */
export interface ParsedMarkedLine extends ParsedLineNumber {
  isMarked: boolean;
}

/**
 * 일반 라인 번호 형식 파싱 (예: "123: G1 X10 Y20")
 * @param line - 파싱할 라인 문자열
 * @returns 파싱된 라인 번호와 코드
 */
export function parseLineNumber(line: string): ParsedLineNumber {
  const match = line.match(/^\s*(\d+):\s*(.*)/);
  if (match) {
    return {
      lineNumber: match[1],
      code: match[2],
      originalLine: line,
    };
  }
  return {
    lineNumber: null,
    code: line,
    originalLine: line,
  };
}

/**
 * 라인 번호 접두사 제거 (예: "123: G1 X10" -> "G1 X10")
 * @param lineWithNumber - 라인 번호가 포함된 문자열
 * @returns 라인 번호가 제거된 코드 부분
 */
export function stripLineNumber(lineWithNumber: string): string {
  const match = lineWithNumber.match(/^\d+:\s*(.*)$/);
  return match ? match[1] : lineWithNumber;
}

/**
 * 마크된 라인 형식 파싱 (>>> 123: G1 X10 <<< 에러메시지)
 * @param line - 파싱할 라인 문자열
 * @returns 마크된 라인의 파싱 결과
 */
export function parseMarkedLine(line: string): ParsedMarkedLine {
  const markerMatch = line.match(/^>>>\s*(\d+):\s*(.*?)\s*<<<.*$/);
  if (markerMatch) {
    return {
      isMarked: true,
      lineNumber: markerMatch[1],
      code: markerMatch[2],
      originalLine: line,
    };
  }

  // 일반 라인 형식도 확인
  const normalMatch = line.match(/^\s*(\d+):\s*(.*)$/);
  if (normalMatch) {
    return {
      isMarked: false,
      lineNumber: normalMatch[1],
      code: normalMatch[2],
      originalLine: line,
    };
  }

  return {
    isMarked: false,
    lineNumber: null,
    code: line,
    originalLine: line,
  };
}

/**
 * 라인 번호만 추출 (예: "123: G1 X10" -> "123")
 * @param line - 라인 문자열
 * @returns 라인 번호 문자열 또는 빈 문자열
 */
export function extractLineNumber(line: string): string {
  const match = line.match(/^(\d+):/);
  return match?.[1] || '';
}

/**
 * 문자열 또는 숫자 라인 번호를 숫자로 변환
 * @param lineNumber - 문자열 또는 숫자 라인 번호
 * @returns 숫자로 변환된 라인 번호 또는 0
 */
export function toLineNumber(lineNumber: string | number | undefined | null): number {
  if (lineNumber === undefined || lineNumber === null) return 0;
  if (typeof lineNumber === 'number') return lineNumber;
  const parsed = parseInt(lineNumber, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * 코드 블록에서 모든 라인 번호 파싱
 * @param codeBlock - 여러 줄의 코드 블록 문자열
 * @returns 각 줄의 파싱 결과 배열
 */
export function parseCodeBlock(codeBlock: string): ParsedMarkedLine[] {
  return codeBlock.split('\n').map(parseMarkedLine);
}

/**
 * 라인이 마크되어 있는지 확인 (>>> ... <<< 형식)
 * @param line - 확인할 라인 문자열
 * @returns 마크 여부
 */
export function isMarkedLine(line: string): boolean {
  return /^>>>\s*\d+:/.test(line);
}

/**
 * 라인 번호가 유효한지 확인
 * @param lineNumber - 확인할 라인 번호
 * @returns 유효 여부
 */
export function isValidLineNumber(lineNumber: string | number | undefined | null): boolean {
  const num = toLineNumber(lineNumber);
  return num > 0;
}
