import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useTheme } from 'next-themes';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Clock,
  Layers,
  Box,
  Repeat2,
  Thermometer,
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingUp,
  Target,
  Activity,
  Printer,
  Snowflake,
  Power,
  FileCode,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  X,
  Zap,
  BarChart3,
  ListChecks,
  FileWarning,
  FileJson,
  FileSpreadsheet,
  Loader2,
  Eye,
  EyeOff,
  Grid3x3,
  Edit3,
  Wrench,
  Check,
  Trash2,
  Plus,
  XCircle,
  Download,
  Save,
  Share2,
  Copy,
} from 'lucide-react';
import { GCodeViewerModal } from './GCodeViewerModal';
import { GCodePath3DFromAPI } from './GCodePath3DFromAPI';
import { loadFullSegmentDataByReportId } from '@/lib/gcodeSegmentService';
import type { LayerSegmentData, TemperatureData } from '@/lib/api/gcode';
import { resolveIssue, type IssueResolveResponse } from '@/lib/api/gcode';
import type { SegmentMetadata } from '@/lib/gcodeSegmentService';
import { supabase } from '@shared/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createReportShare } from '@/lib/sharedReportService';
import { useAuth } from '@shared/contexts/AuthContext';

// ============================================================================
// G-code 분석 보고서 데이터 타입 정의
// LLM에서 리턴하는 분석 결과 구조
// ============================================================================

export interface GCodeAnalysisData {
  // 파일 기본 정보
  fileName?: string;
  gcodeContent?: string;
  storagePath?: string;
  analyzedAt?: string;
  reportId?: string;  // DB 보고서 ID (수정 내역 저장용)
  analysisId?: string; // 백엔드 분석 ID (AI 해결하기 API 호출용)

  // 주요 메트릭
  metrics: {
    printTime: {
      value: string;      // e.g., "4시간 31분"
      seconds?: number;   // 총 초
    };
    filamentUsage: {
      length: string;     // e.g., "12.4m"
      weight?: string;    // e.g., "37g"
      cost?: string;      // e.g., "₩1,200"
    };
    layerCount: {
      value: number;      // e.g., 383
      layerHeight?: number; // e.g., 0.2mm
    };
    retractionCount: {
      value: number;      // e.g., 2847
    };
  };

  // 서포트 비율
  support: {
    percentage: number;   // 0-100
    volume?: string;      // e.g., "3.2cm³"
  };

  // 출력 속도 통계 (새로 추가)
  printSpeed?: {
    max: number;
    avg: number;
    min?: number;
  };

  // 속도 분포
  speedDistribution: {
    travel: number;       // mm/s
    infill: number;       // mm/s
    perimeter: number;    // mm/s
    support?: number;     // mm/s
  };

  // 온도 설정
  temperature: {
    nozzle: number;       // °C
    bed: number;          // °C
    firstLayer?: {
      nozzle?: number;
      bed?: number;
    };
  };

  // 분석 결과 및 권장사항
  analysis: {
    // 위험 경고 (critical)
    warnings: AnalysisItem[];
    // 주의사항 (warning)
    cautions: AnalysisItem[];
    // 최적화 제안 (info)
    suggestions: AnalysisItem[];
    // 양호 항목 (success)
    goodPoints: AnalysisItem[];
  };

  // 전체 점수 (선택적)
  overallScore?: {
    value: number;        // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  };

  // AI 상세 분석 결과 (선택적)
  detailedAnalysis?: {
    // 진단 요약
    diagnosisSummary?: DiagnosisSummary;
    // 문제 유형별 통계
    issueStatistics?: IssueStatistics[];
    // 상세 이슈 목록
    detailedIssues?: DetailedIssue[];
    // 패치 제안
    patchSuggestions?: PatchSuggestion[];
    // 해결 가이드
    solutionGuides?: SolutionGuide[];
    // 예상 개선 효과
    expectedImprovements?: ExpectedImprovement[];
    // LLM 요약 텍스트
    llmSummary?: string;
    // 권장사항 텍스트
    llmRecommendation?: string;
    // 프린팅 정보 (LLM 요약)
    printingInfo?: PrintingInfoData;
  };
}

// 프린팅 정보 타입 (API에서 전달받는 printing_info)
export interface PrintingInfoData {
  overview?: string;
  characteristics?: {
    complexity?: 'low' | 'medium' | 'high' | 'Low' | 'Medium' | 'High' | string;
    estimated_quality?: 'low' | 'medium' | 'high' | string;  // e.g., "Grade C (70)"
    difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'Beginner' | 'Intermediate' | 'Advanced' | string;
    tags?: string[];  // e.g., ['Support Heavy', 'Early Temp Off', 'High Retraction']
  };
  temperature_analysis?: string;
  speed_analysis?: string;
  material_usage?: string;
  warnings?: string[];
  recommendations?: string[];
  summary_text?: string;
}

export interface AnalysisItem {
  title: string;
  description: string;
  impact?: 'high' | 'medium' | 'low';
}

// ============================================================================
// AI 분석 상세 결과 타입
// ============================================================================

/**
 * 그룹 내 개별 이슈 (all_issues 항목)
 * 새로운 통합 구조: all_issues는 항상 배열
 */
export interface GroupedIssueItem {
  line: number;                // 라인 번호 (필수)
  cmd?: string;                // G-code 명령어 (예: "M104 S154")
  temp?: number;               // 온도 값
  min_temp?: number;           // 최소 온도
  type?: string;               // 이슈 타입
  severity?: string;           // 개별 심각도
  description?: string;        // 개별 설명
  gcode_context?: string;      // 해당 라인의 G-code 컨텍스트 (앞뒤 N줄)
  // 레거시 호환 필드
  has_issue?: boolean;
  is_false_positive?: boolean;
  false_positive_reason?: string;
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
export interface DetailedIssue {
  // === 필수 필드 (항상 존재) ===
  id: string;                  // 이슈 고유 ID ("TEMP-1", "TEMP-GROUP-1" 등)
  type: string;                // 이슈 타입 (cold_extrusion, early_temp_off 등)
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'warning';
  is_grouped: boolean;         // 그룹 여부 (false: 단일, true: 그룹)
  count: number;               // 이슈 개수 (단일: 1, 그룹: N)
  lines: number[];             // 라인 번호 목록 (항상 배열, 단일도 [12345])
  title: string;               // 이슈 제목
  description: string;         // 이슈 설명
  all_issues: GroupedIssueItem[];  // 개별 이슈 목록 (항상 배열)

  // === 선택적 필드 (상황에 따라 존재) ===
  issueType?: string;          // type 별칭 (하위 호환용)
  impact?: string;             // 영향
  suggestion?: string;         // 제안
  layer?: number;              // 레이어 번호
  section?: string;            // 섹션 (BODY, INFILL, SUPPORT 등)
  code?: string;               // 관련 G-code 코드
  patch_id?: string | null;    // 연결된 패치 ID
  fix_proposal?: string;       // 수정 제안

  // === 레거시 호환 필드 (점진적 마이그레이션) ===
  line?: number | string;      // 단일 라인 (레거시, lines[0] 사용 권장)
  line_index?: number | string;  // 라인 인덱스 (레거시)
  gcode_context?: string;      // G-code 컨텍스트 (레거시, all_issues[].gcode_context 사용 권장)
  representative?: {           // 대표 이슈 정보 (레거시)
    cmd?: string;
    line?: number;
    temp?: number;
  };
}

export interface PatchSuggestion {
  id?: string;                 // 패치 고유 ID (예: PATCH-001)
  patch_id?: string;           // 패치 ID (new API 형식)
  issue_id?: string;           // 연결된 이슈 ID (예: ISSUE-1)
  line?: number;
  line_index?: number;
  line_number?: number;        // new API: 대상 라인 번호
  action: 'remove' | 'modify' | 'insert' | 'insert_after' | 'add' | 'add_before' | 'add_after' | 'delete' | 'no_action' | 'review';
  position?: 'before' | 'after' | 'replace';  // add 액션 시 위치 지정 (before/after/replace)
  original?: string;
  modified?: string | null;
  reason: string;
  explanation?: string;        // new API: 패치 설명
  original_line?: string;      // 원본 라인
  new_line?: string;           // 새 라인
  issue_type?: string;         // 이슈 타입
  autofix_allowed?: boolean;   // 자동 수정 허용 여부
  can_auto_apply?: boolean;    // new API: 자동 적용 가능 여부
  risk_level?: 'low' | 'medium' | 'high';  // new API: 위험도
  layer?: number;              // 레이어 번호

  // new API: 코드 컨텍스트
  original_code?: {
    line: string;
    context_before: string[];
    context_after: string[];
  };
  patched_code?: {
    line: string;
    context_before: string[];
    context_after: string[];
  };
  additional_lines?: string[]; // add_before/add_after 시 추가되는 라인들
}

export interface IssueStatistics {
  type: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
  description?: string;
}

export interface DiagnosisSummary {
  keyIssue?: {
    title: string;
    description: string;
    icon?: string;
  };
  totalIssues: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  recommendation: string;
}

export interface SolutionGuide {
  title: string;
  description: string;
  steps: string[];
}

export interface ExpectedImprovement {
  label: string;
  value: string;
  progress: number;  // 0-100
}

// ============================================================================
// 해석/설명 헬퍼 함수들
// ============================================================================

/**
 * 서포트 비율 해석 - 번역 키 반환
 */
function getSupportInterpretation(percentage: number): { textKey: string; status: 'good' | 'warning' | 'bad' } {
  if (percentage <= 15) {
    return {
      textKey: 'gcodeAnalytics.supportInterpretation.minimal',
      status: 'good'
    };
  } else if (percentage <= 30) {
    return {
      textKey: 'gcodeAnalytics.supportInterpretation.appropriate',
      status: 'good'
    };
  } else if (percentage <= 50) {
    return {
      textKey: 'gcodeAnalytics.supportInterpretation.moderate',
      status: 'warning'
    };
  } else {
    return {
      textKey: 'gcodeAnalytics.supportInterpretation.high',
      status: 'bad'
    };
  }
}

/**
 * 속도 분포 해석 - 번역 키 반환
 * 주의: 속도 값은 mm/s 단위로 변환되어 전달됨
 * - 60 mm/s: 일반적인 출력 속도
 * - 80 mm/s: 빠른 출력 속도
 * - 120 mm/s: 고속 출력
 * - 150 mm/s 이상: 이동 속도
 */
function getSpeedInterpretation(speedDistribution: {
  travel: number;
  infill: number;
  perimeter: number;
  support?: number;
}): { textKey: string; status: 'good' | 'warning' | 'bad' } {
  const { travel, infill, perimeter } = speedDistribution;

  // 외벽 속도가 너무 빠르면 품질 저하 (120mm/s 이상은 고속)
  if (perimeter > 120) {
    return {
      textKey: 'gcodeAnalytics.speedInterpretation.perimeterFast',
      status: 'warning'
    };
  }

  // 이동 속도가 출력 속도보다 느리면 비효율적
  if (travel < infill) {
    return {
      textKey: 'gcodeAnalytics.speedInterpretation.travelSlow',
      status: 'warning'
    };
  }

  // 내부 채움이 외벽보다 느리면 비효율적 (내부는 빨라도 됨)
  if (infill < perimeter * 0.8) {
    return {
      textKey: 'gcodeAnalytics.speedInterpretation.infillSlow',
      status: 'warning'
    };
  }

  // 외벽 속도가 너무 느리면 시간 낭비 (20mm/s 미만)
  if (perimeter < 20) {
    return {
      textKey: 'gcodeAnalytics.speedInterpretation.perimeterSlow',
      status: 'warning'
    };
  }

  // 이상적인 속도 분포 (현대적인 프린터 기준)
  // 외벽 <= 80mm/s, 내부 >= 80mm/s, 이동 >= 150mm/s
  if (perimeter <= 80 && infill >= 80 && travel >= 150) {
    return {
      textKey: 'gcodeAnalytics.speedInterpretation.ideal',
      status: 'good'
    };
  }

  return {
    textKey: 'gcodeAnalytics.speedInterpretation.appropriate',
    status: 'good'
  };
}

/**
 * 온도 설정 해석 - 번역 키 반환
 */
function getTemperatureInterpretation(temperature: {
  nozzle: number;
  bed: number;
  firstLayer?: { nozzle?: number; bed?: number };
}): { textKey: string; materialGuessKey: string; status: 'good' | 'warning' | 'bad' } {
  const { nozzle, bed } = temperature;

  // 온도 데이터가 없거나 비정상적으로 낮은 경우
  if (nozzle === 0 || bed === 0 || (nozzle < 150 && bed < 30)) {
    return {
      textKey: 'gcodeAnalytics.temperatureInterpretation.noData',
      materialGuessKey: 'gcodeAnalytics.materialGuess.unknown',
      status: 'warning'
    };
  }

  // PLA 범위 (180-220°C 노즐, 50-70°C 베드)
  if (nozzle >= 180 && nozzle <= 220 && bed >= 40 && bed <= 70) {
    return {
      textKey: 'gcodeAnalytics.temperatureInterpretation.pla',
      materialGuessKey: 'gcodeAnalytics.materialGuess.pla',
      status: 'good'
    };
  }

  // PETG 범위 (220-250°C 노즐, 70-90°C 베드)
  if (nozzle >= 220 && nozzle <= 260 && bed >= 70 && bed <= 90) {
    return {
      textKey: 'gcodeAnalytics.temperatureInterpretation.petg',
      materialGuessKey: 'gcodeAnalytics.materialGuess.petg',
      status: 'good'
    };
  }

  // ABS 범위 (220-260°C 노즐, 90-110°C 베드)
  if (nozzle >= 220 && nozzle <= 260 && bed >= 90 && bed <= 110) {
    return {
      textKey: 'gcodeAnalytics.temperatureInterpretation.abs',
      materialGuessKey: 'gcodeAnalytics.materialGuess.abs',
      status: 'good'
    };
  }

  // 노즐 온도가 너무 높음
  if (nozzle > 260) {
    return {
      textKey: 'gcodeAnalytics.temperatureInterpretation.highTemp',
      materialGuessKey: 'gcodeAnalytics.materialGuess.highTemp',
      status: 'warning'
    };
  }

  // 베드 온도가 너무 낮음
  if (bed < 40 && nozzle > 200) {
    return {
      textKey: 'gcodeAnalytics.temperatureInterpretation.lowBed',
      materialGuessKey: 'gcodeAnalytics.materialGuess.unknown',
      status: 'warning'
    };
  }

  return {
    textKey: 'gcodeAnalytics.temperatureInterpretation.general',
    materialGuessKey: 'gcodeAnalytics.materialGuess.general',
    status: 'good'
  };
}

// ============================================================================
// 해석 표시 컴포넌트
// ============================================================================

interface InterpretationBadgeProps {
  textKey: string;
  status: 'good' | 'warning' | 'bad';
}

const InterpretationBadge: React.FC<InterpretationBadgeProps> = ({ textKey, status }) => {
  const { t } = useTranslation();

  const statusStyles = {
    good: 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
    warning: 'bg-yellow-50 dark:bg-yellow-500/20 border-yellow-200 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
    bad: 'bg-red-50 dark:bg-red-500/20 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300',
  };

  const statusIcons = {
    good: <CheckCircle2 className="h-3 w-3 flex-shrink-0" />,
    warning: <AlertTriangle className="h-3 w-3 flex-shrink-0" />,
    bad: <AlertTriangle className="h-3 w-3 flex-shrink-0" />,
  };

  return (
    <div className={cn(
      "mt-3 p-2 rounded-lg border text-xs font-body flex items-start gap-2",
      statusStyles[status]
    )}>
      {statusIcons[status]}
      <span>{t(textKey)}</span>
    </div>
  );
};

// ============================================================================
// G-code 구문 하이라이팅 함수
// ============================================================================

const highlightGCode = (line: string): React.ReactNode => {
  if (line.trim().startsWith(';')) {
    return <span className="text-slate-400 italic">{line}</span>;
  }

  const parts = line.split(/(\s+)/);

  return parts.map((part, i) => {
    if (part.trim() === '') return part;

    // Command (G1, M104...) - Blue/Cyan
    if (/^[GM]\d+/.test(part)) {
      return <span key={i} className="text-blue-600 dark:text-blue-400 font-bold">{part}</span>;
    }

    // Coordinates (X,Y,Z,E) - Orange/Yellow for axis, Green/LightBlue for value
    if (/^[XYZE]-?[\d.]+/.test(part)) {
      const axis = part.charAt(0);
      const val = part.substring(1);
      return (
        <span key={i}>
          <span className="text-orange-600 dark:text-orange-300 font-semibold">{axis}</span>
          <span className="text-emerald-600 dark:text-emerald-300">{val}</span>
        </span>
      );
    }

    // Parameters (F,S,P) - Purple/Pink for param, Green/LightBlue for value
    if (/^[FSP]-?[\d.]+/.test(part)) {
      const param = part.charAt(0);
      const val = part.substring(1);
      return (
        <span key={i}>
          <span className="text-purple-600 dark:text-purple-300 font-semibold">{param}</span>
          <span className="text-amber-600 dark:text-amber-300">{val}</span>
        </span>
      );
    }

    if (part.startsWith(';')) {
      return <span key={i} className="text-slate-400 dark:text-slate-500 italic">{part}</span>;
    }

    return <span key={i} className="text-slate-700 dark:text-slate-300">{part}</span>;
  });
};

// ============================================================================
// 임베디드 G-code 에디터 컴포넌트
// ============================================================================

interface EmbeddedGCodeEditorProps {
  displayContent: string;
  isContextMode: boolean;
  editorFixInfo?: {
    lineNumber: number;
    original: string;
    fixed: string;
    description?: string;
  };
  onEditorApplyFix?: (lineNumber: number, originalCode: string, fixedCode: string, newContent: string) => void;
  onSaveGCode?: (content: string, fileName: string) => void;
  revertLineNumber?: number;  // 되돌릴 라인 번호 (부모에서 설정)
  onRevertComplete?: () => void;  // 되돌리기 완료 콜백
  globalAppliedCount?: number;  // 전체 적용된 패치 수 (부모에서 관리)
  onSaveModifiedGCode?: () => void;  // 부모에서 전체 수정본 저장 처리
  data: GCodeAnalysisData;
  fileName?: string;
}

const EmbeddedGCodeEditor: React.FC<EmbeddedGCodeEditorProps> = ({
  displayContent,
  isContextMode,
  editorFixInfo,
  onEditorApplyFix,
  onSaveGCode,
  revertLineNumber,
  onRevertComplete,
  globalAppliedCount = 0,
  onSaveModifiedGCode,
  data,
  fileName,
}) => {
  const { t } = useTranslation();
  const { theme, resolvedTheme } = useTheme();
  const isDarkMode = theme === 'dark' || resolvedTheme === 'dark';

  // 라인 상태
  const [lines, setLines] = React.useState<string[]>([]);
  const [originalLines, setOriginalLines] = React.useState<string[]>([]);

  // 편집 상태 (현재 미사용이지만 컨텍스트 초기화에 필요)
  const [editingLineIndex, setEditingLineIndex] = React.useState<number | null>(null);
  const [editingValue, setEditingValue] = React.useState<string>('');
  const [newlyInsertedLineIndex, setNewlyInsertedLineIndex] = React.useState<number | null>(null);
  const [hoveredLineIndex, setHoveredLineIndex] = React.useState<number | null>(null);

  // 수정 적용 완료 상태
  const [appliedFixLines, setAppliedFixLines] = React.useState<Set<number>>(new Set());

  // 변경 여부 추적 (패치 적용 시 true로 설정)
  const [hasChanges, setHasChanges] = React.useState(false);

  // 패치 히스토리 (되돌리기용) - lineNumber를 키로 사용
  const [patchHistory, setPatchHistory] = React.useState<Map<number, { lines: string[], appliedFixLines: Set<number> }>>(new Map());

  // refs
  const targetLineRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // 수정 제안 정보 파싱
  const fixLineNumber = editorFixInfo?.lineNumber;
  const fixOriginal = editorFixInfo?.original;
  const fixFixed = editorFixInfo?.fixed;

  // 컨텐츠 초기화 (새로운 컨텍스트가 로드될 때만)
  const prevDisplayContentRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (displayContent && displayContent !== prevDisplayContentRef.current) {
      // 이전 컨텐츠와 완전히 다른 새 컨텐츠인지 확인 (첫 몇 줄 비교)
      const isNewContext = !prevDisplayContentRef.current ||
        displayContent.split('\n').slice(0, 5).join('\n') !== prevDisplayContentRef.current.split('\n').slice(0, 5).join('\n');

      if (isNewContext) {
        const newLines = displayContent.split('\n');
        setLines(newLines);
        setOriginalLines(newLines);
        setEditingLineIndex(null);
        setEditingValue('');
        setNewlyInsertedLineIndex(null);
        setAppliedFixLines(new Set());
        setHasChanges(false);
        setPatchHistory(new Map());
        prevDisplayContentRef.current = displayContent;
      }
    }
  }, [displayContent]);

