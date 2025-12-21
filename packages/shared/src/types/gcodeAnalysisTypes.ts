/**
 * G-code Analysis API Types
 * Python 백엔드 API와의 통신을 위한 타입 정의
 *
 * API 엔드포인트:
 * - POST /api/v1/gcode/analyze: 분석 시작
 * - GET /api/v1/gcode/analysis/{analysis_id}: 분석 상태/결과 조회
 */

// ========== Request Types ==========

export interface PrinterInfo {
  name: string;
  model?: string;
  nozzle_diameter?: number;
  max_temp_nozzle?: number;
  max_temp_bed?: number;
  build_volume?: {
    x: number;
    y: number;
    z: number;
  };
}

export interface GCodeAnalysisRequest {
  gcode_content: string;
  printer_info?: PrinterInfo;
  filament_type?: string;
  user_id?: string;
  file_name?: string;
}

// ========== Start Analysis Response ==========

export interface StartAnalysisResponse {
  analysis_id: string;
  status: 'pending' | 'running';
  message?: string;
}

// ========== Analysis Status/Detail Response ==========

export type AnalysisStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'summary_completed'
  | 'done'
  | 'finished'
  | 'failed'
  | 'error';

export interface AnalysisDetailResponse {
  analysis_id: string;
  status: AnalysisStatus;
  progress: number;  // 0.0 ~ 1.0
  progress_message?: string;
  result?: AnalysisResult;
  error?: string;
}

/**
 * 폴링용 상태 조회 응답
 * GET /api/v1/gcode/analysis/{analysis_id}/status
 */
export interface AnalysisStatusResponse {
  analysis_id: string;
  status: AnalysisStatus;
  progress: number;  // 0.0 ~ 1.0
  current_step?: string;
  progress_message?: string;
  timeline?: SSETimelineEvent[];
  result?: AnalysisResult;
  error?: string;
}

// ========== Analysis Result (최종 결과) ==========

export interface AnalysisResult {
  // 프린팅 정보 (LLM 요약)
  printing_info: PrintingInfo;
  // 종합 분석 데이터
  comprehensive_summary: ComprehensiveSummary;
  // 최종 요약
  final_summary: FinalSummary;
  // 발견된 이슈 목록
  issues_found: IssueFound[];
  // 토큰 사용량
  token_usage: TokenUsage;
  // 패치 제안
  patch_plan?: PatchPlan;
}

// ========== Printing Info (LLM 요약) ==========

export interface PrintingInfo {
  overview: string;
  characteristics: {
    complexity: 'low' | 'medium' | 'high';
    estimated_quality: 'low' | 'medium' | 'high';
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  };
  temperature_analysis: string;
  speed_analysis: string;
  material_usage: string;
  warnings: string[];
  recommendations: string[];
  summary_text: string;
}

// ========== Comprehensive Summary (종합 분석 데이터) ==========

export interface ComprehensiveSummary {
  slicer_info: string;
  print_time: {
    formatted_time: string;
    total_seconds?: number;
  };
  temperature: {
    nozzle_min: number;
    nozzle_max: number;
    nozzle_avg: number;
    bed_min: number;
    bed_max: number;
  };
  extrusion: {
    total_filament_used: number;  // meters
    filament_weight_g?: number;
    retraction_count: number;
  };
  layer: {
    total_layers: number;
    layer_height?: number;
  };
  support: {
    has_support: boolean;
    support_ratio: number;  // percentage
  };
  speed?: {
    average_speed: number;  // mm/min
    max_speed: number;
  };
  feed_rate?: {
    travel_speed_avg: number;
    print_speed_avg: number;
    max_speed: number;
    avg_speed: number;
    min_speed: number;
  };
}

// ========== Final Summary (최종 요약) ==========

export interface FinalSummary {
  overall_quality_score: number;  // 0-100
  total_issues_found: number;
  critical_issues: number;
  summary: string;
  recommendation: string;
  expected_improvement?: string;
  patch_available?: boolean;
  patch_count?: number;
}

// ========== Issue Found (발견된 이슈) ==========

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueType =
  | 'cold_extrusion'
  | 'early_temp_off'
  | 'extreme_cold'
  | 'early_bed_off'
  | 'over_temperature'
  | 'under_extrusion'
  | 'temp_zero_in_body'
  | 'other';

/**
 * all_issues 배열 내 개별 이슈 항목
 * 각 이슈의 상세 정보와 G-code 컨텍스트를 포함
 */
export interface IssueItem {
  line: number;                // 해당 이슈의 라인 번호 (필수)
  cmd?: string;                // G-code 명령어 (예: "M104 S154")
  temp?: number;               // 온도 값
  min_temp?: number;           // 최소 온도
  type?: string;               // 이슈 타입
  severity?: string;           // 개별 심각도
  description?: string;        // 개별 설명
  gcode_context?: string;      // 해당 라인의 G-code 컨텍스트 (앞뒤 N줄)
}

