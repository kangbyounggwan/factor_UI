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
// AI 이슈 해결 API
// ============================================================================

/**
 * 이슈 해결 요청 타입
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
  has_fix?: boolean;        // 단일 이슈용 (optional)
  line_number?: number;     // 그룹화된 이슈용 라인 번호
  original: string | null;
  fixed: string | null;
}

/**
 * 이슈 해결 응답 타입 (새 형식)
 */
export interface IssueResolveResponse {
  success: boolean;
  conversation_id: string;
  analysis_id: string;
  issue_line?: number;
  resolution: {
    explanation: {
      summary: string;
      cause: string;
      is_false_positive: boolean;
      severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
    };
    solution: {
      action_needed: boolean;
      steps: string[];
      // 단일 이슈용 (하위 호환성)
      code_fix: CodeFix;
      // 그룹화된 이슈용 (여러 개의 수정)
      code_fixes?: CodeFix[];
    };
    tips: string[];
  };
  error?: string;
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
 * AI 이슈 해결 API 호출
 */
export async function resolveIssue(
  request: IssueResolveRequest
): Promise<IssueResolveResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/gcode/analysis/${request.analysis_id}/resolve-issue`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analysis_id: request.analysis_id,
        conversation_id: request.conversation_id || null,
        issue: request.issue,
        gcode_context: request.gcode_context || null,
        language: request.language || 'ko',
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API 호출 실패: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
