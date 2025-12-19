/**
 * G-code Analysis Database Types
 * Supabase 테이블 스키마에 매핑되는 타입 정의
 * Migration: 20251211000000_gcode_analysis_tables.sql
 */

// ============================================================================
// gcode_issue_types 테이블 타입
// ============================================================================

export type IssueCategory = 'temperature' | 'speed' | 'retraction' | 'layer' | 'other';
export type IssueSeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'warning';

export interface GCodeIssueType {
  id: string;
  type_code: string;
  label: string;
  label_en?: string;
  description?: string;
  category: IssueCategory;
  severity_default: IssueSeverityLevel;
  color?: string;
  icon?: string;
  rule_metadata?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// gcode_analysis_reports 테이블 타입
// ============================================================================

export type AnalysisReportStatus = 'pending' | 'analyzing' | 'completed' | 'failed';
export type OverallGrade = 'A' | 'B' | 'C' | 'D' | 'F';

// 분석 요약 항목 (warnings, cautions, suggestions, good_points)
export interface AnalysisSummaryItem {
  title: string;
  description: string;
  impact?: 'high' | 'medium' | 'low';
}

// 진단 요약
export interface DiagnosisSummaryData {
  keyIssue?: {
    title: string;
    description: string;
  };
  totalIssues: number;
  severity: IssueSeverityLevel;
  recommendation: string;
}

// 문제 유형별 통계
export interface IssueStatisticsItem {
  type: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
  description?: string;
}

// 상세 이슈
export interface DetailedIssueItem {
  issueType: string;
  severity: IssueSeverityLevel;
  line?: number;
  line_index?: number;
  code?: string;
  description: string;
  impact: string;
  suggestion: string;
}

// 패치 제안
export interface PatchSuggestionItem {
  line?: number;
  line_index?: number;
  action: 'remove' | 'modify' | 'insert' | 'insert_after' | 'add' | 'add_before' | 'add_after' | 'delete' | 'no_action' | 'review';
  original?: string;
  modified?: string;
  reason: string;
}

// 솔루션 가이드
export interface SolutionGuideItem {
  title: string;
  description: string;
  steps: string[];
}

// 예상 개선 효과
export interface ExpectedImprovementItem {
  label: string;
  value: string;
  progress: number;
}

// 프린팅 정보
export interface PrintingInfoDb {
  overview?: string;
  characteristics?: {
    complexity?: 'low' | 'medium' | 'high';
    estimated_quality?: 'low' | 'medium' | 'high';
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
  };
  temperature_analysis?: string;
  speed_analysis?: string;
  material_usage?: string;
  warnings?: string[];
  recommendations?: string[];
  summary_text?: string;
}

// gcode_analysis_reports 테이블 전체 타입
export interface GCodeAnalysisReport {
  id: string;
  user_id: string;
  gcode_file_id?: string;

  // 파일 정보
  file_name?: string;
  file_storage_path?: string;

  // 분석 상태
  status: AnalysisReportStatus;
  analyzed_at?: string;

  // 주요 메트릭
  print_time_seconds?: number;
  print_time_formatted?: string;
  filament_length_mm?: number;
  filament_weight_g?: number;
  filament_cost?: number;
  layer_count?: number;
  layer_height?: number;
  retraction_count?: number;
  support_percentage?: number;
  support_volume_cm3?: number;

  // 속도 정보
  speed_travel?: number;
  speed_infill?: number;
  speed_perimeter?: number;
  speed_support?: number;
  speed_max?: number;
  speed_avg?: number;
  speed_min?: number;

  // 온도 정보
  temp_nozzle?: number;
  temp_bed?: number;
  temp_nozzle_first_layer?: number;
  temp_bed_first_layer?: number;

  // 분석 점수
  overall_score?: number;
  overall_grade?: OverallGrade;

  // 이슈 카운트
  total_issues_count: number;
  critical_issues_count: number;
  high_issues_count: number;
  medium_issues_count: number;
  low_issues_count: number;