/**
 * 통합된 이슈 구조 (단일/그룹 공통)
 *
 * 새 구조:
 * - id: "TEMP-1" (단일) 또는 "TEMP-GROUP-1" (그룹)
 * - is_grouped: false (단일) 또는 true (그룹)
 * - count: 1 (단일) 또는 N (그룹)
 * - lines: [12345] (단일도 항상 배열)
 * - all_issues: [{ line, gcode_context, ... }] (항상 배열)
 */
export interface IssueFound {
  // === 필수 필드 (항상 존재) ===
  id: string;                  // 이슈 고유 ID ("TEMP-1", "TEMP-GROUP-1" 등)
  type: IssueType | string;    // 이슈 타입 (cold_extrusion, early_temp_off 등)
  severity: IssueSeverity;     // 심각도
  is_grouped: boolean;         // 그룹 여부 (false: 단일, true: 그룹)
  count: number;               // 이슈 개수 (단일: 1, 그룹: N)
  lines: number[];             // 라인 번호 목록 (항상 배열, 단일도 [12345])
  title: string;               // 이슈 제목
  description: string;         // 이슈 설명
  all_issues: IssueItem[];     // 개별 이슈 목록 (항상 배열)

  // === 선택적 필드 (상황에 따라 존재) ===
  issue_type?: IssueType | string;  // type 별칭 (하위 호환)
  has_issue?: boolean;              // 레거시 호환 (true면 실제 이슈)
  impact?: string;                  // 영향
  suggestion?: string;              // 제안
  layer?: number;                   // 레이어 번호
  section?: string;                 // 섹션 (BODY, INFILL, SUPPORT 등)
  code?: string;                    // 관련 G-code 코드
  affected_lines?: string[];        // 영향받는 라인 (레거시)

  // === 레거시 호환 필드 (점진적 마이그레이션) ===
  line_index?: number | string;     // 라인 인덱스 (레거시)
  line?: number | string;           // 단일 라인 (레거시, lines[0] 사용 권장)
  event_line_index?: number | string;  // 이벤트 라인 인덱스 (레거시)
  gcode_context?: string;           // G-code 컨텍스트 (레거시, all_issues[].gcode_context 사용 권장)

  // === 그룹 전용 필드 (레거시) ===
  representative?: {                // 대표 이슈 정보
    cmd?: string;
    line?: number;
    temp?: number;
  };

  // === 검증 정보 ===
  validation?: {
    reasoning?: string;
    validated?: boolean;
    confidence?: number;
  };
}

// ========== Token Usage ==========

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

// ========== Patch Plan (패치 제안) ==========

export interface PatchItem {
  id?: string;
  issue_id?: string;
  line_index: number;
  line?: number;
  action: 'remove' | 'modify' | 'insert';
  original_line: string;
  original?: string;
  new_line?: string | null;
  modified?: string | null;
  reason: string;
  issue_type?: string;
  layer?: number;
  position?: 'before' | 'after' | 'replace';
  autofix_allowed?: boolean;
  vendor_extension?: any;
}

export interface PatchPlan {
  total_patches: number;
  patches: PatchItem[];
  estimated_improvement?: number;
}

// ========== UI State Types ==========

export interface AnalysisProgress {
  status: AnalysisStatus;
  progress: number;  // 0-100 (UI용)
  message: string;
  currentStep?: string;
}

// ========== SSE Event Types ==========