  // 수정 대상 라인으로 스크롤 (화면 가운데로)
  React.useEffect(() => {
    if (targetLineRef.current && editorFixInfo && scrollContainerRef.current) {
      setTimeout(() => {
        const container = scrollContainerRef.current;
        const target = targetLineRef.current;
        if (container && target) {
          const containerRect = container.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();

          // 타겟이 컨테이너 가운데에 오도록 스크롤 위치 계산
          const targetOffsetTop = target.offsetTop;
          const scrollTo = targetOffsetTop - (containerRect.height / 2) + (targetRect.height / 2);

          container.scrollTo({
            top: Math.max(0, scrollTo),
            behavior: 'smooth'
          });
        }
      }, 150);
    }
  }, [editorFixInfo, lines]);

  // 되돌리기 처리 (부모에서 revertLineNumber가 설정되면 히스토리에서 복원)
  React.useEffect(() => {
    if (revertLineNumber && patchHistory.has(revertLineNumber)) {
      const history = patchHistory.get(revertLineNumber)!;

      // 저장된 상태로 복원
      setLines(history.lines);
      setAppliedFixLines(history.appliedFixLines);

      // 히스토리에서 제거
      setPatchHistory(prev => {
        const newMap = new Map(prev);
        newMap.delete(revertLineNumber);
        return newMap;
      });

      // 변경 여부 업데이트 (히스토리가 남아있으면 변경 있음, 1개 삭제 후 0개면 false)
      setHasChanges(patchHistory.size > 1);

      // 완료 콜백 호출
      if (onRevertComplete) {
        onRevertComplete();
      }
    }
  }, [revertLineNumber, patchHistory, onRevertComplete]);

  // 자동 수정 적용 (AI 패치)
  const handleApplyFix = React.useCallback((targetIdx: number) => {
    if (!fixLineNumber || !fixOriginal || !fixFixed) return;

    // 되돌리기를 위해 현재 상태 저장
    setPatchHistory(prev => new Map(prev).set(fixLineNumber, {
      lines: [...lines],
      appliedFixLines: new Set(appliedFixLines)
    }));

    // 라인 번호에서 실제 코드만 추출 (예: "678902: M104 S193.6" -> "M104 S193.6")
    const extractCode = (lineWithNumber: string) => {
      const match = lineWithNumber.match(/^\d+:\s*(.*)$/);
      return match ? match[1] : lineWithNumber;
    };

    const fixedCode = extractCode(fixFixed);

    // 해당 라인 수정
    const newLines = [...lines];
    const currentLine = newLines[targetIdx];

    // 마커 형식 체크: ">>> 682077: M104 S193.6 <<< [문제 라인]"
    const markedMatch = currentLine.match(/^>>>\s*(\d+):\s*.*?<<<.*$/);
    // 일반 형식 체크: "682077: M104 S193.6"
    const normalMatch = currentLine.match(/^(\d+):\s*/);

    if (markedMatch) {
      // 마커 형식 -> 일반 형식으로 변환하면서 수정된 코드 적용
      newLines[targetIdx] = `${markedMatch[1]}: ${fixedCode}`;
    } else if (normalMatch) {
      // 일반 형식 유지
      newLines[targetIdx] = `${normalMatch[1]}: ${fixedCode}`;
    } else {
      // 라인 번호가 없는 경우 fixLineNumber 사용
      newLines[targetIdx] = `${fixLineNumber}: ${fixedCode}`;
    }
    setLines(newLines);

    // 적용 완료 표시
    setAppliedFixLines(prev => new Set(prev).add(targetIdx));

    // 변경 여부 표시
    setHasChanges(true);

    // 콜백 호출
    if (onEditorApplyFix) {
      const originalCode = extractCode(fixOriginal);
      // 저장용 콘텐츠에서 라인 번호 제거 (순수 G-code만 저장)
      const contentForSave = newLines.map(line => {
        // 마커 형식: ">>> 123: G1 X100 <<< [문제 라인]" -> "G1 X100"
        const markerMatch = line.match(/^>>>\s*\d+:\s*(.*?)\s*<<<.*$/);
        if (markerMatch) return markerMatch[1];
        // 일반 형식: "123: G1 X100" -> "G1 X100"
        const normalMatch = line.match(/^\s*\d+:\s*(.*)$/);
        if (normalMatch) return normalMatch[1];
        // 라인 번호 없는 경우 그대로
        return line;
      }).join('\n');
      onEditorApplyFix(fixLineNumber, originalCode, fixedCode, contentForSave);
    }
  }, [fixLineNumber, fixOriginal, fixFixed, lines, onEditorApplyFix]);

