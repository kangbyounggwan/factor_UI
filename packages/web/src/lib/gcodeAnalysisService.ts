/**
 * G-code Analysis API Service
 * Python 백엔드와 통신하여 G-code 분석을 수행하는 서비스
 */

import type {
  GCodeAnalysisRequest,
  StartAnalysisResponse,
  AnalysisDetailResponse,
  AnalysisResult,
  AnalysisStatus,
  AnalysisProgress,
} from '@shared/types/gcodeAnalysisTypes';

// API Base URL (환경변수에서 가져오거나 기본값 사용)
const getBaseUrl = (): string => {
  return import.meta.env.VITE_GCODE_API_BASE_URL || 'http://localhost:7000';
};

// 완료 상태 목록
const COMPLETED_STATUSES: AnalysisStatus[] = ['completed', 'summary_completed', 'done', 'finished'];
const FAILED_STATUSES: AnalysisStatus[] = ['failed', 'error'];

/**
 * G-code 분석 API 에러
 */
export class GCodeAnalysisError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: string
  ) {
    super(message);
    this.name = 'GCodeAnalysisError';
  }
}

/**
 * 분석 시작 요청
 * POST /api/v1/gcode/analyze
 */
export async function startAnalysis(request: GCodeAnalysisRequest): Promise<StartAnalysisResponse> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/v1/gcode/analyze`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new GCodeAnalysisError(
      `분석 요청 실패: ${response.status}`,
      response.status,
      errorText
    );
  }

  return response.json();
}

/**
 * 파일에서 분석 시작
 */
export async function startAnalysisFromFile(
  file: File,
  options?: {
    filament_type?: string;
    printer_info?: GCodeAnalysisRequest['printer_info'];
    user_id?: string;
  }
): Promise<StartAnalysisResponse> {
  const gcode_content = await file.text();

  const request: GCodeAnalysisRequest = {
    gcode_content,
    file_name: file.name,
    ...options,
  };

  return startAnalysis(request);
}

/**
 * 분석 상태/결과 조회
 * GET /api/v1/gcode/analysis/{analysis_id}
 */
export async function getAnalysisDetail(analysisId: string): Promise<AnalysisDetailResponse> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/v1/gcode/analysis/${analysisId}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new GCodeAnalysisError(
      `분석 상태 조회 실패: ${response.status}`,
      response.status,
      errorText
    );
  }

  return response.json();
}

/**
 * 분석 진행 상황을 폴링하며 콜백으로 업데이트 전달
 * @param analysisId 분석 ID
 * @param onProgress 진행 상황 콜백
 * @param options 폴링 옵션
 * @returns 최종 분석 결과
 */
export async function pollAnalysisProgress(
  analysisId: string,
  onProgress: (progress: AnalysisProgress) => void,
  options?: {
    pollInterval?: number;  // ms, default 2000
    timeout?: number;       // ms, default 600000 (10분)
  }
): Promise<AnalysisResult> {
  const pollInterval = options?.pollInterval || 2000;
  const timeout = options?.timeout || 600000;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        // 타임아웃 체크
        const elapsed = Date.now() - startTime;
        if (elapsed > timeout) {
          reject(new GCodeAnalysisError(`분석 시간 초과 (${timeout / 1000}초)`));
          return;
        }

        // 상태 조회
        const detail = await getAnalysisDetail(analysisId);
        const { status, progress, progress_message, result, error } = detail;

        // 진행 상황 콜백
        onProgress({
          status,
          progress: Math.round(progress * 100),  // 0-100으로 변환
          message: progress_message || getDefaultProgressMessage(status, progress),
          currentStep: extractCurrentStep(progress_message),
        });

        // 완료 체크
        if (COMPLETED_STATUSES.includes(status)) {
          if (result) {
            resolve(result);
          } else {
            // 완료 상태지만 결과가 없는 경우, 한 번 더 조회
            setTimeout(async () => {
              const finalDetail = await getAnalysisDetail(analysisId);
              if (finalDetail.result) {
                resolve(finalDetail.result);
              } else {
                reject(new GCodeAnalysisError('분석 완료되었으나 결과를 가져올 수 없습니다'));
              }
            }, 500);
          }
          return;
        }

        // 실패 체크
        if (FAILED_STATUSES.includes(status)) {
          reject(new GCodeAnalysisError(error || '분석 실패'));
          return;
        }

        // 다음 폴링 예약
        setTimeout(poll, pollInterval);
      } catch (err) {
        reject(err);
      }
    };

    // 첫 폴링 시작
    poll();
  });
}

/**
 * 분석 시작 후 완료까지 대기
 * 편의 함수: startAnalysis + pollAnalysisProgress 조합
 */
export async function analyzeGCode(
  request: GCodeAnalysisRequest,
  onProgress: (progress: AnalysisProgress) => void,
  options?: {
    pollInterval?: number;
    timeout?: number;
  }
): Promise<AnalysisResult> {
  // 1. 분석 시작
  onProgress({
    status: 'pending',
    progress: 0,
    message: '분석 요청 중...',
  });

  const startResponse = await startAnalysis(request);
  const { analysis_id } = startResponse;

  onProgress({
    status: 'running',
    progress: 5,
    message: 'G-code 파싱 시작...',
  });

  // 2. 완료까지 폴링
  return pollAnalysisProgress(analysis_id, onProgress, options);
}

/**
 * 파일로 분석 시작 후 완료까지 대기
 */
export async function analyzeGCodeFile(
  file: File,
  onProgress: (progress: AnalysisProgress) => void,
  options?: {
    filament_type?: string;
    printer_info?: GCodeAnalysisRequest['printer_info'];
    user_id?: string;
    pollInterval?: number;
    timeout?: number;
  }
): Promise<AnalysisResult> {
  const gcode_content = await file.text();

  const request: GCodeAnalysisRequest = {
    gcode_content,
    file_name: file.name,
    filament_type: options?.filament_type,
    printer_info: options?.printer_info,
    user_id: options?.user_id,
  };

  return analyzeGCode(request, onProgress, {
    pollInterval: options?.pollInterval,
    timeout: options?.timeout,
  });
}

// ========== Helper Functions ==========

/**
 * 기본 진행 메시지 생성
 */
function getDefaultProgressMessage(status: AnalysisStatus, progress: number): string {
  const pct = Math.round(progress * 100);

  switch (status) {
    case 'pending':
      return '분석 대기 중...';
    case 'running':
      if (pct < 10) return 'G-code 파싱 시작...';
      if (pct < 20) return '종합 요약 분석 중...';
      if (pct < 70) return '이벤트 분석 중...';
      if (pct < 90) return '최종 요약 생성 중...';
      return '분석 마무리 중...';
    case 'completed':
    case 'summary_completed':
    case 'done':
    case 'finished':
      return '분석 완료';
    case 'failed':
    case 'error':
      return '분석 실패';
    default:
      return `분석 중... ${pct}%`;
  }
}

/**
 * 진행 메시지에서 현재 단계 추출
 */
function extractCurrentStep(message?: string): string | undefined {
  if (!message) return undefined;

  // "이벤트 N/M 분석 중" 패턴 추출
  const eventMatch = message.match(/이벤트 (\d+)\/(\d+) 분석 중/);
  if (eventMatch) {
    return `이벤트 ${eventMatch[1]}/${eventMatch[2]}`;
  }

  // "분석 중: ..." 패턴에서 앞부분만 추출
  if (message.startsWith('분석 중:')) {
    const content = message.substring(5).trim();
    // 너무 긴 경우 잘라냄
    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  }

  return message.length > 100 ? message.substring(0, 100) + '...' : message;
}

/**
 * 상태가 완료인지 확인
 */
export function isAnalysisCompleted(status: AnalysisStatus): boolean {
  return COMPLETED_STATUSES.includes(status);
}

/**
 * 상태가 실패인지 확인
 */
export function isAnalysisFailed(status: AnalysisStatus): boolean {
  return FAILED_STATUSES.includes(status);
}

/**
 * 상태가 진행 중인지 확인
 */
export function isAnalysisRunning(status: AnalysisStatus): boolean {
  return status === 'pending' || status === 'running';
}