export interface SSETimelineEvent {
  step: number;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface SSEProgressEvent {
  progress: number;
}

export interface SSECompleteEvent extends AnalysisResult {
  // AnalysisResult properties are inherited
}

export interface SSEErrorEvent {
  error: string;
}

// ========== Issue Statistics (UI용 통계) ==========

export interface IssueStatistics {
  type: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
  description?: string;
}

// 이슈 타입별 라벨 매핑
export const ISSUE_TYPE_LABELS: Record<string, string> = {
  cold_extrusion: '압출 불량 (Cold Extrusion)',
  early_temp_off: '조기 온도 차단 (Early Temp Off)',
  extreme_cold: '극저온 설정 (Extreme Cold)',
  early_bed_off: '조기 베드 차단 (Early Bed Off)',
  over_temperature: '과열 설정 (Over Temperature)',
  under_extrusion: '압출 부족 (Under Extrusion)',
  temp_zero_in_body: '본체 내 온도 0 (Temp Zero in Body)',
  other: '기타 문제',
};

// 심각도별 스타일 매핑
export const SEVERITY_STYLES: Record<IssueSeverity, { bg: string; text: string; badge: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', badge: 'bg-red-600' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', badge: 'bg-orange-600' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', badge: 'bg-yellow-600' },
  low: { bg: 'bg-green-500/10', text: 'text-green-400', badge: 'bg-green-600' },
};

// 품질 점수 → 등급 변환
export function getGradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * 이슈 목록에서 통계 계산
 * 새 구조: type, count 필드 사용 (레거시 호환 유지)
 */
export function calculateIssueStatistics(issues: IssueFound[]): IssueStatistics[] {
  // 새 구조: has_issue 필터 불필요 (모든 이슈가 유효함)
  // 레거시 호환: has_issue가 있으면 필터링
  const realIssues = issues.filter(i => i.has_issue !== false);

  if (realIssues.length === 0) return [];

  const countByType: Record<string, number> = {};

  for (const issue of realIssues) {
    // 새 구조: type 필드 사용, 레거시: issue_type 폴백
    const issueType = issue.type || issue.issue_type || 'other';
    // 새 구조: count 필드로 그룹 내 이슈 수 반영
    const issueCount = issue.count || 1;
    countByType[issueType] = (countByType[issueType] || 0) + issueCount;
  }

  // 총 이슈 수 (그룹 내 개수 합산)
  const total = Object.values(countByType).reduce((sum, c) => sum + c, 0);

  const typeColors: Record<string, string> = {
    cold_extrusion: 'red',
    early_temp_off: 'orange',
    extreme_cold: 'blue',
    early_bed_off: 'yellow',
    over_temperature: 'purple',
    under_extrusion: 'pink',
    temp_zero_in_body: 'cyan',
    other: 'gray',
  };

  return Object.entries(countByType)
    .map(([type, count]) => ({
      type,
      label: ISSUE_TYPE_LABELS[type] || type,
      count,
      percentage: Math.round((count / total) * 100),
      color: typeColors[type] || 'gray',
    }))
    .sort((a, b) => b.count - a.count);
}

// ========== Additional UI Types ==========

export interface TimelineStep {
  step: number;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface CollectedInfo {
  printerName?: string;
  printerModel?: string;
  nozzleDiameter?: number;
  maxTempNozzle?: number;
  maxTempBed?: number;
  buildVolume?: {
    x: number;
    y: number;
    z: number;
  };
  filamentType?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ========== Delta Export Types (대용량 파일 효율적 처리) ==========

export type DeltaAction = 'modify' | 'delete' | 'insert_before' | 'insert_after';

/**
 * 단일 라인 변경 델타
 * 원본 파일 대비 변경사항만 추적
 */
export interface LineDelta {
  lineIndex: number;           // 0-based 라인 인덱스
  action: DeltaAction;
  originalContent?: string;    // 원본 내용 (modify, delete 시)
  newContent?: string;         // 새 내용 (modify, insert 시)
}

/**
 * 델타 내보내기 요청 (Python 서버용)
 */
export interface DeltaExportRequest {
  analysis_id: string;         // 분석 보고서 ID
  deltas: LineDelta[];         // 변경 델타 배열
  filename?: string;           // 출력 파일명
  include_comments?: boolean;  // 수정 이력 주석 포함 여부
}

/**
 * 델타 내보내기 응답
 */
export interface DeltaExportResponse {
  success: boolean;
  download_url?: string;       // 다운로드 URL (스토리지 경로)
  file_content?: string;       // 직접 콘텐츠 반환 (작은 파일용)
  total_lines: number;
  modified_lines: number;
  deleted_lines: number;
  inserted_lines: number;
  error?: string;
}

// ========== G-code Summary Result ==========

export interface GCodeSummaryResult {
  total_lines: number;
  slicer_name?: string;
  slicer_version?: string;
  nozzle_temp: {
    min: number;
    max: number;
    average: number;
    change_rate?: number;
    timeline?: any[];
  };
  bed_temp: {
    min: number;
    max: number;
    average: number;
    change_rate?: number;
    timeline?: any[];
  };
  layer_stats: {
    total_layers: number;
    layer_height?: number;
    first_layer_height?: number;
    average_layer_time?: number;
  };
  filament_used_mm?: number;
  filament_used_m: number;
  filament_weight_g?: number;
  retraction_count: number;
  support_ratio: number;
  estimated_print_time_seconds: number;
  estimated_print_time_formatted: string;
  feedrate_distribution: {
    travel: number;
    infill: number;
    perimeter: number;
    support: number;
    min?: number;
    max: number;
    average: number;
  };
  fan_events_count?: number;
}

// ========== API Response Types ==========

/**
 * G-code 분석 시작 응답 (POST /api/v1/gcode/analyze)
 */
export interface GCodeAnalysisResponse {
  analysis_id: string;
  status: AnalysisStatus;
  message?: string;
}

/**
 * 패치 승인 요청
 */
export interface PatchApprovalRequest {
  approved: boolean;
  patch_ids?: string[];
}

/**
 * 패치 승인 응답
 */
export interface PatchApprovalResponse {
  success: boolean;
  message?: string;
  patched_lines?: number;
}

/**
 * G-code 요약 요청
 */
export interface GCodeSummaryRequest {
  gcode_content: string;
  file_name?: string;
}

/**
 * G-code 요약 응답
 */
export interface GCodeSummaryResponse {
  analysis_id: string;
  summary: GCodeSummaryResult;
}