  // 다운로드 핸들러
  const handleDownload = React.useCallback(() => {
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // 파일명 생성
    const baseName = (fileName || data.fileName || 'gcode').replace(/\.gcode$/i, '');
    link.download = `${baseName}_modified.gcode`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // 콜백 호출
    if (onSaveGCode) {
      onSaveGCode(content, link.download);
    }
  }, [lines, fileName, data.fileName, onSaveGCode]);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 에디터 헤더 */}
      <div className={cn(
        "flex items-center justify-between px-4 py-2 border-b shrink-0",
        isDarkMode
          ? "bg-slate-800 border-slate-700"
          : "bg-slate-100 border-slate-200"
      )}>
        <div className="flex items-center gap-2">
          <FileCode className={cn("w-4 h-4", isDarkMode ? "text-slate-400" : "text-slate-500")} />
          <span className={cn(
            "text-sm font-mono",
            isDarkMode ? "text-slate-300" : "text-slate-700"
          )}>
            {isContextMode ? t('gcodeAnalytics.contextView', '컨텍스트 뷰') : (fileName || 'G-code')}
          </span>
          {isContextMode && (
            <Badge variant="outline" className={cn(
              "text-xs",
              isDarkMode
                ? "border-blue-500/50 text-blue-400"
                : "border-blue-500 text-blue-600"
            )}>
              {t('gcodeAnalytics.partialView', '부분 보기')}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(
            "text-xs",
            isDarkMode ? "text-slate-500" : "text-slate-400"
          )}>
            {lines.length} {t('gcodeAnalytics.lines', 'lines')}
          </span>
          {/* 저장 버튼 - 로컬 변경 또는 전체 패치가 적용된 경우 표시 */}
          {(hasChanges || globalAppliedCount > 0) && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSaveModifiedGCode || handleDownload}
              className={cn(
                "h-7 text-xs gap-1.5",
                isDarkMode
                  ? "border-emerald-600 text-emerald-400 hover:bg-emerald-900/30"
                  : "border-emerald-500 text-emerald-600 hover:bg-emerald-50"
              )}
            >
              <Download className="w-3.5 h-3.5" />
              {t('gcodeAnalytics.saveModified', '수정본 저장')}
            </Button>
          )}
        </div>
      </div>

      {/* 에디터 본문 */}
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex-1 overflow-auto font-mono text-sm",
          isDarkMode ? "bg-slate-900" : "bg-white"
        )}>
        {lines.map((line, idx) => {
          // 라인 번호 추출 (컨텍스트 모드에서는 라인에 번호가 포함됨)
          // 일반 형식: "    678902: G1 X100" (앞에 4칸 공백)
          // 문제 라인 표시 형식: ">>> 678902: M104 S193.6  <<< [문제 라인]"
          const normalLineMatch = line.match(/^\s*(\d+):\s*(.*)/);
          const markedLineMatch = line.match(/^>>>\s*(\d+):\s*(.*?)\s*<<<.*$/);

          const lineNumberMatch = markedLineMatch || normalLineMatch;
          // G-code 라인 번호 (줄 번호 컬럼에 표시)
          const gcodeLineNumber = lineNumberMatch ? lineNumberMatch[1] : '';
          // G-code 명령어만 (코드 내용에 표시)
          const codeOnly = lineNumberMatch ? lineNumberMatch[2] : line;

          // 문제 라인 마커가 있는지 확인
          const isMarkedProblemLine = !!markedLineMatch;

          // 수정 대상 라인인지 확인
          const isFixTargetLine = (fixLineNumber !== undefined && editorFixInfo) &&
            (parseInt(gcodeLineNumber) === fixLineNumber ||
             isMarkedProblemLine ||
             (fixOriginal && codeOnly.trim() === fixOriginal.replace(/^\d+:\s*/, '').trim()));

          // 이미 적용된 라인인지 확인
          const isAlreadyApplied = appliedFixLines.has(idx);

          const isHovered = hoveredLineIndex === idx;

          return (
            <React.Fragment key={idx}>
              {/* 라인 */}
              <div
                ref={isFixTargetLine ? targetLineRef : undefined}
                className={cn(
                  "flex items-stretch group transition-colors",
                  isDarkMode
                    ? "border-b border-slate-800/50"
                    : "border-b border-slate-100",
                  isFixTargetLine && !isAlreadyApplied && (isDarkMode
                    ? "bg-amber-900/20 border-l-2 border-l-amber-500"
                    : "bg-amber-50 border-l-2 border-l-amber-500"),
                  isAlreadyApplied && (isDarkMode
                    ? "bg-emerald-900/20 border-l-2 border-l-emerald-500"
                    : "bg-emerald-50 border-l-2 border-l-emerald-500"),
                  isHovered && !isFixTargetLine && (isDarkMode
                    ? "bg-slate-800/50"
                    : "bg-slate-50")
                )}
                onMouseEnter={() => setHoveredLineIndex(idx)}
                onMouseLeave={() => setHoveredLineIndex(null)}
              >
                {/* 줄 번호 (G-code 원본 라인 번호) */}
                <div className={cn(
                  "w-16 min-w-[64px] flex-shrink-0 px-2 py-1 text-right select-none border-r text-xs",
                  isDarkMode ? "border-slate-700/50" : "border-slate-200",
                  isFixTargetLine && !isAlreadyApplied
                    ? (isDarkMode ? "text-amber-400 bg-amber-900/30" : "text-amber-600 bg-amber-100/50")
                    : isAlreadyApplied
                      ? (isDarkMode ? "text-emerald-400 bg-emerald-900/30" : "text-emerald-600 bg-emerald-100/50")
                      : (isDarkMode ? "text-slate-500 bg-slate-800/30" : "text-slate-400 bg-slate-50")
                )}>
                  {gcodeLineNumber || (idx + 1)}
                </div>

                {/* 라인 내용 (순수 G-code 명령어만) */}
                <div className="flex-1 flex items-center min-w-0">
                  <div className={cn(
                    "flex-1 px-3 py-1 whitespace-pre overflow-x-auto",
                    isFixTargetLine && !isAlreadyApplied && (isDarkMode ? "text-amber-200" : "text-amber-800"),
                    isAlreadyApplied && (isDarkMode ? "text-emerald-200" : "text-emerald-800")
                  )}>
                    {highlightGCode(codeOnly)}
                  </div>
                </div>
              </div>

              {/* 인라인 수정 제안 (해당 라인 바로 아래) - GCodeViewerModal 스타일 */}
              {isFixTargetLine && editorFixInfo && !isAlreadyApplied && (
                <div className={cn(
                  "border-l-4 relative",
                  isDarkMode
                    ? "bg-amber-950/20 border-amber-400"
                    : "bg-amber-50/80 border-amber-400"
                )}>
                  {/* 배경 효과 */}
                  <div className={cn(
                    "absolute inset-0 backdrop-blur-[1px] pointer-events-none",
                    isDarkMode ? "bg-slate-800/40" : "bg-white/40"
                  )} />

                  <div className="flex relative z-10">
                    {/* 줄 번호 영역 */}
                    <div className={cn(
                      "w-16 min-w-[64px] border-r",
                      isDarkMode ? "border-slate-800 bg-transparent" : "border-slate-100 bg-transparent"
                    )} />

                    {/* 수정 제안 내용 */}
                    <div className="flex-1 px-5 py-4">
                      {/* 패치 헤더 */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded shadow-sm",
                            isDarkMode
                              ? "bg-amber-900/40 text-amber-300 border border-amber-800"
                              : "bg-amber-100 text-amber-700 border border-amber-200"
                          )}>
                            수정 예정
                          </span>
                        </div>
                      </div>

                      {/* Diff 뷰어 */}
                      <div className={cn(
                        "mb-4 rounded-xl overflow-hidden border shadow-sm",
                        isDarkMode
                          ? "bg-slate-900 border-slate-800"
                          : "bg-slate-100 border-slate-200"
                      )}>
                        {/* 원본 코드 (Before) */}
                        <div className={cn(
                          "border-b",
                          isDarkMode ? "border-slate-800" : "border-slate-200"
                        )}>
                          <div className={cn(
                            "px-3 py-1.5 flex items-center justify-between border-b",
                            isDarkMode
                              ? "bg-slate-800/50 border-slate-700/50"
                              : "bg-slate-50 border-slate-100"
                          )}>
                            <div className={cn(
                              "text-[10px] font-bold uppercase flex items-center gap-1.5",
                              isDarkMode ? "text-slate-400" : "text-slate-500"
                            )}>
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              Before (Line {fixLineNumber})
                            </div>
                          </div>
                          <div className="font-mono text-xs p-3">
                            <div className={cn(
                              "px-3 py-1 rounded border flex items-center gap-2",
                              isDarkMode
                                ? "bg-rose-950/40 text-rose-300 border-rose-900/50"
                                : "bg-rose-50 text-rose-700 border-rose-100"
                            )}>
                              <span className="text-rose-400 select-none">-</span>
                              {highlightGCode(fixOriginal?.replace(/^\d+:\s*/, '') || '')}
                            </div>
                          </div>
                        </div>

                        {/* 패치 후 코드 (After) */}
                        <div>
                          <div className={cn(
                            "px-3 py-1.5 flex items-center justify-between border-b",
                            isDarkMode
                              ? "bg-slate-800/50 border-slate-700/50"
                              : "bg-slate-50 border-slate-100"
                          )}>
                            <div className={cn(
                              "text-[10px] font-bold uppercase flex items-center gap-1.5",
                              isDarkMode ? "text-slate-400" : "text-slate-500"
                            )}>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              After
                            </div>
                          </div>
                          <div className={cn(
                            "font-mono text-xs p-3",
                            isDarkMode ? "bg-slate-800/50" : "bg-white"
                          )}>
                            <div className={cn(
                              "px-3 py-1 rounded border flex items-center gap-2 transition-all",
                              isDarkMode
                                ? "bg-amber-950/40 text-amber-100 border-amber-800"
                                : "bg-amber-50 text-amber-900 border-amber-200"
                            )}>
                              <span className="text-amber-500 font-bold select-none">~</span>
                              {highlightGCode(fixFixed?.replace(/^\d+:\s*/, '') || '')}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 패치 적용 버튼 */}
                      <div className="flex items-center justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleApplyFix(idx)}
                          className="font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg shadow-indigo-500/20 px-6"
                        >
                          <Zap className="h-4 w-4 mr-2 fill-current" />
                          이 패치 적용하기
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 컴포넌트 Props
// ============================================================================

// 패널 탭 타입
export type ReportPanelTab = 'report' | 'viewer' | 'editor';

// AI 해결 시작 정보 (사용자 질문 메시지용)
export interface AIResolveStartInfo {
  issueTitle: string;
  issueSeverity: string;
  issueDescription: string;
  issueLine?: number | string;
}

// AI 해결 완료 정보 (AI 응답 메시지용)
export interface AIResolveCompleteInfo {
  resolution: import('@/lib/api/gcode').IssueResolveResponse;
  gcodeContext?: string;  // AI 해결 요청 시 사용된 gcode_context
  reportId?: string;      // 분석 보고서 ID (DB 저장용)
}

interface GCodeAnalysisReportProps {
  data: GCodeAnalysisData;
  className?: string;
  onClose?: () => void;
  embedded?: boolean; // 인라인 카드 모드 (채팅 내 임베드)
  // 패널 탭 관련 (embedded 모드에서 사용)
  activeTab?: ReportPanelTab;
  onTabChange?: (tab: ReportPanelTab) => void;
  // AI 해결 콜백 (채팅 메시지로 추가)
  onAIResolveStart?: (info: AIResolveStartInfo) => void;  // 시작 시 (사용자 질문 + 로딩)
  onAIResolveComplete?: (info: AIResolveCompleteInfo) => void;  // 완료 시 (AI 응답)
  onAIResolveError?: (error: string) => void;  // 에러 시
  isAIResolving?: boolean;  // AI 응답 대기 중 (버튼 비활성화용)
  jumpToLine?: number;  // 에디터에서 특정 라인으로 점프
  editorContent?: string;  // 에디터에 표시할 G-code 컨텍스트 (외부에서 설정 시 전체 파일 대신 표시)
  editorLoading?: boolean;  // 에디터 컨텍스트 로딩 중
  // 에디터 수정 기능
  editorFixInfo?: {
    lineNumber: number;
    original: string;  // "678902: M104 S193.6" 형식
    fixed: string;     // "678902: M104 S200" 형식
    description?: string;
  };
  onEditorApplyFix?: (lineNumber: number, originalCode: string, fixedCode: string, newContent: string) => void;
  // 되돌리기 기능
  revertLineNumber?: number;
  onRevertComplete?: () => void;
  // 전체 패치 카운트 (저장 버튼 표시용)
  appliedPatchCount?: number;
  // 수정된 G-code 저장 콜백
  onSaveModifiedGCode?: () => void;
  // 3D 뷰어용 초기 세그먼트 데이터 (DB 로드 없이 직접 전달)
  initialSegments?: {
    layers: LayerSegmentData[];
    metadata?: SegmentMetadata;
    temperatures?: TemperatureData[];
  };
  // 코드 수정 클릭 시 에디터로 이동 콜백
  onViewCodeFix?: (fix: { line_number: number | null; original: string | null; fixed: string | null }) => void;
  // 공유 관련 (외부 제어용)
  onShare?: () => void;  // 외부에서 공유 핸들러 제공 시 사용
  showShareButton?: boolean;  // 공유 버튼 표시 여부 (기본: true)
}

import { updateGCodeFileContent } from '@/lib/gcodeAnalysisDbService';

// ============================================================================
// 보고서 컴포넌트
// ============================================================================

export const GCodeAnalysisReport: React.FC<GCodeAnalysisReportProps> = ({
  data,
  className,
  onClose,
  embedded = false,
  activeTab: externalActiveTab,
  onTabChange,
  onAIResolveStart,
  onAIResolveComplete,
  onAIResolveError,
  isAIResolving = false,
  jumpToLine: externalJumpToLine,
  editorContent: externalEditorContent,
  editorLoading: externalEditorLoading = false,
  editorFixInfo,
  onEditorApplyFix,
  revertLineNumber,
  onRevertComplete,
  appliedPatchCount = 0,
  onSaveModifiedGCode,
  initialSegments,
  onViewCodeFix,
  onShare: externalOnShare,
  showShareButton = true,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme, resolvedTheme } = useTheme();
  const isDarkMode = theme === 'dark' || resolvedTheme === 'dark';
  const { metrics, support, speedDistribution, temperature, analysis, overallScore } = data;
  const reportRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'issues' | 'optimization'>('info');
  const [expandedIssueIndices, setExpandedIssueIndices] = useState<Set<number>>(new Set([0])); // 첫 번째 이슈는 기본 펼침
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // 내부 패널 탭 상태 (non-embedded 모드용)
  const [internalPanelTab, setInternalPanelTab] = useState<ReportPanelTab>('report');
  // 실제 사용할 패널 탭 (embedded면 외부, 아니면 내부 상태)
  const currentPanelTab = embedded ? (externalActiveTab || 'report') : internalPanelTab;
  // 탭 변경 핸들러
  const handlePanelTabChange = (tab: ReportPanelTab) => {
    if (embedded && onTabChange) {
      onTabChange(tab);
    } else {
      setInternalPanelTab(tab);
    }
  };

  // 3D 뷰어 상태
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [segmentLayers, setSegmentLayers] = useState<LayerSegmentData[] | null>(null);
  const [segmentMetadata, setSegmentMetadata] = useState<SegmentMetadata | null>(null);
  const [segmentTemperatures, setSegmentTemperatures] = useState<TemperatureData[]>([]);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [showExtrusionPath, setShowExtrusionPath] = useState(true);
  const [showTravelPath, setShowTravelPath] = useState(true);
  const [showWipePath, setShowWipePath] = useState(true);
  const [showSupports, setShowSupports] = useState(true);
  const [showTemperatureChart, setShowTemperatureChart] = useState(true); // 온도 차트 표시
  const [segmentLoadAttempted, setSegmentLoadAttempted] = useState(false); // 로드 시도 여부

  // 에디터 G-code 상태 (data.gcodeContent 또는 externalEditorContent가 우선)
  const [editorGcodeContent, setEditorGcodeContent] = useState<string | null>(null);

  // 해결된 이슈 라인 번호 추적 (패치 적용 시 추가)
  const [resolvedIssueLines, setResolvedIssueLines] = useState<Set<number>>(new Set());

  // 에디터 탭 라인 점프 상태
  const [jumpToLine, setJumpToLine] = useState<number | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // 공유 관련 상태
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // 온도 차트 데이터 생성
  const temperatureChartData = useMemo(() => {
    if (!segmentTemperatures || segmentTemperatures.length === 0 || !segmentMetadata) return [];

    // 전체 레이어에 대한 온도 데이터 생성
    const chartData: { layer: number; nozzle: number | null; bed: number | null }[] = [];

    for (let i = 0; i < segmentMetadata.layerCount; i++) {
      const layerNum = i + 1;
      // 해당 레이어 이하에서 가장 가까운 온도 데이터 찾기
      const temp = [...segmentTemperatures]
        .filter(t => t.layer <= layerNum)
        .sort((a, b) => b.layer - a.layer)[0];

      chartData.push({
        layer: layerNum,
        nozzle: temp?.nozzleTemp ?? null,
        bed: temp?.bedTemp ?? null,
      });
    }

    return chartData;
  }, [segmentTemperatures, segmentMetadata]);

  // initialSegments가 전달되면 바로 사용 (DB 로드 불필요)
  useEffect(() => {
    if (initialSegments && initialSegments.layers && initialSegments.layers.length > 0) {
      console.log('[GCodeAnalysisReport] Using initialSegments, layers:', initialSegments.layers.length);
      setSegmentLayers(initialSegments.layers);
      if (initialSegments.metadata) {
        setSegmentMetadata(initialSegments.metadata);
        setCurrentLayer(initialSegments.metadata.layerCount - 1);
      } else {
        // metadata가 없으면 layers에서 추출
        const layerCount = initialSegments.layers.length;
        const lastLayer = initialSegments.layers[layerCount - 1];
        setSegmentMetadata({
          layerCount,
          totalExtrusionPaths: initialSegments.layers.reduce((sum, l) => sum + (l.extrusionCount || 0), 0),
          totalTravelPaths: initialSegments.layers.reduce((sum, l) => sum + (l.travelCount || 0), 0),
          maxZ: lastLayer?.z || 0,
        });
        setCurrentLayer(layerCount - 1);
      }
      if (initialSegments.temperatures) {
        setSegmentTemperatures(initialSegments.temperatures);
      }
      setSegmentLoadAttempted(true);
    }
  }, [initialSegments]);

  // 뷰어 탭 활성화 시 세그먼트 데이터 로드 (initialSegments가 없고 reportId가 있을 때만)
  useEffect(() => {
    if (currentPanelTab === 'viewer' && data.reportId && !segmentLayers && !viewerLoading && !segmentLoadAttempted && !initialSegments) {
      loadSegmentData();
    }
  }, [currentPanelTab, data.reportId, segmentLayers, viewerLoading, segmentLoadAttempted, initialSegments]);

  // 에디터 탭은 externalEditorContent (gcode_context)만 사용
  // 전체 G-code(data.gcodeContent)는 에디터에 로드하지 않음 (성능 문제)
  // data.gcodeContent는 수정본 저장 기능에서만 백엔드에서 사용

  // 외부에서 전달된 editorContent가 변경되면 로그 출력 (디버깅용)
  useEffect(() => {
    if (externalEditorContent) {
      console.log('[GCodeAnalysisReport] External editorContent changed, length:', externalEditorContent.length);
    }
  }, [externalEditorContent]);

  // 외부에서 전달된 jumpToLine prop이 변경되면 내부 상태 업데이트
  useEffect(() => {
    if (externalJumpToLine !== undefined && externalJumpToLine !== null) {
      console.log('[GCodeAnalysisReport] External jumpToLine changed:', externalJumpToLine);
      setJumpToLine(externalJumpToLine);
    }
  }, [externalJumpToLine]);

  // 이슈 클릭 시 에디터 탭으로 이동하고 해당 라인으로 스크롤
  const handleIssueClickToEditor = (lineNumber: number | string | undefined) => {
    if (!lineNumber) return;

    const targetLine = typeof lineNumber === 'string' ? parseInt(lineNumber, 10) : lineNumber;
    if (isNaN(targetLine) || targetLine <= 0) return;

    console.log('[GCodeAnalysisReport] Issue clicked, jumping to line:', targetLine);

    // 에디터 탭으로 전환
    if (onTabChange) {
      onTabChange('editor');
    }

    // 라인 점프 예약 (useEffect에서 처리)
    setJumpToLine(targetLine);
  };

  // 에디터 탭에서 라인 점프 처리
  useEffect(() => {
    if (jumpToLine && currentPanelTab === 'editor' && (externalEditorContent || editorGcodeContent)) {
      // 약간의 딜레이 후 스크롤 (렌더링 완료 대기)
      const timer = setTimeout(() => {
        const lineElement = document.getElementById(`gcode-line-${jumpToLine}`);
        if (lineElement) {
          lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 하이라이트 효과 (깜빡임)
          lineElement.classList.add('animate-pulse', 'bg-yellow-500/30');
          setTimeout(() => {
            lineElement.classList.remove('animate-pulse', 'bg-yellow-500/30');
          }, 2000);
        }
        setJumpToLine(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [jumpToLine, currentPanelTab, externalEditorContent, editorGcodeContent]);

  // 에디터 모달 열기 (스토리지 다운로드 로직 삭제됨 - externalEditorContent 사용)
  const handleOpenEditor = () => {
    setIsViewerOpen(true);
  };

  const loadSegmentData = async () => {
    if (!data.reportId) return;

    setViewerLoading(true);
    setViewerError(null);
    setSegmentLoadAttempted(true); // 로드 시도 표시 (무한 루프 방지)

    try {
      const { data: segmentData, error } = await loadFullSegmentDataByReportId(data.reportId);

      if (error) {
        console.error('[GCodeAnalysisReport] Segment load error:', error);
        setViewerError(t('gcodeAnalytics.segmentLoadError', '3D 데이터를 불러오는데 실패했습니다'));
        return;
      }

      if (!segmentData) {
        setViewerError(t('gcodeAnalytics.noSegmentData', '3D 시각화 데이터가 없습니다. G-code를 다시 분석해주세요.'));
        return;
      }

      setSegmentLayers(segmentData.layers);
      setSegmentMetadata(segmentData.metadata);
      setSegmentTemperatures(segmentData.temperatures);
      setCurrentLayer(segmentData.metadata.layerCount - 1); // 마지막 레이어로 초기화
    } catch (err) {
      console.error('[GCodeAnalysisReport] Segment load exception:', err);
      setViewerError(String(err));
    } finally {
      setViewerLoading(false);
    }
  };

  // JSON 다운로드 함수
  const handleDownloadJSON = () => {
    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.fileName
      ? `GCode_Analysis_${data.fileName.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.json`
      : `GCode_Analysis_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // G-code 저장 핸들러
  const handleSaveGCode = async (newContent: string) => {
    if (!data.storagePath) {
      console.error('[GCodeAnalysisReport] No storage path available for saving');
      toast({
        title: t('gcodeAnalytics.error', '오류'),
        description: t('gcodeAnalytics.noStoragePath', '저장 경로가 없습니다.'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await updateGCodeFileContent(data.storagePath, newContent);
      if (error) {
        console.error('[GCodeAnalysisReport] Failed to save G-code:', error);
        toast({
          title: t('gcodeAnalytics.saveError', '저장 실패'),
          description: error.message,
          variant: 'destructive',
        });
        throw error;
      }

      toast({
        title: t('gcodeAnalytics.saveSuccess', '저장 완료'),
        description: t('gcodeAnalytics.gcodeModified', 'G-code가 수정되었습니다.'),
      });
    } catch (e) {
      console.error('[GCodeAnalysisReport] Save exception:', e);
    }
  };

  // CSV 다운로드 함수 (이슈 목록)
  const handleDownloadCSV = () => {
    const issues = data.detailedAnalysis?.detailedIssues || [];
    if (issues.length === 0) {
      toast({
        title: t('gcodeAnalytics.noData', '데이터 없음'),
        description: t('gcodeAnalytics.noIssuesToExport', '내보낼 이슈가 없습니다.'),
        variant: 'destructive',
      });
      return;
    }

    const headers = [t('gcodeAnalytics.issueType'), t('gcodeAnalytics.severity'), t('gcodeAnalytics.lineNumber'), t('gcodeAnalytics.description'), t('gcodeAnalytics.impact'), t('gcodeAnalytics.suggestion')];
    const rows = issues.map(issue => [
      issue.type || issue.issueType || '',
      issue.severity,
      // 새 구조: lines 배열 사용, 레거시 폴백
      issue.lines?.length > 0 ? issue.lines.join(', ') : (issue.line || issue.line_index || 'N/A'),
      `"${(issue.description || '').replace(/"/g, '""')}"`,
      `"${(issue.impact || '').replace(/"/g, '""')}"`,
      `"${(issue.suggestion || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.fileName
      ? `GCode_Issues_${data.fileName.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.csv`
      : `GCode_Issues_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // PDF/인쇄용 HTML 생성 함수
  const generatePrintableHTML = (): string => {
    const issues = data.detailedAnalysis?.detailedIssues || [];
    const patches = data.detailedAnalysis?.patchSuggestions || [];
    const printingInfo = data.detailedAnalysis?.printingInfo;
    const issueStats = data.detailedAnalysis?.issueStatistics || [];

    // 심각도별 카운트 계산
    const severityCounts = {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
      info: issues.filter(i => i.severity === 'info').length,
    };
    const totalIssues = severityCounts.critical + severityCounts.high + severityCounts.medium + severityCounts.low + severityCounts.info;

    // 등급별 색상
    const getGradeColor = (grade: string) => {
      switch (grade) {
        case 'A': return '#22c55e';
        case 'B': return '#3b82f6';
        case 'C': return '#eab308';
        case 'D': return '#f97316';
        case 'F': return '#ef4444';
        default: return '#6b7280';
      }
    };

    // 심각도별 색상
    const getSeverityColor = (severity: string) => {
      switch (severity) {
        case 'critical': return { bg: '#ffe4e6', text: '#be123c', border: '#e11d48' };
        case 'high': return { bg: '#fee2e2', text: '#dc2626', border: '#ef4444' };
        case 'medium': return { bg: '#ffedd5', text: '#ea580c', border: '#f97316' };
        case 'low': return { bg: '#fef9c3', text: '#ca8a04', border: '#eab308' };
        case 'info': return { bg: '#dbeafe', text: '#2563eb', border: '#3b82f6' };
        default: return { bg: '#f3f4f6', text: '#6b7280', border: '#9ca3af' };
      }
    };

    // SVG 도넛 차트 생성 (서포트 비율)
    const generateDonutChart = (percentage: number) => {
      const radius = 40;
      const circumference = 2 * Math.PI * radius;
      const strokeDasharray = (percentage / 100) * circumference;

      return `
        <svg width="110" height="110" viewBox="0 0 100 100" style="display:block;margin:0 auto;">
          <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="12"/>
          <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#8b5cf6" stroke-width="12"
            stroke-dasharray="${strokeDasharray} ${circumference}"
            stroke-linecap="round"
            transform="rotate(-90 50 50)"/>
          <text x="50" y="50" text-anchor="middle" dominant-baseline="middle"
            font-size="18" font-weight="900" fill="#0f172a">${percentage.toFixed(1)}%</text>
        </svg>
      `;
    };

    // SVG 파이 차트 생성 (심각도 분포)
    const generateSeverityPieChart = () => {
      if (totalIssues === 0) return '<p style="color:#64748b;font-size:9pt;text-align:center;">이슈 없음</p>';

      const colors: Record<string, string> = {
        critical: '#be123c',
        high: '#ef4444',
        medium: '#f97316',
        low: '#eab308',
        info: '#3b82f6'
      };
      const radius = 35;
      let cumulativeAngle = 0;
      const segments: string[] = [];

      const severities = [
        { key: 'critical', count: severityCounts.critical },
        { key: 'high', count: severityCounts.high },
        { key: 'medium', count: severityCounts.medium },
        { key: 'low', count: severityCounts.low },
        { key: 'info', count: severityCounts.info },
      ];

      // 활성 세그먼트가 하나뿐인 경우 (100%) - 원으로 그리기
      const activeSegments = severities.filter(s => s.count > 0);
      if (activeSegments.length === 1) {
        const singleKey = activeSegments[0].key;
        return `
          <svg width="90" height="90" viewBox="0 0 100 100" style="display:block;margin:0 auto;">
            <circle cx="50" cy="50" r="${radius}" fill="${colors[singleKey]}" stroke="white" stroke-width="1"/>
          </svg>
        `;
      }

      severities.forEach(({ key, count }) => {
        if (count === 0) return;
        const angle = (count / totalIssues) * 360;
        const startRad = (cumulativeAngle - 90) * Math.PI / 180;
        const endRad = (cumulativeAngle + angle - 90) * Math.PI / 180;

        const x1 = 50 + radius * Math.cos(startRad);
        const y1 = 50 + radius * Math.sin(startRad);
        const x2 = 50 + radius * Math.cos(endRad);
        const y2 = 50 + radius * Math.sin(endRad);

        const largeArcFlag = angle > 180 ? 1 : 0;

        segments.push(`<path d="M 50 50 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${colors[key]}" stroke="white" stroke-width="1"/>`);
        cumulativeAngle += angle;
      });

      return `
        <svg width="90" height="90" viewBox="0 0 100 100" style="display:block;margin:0 auto;">
          ${segments.join('')}
        </svg>
      `;
    };

    // SVG 세로 바 차트 생성 (이슈 유형별 통계)
    const generateIssueStatsChart = () => {
      if (issueStats.length === 0) return '';

      const maxCount = Math.max(...issueStats.map(s => s.count));
      const topStats = issueStats.slice(0, 5); // 상위 5개만
      const barWidth = 36;
      const gap = 12;
      const chartWidth = topStats.length * (barWidth + gap);
      const chartHeight = 120;
      const maxBarHeight = 70;

      return `
        <svg width="100%" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" style="display:block;margin:0 auto;">
          ${topStats.map((stat, index) => {
        const x = index * (barWidth + gap) + gap / 2;
        const barHeight = maxCount > 0 ? (stat.count / maxCount) * maxBarHeight : 0;
        const barY = chartHeight - 35 - barHeight;
        const label = stat.label.length > 8 ? stat.label.substring(0, 8) + '..' : stat.label;
        return `
              <rect x="${x}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="3" fill="${stat.color || '#8b5cf6'}"/>
              <text x="${x + barWidth / 2}" y="${barY - 5}" text-anchor="middle" font-size="10" font-weight="700" fill="#0f172a">${stat.count}</text>
              <text x="${x + barWidth / 2}" y="${chartHeight - 20}" text-anchor="middle" font-size="8" fill="#475569">${label}</text>
            `;
      }).join('')}
          <line x1="0" y1="${chartHeight - 35}" x2="${chartWidth}" y2="${chartHeight - 35}" stroke="#e2e8f0" stroke-width="1"/>
        </svg>
      `;
    };

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>G-code 보고서 - ${data.fileName || '분석 결과'}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1e293b;
      background: white;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 10mm 0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #334155;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 22pt;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.025em;
    }
    .header .file-info {
      font-size: 10pt;
      color: #64748b;
      margin-top: 5px;
    }
    .header .file-name {
      font-weight: 600;
      color: #334155;
    }
    .header .file-date {
      display: block;
      margin-top: 3px;
    }
    .score-box {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .score-value {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .score-value .label {
      font-size: 9pt;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }
    .score-value .number {
      font-size: 32pt;
      font-weight: 900;
      color: #0f172a;
      line-height: 1;
    }
    .grade-badge {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22pt;
      font-weight: 900;
      color: white;
    }
    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 14pt;
      font-weight: 700;
      color: #1e293b;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 15px;
    }
    .metric-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .metric-card .label {
      font-size: 8pt;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 5px;
    }
    .metric-card .value {
      font-size: 16pt;
      font-weight: 900;
      color: #0f172a;
    }
    .metric-card .sub {
      font-size: 9pt;
      color: #64748b;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    .info-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
    }
    .info-box h4 {
      font-size: 10pt;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 10px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-row .label {
      font-size: 10pt;
      color: #475569;
    }
    .info-row .value {
      font-size: 12pt;
      font-weight: 700;
      color: #0f172a;
    }
    .issue-item {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 8px;
      page-break-inside: avoid;
    }
    .issue-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .issue-type {
      font-size: 10pt;
      font-weight: 600;
      color: #334155;
    }
    .issue-meta {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .severity-badge {
      font-size: 8pt;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .layer-badge {
      font-size: 8pt;
      color: #64748b;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .issue-desc {
      font-size: 10pt;
      color: #475569;
      margin-bottom: 5px;
    }
    .issue-suggestion {
      font-size: 9pt;
      color: #059669;
      background: #ecfdf5;
      padding: 6px 10px;
      border-radius: 4px;
      border-left: 3px solid #10b981;
    }
    .patch-item {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 8px;
      page-break-inside: avoid;
    }
    .patch-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .patch-action {
      font-size: 9pt;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .patch-action.remove { background: #fee2e2; color: #dc2626; }
    .patch-action.modify { background: #dbeafe; color: #2563eb; }
    .patch-action.insert { background: #dcfce7; color: #16a34a; }
    .patch-code {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 9pt;
      background: #1e293b;
      color: #e2e8f0;
      padding: 8px 10px;
      border-radius: 4px;
      margin: 5px 0;
      overflow-x: auto;
    }
    .patch-reason {
      font-size: 9pt;
      color: #78350f;
    }
    .summary-box {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .summary-box p {
      font-size: 10pt;
      color: #0c4a6e;
      line-height: 1.6;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 9pt;
      color: #94a3b8;
    }
    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- 헤더 -->
    <div class="header">
      <div>
        <h1>G-code 보고서</h1>
        <p class="file-info">
          <span class="file-name">${data.fileName || '분석 결과'}</span>
          <span class="file-date">${data.analyzedAt || new Date().toLocaleString('ko-KR')}</span>
        </p>
      </div>
      ${overallScore ? `
      <div class="score-box">
        <div class="score-value">
          <span class="label">OVERALL SCORE</span>
          <span class="number">${overallScore.value}</span>
        </div>
        <div class="grade-badge" style="background-color: ${getGradeColor(overallScore.grade)}">${overallScore.grade}</div>
      </div>
      ` : ''}
    </div>

    <!-- 섹션 1: 출력 정보 -->
    <div class="section">
      <h2 class="section-title">출력 정보</h2>
      
      <div class="metrics-grid">
        <div class="metric-card">
          <p class="label">예상 출력 시간</p>
          <p class="value">${metrics.printTime.value}</p>
        </div>
        <div class="metric-card">
          <p class="label">필라멘트</p>
          <p class="value">${metrics.filamentUsage.length}</p>
          ${metrics.filamentUsage.weight ? `<p class="sub">${metrics.filamentUsage.weight}</p>` : ''}
        </div>
        <div class="metric-card">
          <p class="label">레이어</p>
          <p class="value">${metrics.layerCount.value.toLocaleString()}</p>
          ${metrics.layerCount.layerHeight ? `<p class="sub">${metrics.layerCount.layerHeight}mm</p>` : ''}
        </div>
        <div class="metric-card">
          <p class="label">리트렉션</p>
          <p class="value">${metrics.retractionCount.value.toLocaleString()}</p>
          <p class="sub">회</p>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <h4>온도 설정</h4>
          <div class="info-row">
            <span class="label">노즐</span>
            <span class="value">${temperature.nozzle}°C</span>
          </div>
          <div class="info-row">
            <span class="label">베드</span>
            <span class="value">${temperature.bed}°C</span>
          </div>
        </div>
        <div class="info-box">
          <h4>서포트 비율</h4>
          ${generateDonutChart(support.percentage)}
        </div>
        <div class="info-box">
          <h4>이슈 심각도</h4>
          ${generateSeverityPieChart()}
          <div style="display:flex;justify-content:center;gap:8px;margin-top:8px;font-size:8pt;">
            <span style="color:#ef4444;">■ HIGH ${severityCounts.high}</span>
            <span style="color:#f97316;">■ MED ${severityCounts.medium}</span>
            <span style="color:#eab308;">■ LOW ${severityCounts.low}</span>
          </div>
        </div>
      </div>

      ${issueStats.length > 0 ? `
      <div class="info-box" style="margin-top:15px;">
        <h4>이슈 유형별 분포</h4>
        ${generateIssueStatsChart()}
      </div>
      ` : ''}
      </div>
    </div>

    ${printingInfo?.overview || printingInfo?.summary_text ? `
    <div class="summary-box">
      <p>${printingInfo.overview || printingInfo.summary_text}</p>
    </div>
    ` : ''}

    <!-- 섹션 2: 문제점 및 이상 상황 -->
    ${issues.length > 0 ? `
    <div class="section ${issues.length > 5 ? 'page-break' : ''}">
      <h2 class="section-title">문제점 및 이상 상황 (${issues.length}건)</h2>
      ${issues.map(issue => {
      const colors = getSeverityColor(issue.severity);
      return `
        <div class="issue-item" style="border-left: 4px solid ${colors.border}">
          <div class="issue-header">
            <span class="issue-type">${issue.issueType.replace(/_/g, ' ').toUpperCase()}</span>
            <div class="issue-meta">
              ${issue.layer !== undefined ? `<span class="layer-badge">Layer ${issue.layer}</span>` : ''}
              <span class="severity-badge" style="background: ${colors.bg}; color: ${colors.text}">${issue.severity}</span>
            </div>
          </div>
          <p class="issue-desc">${issue.description}</p>
          ${issue.suggestion ? `<p class="issue-suggestion">${issue.suggestion}</p>` : ''}
        </div>
        `;
    }).join('')}
    </div>
    ` : ''}

    <!-- 섹션 3: 최적화 방안 및 패치 제안 -->
    ${patches.length > 0 ? `
    <div class="section page-break">
      <h2 class="section-title">G-code 패치 제안 (${patches.length}건)</h2>
      ${patches.map(patch => `
        <div class="patch-item">
          <div class="patch-header">
            <span>Line ${patch.line}</span>
            <span class="patch-action ${patch.action}">${patch.action}</span>
          </div>
          ${patch.action === 'remove' && patch.original ? `<div class="patch-code">- ${patch.original}</div>` : ''}
          ${(patch.action === 'insert' || patch.action === 'insert_after') && patch.modified ? `<div class="patch-code" style="background:#14532d;color:#86efac">+ ${patch.modified}</div>` : ''}
          ${patch.action === 'modify' ? `
            ${patch.original ? `<div class="patch-code">- ${patch.original}</div>` : ''}
            ${patch.modified ? `<div class="patch-code" style="background:#14532d;color:#86efac">+ ${patch.modified}</div>` : ''}
          ` : ''}
          <p class="patch-reason">${patch.reason}</p>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- 푸터 -->
    <div class="footer">
      <p>FACTOR 3D Printer Farm • G-code Quality Analysis Report</p>
      <p>Generated on ${new Date().toLocaleString('ko-KR')}</p>
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() {
        window.close();
      };
    };
  </script>
</body>
</html>
    `;
  };

  // 공유 핸들러
  const handleShare = async () => {
    // 외부 핸들러가 있으면 그것을 사용
    if (externalOnShare) {
      externalOnShare();
      return;
    }

    // 내부 공유 로직
    if (!user?.id) {
      toast({
        title: t('gcodeAnalytics.shareFailed', '공유 실패'),
        description: t('gcodeAnalytics.loginRequired', '로그인이 필요합니다.'),
        variant: 'destructive',
      });
      return;
    }

    if (!data.reportId) {
      toast({
        title: t('gcodeAnalytics.shareFailed', '공유 실패'),
        description: t('gcodeAnalytics.saveFirst', '먼저 보고서를 저장해주세요.'),
        variant: 'destructive',
      });
      return;
    }

    setIsSharing(true);
    try {
      const { shareUrl: url, error } = await createReportShare(
        user.id,
        data.reportId,
        { title: data.fileName }
      );

      if (error || !url) {
        toast({
          title: t('gcodeAnalytics.shareFailed', '공유 실패'),
          description: error?.message || t('gcodeAnalytics.shareError', '공유 링크를 생성할 수 없습니다.'),
          variant: 'destructive',
        });
        return;
      }

      setShareUrl(url);

      // 클립보드에 복사
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);

      toast({
        title: t('gcodeAnalytics.shareSuccess', '공유 링크 생성'),
        description: t('gcodeAnalytics.linkCopied', '링크가 클립보드에 복사되었습니다.'),
      });
    } catch (err) {
      console.error('[GCodeAnalysisReport] Share error:', err);
      toast({
        title: t('gcodeAnalytics.shareFailed', '공유 실패'),
        description: t('gcodeAnalytics.shareError', '공유 링크를 생성할 수 없습니다.'),
        variant: 'destructive',
      });
    } finally {
      setIsSharing(false);
    }
  };

  // 클립보드 복사 (이미 생성된 URL)
  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);

      toast({
        title: t('gcodeAnalytics.copied', '복사됨'),
        description: t('gcodeAnalytics.linkCopied', '링크가 클립보드에 복사되었습니다.'),
      });
    } catch (err) {
      console.error('[GCodeAnalysisReport] Copy error:', err);
    }
  };

  // 인쇄 핸들러
  const handlePrint = () => {
    const printContent = generatePrintableHTML();
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    } else {
      // 팝업이 차단된 경우 대체 방법
      toast({
        title: t('gcodeAnalytics.printError', '인쇄 오류'),
        description: t('gcodeAnalytics.popupBlocked', '팝업이 차단되었습니다. 팝업 차단을 해제해주세요.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className={cn(
      "bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden shadow-sm border border-slate-200/60 dark:border-slate-700/50 gcode-report-print flex flex-col",
      embedded ? "rounded-none border-0 h-full" : "rounded-xl h-full",
      className
    )}>
      {/* 상단 헤더 - 탭 + 버튼들 (인쇄 시 숨김) */}
      <div className={cn(
        "sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/50 px-4 py-2 no-print",
        embedded && "py-1.5"
      )}>
        {/* embedded 모드: 탭 토글 + G-code 보기 버튼 */}
        {/* 통일된 헤더: 탭 + 오른쪽 버튼 */}
        <div className="flex items-center justify-between gap-2">
          {/* 왼쪽: 탭 토글 */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-slate-200 dark:border-slate-700">
            {[
              { key: 'report' as ReportPanelTab, label: t('gcodeAnalytics.tabReport', '보고서') },
              { key: 'viewer' as ReportPanelTab, label: t('gcodeAnalytics.tabViewer', '뷰어') },
              { key: 'editor' as ReportPanelTab, label: t('gcodeAnalytics.tabEditor', '에디터') },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => handlePanelTabChange(tab.key)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-full transition-colors",
                  currentPanelTab === tab.key
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 오른쪽: 공유 버튼 + 인쇄 버튼 + 닫기 버튼 */}
          <div className="flex items-center gap-1">
            {/* 공유 버튼 - reportId가 있을 때만 (저장된 보고서) */}
            {showShareButton && data.reportId && (
              shareUrl ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyShareUrl}
                  className="h-8 px-3 rounded-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  title={isCopied ? t('gcodeAnalytics.copied', '복사됨') : t('gcodeAnalytics.copyLink', '링크 복사')}
                >
                  {isCopied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  disabled={isSharing}
                  className="h-8 px-3 rounded-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  title={t('gcodeAnalytics.share', '공유')}
                >
                  {isSharing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                </Button>
              )
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              className="h-8 px-3 rounded-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              title={t('gcodeAnalytics.printPdf')}
            >
              <Printer className="h-4 w-4" />
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 px-3 rounded-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                title={t('common.close')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Viewer Modal - data.gcodeContent 또는 editorGcodeContent가 있을 때 */}
        {(data.gcodeContent || editorGcodeContent) && (
          <GCodeViewerModal
            isOpen={isViewerOpen}
            onClose={() => {
              console.log('[GCodeAnalysisReport] Closing viewer, reportId was:', data.reportId);
              setIsViewerOpen(false);
            }}
            fileName={data.fileName || 'Unknown.gcode'}
            gcodeContent={data.gcodeContent || editorGcodeContent || ''}
            issues={data.detailedAnalysis?.detailedIssues || []}
            patches={data.detailedAnalysis?.patchSuggestions || []}
            reportId={data.reportId}
            metrics={data.metrics}
          />
        )}
      </div>

      {/* 탭에 따른 컨텐츠 영역 */}
      {/* 뷰어 탭 - 3D G-code 시각화 */}
      {currentPanelTab === 'viewer' && (
        <div className={cn(
          "flex-1 flex flex-col overflow-hidden min-h-[400px]",
          isDarkMode ? "bg-slate-900" : "bg-slate-100"
        )}>
          {/* 로딩 상태 */}
          {viewerLoading && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
              <p className={cn(
                "text-sm",
                isDarkMode ? "text-slate-400" : "text-slate-600"
              )}>{t('gcodeAnalytics.loadingViewer', '3D 뷰어 로딩 중...')}</p>
            </div>
          )}

          {/* 에러 상태 */}
          {viewerError && !viewerLoading && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mb-6",
                isDarkMode ? "bg-slate-800" : "bg-slate-200"
              )}>
                <FileCode className={cn(
                  "w-8 h-8",
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                )} />
              </div>
              <h3 className={cn(
                "text-lg font-semibold mb-2",
                isDarkMode ? "text-white" : "text-slate-900"
              )}>
                {t('gcodeAnalytics.viewerError', '뷰어 로드 실패')}
              </h3>
              <p className={cn(
                "text-sm text-center max-w-md",
                isDarkMode ? "text-slate-400" : "text-slate-600"
              )}>{viewerError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSegmentLoadAttempted(false); // 재시도 허용
                  loadSegmentData();
                }}
              >
                {t('common.retry', '다시 시도')}
              </Button>
            </div>
          )}

          {/* 3D 뷰어 */}
          {segmentLayers && segmentMetadata && !viewerLoading && !viewerError && (
            <>
              {/* 3D Canvas */}
              <div className="flex-1 relative">
                <Canvas
                  camera={{
                    position: [
                      segmentMetadata.boundingBox.maxX,
                      segmentMetadata.boundingBox.maxZ * 1.5,
                      segmentMetadata.boundingBox.maxY * 1.5
                    ],
                    fov: 50,
                    near: 0.1,
                    far: 10000,
                  }}
                  gl={{ antialias: true, alpha: true }}
                >
                  <color attach="background" args={[isDarkMode ? '#0f172a' : '#f1f5f9']} />
                  <ambientLight intensity={0.6} />
                  <directionalLight position={[10, 20, 10]} intensity={0.8} />

                  {/* 베드 플레이트 */}
                  <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[
                      segmentMetadata.boundingBox.maxX / 2,
                      0,
                      segmentMetadata.boundingBox.maxY / 2
                    ]}
                    receiveShadow
                  >
                    <planeGeometry args={[
                      segmentMetadata.boundingBox.maxX,
                      segmentMetadata.boundingBox.maxY
                    ]} />
                    <meshStandardMaterial color={isDarkMode ? "#1e293b" : "#e2e8f0"} transparent opacity={0.8} />
                  </mesh>

                  {/* 그리드 */}
                  <gridHelper
                    args={[
                      Math.max(segmentMetadata.boundingBox.maxX, segmentMetadata.boundingBox.maxY),
                      20,
                      isDarkMode ? '#334155' : '#cbd5e1',
                      isDarkMode ? '#1e293b' : '#e2e8f0'
                    ]}
                    position={[
                      segmentMetadata.boundingBox.maxX / 2,
                      0.01,
                      segmentMetadata.boundingBox.maxY / 2
                    ]}
                  />

                  {/* G-code 경로 */}
                  <GCodePath3DFromAPI
                    layers={segmentLayers}
                    maxLayer={currentLayer}
                    isDarkMode={isDarkMode}
                    showExtrusionPath={showExtrusionPath}
                    showTravelPath={showTravelPath}
                    showWipePath={showWipePath}
                    showSupports={showSupports}
                  />

                  <OrbitControls
                    enableDamping
                    dampingFactor={0.05}
                    target={[
                      segmentMetadata.boundingBox.maxX / 2,
                      segmentMetadata.boundingBox.maxZ / 2,
                      segmentMetadata.boundingBox.maxY / 2
                    ]}
                  />
                </Canvas>

                {/* 오버레이 컨트롤 - 좌측 상단 (경로 타입 토글) */}
                <div className="absolute top-3 left-3 flex flex-col gap-2">
                  <div className="bg-slate-800/90 backdrop-blur rounded-lg p-2 flex flex-col gap-1.5">
                    {/* Extrusion 토글 */}
                    <button
                      onClick={() => setShowExtrusionPath(!showExtrusionPath)}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors",
                        showExtrusionPath ? "bg-emerald-600/30 text-emerald-400" : "text-slate-400 hover:bg-slate-700"
                      )}
                    >
                      {showExtrusionPath ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      <span>Extrusion</span>
                    </button>
                    {/* Travel 토글 */}
                    <button
                      onClick={() => setShowTravelPath(!showTravelPath)}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors",
                        showTravelPath ? "bg-cyan-600/30 text-cyan-400" : "text-slate-400 hover:bg-slate-700"
                      )}
                    >
                      {showTravelPath ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      <span>Travel</span>
                    </button>
                    {/* Wipe 토글 */}
                    {segmentLayers.some(l => l.wipeData && l.wipeCount && l.wipeCount > 0) && (
                      <button
                        onClick={() => setShowWipePath(!showWipePath)}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors",
                          showWipePath ? "bg-purple-600/30 text-purple-400" : "text-slate-400 hover:bg-slate-700"
                        )}
                      >
                        {showWipePath ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>Wipe</span>
                      </button>
                    )}
                    {/* Support 토글 */}
                    {segmentLayers.some(l => l.supportData && l.supportCount && l.supportCount > 0) && (
                      <button
                        onClick={() => setShowSupports(!showSupports)}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors",
                          showSupports ? "bg-amber-600/30 text-amber-400" : "text-slate-400 hover:bg-slate-700"
                        )}
                      >
                        {showSupports ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>Support</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 하단 레이어 컨트롤 */}
              <div className="bg-slate-800/95 backdrop-blur border-t border-slate-700 p-3">
                <div className="flex items-center gap-3">
                  {/* 레이어 이동 버튼 */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
                    onClick={() => setCurrentLayer(Math.max(0, currentLayer - 1))}
                    disabled={currentLayer === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  {/* 레이어 슬라이더 */}
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {t('gcodeAnalytics.layer', '레이어')}: {currentLayer + 1} / {segmentMetadata.layerCount}
                    </span>
                    <Slider
                      value={[currentLayer]}
                      min={0}
                      max={segmentMetadata.layerCount - 1}
                      step={1}
                      onValueChange={([val]) => setCurrentLayer(val)}
                      className="flex-1"
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
                    onClick={() => setCurrentLayer(Math.min(segmentMetadata.layerCount - 1, currentLayer + 1))}
                    disabled={currentLayer === segmentMetadata.layerCount - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* 레이어 정보 */}
                <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                  <div className="flex items-center gap-4">
                    <span>Z: {segmentLayers[currentLayer]?.z?.toFixed(2) || 0}mm</span>
                    <span>H: {segmentMetadata.layerHeight}mm</span>
                    {segmentMetadata.estimatedTime && (
                      <span>{t('gcodeAnalytics.estimatedTime', '예상 시간')}: {segmentMetadata.estimatedTime}</span>
                    )}
                  </div>
                  {/* 온도 정보 + 차트 토글 */}
                  <div className="flex items-center gap-3">
                    {segmentTemperatures.length > 0 && (() => {
                      // 현재 레이어 이하에서 가장 가까운 온도 데이터 찾기
                      const currentLayerNum = currentLayer + 1;
                      const temp = [...segmentTemperatures]
                        .filter(t => t.layer <= currentLayerNum)
                        .sort((a, b) => b.layer - a.layer)[0];
                      if (!temp) return null;
                      return (
                        <>
                          {temp.nozzleTemp !== null && (
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              <span>{t('gcodeAnalytics.nozzle', '노즐')}: {temp.nozzleTemp}°C</span>
                            </span>
                          )}
                          {temp.bedTemp !== null && (
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-orange-500" />
                              <span>{t('gcodeAnalytics.bed', '베드')}: {temp.bedTemp}°C</span>
                            </span>
                          )}
                        </>
                      );
                    })()}
                    {/* 온도 차트 토글 버튼 */}
                    {temperatureChartData.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-slate-400 hover:text-white"
                        onClick={() => setShowTemperatureChart(!showTemperatureChart)}
                      >
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {showTemperatureChart ? t('common.hide', '숨기기') : t('common.show', '보기')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* 온도 차트 섹션 */}
              {showTemperatureChart && temperatureChartData.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {t('gcodeAnalytics.temperatureByLayer', '레이어별 온도 변화')}
                      </span>
                    </div>
                    {/* 온도 범례 */}
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-[2px] bg-red-500 rounded" />
                        <span className="text-slate-700 dark:text-slate-300">{t('gcodeAnalytics.nozzle', '노즐')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-[2px] bg-orange-500 rounded" />
                        <span className="text-slate-700 dark:text-slate-300">{t('gcodeAnalytics.bed', '베드')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={temperatureChartData}
                        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="layer"
                          tick={{ fontSize: 10, fill: resolvedTheme === 'dark' ? '#9ca3af' : '#6b7280' }}
                          axisLine={{ stroke: resolvedTheme === 'dark' ? '#4b5563' : '#d1d5db' }}
                          tickLine={false}
                          interval="preserveStartEnd"
                          tickFormatter={(value) => `L${value}`}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: resolvedTheme === 'dark' ? '#9ca3af' : '#6b7280' }}
                          axisLine={{ stroke: resolvedTheme === 'dark' ? '#4b5563' : '#d1d5db' }}
                          tickLine={false}
                          width={35}
                          domain={['auto', 'auto']}
                          tickFormatter={(value) => `${value}°`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: resolvedTheme === 'dark' ? '#1f2937' : '#ffffff',
                            border: `1px solid ${resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'}`,
                            borderRadius: '6px',
                            fontSize: '12px',
                          }}
                          labelStyle={{ color: resolvedTheme === 'dark' ? '#f3f4f6' : '#111827' }}
                          formatter={(value: number, name: string) => [
                            `${value}°C`,
                            name === 'nozzle' ? t('gcodeAnalytics.nozzle', '노즐') : t('gcodeAnalytics.bed', '베드')
                          ]}
                          labelFormatter={(label) => `${t('gcodeAnalytics.layer', '레이어')} ${label}`}
                        />
                        {/* 현재 레이어 위치 표시 */}
                        <ReferenceLine
                          x={currentLayer + 1}
                          stroke={resolvedTheme === 'dark' ? '#60a5fa' : '#3b82f6'}
                          strokeWidth={2}
                          strokeDasharray="4 4"
                        />
                        <Line
                          type="stepAfter"
                          dataKey="nozzle"
                          stroke="#ef4444"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: '#ef4444' }}
                          connectNulls
                        />
                        <Line
                          type="stepAfter"
                          dataKey="bed"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: '#f97316' }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 에디터 탭 - G-code 편집기 */}
      {currentPanelTab === 'editor' && (
        <div className={cn(
          "flex-1 flex flex-col overflow-hidden",
          isDarkMode ? "bg-slate-900" : "bg-slate-50"
        )}>
          {/* 로딩 상태 */}
          {externalEditorLoading && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mb-6",
                isDarkMode ? "bg-slate-800" : "bg-slate-200"
              )}>
                <Loader2 className={cn(
                  "w-8 h-8 animate-spin",
                  isDarkMode ? "text-blue-400" : "text-blue-600"
                )} />
              </div>
              <h3 className={cn(
                "text-lg font-semibold mb-2",
                isDarkMode ? "text-white" : "text-slate-900"
              )}>
                {t('gcodeAnalytics.loadingContext', '코드 컨텍스트 로딩 중...')}
              </h3>
              <p className={cn(
                "text-sm text-center max-w-md",
                isDarkMode ? "text-slate-400" : "text-slate-500"
              )}>
                {t('gcodeAnalytics.loadingContextDesc', '잠시만 기다려주세요.')}
              </p>
            </div>
          )}

          {/* G-code 컨텍스트 없음 상태 - 이슈 유무에 따라 다른 메시지 표시 */}
          {!externalEditorLoading && !externalEditorContent && !editorGcodeContent && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mb-6",
                isDarkMode ? "bg-slate-800" : "bg-slate-200"
              )}>
                <FileCode className={cn(
                  "w-8 h-8",
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                )} />
              </div>
              <h3 className={cn(
                "text-lg font-semibold mb-2",
                isDarkMode ? "text-white" : "text-slate-900"
              )}>
                {t('gcodeAnalytics.noContextSelected', '코드 컨텍스트 없음')}
              </h3>
              <p className={cn(
                "text-sm text-center max-w-md",
                isDarkMode ? "text-slate-400" : "text-slate-500"
              )}>
                {(data.detailedAnalysis?.detailedIssues?.length ?? 0) > 0
                  ? t('gcodeAnalytics.selectIssueCard', '보고서 탭 > 문제점 > AI 해결하기를 통해 수정할 문제를 선택해주세요.')
                  : t('gcodeAnalytics.noIssuesFound', '발견된 이슈가 없습니다.')}
              </p>
            </div>
          )}

          {/* G-code 에디터 - 카드 클릭으로 컨텍스트가 설정된 경우에만 표시 (전체 G-code는 표시하지 않음) */}
          {!externalEditorLoading && (externalEditorContent || editorGcodeContent) && (
            <EmbeddedGCodeEditor
              displayContent={externalEditorContent || editorGcodeContent || ''}
              isContextMode={!!externalEditorContent}
              editorFixInfo={editorFixInfo}
              onEditorApplyFix={(lineNumber, originalCode, fixedCode, newContent) => {
                // 해결된 라인 추적
                setResolvedIssueLines(prev => new Set(prev).add(lineNumber));
                // 원래 콜백 호출
                if (onEditorApplyFix) {
                  onEditorApplyFix(lineNumber, originalCode, fixedCode, newContent);
                }
              }}
              revertLineNumber={revertLineNumber}
              onRevertComplete={onRevertComplete}
              globalAppliedCount={appliedPatchCount}
              onSaveModifiedGCode={onSaveModifiedGCode}
              data={data}
              fileName={data.fileName}
            />
          )}
        </div>
      )}

      {/* 보고서 내용 - PDF 캡처 대상 (report 탭일 때) */}
      {currentPanelTab === 'report' && (
      <ScrollArea className="flex-1 overflow-auto">
      <div ref={reportRef}>
        {/* 헤더 - Premium Gradient Design */}
        <div className={cn(
          "relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white",
          embedded ? "px-5 py-6" : "px-8 py-10"
        )}>
          {/* Background decoration */}
          <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
            <Target className="w-64 h-64" />
          </div>

          <div className="relative z-10 flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white/80 border border-white/10">
                  AI Powered Analysis
                </span>
                {data.analyzedAt && (
                  <span className="text-xs text-white/50 font-body">
                    {data.analyzedAt}
                  </span>
                )}
              </div>
              <h1 className={cn(
                "font-title font-bold tracking-tight text-white drop-shadow-sm",
                embedded ? "text-2xl lg:text-3xl" : "text-4xl lg:text-5xl"
              )}>
                {t('gcodeAnalytics.reportTitle')}
              </h1>
              <p className="text-white/70 text-base max-w-xl font-body leading-relaxed">
                {data.fileName ? (
                  <>Analysis report for <span className="text-white font-semibold underline decoration-white/30 underline-offset-4">{data.fileName}</span></>
                ) : t('gcodeAnalytics.analysisResult')}
              </p>
            </div>

            {overallScore && (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-4 bg-white/5 backdrop-blur-sm border border-white/10 p-4 rounded-2xl shadow-xl">
                  <div className="text-right">
                    <p className="text-xs text-white/60 uppercase tracking-widest font-heading font-semibold mb-0.5">{t('gcodeAnalytics.overallScore')}</p>
                    <p className="text-4xl font-score font-black text-white leading-none">{overallScore.value}</p>
                  </div>
                  <div className={cn(
                    "w-16 h-16 rounded-xl flex items-center justify-center text-4xl font-score font-black text-white shadow-lg ring-4 ring-white/10",
                    overallScore.grade === 'A' && "bg-gradient-to-br from-emerald-400 to-emerald-600",
                    overallScore.grade === 'B' && "bg-gradient-to-br from-blue-400 to-blue-600",
                    overallScore.grade === 'C' && "bg-gradient-to-br from-yellow-400 to-yellow-600",
                    overallScore.grade === 'D' && "bg-gradient-to-br from-orange-400 to-orange-600",
                    overallScore.grade === 'F' && "bg-gradient-to-br from-red-400 to-red-600"
                  )}>
                    {overallScore.grade}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div >

        {/* 탭 네비게이션 - Modern Style */}
        <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
          <div className="px-6 flex gap-8">
            <button
              onClick={() => setActiveTab('info')}
              className={cn(
                "py-4 text-sm font-heading font-medium border-b-2 transition-all duration-200 relative",
                activeTab === 'info'
                  ? "border-violet-600 text-violet-700 dark:text-violet-400 dark:border-violet-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              {t('gcodeAnalytics.tabInfo')}
            </button>
            <button
              onClick={() => setActiveTab('issues')}
              className={cn(
                "py-4 text-sm font-heading font-medium border-b-2 transition-all duration-200",
                activeTab === 'issues'
                  ? "border-violet-600 text-violet-700 dark:text-violet-400 dark:border-violet-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <div className="flex items-center gap-2">
                {t('gcodeAnalytics.tabIssues')}
                <span className={cn(
                  "ml-1 px-2 py-0.5 rounded-full text-[10px] font-black leading-none",
                  activeTab === 'issues'
                    ? "bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                )}>
                  {analysis.warnings.length + (data.detailedAnalysis?.detailedIssues?.reduce((acc, curr) => acc + (curr.count || 1), 0) || 0)}
                </span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('optimization')}
              className={cn(
                "py-4 text-sm font-heading font-medium border-b-2 transition-all duration-200",
                activeTab === 'optimization'
                  ? "border-violet-600 text-violet-700 dark:text-violet-400 dark:border-violet-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              {t('gcodeAnalytics.tabOptimization')}
            </button>
          </div>
        </div >

        <div className="p-6 space-y-6 min-h-[500px]">
          {/* ================================================================ */}
          {/* TAB 1: 출력 정보 (Print Info) */}
          {/* ================================================================ */}
          {activeTab === 'info' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* 주요 메트릭 카드 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 출력 시간 */}
                <MetricCard
                  icon={<Clock className="h-5 w-5" />}
                  label={t('gcodeAnalytics.printTime')}
                  value={metrics.printTime.value}
                  color="blue"
                />

                {/* 필라멘트 사용량 */}
                <MetricCard
                  icon={<Box className="h-5 w-5" />}
                  label={t('gcodeAnalytics.filament')}
                  value={metrics.filamentUsage.length}
                  subValue={metrics.filamentUsage.weight}
                  color="green"
                />

                {/* 레이어 수 */}
                <MetricCard
                  icon={<Layers className="h-5 w-5" />}
                  label={t('gcodeAnalytics.layer')}
                  value={metrics.layerCount.value.toLocaleString()}
                  subValue={metrics.layerCount.layerHeight ? `${metrics.layerCount.layerHeight}mm` : undefined}
                  color="purple"
                />

                {/* 리트렉션 횟수 */}
                <MetricCard
                  icon={<Repeat2 className="h-5 w-5" />}
                  label={t('gcodeAnalytics.retraction')}
                  value={`${metrics.retractionCount.value.toLocaleString()} ${t('gcodeAnalytics.retractionCount', '회')}`}
                  color="orange"
                />
              </div>

              {/* 차트 및 온도 섹션 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 서포트 비율 - 도넛 차트 */}
                <div className="bg-slate-50 dark:bg-slate-800/35 backdrop-blur rounded-xl p-5 border border-slate-200 dark:border-slate-700/65 flex flex-col">
                  <h3 className="text-base font-heading font-semibold text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    {t('gcodeAnalytics.supportRatio')}
                  </h3>
                  <div className="flex-grow flex items-center justify-center">
                    <div className="relative w-40 h-40">
                      {/* 도넛 차트 배경 */}
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="10"
                          className="text-slate-200 dark:text-slate-700"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${(support.percentage / 100) * 251.2} 251.2`}
                          className="text-primary"
                        />
                      </svg>
                      {/* 중앙 텍스트 */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-heading font-bold text-slate-900 dark:text-white">{support.percentage.toFixed(1)}%</span>
                        {support.volume && (
                          <span className="text-xs font-body text-slate-500 dark:text-slate-400">{support.volume}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* 서포트 비율 해석 - 하단 고정 */}
                  <div className="mt-auto">
                    <InterpretationBadge {...getSupportInterpretation(support.percentage)} />
                  </div>
                </div>


                {/* 속도 분포 - 바 차트 (speedDistribution이 있을 때만 표시) */}
                {speedDistribution && (
                  <div className="bg-slate-50 dark:bg-slate-800/35 backdrop-blur rounded-xl p-5 border border-slate-200 dark:border-slate-700/65 flex flex-col">
                    <h3 className="text-base font-heading font-semibold text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      {t('gcodeAnalytics.speedDistribution')}
                    </h3>
                    <div className="flex-grow space-y-3">
                      {(() => {
                        // 속도 중 최댓값을 기준으로 바 크기 계산
                        const speeds = [
                          speedDistribution.travel,
                          speedDistribution.infill,
                          speedDistribution.perimeter,
                          speedDistribution.support,
                        ].filter((v): v is number => v !== undefined);
                        const maxSpeed = Math.max(...speeds);

                        return (
                          <>
                            <SpeedBar label={t('gcodeAnalytics.travel')} value={speedDistribution.travel} maxValue={maxSpeed} color="blue" />
                            <SpeedBar label={t('gcodeAnalytics.infill')} value={speedDistribution.infill} maxValue={maxSpeed} color="green" />
                            <SpeedBar label={t('gcodeAnalytics.perimeter')} value={speedDistribution.perimeter} maxValue={maxSpeed} color="purple" />
                            {speedDistribution.support !== undefined && (
                              <SpeedBar label={t('gcodeAnalytics.support')} value={speedDistribution.support} maxValue={maxSpeed} color="orange" />
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {/* 속도 분포 해석 - 하단 고정 */}
                    <div className="mt-auto">
                      <InterpretationBadge {...getSpeedInterpretation(speedDistribution)} />
                    </div>
                  </div>
                )}

                {/* 온도 설정 */}
                <div className="bg-slate-50 dark:bg-slate-800/35 backdrop-blur rounded-xl p-5 border border-slate-200 dark:border-slate-700/65 flex flex-col">
                  <h3 className="text-base font-heading font-semibold text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                    <Thermometer className="h-5 w-5" />
                    {t('gcodeAnalytics.temperatureSettings')}
                  </h3>
                  <div className="flex-grow space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-base font-body text-slate-700 dark:text-white">{t('gcodeAnalytics.nozzle')}</span>
                      </div>
                      <span className="text-xl font-heading font-bold text-slate-900 dark:text-white">{typeof temperature.nozzle === 'number' ? temperature.nozzle.toFixed(1) : temperature.nozzle}°C</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span className="text-base font-body text-slate-700 dark:text-white">{t('gcodeAnalytics.bed')}</span>
                      </div>
                      <span className="text-xl font-heading font-bold text-slate-900 dark:text-white">{typeof temperature.bed === 'number' ? temperature.bed.toFixed(1) : temperature.bed}°C</span>
                    </div>
                    {temperature.firstLayer && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50">
                        <p className="text-sm text-slate-500 mb-2">{t('gcodeAnalytics.firstLayerSettings')}</p>
                        <div className="grid grid-cols-2 gap-2 text-sm text-slate-700 dark:text-white">
                          {temperature.firstLayer.nozzle && (
                            <span>{t('gcodeAnalytics.nozzle')}: {typeof temperature.firstLayer.nozzle === 'number' ? temperature.firstLayer.nozzle.toFixed(1) : temperature.firstLayer.nozzle}°C</span>
                          )}
                          {temperature.firstLayer.bed && (
                            <span>{t('gcodeAnalytics.bed')}: {typeof temperature.firstLayer.bed === 'number' ? temperature.firstLayer.bed.toFixed(1) : temperature.firstLayer.bed}°C</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* 온도 설정 해석 - 하단 고정 */}
                  <div className="mt-auto">
                    {(() => {
                      const tempInterpretation = getTemperatureInterpretation(temperature);
                      return (
                        <div className={cn(
                          "mt-3 p-2 rounded-lg border text-xs",
                          tempInterpretation.status === 'good' && "bg-emerald-50 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
                          tempInterpretation.status === 'warning' && "bg-yellow-50 dark:bg-yellow-500/20 border-yellow-200 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-300",
                          tempInterpretation.status === 'bad' && "bg-red-50 dark:bg-red-500/20 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300"
                        )}>
                          <div className="flex items-start gap-2">
                            {tempInterpretation.status === 'good' ? (
                              <CheckCircle2 className="h-3 w-3 flex-shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                            )}
                            <div>
                              <span className="block">{t(tempInterpretation.textKey)}</span>
                              <span className="block mt-1 text-slate-500 dark:text-slate-400">
                                {t('gcodeAnalytics.estimatedMaterial')}: <span className="text-slate-900 dark:text-white font-medium">{t(tempInterpretation.materialGuessKey)}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* 양호 항목 (출력 정보 탭에 포함) */}
              {analysis.goodPoints.length > 0 && (
                <AnalysisSection
                  title={t('gcodeAnalytics.highQuality')}
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  items={analysis.goodPoints}
                  variant="success"
                />
              )}

              {/* 프린팅 정보 요약 (출력 정보 탭에 포함) */}
              {data.detailedAnalysis?.printingInfo && (
                <div className="bg-white/80 dark:bg-slate-800/40 backdrop-blur-sm rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm custom-scrollbar">
                  <div className="flex items-center gap-3 mb-5 border-b border-slate-100 dark:border-slate-700/50 pb-4">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                      <Info className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-heading font-bold text-slate-900 dark:text-white">
                        {t('gcodeAnalytics.diagnosisSummary')}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Detailed Analysis & Insights</p>
                    </div>
                  </div>

                  {/* 진단 요약 설명 (diagnosisSummary에서 이동) */}
                  {(data.detailedAnalysis?.diagnosisSummary?.keyIssue?.description || data.detailedAnalysis?.llmSummary) && (
                    <div className="mb-6 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30">
                      <p className="text-sm font-body text-slate-700 dark:text-slate-300 leading-relaxed">
                        {data.detailedAnalysis?.diagnosisSummary?.keyIssue?.description || data.detailedAnalysis?.llmSummary}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 온도 분석 */}
                    {data.detailedAnalysis.printingInfo.temperature_analysis && (
                      <div>
                        <p className="text-xs font-heading font-bold uppercase text-slate-400 dark:text-slate-500 mb-2 tracking-wider">{t('gcodeAnalytics.temperatureAnalysis')}</p>
                        <p className="text-sm font-body text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                          {data.detailedAnalysis.printingInfo.temperature_analysis}
                        </p>
                      </div>
                    )}

                    {/* 속도 분석 */}
                    {data.detailedAnalysis.printingInfo.speed_analysis && (
                      <div>
                        <p className="text-xs font-heading font-bold uppercase text-slate-400 dark:text-slate-500 mb-2 tracking-wider">{t('gcodeAnalytics.speedAnalysis')}</p>
                        <p className="text-sm font-body text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                          {data.detailedAnalysis.printingInfo.speed_analysis}
                        </p>
                      </div>
                    )}

                    {/* 재료 사용 */}
                    {data.detailedAnalysis.printingInfo.material_usage && (
                      <div className="md:col-span-2">
                        <p className="text-xs font-heading font-bold uppercase text-slate-400 dark:text-slate-500 mb-2 tracking-wider">{t('gcodeAnalytics.materialUsage')}</p>
                        <p className="text-sm font-body text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                          {data.detailedAnalysis.printingInfo.material_usage}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 권장사항 */}
                  {data.detailedAnalysis.printingInfo.recommendations && data.detailedAnalysis.printingInfo.recommendations.length > 0 && (
                    <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-700/50">
                      <p className="text-xs font-heading font-bold uppercase text-blue-500 dark:text-blue-400 mb-3 tracking-wider flex items-center gap-2">
                        <TrendingUp className="h-3 w-3" />
                        {t('gcodeAnalytics.recommendations')}
                      </p>
                      <ul className="space-y-2">
                        {data.detailedAnalysis.printingInfo.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: 문제점 및 이상 상황 (Issues) */}
          {/* ================================================================ */}
          {activeTab === 'issues' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* 진단 요약 카드 */}
              {data.detailedAnalysis?.diagnosisSummary && (
                <DiagnosisSummaryCard summary={data.detailedAnalysis.diagnosisSummary} detailedIssues={data.detailedAnalysis?.detailedIssues} />
              )}

              {/* 위험 경고 */}
              {analysis.warnings.length > 0 && (
                <AnalysisSection
                  title={t('gcodeAnalytics.dangerWarning')}
                  icon={<AlertTriangle className="h-5 w-5" />}
                  items={analysis.warnings}
                  variant="danger"
                />
              )}

              {/* 주의사항 */}
              {analysis.cautions.length > 0 && (
                <AnalysisSection
                  title={t('gcodeAnalytics.cautions')}
                  icon={<Info className="h-5 w-5" />}
                  items={analysis.cautions}
                  variant="warning"
                />
              )}

              {/* 문제 유형별 통계 */}
              {data.detailedAnalysis?.issueStatistics && data.detailedAnalysis.issueStatistics.length > 0 && (
                <IssueStatisticsChart statistics={data.detailedAnalysis.issueStatistics} />
              )}

              {/* 상세 이슈 목록 */}
              {data.detailedAnalysis?.detailedIssues && data.detailedAnalysis.detailedIssues.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-heading font-semibold">
                    <ListChecks className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    {t('gcodeAnalytics.detailedIssueAnalysis')}
                  </div>
                  <div className="divide-y divide-slate-200 dark:divide-slate-600/60 rounded-xl border border-slate-200 dark:border-slate-600/65 overflow-hidden bg-slate-50 dark:bg-slate-800/35">
                    {data.detailedAnalysis.detailedIssues.map((issue, index) => (
                      <DetailedIssueCard
                        key={index}
                        issue={issue}
                        index={index}
                        isExpanded={expandedIssueIndices.has(index)}
                        onToggle={() => {
                          setExpandedIssueIndices(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(index)) {
                              newSet.delete(index);
                            } else {
                              newSet.add(index);
                            }
                            return newSet;
                          });
                        }}
                        gcodeContent={data.gcodeContent}
                        onSaveGCode={handleSaveGCode}
                        fileName={data.fileName}
                        allIssues={data.detailedAnalysis?.detailedIssues || []}
                        patches={data.detailedAnalysis?.patchSuggestions || []}
                        reportId={data.reportId}
                        metrics={data.metrics}
                        analysisId={data.analysisId}
                        onAIResolveStart={onAIResolveStart}
                        onAIResolveComplete={onAIResolveComplete}
                        onAIResolveError={onAIResolveError}
                        isAIResolving={isAIResolving}
                        groupCount={issue.count}
                        groupLines={issue.lines}
                        onLineClick={handleIssueClickToEditor}
                        resolvedLines={resolvedIssueLines}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/10 rounded-xl border border-slate-300 dark:border-slate-800 border-dashed font-body">
                  발견된 상세 문제가 없습니다.
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 3: 최적화 방안 (Optimization) */}
          {/* ================================================================ */}
          {activeTab === 'optimization' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* AI 최적화 제안 (AnalysisSection 활용) */}
              {analysis.suggestions.length > 0 && (
                <AnalysisSection
                  title="AI 최적화 제안"
                  icon={<TrendingUp className="h-5 w-5" />}
                  items={analysis.suggestions}
                  variant="info"
                />
              )}

              {/* 예상 개선 효과 (solutionGuides 중복 제거, 개선 효과만 표시) */}
              {data.detailedAnalysis?.expectedImprovements && data.detailedAnalysis.expectedImprovements.length > 0 && (
                <div className="bg-green-50 dark:bg-green-500/5 border border-green-200 dark:border-green-500/20 rounded-xl p-6">
                  <h3 className="text-xl font-title font-bold text-green-600 dark:text-green-300 mb-5 flex items-center gap-2">
                    <TrendingUp className="h-6 w-6" />
                    예상 개선 효과
                  </h3>
                  <div className="space-y-4">
                    {data.detailedAnalysis.expectedImprovements.map((imp, index) => (
                      <div key={index}>
                        <div className="flex items-center justify-between text-base mb-1">
                          <span className="font-body text-slate-600 dark:text-slate-400">{imp.label}</span>
                          <span className="font-score font-black text-green-600 dark:text-green-400">{imp.value}</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${imp.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 패치 제안 */}
              {data.detailedAnalysis?.patchSuggestions && data.detailedAnalysis.patchSuggestions.length > 0 && (
                <PatchSuggestionsSection patches={data.detailedAnalysis.patchSuggestions} />
              )}
            </div>
          )}
        </div>
      </div>
      </ScrollArea>
      )}
    </div>
  );
};

// ============================================================================
// 서브 컴포넌트들
// ============================================================================

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function MetricCard({ icon, label, value, subValue, color }: MetricCardProps) {
  const colorStyles = {
    blue: 'from-blue-50 to-white dark:from-blue-900/10 dark:to-slate-800 border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400',
    green: 'from-emerald-50 to-white dark:from-emerald-900/10 dark:to-slate-800 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    purple: 'from-violet-50 to-white dark:from-violet-900/10 dark:to-slate-800 border-violet-100 dark:border-violet-500/20 text-violet-600 dark:text-violet-400',
    orange: 'from-orange-50 to-white dark:from-orange-900/10 dark:to-slate-800 border-orange-100 dark:border-orange-500/20 text-orange-600 dark:text-orange-400',
  };

  const iconBgStyles = {
    blue: 'bg-blue-100 dark:bg-blue-500/20',
    green: 'bg-emerald-100 dark:bg-emerald-500/20',
    purple: 'bg-violet-100 dark:bg-violet-500/20',
    orange: 'bg-orange-100 dark:bg-orange-500/20',
  };

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-2xl p-5 border shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 bg-gradient-to-br",
      colorStyles[color]
    )}>
      {/* 라벨 + 아이콘 (한 줄에 정렬) */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-heading font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">{label}</span>
        <div className={cn("flex-shrink-0 p-2 rounded-xl transition-transform group-hover:scale-110", iconBgStyles[color])}>
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { className: "h-4 w-4" }) : icon}
        </div>
      </div>
      {/* 값 영역 */}
      <div className="space-y-1">
        <div className="text-3xl font-score font-bold text-slate-900 dark:text-white tracking-tight leading-none">{value}</div>
        {subValue && (
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{subValue}</div>
        )}
      </div>
    </div>
  );
}

interface SpeedBarProps {
  label: string;
  value: number;
  maxValue: number;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function SpeedBar({ label, value, maxValue, color }: SpeedBarProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const displayValue = Math.round(value);

  const barStyles = {
    blue: 'bg-gradient-to-r from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-400 box-shadow-blue',
    green: 'bg-gradient-to-r from-emerald-400 to-emerald-600 dark:from-emerald-500 dark:to-emerald-400 box-shadow-green',
    purple: 'bg-gradient-to-r from-violet-400 to-violet-600 dark:from-violet-500 dark:to-violet-400 box-shadow-purple',
    orange: 'bg-gradient-to-r from-orange-400 to-orange-600 dark:from-orange-500 dark:to-orange-400 box-shadow-orange',
  };

  const shadowStyles = {
    blue: 'shadow-[0_0_12px_-2px_rgba(59,130,246,0.3)] dark:shadow-[0_0_15px_-2px_rgba(59,130,246,0.5)]',
    green: 'shadow-[0_0_12px_-2px_rgba(16,185,129,0.3)] dark:shadow-[0_0_15px_-2px_rgba(16,185,129,0.5)]',
    purple: 'shadow-[0_0_12px_-2px_rgba(139,92,246,0.3)] dark:shadow-[0_0_15px_-2px_rgba(139,92,246,0.5)]',
    orange: 'shadow-[0_0_12px_-2px_rgba(249,115,22,0.3)] dark:shadow-[0_0_15px_-2px_rgba(249,115,22,0.5)]',
  };

  return (
    <div className="group">
      <div className="flex justify-between text-sm mb-2">
        <span className="font-heading font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">{label}</span>
        <span className="font-mono font-bold text-slate-900 dark:text-white">{displayValue} <span className="text-xs text-slate-400 font-normal">mm/s</span></span>
      </div>
      <div className="h-3.5 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600/50">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            barStyles[color],
            shadowStyles[color]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface AnalysisSectionProps {
  title: string;
  icon: React.ReactNode;
  items: AnalysisItem[];
  variant: 'danger' | 'warning' | 'info' | 'success';
}

function AnalysisSection({ title, icon, items, variant }: AnalysisSectionProps) {
  const variantStyles = {
    danger: {
      bg: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-500/20',
      header: 'text-red-700 dark:text-red-400',
      icon: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-500/20',
      header: 'text-amber-700 dark:text-amber-400',
      icon: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    },
    info: {
      bg: 'bg-sky-50 dark:bg-sky-900/10 border-sky-100 dark:border-sky-500/20',
      header: 'text-sky-700 dark:text-sky-400',
      icon: 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400',
    },
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-500/20',
      header: 'text-emerald-700 dark:text-emerald-400',
      icon: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className={cn("rounded-2xl border p-6 transition-all duration-300 hover:shadow-md", styles.bg)}>
      <div className={cn("flex items-center gap-4 mb-5", styles.header)}>
        <div className={cn("p-2.5 rounded-xl shadow-sm", styles.icon)}>
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-heading font-bold">{title}</h3>
        </div>
        <span className="text-sm font-score font-black bg-white/50 dark:bg-black/20 px-3 py-1 rounded-full shadow-sm">
          {items.length}
        </span>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="group bg-white dark:bg-slate-800/80 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-base font-warning font-semibold text-slate-800 dark:text-slate-100 mb-1 group-hover:text-primary transition-colors">{item.title}</p>
                <p className="text-sm font-body text-slate-600 dark:text-slate-400 leading-relaxed">{item.description}</p>
              </div>
              {item.impact && (
                <span className={cn(
                  "text-[10px] px-2.5 py-1 rounded-full uppercase font-bold tracking-wider",
                  item.impact === 'high' && "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30",
                  item.impact === 'medium' && "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30",
                  item.impact === 'low' && "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                )}>
                  {item.impact}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// AI 상세 분석 섹션 컴포넌트
// ============================================================================

interface DetailedAnalysisSectionProps {
  detailedAnalysis: NonNullable<GCodeAnalysisData['detailedAnalysis']>;
  gcodeContent?: string;
  onSaveGCode?: (newContent: string) => Promise<void>;
  fileName?: string;
  metrics?: GCodeAnalysisData['metrics'];
  analysisId?: string;
  onAIResolveStart?: (info: AIResolveStartInfo) => void;
  onAIResolveComplete?: (info: AIResolveCompleteInfo) => void;
  onAIResolveError?: (error: string) => void;
  isAIResolving?: boolean;
  onLineClick?: (line: number | string) => void;
}

function DetailedAnalysisSection({ detailedAnalysis, gcodeContent, onSaveGCode, fileName, metrics, analysisId, onAIResolveStart, onAIResolveComplete, onAIResolveError, isAIResolving, onLineClick }: DetailedAnalysisSectionProps) {
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [showAllIssues, setShowAllIssues] = useState(false);

  const {
    diagnosisSummary,
    issueStatistics,
    detailedIssues,
    patchSuggestions,
    expectedImprovements,
    llmSummary,
    llmRecommendation
  } = detailedAnalysis;

  // 백엔드에서 그룹화된 이슈를 그대로 사용
  // 새 구조: lines, count, is_grouped가 항상 존재
  const groupedIssues = useMemo(() => {
    if (!detailedIssues || detailedIssues.length === 0) return [];

    return detailedIssues.map(issue => ({
      issue,
      // 새 구조: lines 배열이 항상 존재 (레거시 폴백 포함)
      lines: issue.lines || (issue.line !== undefined ? [issue.line] : []),
      count: issue.count || 1,
    }));
  }, [detailedIssues]);

  // 표시할 이슈 수 제한
  const displayedIssues = showAllIssues
    ? groupedIssues
    : groupedIssues?.slice(0, 5);

  return (
    <div className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-700/50">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-violet-100 dark:bg-violet-500/20 rounded-lg">
          <Zap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-title font-bold text-slate-900 dark:text-white">AI 상세 분석 결과</h2>
          <p className="text-xs font-body text-slate-500 dark:text-slate-400">LLM이 분석한 G-code 문제점 및 해결 방안</p>
        </div>
      </div>

      {/* 진단 요약 카드 */}
      {diagnosisSummary && (
        <DiagnosisSummaryCard summary={diagnosisSummary} detailedIssues={detailedIssues} />
      )}

      {/* 문제 유형별 통계 */}
      {issueStatistics && issueStatistics.length > 0 && (
        <IssueStatisticsChart statistics={issueStatistics} />
      )}

      {/* 예상 개선 효과 */}
      {expectedImprovements && expectedImprovements.length > 0 && (
        <div className="bg-green-50 dark:bg-green-500/5 border border-green-200 dark:border-green-500/20 rounded-xl p-6">
          <h3 className="text-xl font-title font-bold text-green-600 dark:text-green-300 mb-5 flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            예상 개선 효과
          </h3>
          <div className="space-y-4">
            {expectedImprovements.map((imp, index) => (
              <div key={index}>
                <div className="flex items-center justify-between text-base mb-1">
                  <span className="font-body text-slate-600 dark:text-slate-400">{imp.label}</span>
                  <span className="font-score font-black text-green-600 dark:text-green-400">{imp.value}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${imp.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 상세 이슈 목록 */}
      {detailedIssues && detailedIssues.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              <h3 className="font-heading font-semibold text-slate-900 dark:text-white">발견된 문제 상세 분석</h3>
              <span className="text-xs font-score font-black bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 px-2 py-0.5 rounded-full">
                {groupedIssues.reduce((sum, g) => sum + g.count, 0)}건 ({groupedIssues.length}종류)
              </span>
            </div>
            {groupedIssues.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllIssues(!showAllIssues)}
                className="font-body text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                {showAllIssues ? '접기' : `모두 보기 (${groupedIssues.length})`}
                {showAllIssues ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
              </Button>
            )}
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700/30">
            {displayedIssues?.map((groupedIssue, index) => (
              <DetailedIssueCard
                key={index}
                issue={groupedIssue.issue}
                index={index}
                isExpanded={expandedIssue === index}
                onToggle={() => setExpandedIssue(expandedIssue === index ? null : index)}
                gcodeContent={gcodeContent}
                onSaveGCode={onSaveGCode}
                fileName={fileName}
                allIssues={detailedIssues}
                patches={patchSuggestions || []}
                analysisId={analysisId}
                onAIResolveStart={onAIResolveStart}
                onAIResolveComplete={onAIResolveComplete}
                onAIResolveError={onAIResolveError}
                isAIResolving={isAIResolving}
                groupCount={groupedIssue.count}
                groupLines={groupedIssue.lines}
                onLineClick={onLineClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* 패치 제안 */}
      {patchSuggestions && patchSuggestions.length > 0 && (
        <PatchSuggestionsSection patches={patchSuggestions} />
      )}

      {/* LLM 요약 텍스트 */}
      {llmSummary && (
        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-5 border border-slate-200 dark:border-slate-700/50">
          <h3 className="text-sm font-heading font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
            <Info className="h-4 w-4" />
            분석 요약
          </h3>
          <p className="text-sm font-body text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{llmSummary}</p>
        </div>
      )}

      {/* LLM 권장사항 */}
      {llmRecommendation && (
        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-5 border border-blue-200 dark:border-blue-500/30">
          <h3 className="text-sm font-heading font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            권장사항
          </h3>
          <p className="text-sm font-body text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{llmRecommendation}</p>
        </div>
      )}
    </div>
  );
};

// 진단 요약 카드
function DiagnosisSummaryCard({ summary, detailedIssues }: { summary: DiagnosisSummary; detailedIssues?: DetailedIssue[] }) {
  const { t } = useTranslation();

  // 실제 이슈 개수 계산: 리스트 개수 + 그룹화된 이슈의 count 합산
  const calculatedTotalIssues = detailedIssues
    ? detailedIssues.reduce((total, issue) => total + (issue.count || 1), 0)
    : summary.totalIssues;

  const severityStyles = {
    critical: {
      bg: 'bg-rose-50 dark:bg-rose-950/20',
      border: 'border-rose-100 dark:border-rose-900/30',
      icon: 'text-rose-600 dark:text-rose-400',
      badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
    },
    high: {
      bg: 'bg-red-50 dark:bg-red-950/20',
      border: 'border-red-100 dark:border-red-900/30',
      icon: 'text-red-600 dark:text-red-400',
      badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
    },
    medium: {
      bg: 'bg-orange-50 dark:bg-orange-950/20',
      border: 'border-orange-100 dark:border-orange-900/30',
      icon: 'text-orange-600 dark:text-orange-400',
      badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
    },
    low: {
      bg: 'bg-yellow-50 dark:bg-yellow-950/20',
      border: 'border-yellow-100 dark:border-yellow-900/30',
      icon: 'text-yellow-600 dark:text-yellow-400',
      badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300'
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      border: 'border-blue-100 dark:border-blue-900/30',
      icon: 'text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
    }
  };

  const severityLabels: Record<string, string> = {
    critical: t('gcodeAnalytics.severityCritical'),
    high: t('gcodeAnalytics.severityHigh'),
    medium: t('gcodeAnalytics.severityMedium'),
    low: t('gcodeAnalytics.severityLow'),
    info: t('gcodeAnalytics.severityInfo'),
  };

  const style = severityStyles[summary.severity] || severityStyles.info;

  // 출력 판단 문구 생성 (severity 기반)
  const getPrintabilityVerdict = () => {
    switch (summary.severity) {
      case 'critical':
        return t('gcodeAnalytics.verdictReslice', '재슬라이싱 권장');
      case 'high':
        return t('gcodeAnalytics.verdictCautionReslice', '주의 필요 - 재슬라이싱 고려');
      case 'medium':
        return t('gcodeAnalytics.verdictCaution', '주의하여 출력');
      case 'low':
      case 'info':
      default:
        return t('gcodeAnalytics.verdictPrintOk', '출력 권장');
    }
  };

  return (
    <div className={cn("rounded-xl p-5 border shadow-sm", style.bg, style.border)}>
      <div className="flex flex-col md:flex-row gap-4 md:items-start">
        <div className={cn("p-3 rounded-xl bg-white shadow-sm shrink-0", style.icon)}>
          <Thermometer className="h-7 w-7" strokeWidth={1.5} />
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", style.badge)}>
              {severityLabels[summary.severity] || summary.severity}
            </span>
            <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">{t('gcodeAnalytics.diagnosisSummary')}</span>
          </div>
          <h3 className="text-base font-title font-bold text-slate-900 dark:text-white leading-snug">
            {summary.keyIssue?.title || t('gcodeAnalytics.analysisCompleted')}
          </h3>
          <p className="text-sm font-body text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
            {summary.recommendation}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-700/50">
        <div className="flex items-center gap-3 p-3 bg-white/50 dark:bg-slate-900/20 rounded-lg border border-white/50 dark:border-white/5">
          <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-500">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-heading font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('gcodeAnalytics.totalIssues')}</p>
            <p className="text-base font-score font-black text-slate-900 dark:text-white">{t('gcodeAnalytics.issueCountUnit', { count: calculatedTotalIssues })}</p>
          </div>
        </div>

        <div className="sm:col-span-2 lg:col-span-2 flex items-center gap-3 p-3 bg-white/50 dark:bg-slate-900/20 rounded-lg border border-white/50 dark:border-white/5">
          <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-md text-blue-500">
            <Info className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-heading font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('gcodeAnalytics.printabilityVerdict')}</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{getPrintabilityVerdict()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 문제 유형별 통계 차트
function IssueStatisticsChart({ statistics }: { statistics: IssueStatistics[] }) {
  const { t } = useTranslation();

  const getIcon = (type: string) => {
    switch (type) {
      case 'cold_extrusion':
        return <Snowflake className="h-4 w-4" />;
      case 'early_temp_off':
        return <Power className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="bg-white/50 dark:bg-slate-800/20 backdrop-blur-sm rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
      <h3 className="text-base font-heading font-semibold text-slate-600 dark:text-slate-400 mb-6 flex items-center gap-2">
        <div className="p-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
          <BarChart3 className="h-4 w-4" />
        </div>
        {t('gcodeAnalytics.issueStatsByType')}
      </h3>
      <div className="space-y-6">
        {statistics.map((stat, index) => (
          <div key={index}>
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-heading font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span className={cn("w-5 flex justify-center", stat.color === 'red' ? 'text-rose-500' : 'text-orange-500')}>
                  {getIcon(stat.type)}
                </span>
                {stat.label}
              </span>
              <span className={cn(
                "text-base font-score font-black",
                stat.color === 'red' ? 'text-rose-600 dark:text-rose-400' : 'text-orange-600 dark:text-orange-400'
              )}>
                {t('gcodeAnalytics.issueCountUnit', { count: stat.count })}
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700/30 rounded-full h-5 overflow-hidden relative shadow-inner">
              <div
                className={cn(
                  "h-full rounded-full flex items-center justify-end pr-3 transition-all duration-1000 ease-out shadow-lg",
                  stat.color === 'red'
                    ? 'bg-gradient-to-r from-rose-400 to-rose-600 dark:from-rose-500 dark:to-rose-400 shadow-rose-500/20'
                    : 'bg-gradient-to-r from-orange-400 to-orange-600 dark:from-orange-500 dark:to-orange-400 shadow-orange-500/20'
                )}
                style={{ width: `${Math.max(stat.percentage, 5)}%` }}
              >
                <span className="text-[10px] text-white font-score font-black drop-shadow-md">{stat.percentage}%</span>
              </div>
            </div>
            {stat.description && (
              <p className="text-xs font-body text-slate-500 dark:text-slate-500 mt-2 pl-9 leading-relaxed">{stat.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 상세 이슈 카드
function DetailedIssueCard({ issue, index, isExpanded, onToggle, gcodeContent, onSaveGCode, fileName, allIssues, patches, reportId, metrics, analysisId, onAIResolveStart, onAIResolveComplete, onAIResolveError, isAIResolving, groupCount, groupLines, onLineClick, resolvedLines }: {
  issue: DetailedIssue;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  gcodeContent?: string;
  onSaveGCode?: (newContent: string) => Promise<void>;
  fileName?: string;
  allIssues?: DetailedIssue[];
  patches?: PatchSuggestion[];
  reportId?: string;
  metrics?: GCodeAnalysisData['metrics'];
  analysisId?: string;
  onAIResolveStart?: (info: AIResolveStartInfo) => void;
  onAIResolveComplete?: (info: AIResolveCompleteInfo) => void;
  onAIResolveError?: (error: string) => void;
  isAIResolving?: boolean;
  groupCount?: number;
  groupLines?: (number | string)[];
  onLineClick?: (line: number | string) => void;  // 라인 번호 클릭 시 에디터로 이동
  resolvedLines?: Set<number>;  // 해결된 라인 번호들
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showGCodeModal, setShowGCodeModal] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolution, setResolution] = useState<IssueResolveResponse | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showResolution, setShowResolution] = useState(false);

  const severityStyles = {
    critical: { strip: 'bg-rose-600', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300', icon: 'text-rose-600' },
    high: { strip: 'bg-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300', icon: 'text-red-500' },
    medium: { strip: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300', icon: 'text-orange-500' },
    low: { strip: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300', icon: 'text-amber-500' },
    info: { strip: 'bg-blue-400', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300', icon: 'text-blue-500' },
  };

  const style = severityStyles[issue.severity] || severityStyles.info;

  // 이슈가 해결되었는지 확인 (이슈의 라인 번호 중 하나라도 resolvedLines에 있으면 해결됨)
  const isResolved = useMemo(() => {
    if (!resolvedLines || resolvedLines.size === 0) return false;
    // 단일 라인
    if (issue.line !== undefined && resolvedLines.has(Number(issue.line))) return true;
    // 그룹화된 라인들
    if (groupLines && groupLines.length > 0) {
      return groupLines.some(line => resolvedLines.has(Number(line)));
    }
    return false;
  }, [resolvedLines, issue.line, groupLines]);

  const getIssueTypeLabel = (type: string) => {
    const key = `gcodeAnalytics.issueTypeLabels.${type}`;
    const translated = t(key);
    return translated !== key ? translated : type;
  };

  const getSeverityLabel = (severity: string) => {
    return t(`gcodeAnalytics.severityBadge.${severity}`);
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'cold_extrusion':
      case 'extreme_cold':
        return <Snowflake className="h-4 w-4" />;
      case 'early_temp_off':
      case 'early_bed_off':
        return <Power className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  // AI 해결하기 핸들러
  const handleAIResolve = async () => {
    if (!analysisId) {
      toast({
        title: t('gcodeAnalytics.aiResolveError', 'AI 해결 오류'),
        description: t('gcodeAnalytics.noAnalysisId', '분석 ID가 없습니다.'),
        variant: 'destructive',
      });
      return;
    }

    // 새 구조: lines 배열이 항상 존재, count는 이슈 개수
    const effectiveGroupLines = groupLines || issue.lines || [];
    const effectiveGroupCount = groupCount || issue.count || 1;
    const isGrouped = issue.is_grouped || effectiveGroupCount > 1 || effectiveGroupLines.length > 1;

    // 대표 라인 번호 (새 구조: lines[0] 사용)
    const lineNumber = effectiveGroupLines[0] || (typeof issue.line === 'string' ? parseInt(issue.line, 10) : (issue.line || issue.line_index as number || 0));
    const issueTitle = issue.title || getIssueTypeLabel(issue.type || issue.issueType || '');

    // 시작 콜백 호출 (사용자 질문 메시지 + 로딩 시작)
    if (onAIResolveStart) {
      onAIResolveStart({
        issueTitle,
        issueSeverity: issue.severity,
        issueDescription: issue.description,
        // 그룹: 첫 번째 라인 전달, 단일: lineNumber
        issueLine: isGrouped ? effectiveGroupLines[0] : lineNumber,
      });
    }

    setIsResolving(true);
    try {
      // issue 원본 데이터를 그대로 전송 (DetailedIssue → Record<string, unknown>)
      const requestData = {
        analysis_id: analysisId,
        conversation_id: conversationId,
        issue: issue as unknown as Record<string, unknown>,
        language: 'ko' as const,
      };

      // API 요청 로그
      console.log('[DetailedIssueCard] AI resolve request:', requestData);

      const response = await resolveIssue(requestData);

      // API 응답 로그
      console.log('[DetailedIssueCard] AI resolve response:', response);

      if (response.success) {
        setResolution(response);
        setConversationId(response.conversation_id);
        setShowResolution(true);
        toast({
          title: t('gcodeAnalytics.aiResolveSuccess', 'AI 해결 완료'),
          description: t('gcodeAnalytics.aiResolveSolutionReady', '해결 방안이 준비되었습니다.'),
        });

        // 완료 콜백 호출 (AI 응답 메시지)
        if (onAIResolveComplete) {
          // gcode_context: issue에서 직접 가져오거나 all_issues[0]에서 가져옴
          const gcodeCtx = issue.gcode_context || issue.all_issues?.[0]?.gcode_context;
          onAIResolveComplete({ resolution: response, gcodeContext: gcodeCtx, reportId });
        }
      } else {
        throw new Error(response.error || 'Unknown error');
      }
    } catch (err) {
      console.error('[DetailedIssueCard] AI resolve error:', err);
      const errorMsg = String(err);
      toast({
        title: t('gcodeAnalytics.aiResolveError', 'AI 해결 오류'),
        description: errorMsg,
        variant: 'destructive',
      });
      // 에러 콜백 호출
      if (onAIResolveError) {
        onAIResolveError(errorMsg);
      }
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "group relative bg-white dark:bg-slate-900 overflow-hidden transition-all duration-300 border-b border-slate-100 dark:border-slate-800 last:border-b-0",
          isExpanded ? "bg-slate-50/50 dark:bg-slate-800/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/30",
          isResolved && "bg-emerald-50/50 dark:bg-emerald-900/10"
        )}
      >
        {/* Left Status Strip */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
          isResolved ? "bg-emerald-500" : style.strip,
          isExpanded || isResolved ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )} />

        {/* 헤더 */}
        <div
          className="px-6 py-5 flex items-center justify-between cursor-pointer select-none pl-7"
          onClick={onToggle}
        >
          <div className="flex items-center gap-4 overflow-hidden">
            {/* Icon Box */}
            <div className={cn("p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0", style.icon)}>
              {getIssueIcon(issue.issueType)}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-heading font-bold text-slate-900 dark:text-white truncate">
                  {issue.title || getIssueTypeLabel(issue.type || issue.issueType || '')}
                </h4>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider", style.badge)}>
                  {getSeverityLabel(issue.severity)}
                </span>
                {/* 해결됨 뱃지 */}
                {isResolved && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {t('gcodeAnalytics.resolved', '해결됨')}
                  </span>
                )}
                {/* 새 구조: count가 항상 존재 */}
                {(issue.count || groupCount || 1) > 1 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                    ×{issue.count || groupCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 flex-wrap">
                {/* 새 구조: lines 배열이 항상 존재 */}
                {(() => {
                  const effectiveLines = issue.lines || groupLines || [];
                  if (effectiveLines.length > 1) {
                    return (
                      <>
                        <span className="text-slate-400 dark:text-slate-500">LN</span>
                        {effectiveLines.map((ln, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              onLineClick?.(ln);
                            }}
                            className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                            title={t('gcodeAnalytics.clickToViewInEditor', '에디터에서 보기')}
                          >
                            {typeof ln === 'number' ? ln.toLocaleString() : ln}
                          </button>
                        ))}
                      </>
                    );
                  }
                  // 단일 라인 또는 레거시 폴백
                  const lineNum = effectiveLines[0] || issue.line || issue.line_index;
                  return (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (lineNum) onLineClick?.(lineNum);
                      }}
                      className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                      title={t('gcodeAnalytics.clickToViewInEditor', '에디터에서 보기')}
                    >
                      <span>LN</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {lineNum || 'N/A'}
                      </span>
                    </button>
                  );
                })()}
                {issue.layer !== undefined && issue.layer !== null && (
                  <span className="flex items-center gap-1">
                    <span>LYR</span>
                    <span className="font-bold">{issue.layer.toLocaleString()}</span>
                  </span>
                )}
                {issue.section && (
                  <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">
                    {issue.section}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 pl-4 shrink-0">
            {!isExpanded && (
              <p className="hidden md:block text-sm text-slate-500 max-w-[300px] truncate">
                {issue.description}
              </p>
            )}
            <div className={cn(
              "p-2 rounded-full transition-all duration-200",
              isExpanded ? "bg-slate-200 dark:bg-slate-700 rotate-180" : "bg-transparent text-slate-400 group-hover:bg-slate-100 dark:group-hover:bg-slate-800"
            )}>
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* 내용 */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-in-out",
            isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden">
            <div className="px-6 pb-6 pl-16">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Description & Metadata */}
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-heading font-bold uppercase text-slate-400 mb-2 tracking-wider">{t('gcodeAnalytics.analysisContent')}</p>
                    <p className="text-base font-body text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      {issue.description}
                    </p>
                  </div>

                  {issue.impact && (
                    <div>
                      <p className="text-xs font-heading font-bold uppercase text-slate-400 mb-2 tracking-wider">{t('gcodeAnalytics.impact')}</p>
                      <p className="text-sm font-body text-slate-600 dark:text-slate-400 leading-relaxed">
                        {issue.impact}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right Column: Code & Actions */}
                <div className="space-y-6">
                  {issue.code && (
                    <div className="relative group/code">
                      <p className="text-xs font-heading font-bold uppercase text-slate-400 mb-2 tracking-wider">{t('gcodeAnalytics.foundCode')}</p>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/50 border-b border-slate-800">
                          <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">G-code Snippet</span>
                        </div>
                        <code className="block p-4 font-mono text-sm text-emerald-400 overflow-x-auto">
                          {issue.code}
                        </code>
                      </div>
                    </div>
                  )}

                  {issue.suggestion && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl">
                      <div className="flex gap-3">
                        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-heading font-bold uppercase text-blue-600 dark:text-blue-400 mb-1 tracking-wider">{t('gcodeAnalytics.suggestion')}</p>
                          <p className="text-sm font-body text-slate-700 dark:text-slate-300">{issue.suggestion}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      size="sm"
                      className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAIResolve();
                      }}
                      disabled={isResolving || isAIResolving || !analysisId}
                    >
                      {isResolving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      {isResolving
                        ? t('gcodeAnalytics.aiResolving', '분석 중...')
                        : t('gcodeAnalytics.aiSolve', 'AI 해결하기')
                      }
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* G-code 뷰어 모달 (GCodeViewerModal 사용) */}
      {showGCodeModal && gcodeContent && (
        <GCodeViewerModal
          isOpen={showGCodeModal}
          onClose={() => setShowGCodeModal(false)}
          fileName={fileName || 'unknown.gcode'}
          gcodeContent={gcodeContent}
          issues={allIssues || [issue]}
          patches={patches || []}
          onSave={onSaveGCode}
          reportId={reportId}
          initialIssueIndex={index}
          metrics={metrics}
        />
      )}
    </>
  );
}

// AI 해결 결과 패널
function AIResolutionPanel({
  resolution,
  onClose,
  onViewCode,
  onViewCodeFix
}: {
  resolution: IssueResolveResponse;
  onClose: () => void;
  onViewCode?: () => void;
  onViewCodeFix?: (fix: { line_number: number | null; original: string | null; fixed: string | null }) => void;
}) {
  const { t } = useTranslation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['explanation']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const { explanation, solution, tips } = resolution.resolution;

  // 디버그: solution 구조 확인
  console.log('[AIResolutionPanel] solution:', solution);
  console.log('[AIResolutionPanel] solution.code_fix:', solution?.code_fix);
  console.log('[AIResolutionPanel] solution.code_fixes:', solution?.code_fixes);

  // 디버그: code_fixes 배열 각 항목 상세 출력
  if (solution?.code_fixes) {
    console.log('[AIResolutionPanel] code_fixes length:', solution.code_fixes.length);
    solution.code_fixes.forEach((fix, idx) => {
      console.log(`[AIResolutionPanel] code_fixes[${idx}]:`, {
        line_number: fix.line_number,
        has_fix: fix.has_fix,
        original: fix.original ? `"${fix.original.substring(0, 50)}..."` : null,
        fixed: fix.fixed ? `"${fix.fixed.substring(0, 50)}..."` : null,
        original_type: typeof fix.original,
        fixed_type: typeof fix.fixed,
        passesFilter: !!(fix.original && fix.fixed)
      });
    });
    const filtered = solution.code_fixes.filter(fix => fix.original && fix.fixed);
    console.log('[AIResolutionPanel] filtered code_fixes count:', filtered.length);
  }

  // 심각도 라벨
  const severityLabels: Record<string, string> = {
    none: t('gcodeAnalytics.severityNone', '없음'),
    low: t('gcodeAnalytics.severityLow', '낮음'),
    medium: t('gcodeAnalytics.severityMedium', '중간'),
    high: t('gcodeAnalytics.severityHigh', '높음'),
    critical: t('gcodeAnalytics.severityCritical', '치명적'),
  };

  // 오탐 여부에 따라 헤더 색상/텍스트 변경
  const isNormal = explanation.is_false_positive;

  return (
    <div className={cn(
      "mt-4 border rounded-xl overflow-hidden",
      isNormal
        ? "bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200 dark:border-emerald-800/50"
        : "bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 border-violet-200 dark:border-violet-800/50"
    )}>
      {/* 헤더 */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 text-white",
        isNormal
          ? "bg-gradient-to-r from-emerald-600 to-green-600"
          : "bg-gradient-to-r from-violet-600 to-indigo-600"
      )}>
        <div className="flex items-center gap-2">
          {isNormal ? <CheckCircle2 className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
          <span className="font-heading font-bold text-sm">
            {isNormal
              ? t('gcodeAnalytics.analysisResultNormal', '분석 결과: 정상')
              : t('gcodeAnalytics.aiResolution', 'AI 해결 방안')
            }
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-3">
        {/* 분석 요약 */}
        <CollapsibleSection
          title={t('gcodeAnalytics.analysisSummary', '분석 요약')}
          icon={<Target className="h-4 w-4" />}
          isExpanded={expandedSections.has('explanation')}
          onToggle={() => toggleSection('explanation')}
        >
          <div className="space-y-2 text-sm">
            <p className="text-slate-600 dark:text-slate-400">{explanation.summary}</p>
            <p>
              <strong className="text-slate-700 dark:text-slate-300">{t('gcodeAnalytics.cause', '원인')}:</strong>{' '}
              <span className="text-slate-600 dark:text-slate-400">{explanation.cause}</span>
            </p>
            {!isNormal && explanation.severity !== 'none' && (
              <p>
                <strong className="text-slate-700 dark:text-slate-300">{t('gcodeAnalytics.severity', '심각도')}:</strong>{' '}
                <span className={cn(
                  "font-medium",
                  explanation.severity === 'critical' && "text-rose-600 dark:text-rose-400",
                  explanation.severity === 'high' && "text-red-600 dark:text-red-400",
                  explanation.severity === 'medium' && "text-orange-600 dark:text-orange-400",
                  explanation.severity === 'low' && "text-amber-600 dark:text-amber-400",
                )}>
                  {severityLabels[explanation.severity] || explanation.severity}
                </span>
              </p>
            )}
          </div>
        </CollapsibleSection>

        {/* 해결 방안 (조치가 필요한 경우에만) */}
        {solution.action_needed && (
          <CollapsibleSection
            title={t('gcodeAnalytics.solutionTitle', '해결 방안')}
            icon={<CheckCircle2 className="h-4 w-4" />}
            isExpanded={expandedSections.has('solution')}
            onToggle={() => toggleSection('solution')}
            highlight
          >
            <div className="space-y-2 text-sm">
              {solution.steps?.length > 0 && (
                <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400">
                  {solution.steps.map((step, i) => <li key={`solution-step-${i}-${step.slice(0, 20)}`}>{step}</li>)}
                </ol>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* 코드 수정 (있는 경우) */}
        {(solution.code_fix?.has_fix || (solution.code_fixes && solution.code_fixes.length > 0)) && (
          <CollapsibleSection
            title={t('gcodeAnalytics.codeFix', '코드 수정')}
            icon={<FileCode className="h-4 w-4" />}
            isExpanded={expandedSections.has('code_fix')}
            onToggle={() => toggleSection('code_fix')}
            badge={solution.code_fixes && solution.code_fixes.length > 1 ? `${solution.code_fixes.length}건` : undefined}
          >
            <div className="space-y-4 text-sm">
              {/* 그룹화된 코드 수정 (code_fixes 배열) */}
              {solution.code_fixes && solution.code_fixes.length > 0 ? (
                solution.code_fixes.filter(fix => fix.original && fix.fixed).map((fix, fixIdx, filteredArr) => (
                  <div key={fixIdx} className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    {/* 라인 번호 헤더 - 클릭하여 에디터로 이동 */}
                    {fix.line_number && (
                      <div
                        className={cn(
                          "px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2",
                          onViewCodeFix && "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors group"
                        )}
                        onClick={() => onViewCodeFix?.(fix)}
                        role={onViewCodeFix ? "button" : undefined}
                        tabIndex={onViewCodeFix ? 0 : undefined}
                        onKeyDown={(e) => {
                          if (onViewCodeFix && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            onViewCodeFix(fix);
                          }
                        }}
                      >
                        <span className={cn(
                          "text-xs font-mono bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300",
                          onViewCodeFix && "group-hover:bg-blue-100 dark:group-hover:bg-blue-800 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors"
                        )}>
                          LN {fix.line_number.toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {t('gcodeAnalytics.fixNumber', '수정 {{n}}', { n: fixIdx + 1 })} / {filteredArr.length}
                        </span>
                        {onViewCodeFix && (
                          <span className="ml-auto text-xs text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Edit3 className="h-3 w-3" />
                            {t('gcodeAnalytics.editInViewer', '에디터에서 수정')}
                          </span>
                        )}
                      </div>
                    )}
                    {/* 원본 코드 */}
                    <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                      <div className="px-3 py-1.5 bg-red-100 dark:bg-red-900/40 border-b border-red-200 dark:border-red-800">
                        <span className="text-xs text-red-600 dark:text-red-400 font-semibold">{t('gcodeAnalytics.original', '원본')}</span>
                      </div>
                      <div className="p-3 overflow-x-auto">
                        {fix.original!.split('\n').map((line, idx) => (
                          <div key={idx} className="flex font-mono text-xs leading-relaxed">
                            <span className="w-16 flex-shrink-0 text-red-400 dark:text-red-500 select-none pr-2 text-right border-r border-red-200 dark:border-red-700 mr-3">
                              {line.match(/^(\d+):/)?.[1] || ''}
                            </span>
                            <span className="text-red-700 dark:text-red-300 whitespace-pre">
                              {line.replace(/^\d+:\s*/, '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* 수정 코드 */}
                    <div className="bg-emerald-50 dark:bg-emerald-900/20">
                      <div className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/40 border-b border-emerald-200 dark:border-emerald-800">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{t('gcodeAnalytics.fixed', '수정')}</span>
                      </div>
                      <div className="p-3 overflow-x-auto">
                        {fix.fixed!.split('\n').map((line, idx) => (
                          <div key={idx} className="flex font-mono text-xs leading-relaxed">
                            <span className="w-16 flex-shrink-0 text-emerald-400 dark:text-emerald-500 select-none pr-2 text-right border-r border-emerald-200 dark:border-emerald-700 mr-3">
                              {line.match(/^(\d+):/)?.[1] || ''}
                            </span>
                            <span className="text-emerald-700 dark:text-emerald-300 whitespace-pre">
                              {line.replace(/^\d+:\s*/, '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                /* 단일 코드 수정 (code_fix) - 하위 호환성 */
                solution.code_fix?.original && solution.code_fix?.fixed && (
                  <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    {/* 원본 코드 */}
                    <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                      <div className="px-3 py-1.5 bg-red-100 dark:bg-red-900/40 border-b border-red-200 dark:border-red-800">
                        <span className="text-xs text-red-600 dark:text-red-400 font-semibold">{t('gcodeAnalytics.original', '원본')}</span>
                      </div>
                      <div className="p-3 overflow-x-auto">
                        {solution.code_fix.original.split('\n').map((line, idx) => (
                          <div key={idx} className="flex font-mono text-xs leading-relaxed">
                            <span className="w-16 flex-shrink-0 text-red-400 dark:text-red-500 select-none pr-2 text-right border-r border-red-200 dark:border-red-700 mr-3">
                              {line.match(/^(\d+):/)?.[1] || ''}
                            </span>
                            <span className="text-red-700 dark:text-red-300 whitespace-pre">
                              {line.replace(/^\d+:\s*/, '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* 수정 코드 */}
                    <div className="bg-emerald-50 dark:bg-emerald-900/20">
                      <div className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/40 border-b border-emerald-200 dark:border-emerald-800">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{t('gcodeAnalytics.fixed', '수정')}</span>
                      </div>
                      <div className="p-3 overflow-x-auto">
                        {solution.code_fix.fixed.split('\n').map((line, idx) => (
                          <div key={idx} className="flex font-mono text-xs leading-relaxed">
                            <span className="w-16 flex-shrink-0 text-emerald-400 dark:text-emerald-500 select-none pr-2 text-right border-r border-emerald-200 dark:border-emerald-700 mr-3">
                              {line.match(/^(\d+):/)?.[1] || ''}
                            </span>
                            <span className="text-emerald-700 dark:text-emerald-300 whitespace-pre">
                              {line.replace(/^\d+:\s*/, '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              )}
              {onViewCode && (
                <Button size="sm" variant="outline" className="mt-2 gap-2" onClick={onViewCode}>
                  <Edit3 className="h-3 w-3" />
                  {t('gcodeAnalytics.editInViewer', '에디터에서 수정')}
                </Button>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* 팁 */}
        {tips?.length > 0 && (
          <CollapsibleSection
            title={t('gcodeAnalytics.tips', '팁')}
            icon={<Info className="h-4 w-4" />}
            isExpanded={expandedSections.has('tips')}
            onToggle={() => toggleSection('tips')}
          >
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400">
              {tips.map((tip, i) => (
                <li key={i} className="[&>p]:inline [&>p]:m-0 [&_strong]:font-semibold [&_strong]:text-slate-700 [&_strong]:dark:text-slate-300 [&_code]:bg-slate-100 [&_code]:dark:bg-slate-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <>{children}</> }}>
                    {tip}
                  </ReactMarkdown>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}

// 접을 수 있는 섹션 컴포넌트
function CollapsibleSection({
  title,
  icon,
  isExpanded,
  onToggle,
  highlight,
  badge,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  highlight?: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      highlight
        ? "border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900"
        : "border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50"
    )}>
      <button
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 text-left transition-colors",
          highlight
            ? "bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
            : "hover:bg-slate-50 dark:hover:bg-slate-800"
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <span className={highlight ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}>{icon}</span>
          <span className={cn(
            "font-heading font-semibold text-sm",
            highlight ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300"
          )}>{title}</span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 transition-transform text-slate-400",
          isExpanded && "rotate-180"
        )} />
      </button>
      {isExpanded && (
        <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-700">
          {children}
        </div>
      )}
    </div>
  );
}

// 패치 제안 섹션
function PatchSuggestionsSection({ patches }: { patches: PatchSuggestion[] }) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const displayedPatches = showAll ? patches : patches.slice(0, 3);

  const getActionLabel = (action: string) => {
    return t(`gcodeAnalytics.patchAction.${action}`);
  };

  const actionColors: Record<string, string> = {
    remove: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',
    modify: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
    insert: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
    insert_after: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
            <FileCode className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-heading font-bold text-slate-900 dark:text-white">{t('gcodeAnalytics.patchSuggestions')}</h3>
          <span className="text-sm font-score font-black bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-3 py-1 rounded-full">
            {t('gcodeAnalytics.patchCount', { count: patches.length })}
          </span>
        </div>
        {patches.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-sm font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
          >
            {showAll ? t('gcodeAnalytics.collapse') : t('gcodeAnalytics.showAll', { count: patches.length })}
          </Button>
        )}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {displayedPatches.map((patch, index) => {
          const actionColor = actionColors[patch.action] || actionColors.modify;
          return (
            <div key={index} className="p-6 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Line</span>
                  <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{patch.line || patch.line_index || 'N/A'}</span>
                </span>
                <span className={cn("text-xs px-2.5 py-1 rounded border font-bold uppercase tracking-wider", actionColor)}>
                  {getActionLabel(patch.action)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Code */}
                {(patch.action === 'remove' || patch.action === 'modify') && patch.original && (
                  <div className="group/code">
                    <span className="text-xs font-heading font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">{t('gcodeAnalytics.original')}</span>
                    <div className="relative bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                      <code className="block p-3 pl-4 font-mono text-xs md:text-sm text-red-300 overflow-x-auto">
                        - {patch.original}
                      </code>
                    </div>
                  </div>
                )}

                {/* Modified Code */}
                {(patch.action === 'insert' || patch.action === 'insert_after' || patch.action === 'modify') && patch.modified && (
                  <div className="group/code">
                    <span className="text-xs font-heading font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">{t('gcodeAnalytics.modified')}</span>
                    <div className="relative bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                      <code className="block p-3 pl-4 font-mono text-xs md:text-sm text-emerald-300 overflow-x-auto">
                        + {patch.modified}
                      </code>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-start gap-2 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/20">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-sm font-body text-slate-600 dark:text-slate-400 leading-relaxed">{patch.reason}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 유틸리티: LLM 응답을 GCodeAnalysisData로 변환
// ============================================================================

export function parseAnalysisResponse(llmResponse: string): GCodeAnalysisData | null {
  try {
    // JSON 블록 추출 시도
    const jsonMatch = llmResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]) as GCodeAnalysisData;
    }

    // 직접 JSON 파싱 시도
    const parsed = JSON.parse(llmResponse);
    return parsed as GCodeAnalysisData;
  } catch {
    console.warn('[GCodeAnalysisReport] Failed to parse LLM response as JSON');
    return null;
  }
}

// 기본 내보내기
export default GCodeAnalysisReport;
