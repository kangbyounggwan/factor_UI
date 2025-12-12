import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  ChevronRight,
  X,
  Zap,
  BarChart3,
  ListChecks,
  FileWarning,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react';
import { GCodeViewerModal } from './GCodeViewerModal';

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
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
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
}): { textKey: string; status: 'good' | 'warning' | 'bad' } {
  const { travel, infill, perimeter } = speedDistribution;

  // 외벽 속도가 너무 빠르면 품질 저하 (120mm/s = 7200mm/min 이상은 고속)
  if (perimeter > 7200) {
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

  // 외벽 속도가 너무 느리면 시간 낭비 (20mm/s = 1200mm/min 미만)
  if (perimeter < 1200) {
    return {
      textKey: 'gcodeAnalytics.speedInterpretation.perimeterSlow',
      status: 'warning'
    };
  }

  // 이상적인 속도 분포 (현대적인 프린터 기준)
  // 외벽 <= 80mm/s (4800mm/min), 내부 >= 80mm/s (4800mm/min), 이동 >= 150mm/s (9000mm/min)
  if (perimeter <= 4800 && infill >= 4800 && travel >= 9000) {
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
// 컴포넌트 Props
// ============================================================================

interface GCodeAnalysisReportProps {
  data: GCodeAnalysisData;
  className?: string;
}

import { updateGCodeFileContent } from '@/lib/gcodeAnalysisDbService';

// ============================================================================
// 보고서 컴포넌트
// ============================================================================

export const GCodeAnalysisReport: React.FC<GCodeAnalysisReportProps> = ({
  data,
  className,
}) => {
  const { t } = useTranslation();
  const { metrics, support, speedDistribution, temperature, analysis, overallScore } = data;
  const reportRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'issues' | 'optimization'>('info');
  const [expandedIssueIndices, setExpandedIssueIndices] = useState<Set<number>>(new Set([0])); // 첫 번째 이슈는 기본 펼침
  const [isViewerOpen, setIsViewerOpen] = useState(false);

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
      console.error('No storage path available for saving');
      alert(t('gcodeAnalytics.noStoragePath'));
      return;
    }

    try {
      const { error } = await updateGCodeFileContent(data.storagePath, newContent);
      if (error) {
        console.error('Failed to save G-code:', error);
        alert(t('gcodeAnalytics.saveError') + ': ' + error.message);
        throw error;
      }

      // 성공 시 페이지를 새로고침하거나 상태를 업데이트해야 함
      // 지금은 간단히 알림만 표시
      alert(t('gcodeAnalytics.gcodeModified'));

      // data.gcodeContent를 업데이트 (SWR 등의 갱신이 없으면 로컬 상태 업데이트는 복잡할 수 있음)
      // 상위 컴포넌트에서 데이터를 다시 불러오는 것이 가장 좋음
    } catch (e) {
      console.error(e);
    }
  };

  // CSV 다운로드 함수 (이슈 목록)
  const handleDownloadCSV = () => {
    const issues = data.detailedAnalysis?.detailedIssues || [];
    if (issues.length === 0) {
      alert(t('gcodeAnalytics.noIssuesToExport'));
      return;
    }

    const headers = [t('gcodeAnalytics.issueType'), t('gcodeAnalytics.severity'), t('gcodeAnalytics.lineNumber'), t('gcodeAnalytics.description'), t('gcodeAnalytics.impact'), t('gcodeAnalytics.suggestion')];
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
        <h1>G-code 분석 보고서</h1>
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
      alert(t('gcodeAnalytics.popupBlocked'));
    }
  };

  return (
    <div className={cn(
      "bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800 gcode-report-print",
      className
    )}>
      {/* 인쇄 버튼 - 헤더 외부에 고정 (인쇄 시 숨김) */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/50 px-4 py-2 flex justify-between gap-2 no-print">
        {/* 왼쪽: G-code 보기 버튼 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsViewerOpen(true)}
          className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white"
          title={t('gcodeAnalytics.viewGcode')}
        >
          <FileCode className="h-4 w-4 mr-2" />
          {t('gcodeAnalytics.viewGcode')}
        </Button>

        {/* Viewer Modal */}
        {data.gcodeContent && (
          <GCodeViewerModal
            isOpen={isViewerOpen}
            onClose={() => setIsViewerOpen(false)}
            fileName={data.fileName || 'Unknown.gcode'}
            gcodeContent={data.gcodeContent}
            issues={data.detailedAnalysis?.detailedIssues || []}
            patches={data.detailedAnalysis?.patchSuggestions || []}
            reportId={data.reportId}
          />
        )}

        {/* 오른쪽: 인쇄 버튼 */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white"
          title={t('gcodeAnalytics.printPdf')}
        >
          <Printer className="h-4 w-4 mr-2" />
          {t('gcodeAnalytics.printPdf')}
        </Button>
      </div>

      {/* 보고서 내용 - PDF 캡처 대상 */}
      <div ref={reportRef}>
        {/* 헤더 */}
        <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-title font-bold tracking-tight text-slate-900 dark:text-white">{t('gcodeAnalytics.reportTitle')}</h1>
              <p className="text-slate-500 dark:text-white/70 text-sm mt-2 font-body">
                {data.fileName || t('gcodeAnalytics.analysisResult')} • {data.analyzedAt || new Date().toLocaleString()}
              </p>
            </div>
            {overallScore && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-slate-500 dark:text-white/60 uppercase tracking-wide font-heading font-semibold">{t('gcodeAnalytics.overallScore')}</p>
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
        </div >

        {/* 탭 네비게이션 */}
        < div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50" >
          <button
            onClick={() => setActiveTab('info')}
            className={cn(
              "flex-1 py-4 text-sm font-heading font-semibold border-b-2 transition-colors",
              activeTab === 'info'
                ? "border-violet-500 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/5"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50"
            )}
          >
            {t('gcodeAnalytics.tabInfo')}
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
            {t('gcodeAnalytics.tabIssues')} ({analysis.warnings.length + (data.detailedAnalysis?.issueStatistics?.reduce((acc, curr) => acc + curr.count, 0) || 0)})
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
            {t('gcodeAnalytics.tabOptimization')}
          </button>
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
                  value={metrics.retractionCount.value.toLocaleString()}
                  subValue={t('gcodeAnalytics.retractionCount')}
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
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">{support.percentage.toFixed(1)}%</span>
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
                      <span className="text-xl font-bold text-slate-900 dark:text-white">{temperature.nozzle}°C</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span className="text-base font-body text-slate-700 dark:text-white">{t('gcodeAnalytics.bed')}</span>
                      </div>
                      <span className="text-xl font-bold text-slate-900 dark:text-white">{temperature.bed}°C</span>
                    </div>
                    {temperature.firstLayer && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50">
                        <p className="text-sm text-slate-500 mb-2">{t('gcodeAnalytics.firstLayerSettings')}</p>
                        <div className="grid grid-cols-2 gap-2 text-sm text-slate-700 dark:text-white">
                          {temperature.firstLayer.nozzle && (
                            <span>{t('gcodeAnalytics.nozzle')}: {temperature.firstLayer.nozzle}°C</span>
                          )}
                          {temperature.firstLayer.bed && (
                            <span>{t('gcodeAnalytics.bed')}: {temperature.firstLayer.bed}°C</span>
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
                <div className="bg-slate-100 dark:bg-slate-800/30 rounded-xl p-5 border border-slate-200 dark:border-slate-700/65">
                  <h3 className="text-base font-heading font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    {t('gcodeAnalytics.diagnosisSummary')}
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
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{t('gcodeAnalytics.temperatureAnalysis')}: </span>
                      <span className="text-sm text-slate-600 dark:text-slate-300">{data.detailedAnalysis.printingInfo.temperature_analysis}</span>
                    </div>
                  )}

                  {/* 속도 분석 */}
                  {data.detailedAnalysis.printingInfo.speed_analysis && (
                    <div className="mb-3">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{t('gcodeAnalytics.speedAnalysis')}: </span>
                      <span className="text-sm text-slate-600 dark:text-slate-300">{data.detailedAnalysis.printingInfo.speed_analysis}</span>
                    </div>
                  )}

                  {/* 재료 사용 */}
                  {data.detailedAnalysis.printingInfo.material_usage && (
                    <div className="mb-3">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{t('gcodeAnalytics.materialUsage')}: </span>
                      <span className="text-sm text-slate-600 dark:text-slate-300">{data.detailedAnalysis.printingInfo.material_usage}</span>
                    </div>
                  )}

                  {/* 권장사항 */}
                  {data.detailedAnalysis.printingInfo.recommendations && data.detailedAnalysis.printingInfo.recommendations.length > 0 && (
                    <div className="mt-4">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 block mb-2">{t('gcodeAnalytics.recommendations')}:</span>
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
      </div >
    </div >
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
        <span className="text-3xl font-bold text-slate-900 dark:text-white">{value}</span>
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
        <span className="font-bold text-slate-900 dark:text-white">{displayValue} mm/s</span>
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
  gcodeContent?: string;
  onSaveGCode?: (newContent: string) => Promise<void>;
  fileName?: string;
}

function DetailedAnalysisSection({ detailedAnalysis, gcodeContent, onSaveGCode, fileName }: DetailedAnalysisSectionProps) {
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
                gcodeContent={gcodeContent}
                onSaveGCode={onSaveGCode}
                fileName={fileName}
                allIssues={detailedIssues}
                patches={patchSuggestions || []}
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
  const { t } = useTranslation();

  const severityStyles = {
    critical: { bg: 'bg-red-50 dark:bg-red-900/40', border: 'border-red-200 dark:border-red-500/50', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-600' },
    high: { bg: 'bg-red-50 dark:bg-red-900/40', border: 'border-red-200 dark:border-red-500/50', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-600' },
    medium: { bg: 'bg-orange-50 dark:bg-orange-900/40', border: 'border-orange-200 dark:border-orange-500/50', text: 'text-orange-600 dark:text-orange-400', badge: 'bg-orange-600' },
    low: { bg: 'bg-green-50 dark:bg-green-900/40', border: 'border-green-200 dark:border-green-500/50', text: 'text-green-600 dark:text-green-400', badge: 'bg-green-600' },
  };

  const severityLabels: Record<string, string> = {
    critical: t('gcodeAnalytics.severityCritical'),
    high: t('gcodeAnalytics.severityHigh'),
    medium: t('gcodeAnalytics.severityMedium'),
    low: t('gcodeAnalytics.severityLow'),
    info: t('gcodeAnalytics.severityInfo'),
  };

  const style = severityStyles[summary.severity];

  return (
    <div className={cn("rounded-xl p-6 border", style.bg, style.border)}>
      <div className="flex items-start gap-4">
        <div className="bg-red-50 dark:bg-red-500/20 p-3 rounded-lg flex-shrink-0">
          <Thermometer className={cn("h-7 w-7", style.text)} />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-title font-bold text-slate-900 dark:text-white mb-1">{summary.keyIssue?.title}</h3>
          <p className="text-base font-body text-slate-600 dark:text-slate-300 leading-relaxed">{summary.keyIssue?.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-200 dark:border-slate-700/50">
        <div className="text-center">
          <p className="text-xs font-heading font-semibold text-slate-500 dark:text-slate-400">{t('gcodeAnalytics.totalIssues')}</p>
          <p className="text-xl font-score font-black text-slate-900 dark:text-white">{t('gcodeAnalytics.issueCountUnit', { count: summary.totalIssues })}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-heading font-semibold text-slate-500 dark:text-slate-400">{t('gcodeAnalytics.severity')}</p>
          <p className={cn("text-xl font-score font-black capitalize", style.text)}>{severityLabels[summary.severity] || summary.severity}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-heading font-semibold text-slate-500 dark:text-slate-400">{t('gcodeAnalytics.recommendedAction')}</p>
          <p className="text-xl font-score font-black text-blue-600 dark:text-blue-400">{summary.recommendation}</p>
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
    <div className="bg-slate-50 dark:bg-slate-800/35 rounded-xl p-6 border border-slate-200 dark:border-slate-600/65">
      <h3 className="text-base font-heading font-semibold text-slate-600 dark:text-slate-400 mb-5 flex items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        {t('gcodeAnalytics.issueStatsByType')}
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
                {t('gcodeAnalytics.issueCountUnit', { count: stat.count })}
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
function DetailedIssueCard({ issue, index, isExpanded, onToggle, gcodeContent, onSaveGCode, fileName, allIssues, patches, reportId }: {
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
}) {
  const { t } = useTranslation();
  const [showGCodeModal, setShowGCodeModal] = useState(false);

  const severityStyles = {
    critical: { badge: 'bg-rose-700', border: 'border-rose-600/30', headerBg: 'bg-rose-500/20' },
    high: { badge: 'bg-red-600', border: 'border-red-500/30', headerBg: 'bg-red-500/15' },
    medium: { badge: 'bg-yellow-600', border: 'border-yellow-500/30', headerBg: 'bg-yellow-500/15' },
    low: { badge: 'bg-slate-600', border: 'border-slate-500/30', headerBg: 'bg-slate-500/15' },
    info: { badge: 'bg-blue-600', border: 'border-blue-500/30', headerBg: 'bg-blue-500/15' },
  };

  const style = severityStyles[issue.severity];

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

  return (
    <>
      <div className="hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors border-b border-slate-200 dark:border-slate-600/50 last:border-b-0 relative">
        {/* 헤더 */}
        <div
          className={cn("px-5 py-4 flex justify-between items-center cursor-pointer", style.headerBg)}
          onClick={onToggle}
        >
          <div className="flex items-center gap-3">
            <span className={cn("text-white text-sm px-3 py-1.5 rounded font-warning font-medium", style.badge)}>
              {getSeverityLabel(issue.severity)}
            </span>
            <span className="font-mono text-base text-red-600 dark:text-red-300 font-semibold">
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
                <p className="text-sm text-slate-600 dark:text-slate-400 uppercase font-heading font-semibold mb-2">{t('gcodeAnalytics.foundCode')}</p>
                <code className="bg-slate-200 dark:bg-slate-900 text-green-700 dark:text-green-400 px-4 py-2 rounded text-base block w-fit font-mono">
                  {issue.code}
                </code>
              </div>
            )}
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 uppercase font-heading font-semibold mb-2">{t('gcodeAnalytics.analysisContent')}</p>
              <p className="text-base font-body text-slate-700 dark:text-slate-300">{issue.description}</p>
            </div>
          </div>

          {issue.impact && (
            <div className="mt-5">
              <p className="text-sm text-slate-600 dark:text-slate-400 uppercase font-heading font-semibold mb-2">{t('gcodeAnalytics.impact')}</p>
              <p className="text-base font-body text-slate-600 dark:text-slate-400">{issue.impact}</p>
            </div>
          )}

          {issue.suggestion && (
            <div className="mt-5 p-4 bg-blue-100 dark:bg-blue-500/10 border border-blue-300 dark:border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400 uppercase font-heading font-semibold mb-2">{t('gcodeAnalytics.suggestion')}</p>
              <p className="text-base font-body text-slate-700 dark:text-slate-300">{issue.suggestion}</p>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-slate-300 dark:border-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                setShowGCodeModal(true);
              }}
            >
              <FileCode className="h-4 w-4" />
              {t('gcodeAnalytics.openGcodeEditor')}
            </Button>
          </div>
        </div>

        {/* 축소 상태에서 간단한 설명 표시 */}
        {!isExpanded && (
          <div className="px-5 pb-4">
            <p className="text-base font-body text-slate-600 dark:text-slate-400 line-clamp-2">{issue.description}</p>
          </div>
        )}
      </div>

      {/* G-code Raw 모달 */}
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
        />
      )}
    </>
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
    remove: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/20',
    modify: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/20',
    insert: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20',
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-800/35 rounded-xl border border-slate-200 dark:border-slate-600/65 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-600/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCode className="h-6 w-6 text-slate-500 dark:text-slate-400" />
          <h3 className="text-lg font-heading font-semibold text-slate-900 dark:text-white">{t('gcodeAnalytics.patchSuggestions')}</h3>
          <span className="text-sm font-score font-black bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 px-3 py-1 rounded-full">
            {t('gcodeAnalytics.patchCount', { count: patches.length })}
          </span>
        </div>
        {patches.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-base font-body text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            {showAll ? t('gcodeAnalytics.collapse') : t('gcodeAnalytics.showAll', { count: patches.length })}
          </Button>
        )}
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-600/60">
        {displayedPatches.map((patch, index) => {
          const actionColor = actionColors[patch.action] || actionColors.modify;
          return (
            <div key={index} className="p-5 border-b border-slate-200 dark:border-slate-600/50 last:border-b-0">
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-sm font-score font-black text-slate-600 dark:text-slate-400">Line {patch.line || patch.line_index || 'N/A'}</span>
                <span className={cn("text-sm px-3 py-1 rounded font-warning font-medium", actionColor)}>
                  {getActionLabel(patch.action)}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-heading font-semibold text-slate-600 dark:text-slate-400">{t('gcodeAnalytics.original')}:</span>
                  <code className="block mt-2 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 px-4 py-2 rounded text-sm font-mono border border-transparent dark:border-red-700/50">
                    {patch.original}
                  </code>
                </div>
                {patch.modified && (
                  <div>
                    <span className="text-sm font-heading font-semibold text-slate-600 dark:text-slate-400">{t('gcodeAnalytics.modified')}:</span>
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
