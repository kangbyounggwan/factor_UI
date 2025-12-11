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
  | 'other';

export interface IssueFound {
  has_issue: boolean;
  issue_type: IssueType | string;
  severity: IssueSeverity;
  line_index?: number | string;
  event_line_index?: number | string;  // API에서 실제로 반환하는 라인 번호 키
  code?: string;
  description: string;
  impact: string;
  suggestion: string;
  affected_lines?: string[];
  layer?: number;    // 레이어 번호
  section?: string;  // 섹션 (BODY, INFILL, SUPPORT 등)
}

// ========== Token Usage ==========

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

// ========== Patch Plan (패치 제안) ==========

export interface PatchItem {
  line_index: number;
  action: 'remove' | 'modify' | 'insert';
  original_line: string;
  new_line?: string | null;
  reason: string;
  issue_type?: string;
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

// 이슈 목록에서 통계 계산
export function calculateIssueStatistics(issues: IssueFound[]): IssueStatistics[] {
  const realIssues = issues.filter(i => i.has_issue);
  const total = realIssues.length;

  if (total === 0) return [];

  const countByType: Record<string, number> = {};

  for (const issue of realIssues) {
    const type = issue.issue_type || 'other';
    countByType[type] = (countByType[type] || 0) + 1;
  }

  const typeColors: Record<string, string> = {
    cold_extrusion: 'red',
    early_temp_off: 'orange',
    extreme_cold: 'blue',
    early_bed_off: 'yellow',
    over_temperature: 'purple',
    under_extrusion: 'pink',
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
