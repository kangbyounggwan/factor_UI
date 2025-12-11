import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
  Zap,
  BarChart3,
  ListChecks,
  FileWarning,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react';

// ============================================================================
// G-code 분석 보고서 데이터 타입 정의
// LLM에서 리턴하는 분석 결과 구조
// ============================================================================

export interface GCodeAnalysisData {
  // 파일 기본 정보
  fileName?: string;
  analyzedAt?: string;

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

export interface DetailedIssue {
  issueType: string;           // cold_extrusion, early_temp_off, etc.
  severity: 'high' | 'medium' | 'low';
  line?: number | string;       // G-code 라인 번호
  line_index?: number | string; // 백엔드에서 오는 라인 인덱스
  code?: string;               // 발견된 G-code
  description: string;         // 상세 설명
  impact: string;              // 영향 설명
  suggestion: string;          // 제안 사항
  layer?: number;              // 레이어 번호
  section?: string;            // 섹션 (BODY, INFILL, etc.)
}

export interface PatchSuggestion {
  line?: number;
  line_index?: number;
  action: 'remove' | 'modify' | 'insert';
  original?: string;
  modified?: string | null;
  reason: string;
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
 * 서포트 비율 해석
 */
function getSupportInterpretation(percentage: number): { text: string; status: 'good' | 'warning' | 'bad' } {
  if (percentage <= 15) {
    return {
      text: '서포트가 거의 없거나 최소화되어 있습니다. 후처리가 쉽고 재료 소모가 적습니다.',
      status: 'good'
    };
  } else if (percentage <= 30) {
    return {
      text: '적절한 서포트 비율입니다. 구조 안정성과 재료 효율의 균형이 잘 맞습니다.',
      status: 'good'
    };
  } else if (percentage <= 50) {
    return {
      text: '서포트 비율이 다소 높습니다. 모델 방향 조정으로 줄일 수 있는지 검토해보세요.',
      status: 'warning'
    };
  } else {
    return {
      text: '서포트 비율이 높은 편입니다. 출력 후 제거 작업이 많이 필요하며 재료 소모가 큽니다.',
      status: 'bad'
    };
  }
}

/**
 * 속도 분포 해석
 * 주의: API에서 반환하는 속도 값은 mm/min 단위임
 * - 60 mm/s = 3600 mm/min
 * - 80 mm/s = 4800 mm/min
 * - 120 mm/s = 7200 mm/min
 * - 150 mm/s = 9000 mm/min
 */
function getSpeedInterpretation(speedDistribution: {
  travel: number;
  infill: number;
  perimeter: number;
  support?: number;
}): { text: string; status: 'good' | 'warning' | 'bad' } {
  const { travel, infill, perimeter } = speedDistribution;

  // 외벽 속도가 너무 빠르면 품질 저하 (120mm/s = 7200mm/min 이상은 고속)
  if (perimeter > 7200) {
    return {
      text: '외벽 속도가 매우 빠릅니다. 정밀한 표면 품질이 필요하다면 속도를 낮춰보세요.',
      status: 'warning'
    };
  }

  // 이동 속도가 출력 속도보다 느리면 비효율적
  if (travel < infill) {
    return {
      text: '이동 속도가 출력 속도보다 느립니다. 이동 속도를 높이면 출력 시간을 크게 단축할 수 있습니다.',
      status: 'warning'
    };
  }

  // 내부 채움이 외벽보다 느리면 비효율적 (내부는 빨라도 됨)
  if (infill < perimeter * 0.8) {
    return {
      text: '내부 채움 속도가 외벽보다 느립니다. 내부는 보이지 않으므로 속도를 높여도 됩니다.',
      status: 'warning'
    };
  }

  // 외벽 속도가 너무 느리면 시간 낭비 (20mm/s = 1200mm/min 미만)
  if (perimeter < 1200) {
    return {
      text: '외벽 속도가 매우 느립니다. 일반적인 품질이라면 속도를 높여도 됩니다.',
      status: 'warning'
    };
  }

  // 이상적인 속도 분포 (현대적인 프린터 기준)
  // 외벽 <= 80mm/s (4800mm/min), 내부 >= 80mm/s (4800mm/min), 이동 >= 150mm/s (9000mm/min)
  if (perimeter <= 4800 && infill >= 4800 && travel >= 9000) {
    return {
      text: '속도 설정이 이상적입니다. 외벽은 품질 우선, 내부는 속도 우선으로 잘 설정되었습니다.',
      status: 'good'
    };
  }

  return {
    text: '전반적으로 적절한 속도 설정입니다. 출력 품질과 시간의 균형이 맞습니다.',
    status: 'good'
  };
}

/**
 * 온도 설정 해석
 */
function getTemperatureInterpretation(temperature: {
  nozzle: number;
  bed: number;
  firstLayer?: { nozzle?: number; bed?: number };
}): { text: string; materialGuess: string; status: 'good' | 'warning' | 'bad' } {
  const { nozzle, bed } = temperature;

  // PLA 범위 (180-220°C 노즐, 50-70°C 베드)
  if (nozzle >= 180 && nozzle <= 220 && bed >= 40 && bed <= 70) {
    return {
      text: 'PLA에 적합한 온도입니다. 안정적인 출력이 가능합니다.',
      materialGuess: 'PLA',
      status: 'good'
    };
  }

  // PETG 범위 (220-250°C 노즐, 70-90°C 베드)
  if (nozzle >= 220 && nozzle <= 260 && bed >= 70 && bed <= 90) {
    return {
      text: 'PETG에 적합한 온도입니다. 레이어 접착력이 좋을 것입니다.',
      materialGuess: 'PETG',
      status: 'good'
    };
  }

  // ABS 범위 (220-260°C 노즐, 90-110°C 베드)
  if (nozzle >= 220 && nozzle <= 260 && bed >= 90 && bed <= 110) {
    return {
      text: 'ABS에 적합한 온도입니다. 밀폐된 환경에서 출력하면 뒤틀림을 방지할 수 있습니다.',
      materialGuess: 'ABS',
      status: 'good'
    };
  }

  // 노즐 온도가 너무 높음
  if (nozzle > 260) {
    return {
      text: '노즐 온도가 높습니다. 고온 필라멘트(나일론, PC)가 아니라면 확인이 필요합니다.',
      materialGuess: '고온 필라멘트',
      status: 'warning'
    };
  }

  // 베드 온도가 너무 낮음
  if (bed < 40 && nozzle > 200) {
    return {
      text: '베드 온도가 낮습니다. 첫 레이어 접착에 문제가 있을 수 있습니다.',
      materialGuess: '알 수 없음',
      status: 'warning'
    };
  }

  return {
    text: '일반적인 온도 범위입니다. 사용하는 필라멘트 권장 온도를 확인해보세요.',
    materialGuess: '범용',
    status: 'good'
  };
}

// ============================================================================
// 해석 표시 컴포넌트
// ============================================================================

interface InterpretationBadgeProps {
  text: string;
  status: 'good' | 'warning' | 'bad';
}

const InterpretationBadge: React.FC<InterpretationBadgeProps> = ({ text, status }) => {
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
      <span>{text}</span>
    </div>
  );
};

// ============================================================================
// 컴포넌트 Props
// ============================================================================

interface GCodeAnalysisReportProps {
  data: GCodeAnalysisData;
  className?: string;
}

// ============================================================================
// 보고서 컴포넌트
// ============================================================================

export const GCodeAnalysisReport: React.FC<GCodeAnalysisReportProps> = ({
  data,
  className,
}) => {
  const { metrics, support, speedDistribution, temperature, analysis, overallScore } = data;
  const reportRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'issues' | 'optimization'>('info');
  const [expandedIssueIndices, setExpandedIssueIndices] = useState<Set<number>>(new Set([0])); // 첫 번째 이슈는 기본 펼침

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

  // CSV 다운로드 함수 (이슈 목록)
  const handleDownloadCSV = () => {
    const issues = data.detailedAnalysis?.detailedIssues || [];
    if (issues.length === 0) {
      alert('내보낼 이슈가 없습니다.');
      return;
    }

    const headers = ['이슈유형', '심각도', '라인번호', '설명', '영향', '해결방안'];
    const rows = issues.map(issue => [
      issue.issueType,
      issue.severity,
      issue.line || issue.line_index || 'N/A',
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
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
    };
    const totalIssues = severityCounts.high + severityCounts.medium + severityCounts.low;

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
        case 'high': return { bg: '#fee2e2', text: '#dc2626', border: '#ef4444' };
        case 'medium': return { bg: '#ffedd5', text: '#ea580c', border: '#f97316' };
        case 'low': return { bg: '#fef9c3', text: '#ca8a04', border: '#eab308' };
        default: return { bg: '#f3f4f6', text: '#6b7280', border: '#9ca3af' };
      }
    };

    // SVG 도넛 차트 생성 (서포트 비율)
    const generateDonutChart = (percentage: number) => {
      const radius = 35;
      const circumference = 2 * Math.PI * radius;
      const strokeDasharray = (percentage / 100) * circumference;

      return `
        <svg width="90" height="90" viewBox="0 0 100 100" style="display:block;margin:0 auto;">
          <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="10"/>
          <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#8b5cf6" stroke-width="10"
            stroke-dasharray="${strokeDasharray} ${circumference}"
            stroke-linecap="round"
            transform="rotate(-90 50 50)"/>
          <text x="50" y="50" text-anchor="middle" dominant-baseline="middle" 
            font-size="14" font-weight="900" fill="#0f172a">${percentage.toFixed(1)}%</text>
        </svg>
      `;
    };

    // SVG 파이 차트 생성 (심각도 분포)
    const generateSeverityPieChart = () => {
      if (totalIssues === 0) return '<p style="color:#64748b;font-size:9pt;text-align:center;">이슈 없음</p>';

      const colors: Record<string, string> = { high: '#ef4444', medium: '#f97316', low: '#eab308' };
      const radius = 35;
      let cumulativeAngle = 0;
      const segments: string[] = [];

      const severities = [
        { key: 'high', count: severityCounts.high },
        { key: 'medium', count: severityCounts.medium },
        { key: 'low', count: severityCounts.low },
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

    // SVG 가로 바 차트 생성 (이슈 유형별 통계)
    const generateIssueStatsChart = () => {
      if (issueStats.length === 0) return '';

      const maxCount = Math.max(...issueStats.map(s => s.count));
      const barHeight = 16;
      const gap = 6;
      const topStats = issueStats.slice(0, 5); // 상위 5개만
      const chartHeight = topStats.length * (barHeight + gap);

      return `
        <svg width="100%" height="${chartHeight}" viewBox="0 0 280 ${chartHeight}" style="display:block;">
          ${topStats.map((stat, index) => {
        const y = index * (barHeight + gap);
        const barWidth = maxCount > 0 ? (stat.count / maxCount) * 140 : 0;
        const label = stat.label.length > 12 ? stat.label.substring(0, 12) + '...' : stat.label;
        return `
              <text x="0" y="${y + 12}" font-size="9" fill="#475569">${label}</text>
              <rect x="90" y="${y}" width="${barWidth}" height="${barHeight}" rx="2" fill="${stat.color || '#8b5cf6'}"/>
              <text x="${95 + barWidth}" y="${y + 12}" font-size="9" font-weight="700" fill="#0f172a">${stat.count}</text>
            `;
      }).join('')}
        </svg>
      `;
    };

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>G-code 분석 보고서 - ${data.fileName || '분석 결과'}</title>
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
      align-items: flex-start;
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
    .score-box {
      display:flex;
      align-items: center;
      gap: 10px;
    }
    .score-value {
      text-align: right;
    }
    .score-value .label {
      font-size: 8pt;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .score-value .number {
      font-size: 28pt;
      font-weight: 900;
      color: #0f172a;
    }
    .grade-badge {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20pt;
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
        <h1>G-code 분석 보고서</h1>
        <p class="file-info">${data.fileName || '분석 결과'} • ${data.analyzedAt || new Date().toLocaleString('ko-KR')}</p>
      </div>
      ${overallScore ? `
      <div class="score-box">
        <div class="score-value">
          <p class="label">Overall Score</p>
          <p class="number">${overallScore.value}</p>
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
          ${patch.original ? `<div class="patch-code">- ${patch.original}</div>` : ''}
          ${patch.modified ? `<div class="patch-code" style="background:#14532d;color:#86efac">+ ${patch.modified}</div>` : ''}
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

  // 인쇄 핸들러
  const handlePrint = () => {
    const printContent = generatePrintableHTML();
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    } else {
      // 팝업이 차단된 경우 대체 방법
      alert('팝업이 차단되었습니다. 팝업 차단을 해제하고 다시 시도해 주세요.');
    }
  };

  return (
    <div className={cn(
      "bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800 gcode-report-print",
      className
    )}>
      {/* 인쇄 버튼 - 헤더 외부에 고정 (인쇄 시 숨김) */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/50 px-4 py-2 flex justify-end gap-2 no-print">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white"
          title="인쇄 또는 PDF로 저장 (Ctrl+P)"
        >
          <Printer className="h-4 w-4 mr-2" />
          인쇄/PDF
        </Button>
      </div>

      {/* 보고서 내용 - PDF 캡처 대상 */}
      <div ref={reportRef}>
        {/* 헤더 */}
        <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-title font-bold tracking-tight text-slate-900 dark:text-white">G-code 분석 보고서</h1>
              <p className="text-slate-500 dark:text-white/70 text-sm mt-2 font-body">
                {data.fileName || '분석 결과'} • {data.analyzedAt || new Date().toLocaleString('ko-KR')}
              </p>
            </div>
            {overallScore && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-slate-500 dark:text-white/60 uppercase tracking-wide font-heading font-semibold">Overall Score</p>
                  <p className="text-4xl font-score font-black text-slate-900 dark:text-white">{overallScore.value}</p>
                </div>
                <div className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center text-3xl font-score font-black text-white",
                  overallScore.grade === 'A' && "bg-green-500",
                  overallScore.grade === 'B' && "bg-blue-500",
                  overallScore.grade === 'C' && "bg-yellow-500",
                  overallScore.grade === 'D' && "bg-orange-500",
                  overallScore.grade === 'F' && "bg-red-500"
                )}>
                  {overallScore.grade}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={() => setActiveTab('info')}
            className={cn(
              "flex-1 py-4 text-sm font-heading font-semibold border-b-2 transition-colors",
              activeTab === 'info'
                ? "border-violet-500 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/5"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50"
            )}
          >
            출력 정보
          </button>
          <button
            onClick={() => setActiveTab('issues')}
            className={cn(
              "flex-1 py-4 text-sm font-heading font-semibold border-b-2 transition-colors",
              activeTab === 'issues'
                ? "border-violet-500 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/5"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50"
            )}
          >
            문제점 및 이상상황 ({analysis.warnings.length + (data.detailedAnalysis?.issueStatistics?.reduce((acc, curr) => acc + curr.count, 0) || 0)})
          </button>
          <button
            onClick={() => setActiveTab('optimization')}
            className={cn(
              "flex-1 py-4 text-sm font-heading font-semibold border-b-2 transition-colors",
              activeTab === 'optimization'
                ? "border-violet-500 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/5"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50"
            )}
          >
            최적화 방안
          </button>
        </div>

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
                  label="예상 출력 시간"
                  value={metrics.printTime.value}
                  color="blue"
                />

                {/* 필라멘트 사용량 */}
                <MetricCard
                  icon={<Box className="h-5 w-5" />}
                  label="필라멘트"
                  value={metrics.filamentUsage.length}
                  subValue={metrics.filamentUsage.weight}
                  color="green"
                />

                {/* 레이어 수 */}
                <MetricCard
                  icon={<Layers className="h-5 w-5" />}
                  label="레이어"
                  value={metrics.layerCount.value.toLocaleString()}
                  subValue={metrics.layerCount.layerHeight ? `${metrics.layerCount.layerHeight}mm` : undefined}
                  color="purple"
                />

                {/* 리트렉션 횟수 */}
                <MetricCard
                  icon={<Repeat2 className="h-5 w-5" />}
                  label="리트렉션"
                  value={metrics.retractionCount.value.toLocaleString()}
                  subValue="회"
                  color="orange"
                />
              </div>

              {/* 차트 및 온도 섹션 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 서포트 비율 - 도넛 차트 */}
                <div className="bg-slate-50 dark:bg-slate-800/35 backdrop-blur rounded-xl p-5 border border-slate-200 dark:border-slate-700/65 flex flex-col">
                  <h3 className="text-base font-heading font-semibold text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    서포트 비율
                  </h3>
                  <div className="flex-grow flex items-center justify-center">
                    <div className="relative w-32 h-32">
                      {/* 도넛 차트 배경 */}
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="12"
                          className="text-slate-200 dark:text-slate-700"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={`${(support.percentage / 100) * 251.2} 251.2`}
                          className="text-primary"
                        />
                      </svg>
                      {/* 중앙 텍스트 */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-score font-black text-slate-900 dark:text-white">{support.percentage.toFixed(1)}%</span>
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
                      속도 분포
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
                            <SpeedBar label="이동" value={speedDistribution.travel} maxValue={maxSpeed} color="blue" />
                            <SpeedBar label="내부 채움" value={speedDistribution.infill} maxValue={maxSpeed} color="green" />
                            <SpeedBar label="외벽" value={speedDistribution.perimeter} maxValue={maxSpeed} color="purple" />
                            {speedDistribution.support !== undefined && (
                              <SpeedBar label="서포트" value={speedDistribution.support} maxValue={maxSpeed} color="orange" />
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
                    온도 설정
                  </h3>
                  <div className="flex-grow space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-base font-body text-slate-700 dark:text-white">노즐</span>
                      </div>
                      <span className="text-xl font-score font-black text-slate-900 dark:text-white">{temperature.nozzle}°C</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span className="text-base font-body text-slate-700 dark:text-white">베드</span>
                      </div>
                      <span className="text-xl font-score font-black text-slate-900 dark:text-white">{temperature.bed}°C</span>
                    </div>
                    {temperature.firstLayer && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50">
                        <p className="text-sm text-slate-500 mb-2">첫 레이어 설정</p>
                        <div className="grid grid-cols-2 gap-2 text-sm text-slate-700 dark:text-white">
                          {temperature.firstLayer.nozzle && (
                            <span>노즐: {temperature.firstLayer.nozzle}°C</span>
                          )}
                          {temperature.firstLayer.bed && (
                            <span>베드: {temperature.firstLayer.bed}°C</span>
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
                              <span className="block">{tempInterpretation.text}</span>
                              <span className="block mt-1 text-slate-500 dark:text-slate-400">
                                추정 재료: <span className="text-slate-900 dark:text-white font-medium">{tempInterpretation.materialGuess}</span>
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
                  title="양호 항목"
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  items={analysis.goodPoints}
                  variant="success"
                />
              )}

              {/* 프린팅 정보 요약 (출력 정보 탭에 포함) */}
              {data.detailedAnalysis?.printingInfo && (
                <div className="bg-slate-100 dark:bg-slate-800/30 rounded-xl p-5 border border-slate-200 dark:border-slate-700/65">
                  <h3 className="text-base font-heading font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    분석 요약
                  </h3>
                  {/* Overview / Summary Text */}
                  {(data.detailedAnalysis.printingInfo.overview || data.detailedAnalysis.printingInfo.summary_text) && (
                    <p className="text-base font-body text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                      {data.detailedAnalysis.printingInfo.overview || data.detailedAnalysis.printingInfo.summary_text}
                    </p>
                  )}

                  {/* 온도 분석 */}
                  {data.detailedAnalysis.printingInfo.temperature_analysis && (
                    <div className="mb-3">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">온도 분석: </span>
                      <span className="text-sm text-slate-600 dark:text-slate-300">{data.detailedAnalysis.printingInfo.temperature_analysis}</span>
                    </div>
                  )}

                  {/* 속도 분석 */}
                  {data.detailedAnalysis.printingInfo.speed_analysis && (
                    <div className="mb-3">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">속도 분석: </span>
                      <span className="text-sm text-slate-600 dark:text-slate-300">{data.detailedAnalysis.printingInfo.speed_analysis}</span>
                    </div>
                  )}

                  {/* 재료 사용 */}
                  {data.detailedAnalysis.printingInfo.material_usage && (
                    <div className="mb-3">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">재료 사용: </span>
                      <span className="text-sm text-slate-600 dark:text-slate-300">{data.detailedAnalysis.printingInfo.material_usage}</span>
                    </div>
                  )}

                  {/* 권장사항 */}
                  {data.detailedAnalysis.printingInfo.recommendations && data.detailedAnalysis.printingInfo.recommendations.length > 0 && (
                    <div className="mt-4">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 block mb-2">권장사항:</span>
                      <ul className="list-disc list-inside space-y-1">
                        {data.detailedAnalysis.printingInfo.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-sm text-slate-600 dark:text-slate-300">{rec}</li>
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
                <DiagnosisSummaryCard summary={data.detailedAnalysis.diagnosisSummary} />
              )}

              {/* 위험 경고 */}
              {analysis.warnings.length > 0 && (
                <AnalysisSection
                  title="위험 경고"
                  icon={<AlertTriangle className="h-5 w-5" />}
                  items={analysis.warnings}
                  variant="danger"
                />
              )}

              {/* 주의사항 */}
              {analysis.cautions.length > 0 && (
                <AnalysisSection
                  title="주의사항"
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
                    상세 문제 분석
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
              {data.detailedAnalysis?.patchSuggestions && data.detailedAnalysis.patchSuggestions.length > 0 ? (
                <PatchSuggestionsSection patches={data.detailedAnalysis.patchSuggestions} />
              ) : (
                <div className="text-center py-10 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/10 rounded-xl border border-slate-300 dark:border-slate-800 border-dashed font-body">
                  제안된 G-code 패치가 없습니다.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
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
    blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/65 text-blue-600 dark:text-blue-400',
    green: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/65 text-emerald-600 dark:text-emerald-400',
    purple: 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/65 text-violet-600 dark:text-violet-400',
    orange: 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/65 text-orange-600 dark:text-orange-400',
  };

  return (
    <div className={cn(
      "rounded-xl p-4 border",
      colorStyles[color]
    )}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-heading font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-score font-black text-slate-900 dark:text-white">{value}</span>
        {subValue && <span className="text-base font-body text-slate-500 dark:text-slate-400">{subValue}</span>}
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
  const displayValue = Math.round(value);  // 정수로 반올림

  const barColors = {
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    purple: 'bg-violet-500',
    orange: 'bg-orange-500',
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-body text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-score font-black text-slate-900 dark:text-white">{displayValue} mm/s</span>
      </div>
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColors[color])}
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
      bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30',
      header: 'text-red-600 dark:text-red-400',
      icon: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30',
      header: 'text-yellow-600 dark:text-yellow-400',
      icon: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
      header: 'text-blue-600 dark:text-blue-400',
      icon: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
    },
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30',
      header: 'text-emerald-600 dark:text-emerald-400',
      icon: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className={cn("rounded-xl border p-5", styles.bg)}>
      <div className={cn("flex items-center gap-3 mb-4", styles.header)}>
        <div className={cn("p-2 rounded-lg", styles.icon)}>
          {icon}
        </div>
        <h3 className="text-lg font-heading font-semibold">{title}</h3>
        <span className="text-sm font-score font-black bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white px-3 py-1 rounded-full">{items.length}</span>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="bg-slate-100 dark:bg-slate-800/40 rounded-lg p-4 border border-slate-200 dark:border-slate-600/50">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-base font-warning font-medium text-slate-900 dark:text-white">{item.title}</p>
                <p className="text-sm font-body text-slate-600 dark:text-slate-400 mt-1">{item.description}</p>
              </div>
              {item.impact && (
                <span className={cn(
                  "text-xs px-3 py-1 rounded-full uppercase font-warning font-medium",
                  item.impact === 'high' && "bg-red-100 dark:bg-red-500/30 text-red-600 dark:text-red-300",
                  item.impact === 'medium' && "bg-yellow-100 dark:bg-yellow-500/30 text-yellow-600 dark:text-yellow-300",
                  item.impact === 'low' && "bg-slate-200 dark:bg-slate-500/30 text-slate-600 dark:text-slate-300"
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
}

function DetailedAnalysisSection({ detailedAnalysis }: DetailedAnalysisSectionProps) {
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

  // 표시할 이슈 수 제한
  const displayedIssues = showAllIssues
    ? detailedIssues
    : detailedIssues?.slice(0, 5);

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
        <DiagnosisSummaryCard summary={diagnosisSummary} />
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
                {detailedIssues.length}건
              </span>
            </div>
            {detailedIssues.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllIssues(!showAllIssues)}
                className="font-body text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                {showAllIssues ? '접기' : `모두 보기 (${detailedIssues.length})`}
                {showAllIssues ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
              </Button>
            )}
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700/30">
            {displayedIssues?.map((issue, index) => (
              <DetailedIssueCard
                key={index}
                issue={issue}
                index={index}
                isExpanded={expandedIssue === index}
                onToggle={() => setExpandedIssue(expandedIssue === index ? null : index)}
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
function DiagnosisSummaryCard({ summary }: { summary: DiagnosisSummary }) {
  const severityStyles = {
    critical: { bg: 'bg-red-50 dark:bg-red-900/40', border: 'border-red-200 dark:border-red-500/50', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-600' },
    high: { bg: 'bg-red-50 dark:bg-red-900/40', border: 'border-red-200 dark:border-red-500/50', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-600' },
    medium: { bg: 'bg-orange-50 dark:bg-orange-900/40', border: 'border-orange-200 dark:border-orange-500/50', text: 'text-orange-600 dark:text-orange-400', badge: 'bg-orange-600' },
    low: { bg: 'bg-green-50 dark:bg-green-900/40', border: 'border-green-200 dark:border-green-500/50', text: 'text-green-600 dark:text-green-400', badge: 'bg-green-600' },
  };

  const style = severityStyles[summary.severity];

  return (
    <div className={cn("rounded-xl p-6 border", style.bg, style.border)}>
      <div className="flex items-start gap-4">
        <div className="bg-red-50 dark:bg-red-500/20 p-3 rounded-lg flex-shrink-0">
          <Thermometer className={cn("h-7 w-7", style.text)} />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-title font-bold text-slate-900 dark:text-white mb-1">{summary.keyIssue.title}</h3>
          <p className="text-base font-body text-slate-600 dark:text-slate-300 leading-relaxed">{summary.keyIssue.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-200 dark:border-slate-700/50">
        <div className="text-center">
          <p className="text-xs font-heading font-semibold text-slate-500 dark:text-slate-400">총 이슈</p>
          <p className="text-xl font-score font-black text-slate-900 dark:text-white">{summary.totalIssues}건</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-heading font-semibold text-slate-500 dark:text-slate-400">심각도</p>
          <p className={cn("text-xl font-score font-black capitalize", style.text)}>{summary.severity}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-heading font-semibold text-slate-500 dark:text-slate-400">권장 조치</p>
          <p className="text-xl font-score font-black text-blue-600 dark:text-blue-400">{summary.recommendation}</p>
        </div>
      </div>
    </div>
  );
}

// 문제 유형별 통계 차트
function IssueStatisticsChart({ statistics }: { statistics: IssueStatistics[] }) {
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
    <div className="bg-slate-50 dark:bg-slate-800/35 rounded-xl p-6 border border-slate-200 dark:border-slate-600/65">
      <h3 className="text-base font-heading font-semibold text-slate-600 dark:text-slate-400 mb-5 flex items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        문제 유형별 통계
      </h3>
      <div className="space-y-5">
        {statistics.map((stat, index) => (
          <div key={index}>
            <div className="flex justify-between items-end mb-2">
              <span className="text-base font-heading font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span className={cn("w-5", stat.color === 'red' ? 'text-red-500' : 'text-orange-500')}>
                  {getIcon(stat.type)}
                </span>
                {stat.label}
              </span>
              <span className={cn(
                "text-base font-score font-black",
                stat.color === 'red' ? 'text-red-500' : 'text-orange-500'
              )}>
                {stat.count}건
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-6 overflow-hidden relative">
              <div
                className={cn(
                  "h-full rounded-full flex items-center justify-end pr-3 transition-all duration-1000 ease-out",
                  stat.color === 'red' ? 'bg-red-500' : 'bg-orange-400'
                )}
                style={{ width: `${stat.percentage}%` }}
              >
                <span className="text-xs text-white font-score font-black">{stat.percentage}%</span>
              </div>
            </div>
            <p className="text-sm font-body text-slate-500 dark:text-slate-400 mt-1 pl-7">{stat.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// 상세 이슈 카드
function DetailedIssueCard({ issue, index, isExpanded, onToggle }: {
  issue: DetailedIssue;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const severityStyles = {
    high: { badge: 'bg-red-600', border: 'border-red-500/30', headerBg: 'bg-red-500/15' },
    medium: { badge: 'bg-yellow-600', border: 'border-yellow-500/30', headerBg: 'bg-yellow-500/15' },
    low: { badge: 'bg-slate-600', border: 'border-slate-500/30', headerBg: 'bg-slate-500/15' },
  };

  const style = severityStyles[issue.severity];

  const getIssueTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      cold_extrusion: 'Cold Extrusion',
      early_temp_off: 'Early Temp Off',
      extreme_cold: 'Extreme Cold',
      early_bed_off: 'Early Bed Off',
    };
    return labels[type] || type;
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

  return (
    <div className="hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors border-b border-slate-200 dark:border-slate-600/50 last:border-b-0">
      {/* 헤더 */}
      <div
        className={cn("px-5 py-4 flex justify-between items-center cursor-pointer", style.headerBg)}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className={cn("text-white text-sm px-3 py-1.5 rounded font-warning font-medium", style.badge)}>
            {issue.severity === 'high' ? '심각' : issue.severity === 'medium' ? '주의' : '정보'}
          </span>
          <span className="font-mono text-base text-red-600 dark:text-red-300 font-score font-black">
            Line {issue.line || issue.line_index || 'N/A'}
          </span>
          {issue.layer !== undefined && issue.layer !== null && (
            <span className="text-sm px-2.5 py-1 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-mono font-medium">
              Layer {issue.layer.toLocaleString()}
            </span>
          )}
          {issue.section && (
            <span className="text-sm px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-600/50 text-slate-600 dark:text-slate-300 font-mono">
              {issue.section}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-600 dark:text-red-400 text-base font-warning font-medium flex items-center gap-1">
            {getIssueIcon(issue.issueType)}
            {getIssueTypeLabel(issue.issueType)}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          )}
        </div>
      </div>

      {/* 내용 */}
      <div className={cn("px-5 py-5", !isExpanded && "hidden")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {issue.code && (
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 uppercase font-heading font-semibold mb-2">발견된 코드</p>
              <code className="bg-slate-200 dark:bg-slate-900 text-green-700 dark:text-green-400 px-4 py-2 rounded text-base block w-fit font-mono">
                {issue.code}
              </code>
            </div>
          )}
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 uppercase font-heading font-semibold mb-2">분석 내용</p>
            <p className="text-base font-body text-slate-700 dark:text-slate-300">{issue.description}</p>
          </div>
        </div>

        {issue.impact && (
          <div className="mt-5">
            <p className="text-sm text-slate-600 dark:text-slate-400 uppercase font-heading font-semibold mb-2">영향</p>
            <p className="text-base font-body text-slate-600 dark:text-slate-400">{issue.impact}</p>
          </div>
        )}

        {issue.suggestion && (
          <div className="mt-5 p-4 bg-blue-100 dark:bg-blue-500/10 border border-blue-300 dark:border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-600 dark:text-blue-400 uppercase font-heading font-semibold mb-2">제안</p>
            <p className="text-base font-body text-slate-700 dark:text-slate-300">{issue.suggestion}</p>
          </div>
        )}
      </div>

      {/* 축소 상태에서 간단한 설명 표시 */}
      {!isExpanded && (
        <div className="px-5 pb-4">
          <p className="text-base font-body text-slate-600 dark:text-slate-400 line-clamp-2">{issue.description}</p>
        </div>
      )}
    </div>
  );
}

// 패치 제안 섹션
function PatchSuggestionsSection({ patches }: { patches: PatchSuggestion[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayedPatches = showAll ? patches : patches.slice(0, 3);

  const actionLabels: Record<string, { label: string; color: string }> = {
    remove: { label: '삭제', color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/20' },
    modify: { label: '수정', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/20' },
    insert: { label: '추가', color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20' },
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-800/35 rounded-xl border border-slate-200 dark:border-slate-600/65 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-600/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCode className="h-6 w-6 text-slate-500 dark:text-slate-400" />
          <h3 className="text-lg font-heading font-semibold text-slate-900 dark:text-white">패치 제안</h3>
          <span className="text-sm font-score font-black bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 px-3 py-1 rounded-full">
            {patches.length}개
          </span>
        </div>
        {patches.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-base font-body text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            {showAll ? '접기' : `모두 보기 (${patches.length})`}
          </Button>
        )}
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-600/60">
        {displayedPatches.map((patch, index) => {
          const actionStyle = actionLabels[patch.action] || actionLabels.modify;
          return (
            <div key={index} className="p-5 border-b border-slate-200 dark:border-slate-600/50 last:border-b-0">
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-sm font-score font-black text-slate-600 dark:text-slate-400">Line {patch.line || patch.line_index || 'N/A'}</span>
                <span className={cn("text-sm px-3 py-1 rounded font-warning font-medium", actionStyle.color)}>
                  {actionStyle.label}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-heading font-semibold text-slate-600 dark:text-slate-400">원본:</span>
                  <code className="block mt-2 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 px-4 py-2 rounded text-sm font-mono border border-transparent dark:border-red-700/50">
                    {patch.original}
                  </code>
                </div>
                {patch.modified && (
                  <div>
                    <span className="text-sm font-heading font-semibold text-slate-600 dark:text-slate-400">수정:</span>
                    <code className="block mt-2 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200 px-4 py-2 rounded text-sm font-mono border border-transparent dark:border-green-700/50">
                      {patch.modified}
                    </code>
                  </div>
                )}
              </div>
              <p className="text-sm font-body text-slate-600 dark:text-slate-400 mt-3">{patch.reason}</p>
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
