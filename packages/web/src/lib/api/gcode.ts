/**
 * G-code API Client
 * 백엔드 G-code 분석 API 호출
 */

export interface LayerSegmentData {
  layerNum: number;
  z: number;
  extrusionData: string;  // Base64 encoded Float32Array
  travelData: string;     // Base64 encoded Float32Array
  wipeData?: string;      // Base64 encoded Float32Array (optional, for Bambu Lab slicers)
  supportData?: string;   // Base64 encoded Float32Array (optional, support structures)
  extrusionCount: number;
  travelCount: number;
  wipeCount?: number;     // optional
  supportCount?: number;  // optional
}

export interface TemperatureData {
  layer: number;
  nozzleTemp: number | null;
  bedTemp: number | null;
}

export interface GCodeAnalysisResponse {
  analysis_id: string;
  status: string;
  segments: {
    layers: LayerSegmentData[];
    metadata: {
      boundingBox: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        minZ: number;
        maxZ: number;
      };
      layerCount: number;
      totalFilament: number;
      printTime: number;
      layerHeight: number;
      firstLayerHeight: number;
      estimatedTime: string;
      filamentType: string | null;
      slicer: string;
      slicerVersion: string | null;
    };
    temperatures: TemperatureData[];
  };
  llm_analysis_started: boolean;
  message?: string;
  stream_url?: string;
}

const API_BASE_URL = import.meta.env.VITE_AI_PYTHON_URL || 'http://localhost:7000';

// ============================================================================
// 커뮤니티용 세그먼트 생성 API
// 엔드포인트: POST /api/v1/gcode/segments
// ============================================================================

/**
 * 커뮤니티용 세그먼트 생성 요청 타입
 * - gcode_content: G-code 파일 내용 (문자열)
 * - 다른 분석 API와 동일한 형식 사용
 */
export interface CreateSegmentsRequest {
  gcode_content: string;      // G-code 파일 내용 (문자열)
  filename?: string;          // 파일명 (옵션)
  binary_format?: boolean;    // Base64 인코딩 여부 (기본: true)
  language?: 'ko' | 'en';     // 언어 (기본: 'ko')
}

/**
 * 커뮤니티용 세그먼트 생성 응답 타입
 */
export interface CreateSegmentsResponse {
  success: boolean;
  segments: {
    layers: LayerSegmentData[];
    metadata: {
      boundingBox: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        minZ: number;
        maxZ: number;
      };
      layerCount: number;
      totalFilament: number;
      printTime: number;
      layerHeight: number;
      firstLayerHeight: number;
      estimatedTime: string;
      filamentType: string | null;
      slicer: string;
      slicerVersion: string | null;
    };
    temperatures: TemperatureData[];
  };
  layer_count: number;
  processing_time_ms?: number;
  message?: string;
  error?: string;
}

/**
 * 커뮤니티 G-code 세그먼트 생성 API 호출
 * - gcode_content를 전달하면 백엔드에서 세그먼트 생성
 * - analyzeGCodeWithSegments와 동일한 요청 형식 사용
 */
export async function createCommunitySegments(
  request: CreateSegmentsRequest
): Promise<CreateSegmentsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/gcode/segments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gcode_content: request.gcode_content,
      file_name: request.filename,
      binary_format: request.binary_format ?? true,
      language: request.language ?? 'ko',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API 호출 실패: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * G-code 분석 API 호출 (Float32Array 형식)
 */