  // 분석 요약 (JSONB)
  analysis_warnings: AnalysisSummaryItem[];
  analysis_cautions: AnalysisSummaryItem[];
  analysis_suggestions: AnalysisSummaryItem[];
  analysis_good_points: AnalysisSummaryItem[];

  // AI 상세 분석 결과 (JSONB)
  diagnosis_summary?: DiagnosisSummaryData;
  issue_statistics: IssueStatisticsItem[];
  detailed_issues: DetailedIssueItem[];
  patch_suggestions: PatchSuggestionItem[];
  solution_guides: SolutionGuideItem[];
  expected_improvements: ExpectedImprovementItem[];

  // LLM 텍스트
  llm_summary?: string;
  llm_recommendation?: string;

  // 프린팅 정보
  printing_info?: PrintingInfoDb;

  // 전체 원본 데이터
  raw_analysis_data?: Record<string, unknown>;  // UI 변환 데이터 (GCodeAnalysisData)
  raw_api_response?: Record<string, unknown>;   // API 원본 응답 전체
  issues_found?: Record<string, unknown>[];     // API issues_found 원본 (그룹화된 이슈 포함)

  // 타임스탬프
  created_at: string;
  updated_at: string;
}

// Insert용 타입 (id, timestamps 제외)
export type GCodeAnalysisReportInsert = Omit<
  GCodeAnalysisReport,
  'id' | 'created_at' | 'updated_at'
>;

// Update용 타입 (partial)
export type GCodeAnalysisReportUpdate = Partial<
  Omit<GCodeAnalysisReport, 'id' | 'user_id' | 'created_at'>
>;

// 리스트 조회용 (경량 타입)
export interface GCodeAnalysisReportListItem {
  id: string;
  file_name?: string;
  status: AnalysisReportStatus;
  overall_score?: number;
  overall_grade?: OverallGrade;
  total_issues_count: number;
  high_issues_count: number;
  print_time_formatted?: string;
  filament_weight_g?: number;
  layer_count?: number;
  created_at: string;
}

// 필터 옵션
export interface AnalysisReportFilters {
  status?: AnalysisReportStatus;
  grade?: OverallGrade;
  minScore?: number;
  maxScore?: number;
  hasIssues?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

// 정렬 옵션
export type AnalysisReportSortField =
  | 'created_at'
  | 'overall_score'
  | 'total_issues_count'
  | 'file_name';

export interface AnalysisReportSortOption {
  field: AnalysisReportSortField;
  direction: 'asc' | 'desc';
}

// ============================================================================
// gcode_issue_edits 테이블 타입
// ============================================================================

export type IssueEditStatus = 'pending' | 'applied' | 'reverted';
export type EditAction = 'edit' | 'delete';
export type PatchFeedback = 'like' | 'dislike';

// 개별 수정 항목
export interface IssueEditItem {
  lineIndex: number;        // 수정된 라인 인덱스 (0-based)
  lineNumber: number;       // 수정된 라인 번호 (1-based)
  action: EditAction;
  originalContent: string;
  modifiedContent: string | null;  // delete인 경우 null
  editedAt: string;         // ISO timestamp
  // 패치 피드백 (추천/비추천)
  feedback?: PatchFeedback;
  feedbackAt?: string;      // ISO timestamp
}

// gcode_issue_edits 테이블 전체 타입
export interface GCodeIssueEdit {
  id: string;
  user_id: string;
  report_id: string;

  // 이슈 식별
  issue_index: number;
  issue_type: string;
  issue_line?: number;
  issue_line_index?: number;

  // 수정 내역
  edits: IssueEditItem[];

  // 상태
  status: IssueEditStatus;
  applied_at?: string;
  note?: string;

  // 타임스탬프
  created_at: string;
  updated_at: string;
}

// Insert용 타입
export type GCodeIssueEditInsert = Omit<
  GCodeIssueEdit,
  'id' | 'created_at' | 'updated_at'
>;

// Update용 타입
export type GCodeIssueEditUpdate = Partial<
  Omit<GCodeIssueEdit, 'id' | 'user_id' | 'report_id' | 'created_at'>
>;