export async function analyzeGCodeWithSegments(
  gcodeContent: string,
  options: {
    binaryFormat?: boolean;
    language?: 'ko' | 'en';
  } = {}
): Promise<GCodeAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/gcode/analyze-with-segments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gcode_content: gcodeContent,
      binary_format: options.binaryFormat ?? true,
      language: options.language ?? 'ko',
    }),
  });

  if (!response.ok) {
    throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Base64 디코딩 → Float32Array 변환
 */
export function decodeFloat32Array(base64Data: string): Float32Array {
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}

// ============================================================================
// AI 이슈 해결 API (REST API 기반)
// 엔드포인트: POST /api/v1/gcode/analysis/{analysis_id}/resolve-issue
// ============================================================================

/**
 * 이슈 해결 요청 타입
 * 엔드포인트: POST /api/v1/gcode/analysis/{analysis_id}/resolve-issue
 */
export interface IssueResolveRequest {
  analysis_id: string;
  conversation_id?: string | null;
  issue: Record<string, unknown>;  // issues_found 원본 데이터를 그대로 전송
  gcode_context?: string | null;
  language?: 'ko' | 'en';
}

/**
 * 단일 코드 픽스 타입
 */
export interface CodeFix {
  has_fix?: boolean;        // 수정 가능 여부
  line_number?: number | null;     // 라인 번호
  original: string | null;  // 원본 코드 (형식: "라인번호: G-code")
  fixed: string | null;     // 수정 코드 (형식: "라인번호: G-code")
}

/**
 * AI 해결 결과 구조
 */
export interface IssueResolution {
  explanation: {
    summary: string;          // 핵심 설명 (1-2문장)
    cause: string;            // 원인 분석 (2-3문장)
    is_false_positive: boolean;  // 오탐 여부
    severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  };
  solution: {
    action_needed: boolean;      // 조치 필요 여부
    steps: string[];             // 해결 단계
    code_fix: CodeFix;           // 대표 코드 수정 (1건)
    code_fixes?: CodeFix[];      // 모든 코드 수정 (배열)
  };
  tips: string[];                // 추가 팁
}

/**
 * 업데이트된 이슈 정보
 */
export interface UpdatedIssue {
  id?: string;
  line?: number;
  type?: string;
  severity?: 'none' | 'low' | 'medium' | 'high' | 'critical';
  has_issue?: boolean;
  is_false_positive?: boolean;
  false_positive_reason?: string;
  title?: string;
  description?: string;
  ai_resolution?: {
    summary: string;
    cause: string;
    action_needed: boolean;
    steps: string[];
    tips: string[];
  };
  code_fix?: CodeFix;
  code_fixes?: CodeFix[];
  all_issues?: UpdatedIssue[];
}

/**
 * 이슈 해결 응답 타입 (REST API 응답 구조)
 */
export interface IssueResolveResponse {
  // 기본 필드
  success: boolean;
  conversation_id: string;
  analysis_id: string;
  issue_line?: number;
  error?: string;

  // 핵심 해결 결과
  resolution: IssueResolution;
  updated_issue?: UpdatedIssue;
}

/**
 * G-code 컨텍스트 추출 (문제 라인 앞뒤 N줄)
 */
export function extractGcodeContext(
  gcodeContent: string,
  problemLine: number,
  contextSize: number = 50
): string {
  const lines = gcodeContent.split('\n');
  const startLine = Math.max(0, problemLine - contextSize - 1);
  const endLine = Math.min(lines.length, problemLine + contextSize);

  const context: string[] = [];
  for (let i = startLine; i < endLine; i++) {
    const lineNum = i + 1;
    const prefix = lineNum === problemLine ? '>>> ' : '    ';
    const suffix = lineNum === problemLine ? '  <<< [문제 라인]' : '';
    context.push(`${prefix}${lineNum}: ${lines[i]}${suffix}`);
  }
  return context.join('\n');
}

/**
 * 그룹화된 이슈의 G-code 컨텍스트 추출
 * 각 문제 라인 앞뒤 30줄(총 60줄)씩 추출하여 구분자로 연결
 */
export function extractGroupedGcodeContext(
  gcodeContent: string,
  problemLines: (number | string)[],
  contextSize: number = 30
): string {
  const lines = gcodeContent.split('\n');
  const contexts: string[] = [];

  // 라인 번호를 숫자로 변환하고 정렬
  const sortedLines = problemLines
    .map(ln => typeof ln === 'string' ? parseInt(ln, 10) : ln)
    .filter(ln => !isNaN(ln) && ln > 0)
    .sort((a, b) => a - b);

  sortedLines.forEach((problemLine, idx) => {
    const startLine = Math.max(0, problemLine - contextSize - 1);
    const endLine = Math.min(lines.length, problemLine + contextSize);

    const context: string[] = [];
    context.push(`\n========== [문제 ${idx + 1}/${sortedLines.length}] 라인 ${problemLine} ==========`);

    for (let i = startLine; i < endLine; i++) {
      const lineNum = i + 1;
      const prefix = lineNum === problemLine ? '>>> ' : '    ';
      const suffix = lineNum === problemLine ? '  <<< [문제 라인]' : '';
      context.push(`${prefix}${lineNum}: ${lines[i]}${suffix}`);
    }

    contexts.push(context.join('\n'));
  });

  return contexts.join('\n');
}

/**
 * REST API 응답 타입 (직접 응답)
 * 엔드포인트: POST /api/v1/gcode/analysis/{analysis_id}/resolve-issue
 */
interface ResolveIssueAPIResponse {
  success: boolean;
  conversation_id: string;
  analysis_id: string;
  issue_line?: number;
  resolution: IssueResolution;
  updated_issue?: UpdatedIssue;
  error?: string;
}

/**
 * AI 이슈 해결 API 호출 (REST API 기반)
 *
 * 문서 참조: CHAT_API_FRONTEND_GUIDE.md 섹션 10
 * - 엔드포인트: POST /api/v1/gcode/analysis/{analysis_id}/resolve-issue
 */
export async function resolveIssue(
  request: IssueResolveRequest
): Promise<IssueResolveResponse> {
  // REST API 요청 형식
  const apiRequest = {
    analysis_id: request.analysis_id,
    issue: request.issue,
    conversation_id: request.conversation_id || undefined,
    gcode_context: request.gcode_context || undefined,
    language: request.language || 'ko',
  };

  console.log('[resolveIssue] REST API request:', apiRequest);

  const response = await fetch(
    `${API_BASE_URL}/api/v1/gcode/analysis/${request.analysis_id}/resolve-issue`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiRequest),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API 호출 실패: ${response.status} ${response.statusText}`);
  }

  const apiResponse: ResolveIssueAPIResponse = await response.json();
  console.log('[resolveIssue] REST API response:', apiResponse);

  // REST API 응답을 IssueResolveResponse로 변환
  if (!apiResponse.success || !apiResponse.resolution) {
    return {
      success: false,
      conversation_id: apiResponse.conversation_id || '',
      analysis_id: request.analysis_id,
      error: apiResponse.error || 'AI 해결 결과를 가져올 수 없습니다.',
      resolution: {
        explanation: {
          summary: '',
          cause: '',
          is_false_positive: false,
          severity: 'medium',
        },
        solution: {
          action_needed: false,
          steps: [],
          code_fix: { original: null, fixed: null },
        },
        tips: [],
      },
    };
  }

  // 성공 응답 반환
  return {
    success: true,
    conversation_id: apiResponse.conversation_id,
    analysis_id: apiResponse.analysis_id,
    issue_line: apiResponse.issue_line,

    // 핵심 해결 결과
    resolution: apiResponse.resolution,
    updated_issue: apiResponse.updated_issue,
  };
}
