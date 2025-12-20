/**
 * G-code 분석 폴링 훅
 * - 분석 상태 폴링 (2초 간격)
 * - 분석 완료 시 보고서 데이터 변환
 * - DB 작업은 별도 서비스에 위임
 *
 * 책임 분리 원칙:
 * - 이 훅: UI 상태 관리 + 폴링 로직
 * - gcodeAnalysisCompleteService: 비동기 I/O (DB, API)
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { getAnalysisStatus } from '@shared/services/gcodeAnalysisService';
import type { TimelineStep, AnalysisResult } from '@shared/types/gcodeAnalysisTypes';
import { calculateIssueStatistics, ISSUE_TYPE_LABELS } from '@shared/types/gcodeAnalysisTypes';
import type { GCodeAnalysisData } from '@/components/PrinterDetail/GCodeAnalysisReport';
import { completeAnalysisDbOperations } from './gcodeAnalysisCompleteService';

// 보고서 카드 정보 타입
export interface ReportCardData {
  reportId: string;
  fileName: string;
  overallScore?: number;
  overallGrade?: string;
  totalIssues?: number;
  layerCount?: number;
  printTime?: string;
}

// 세그먼트 데이터 타입
export interface SegmentData {
  layers: any[];
  metadata?: any;
  temperatures?: any[];
}

// 훅 반환 타입
export interface UseGcodeAnalysisPollingReturn {
  // 상태
  isAnalyzing: boolean;
  progress: number;
  timeline: TimelineStep[];
  progressMessage: string | null;
  analysisId: string | null;
  analysisMessageId: string | null;

  // 데이터
  reportData: GCodeAnalysisData | null;
  segmentData: SegmentData | null;
  activeReportId: string | null;

  // 액션
  startPolling: (params: StartPollingParams) => void;
  stopPolling: () => void;
  setReportData: React.Dispatch<React.SetStateAction<GCodeAnalysisData | null>>;
  setActiveReportId: React.Dispatch<React.SetStateAction<string | null>>;
  setSegmentData: React.Dispatch<React.SetStateAction<SegmentData | null>>;
  setAnalysisMessageId: React.Dispatch<React.SetStateAction<string | null>>;
}

// 폴링 시작 파라미터
export interface StartPollingParams {
  analysisId: string;
  fileName?: string;
  messageId?: string;
  dbMessageId?: string | null;
  userId?: string;
  sessionId?: string | null;
  gcodeContent?: string | null;
  gcodeFileId?: string;
  storagePath?: string;
  onReportCardReady?: (reportCard: ReportCardData) => void;
  onError?: (errorMessage: string) => void;
}

/**
 * 점수를 등급으로 변환
 */
const scoreToGrade = (score: number): string => {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
};

/**
 * 분석 결과에서 보고서 카드 데이터 생성
 */
export const createReportCardData = (
  result: AnalysisResult,
  reportId: string,
  fileName: string
): ReportCardData => {
  const score = result.final_summary?.overall_quality_score ?? 0;

  return {
    reportId,
    fileName,
    overallScore: score,
    overallGrade: scoreToGrade(score),
    totalIssues: result.final_summary?.total_issues_found,
    layerCount: result.comprehensive_summary?.layer?.total_layers,
    printTime: result.comprehensive_summary?.print_time?.formatted_time,
  };
};

/**
 * 분석 결과를 UI 보고서 데이터로 변환
 */
export const convertAnalysisResultToReportData = (
  result: AnalysisResult,
  fileName?: string
): GCodeAnalysisData => {
  const { comprehensive_summary, final_summary, issues_found, printing_info, patch_plan } = result;

  return {
    fileName: fileName || 'analysis.gcode',
    metrics: {
      printTime: {
        value: comprehensive_summary.print_time.formatted_time,
        seconds: comprehensive_summary.print_time.total_seconds,
      },
      filamentUsage: {
        length: `${comprehensive_summary.extrusion.total_filament_used.toFixed(1)}m`,
        weight: comprehensive_summary.extrusion.filament_weight_g
          ? `${comprehensive_summary.extrusion.filament_weight_g.toFixed(1)}g`
          : undefined,
      },
      layerCount: {
        value: comprehensive_summary.layer.total_layers,
        layerHeight: comprehensive_summary.layer.layer_height,
      },
      retractionCount: {
        value: comprehensive_summary.extrusion.retraction_count,
      },
    },
    support: {
      percentage: comprehensive_summary.support.support_ratio,
    },
    speedDistribution: {
      travel: comprehensive_summary.feed_rate?.travel_speed_avg || 0,
      infill: comprehensive_summary.feed_rate?.print_speed_avg || 0,
      perimeter: comprehensive_summary.feed_rate?.print_speed_avg || 0,
      support: comprehensive_summary.feed_rate?.print_speed_avg,
    },
    temperature: {
      nozzle: comprehensive_summary.temperature.nozzle_avg,
      bed: comprehensive_summary.temperature.bed_max,
      firstLayer: {
        nozzle: comprehensive_summary.temperature.nozzle_max,
        bed: comprehensive_summary.temperature.bed_max,
      },
    },
    analysis: {
      warnings: [],
      cautions: [],
      suggestions: printing_info?.recommendations?.map((r: string) => ({
        title: r,
        description: r,
        impact: 'medium',
      })) || [],
      goodPoints: [],
    },
    overallScore: {
      value: final_summary.overall_quality_score,
      grade: scoreToGrade(final_summary.overall_quality_score),
    },
    printSpeed: {
      max: comprehensive_summary.feed_rate?.max_speed || 0,
      avg: comprehensive_summary.feed_rate?.avg_speed || 0,
      min: comprehensive_summary.feed_rate?.min_speed,
    },
    detailedAnalysis: {
      diagnosisSummary: {
        keyIssue: {
          title: final_summary.critical_issues > 0 ? '치명적인 문제 감지' : '분석 완료',
          description: final_summary.summary,
        },
        totalIssues: final_summary.total_issues_found,
        severity: final_summary.critical_issues > 0 ? 'critical' :
          final_summary.total_issues_found > 5 ? 'high' : 'medium',
        recommendation: final_summary.recommendation,
      },
      issueStatistics: calculateIssueStatistics(issues_found).map((stat) => ({
        ...stat,
        description: stat.description || ISSUE_TYPE_LABELS[stat.type] || stat.type,
      })),
      detailedIssues: issues_found.map((issue, idx) => ({
        id: issue.id || `issue-${idx}`,
        type: issue.type,
        issueType: issue.type,
        severity: issue.severity,
        is_grouped: issue.is_grouped,
        count: issue.count,
        lines: issue.lines,
        line: issue.lines[0],
        title: issue.title,
        description: issue.description,
        all_issues: issue.all_issues,  // gcode_context 포함
        gcode_context: issue.gcode_context || issue.all_issues?.[0]?.gcode_context,  // 레거시 호환 + 대표값
        impact: issue.impact,
        suggestion: issue.suggestion,
        layer: issue.layer,
        section: issue.section,
      })),
      patchSuggestions: patch_plan?.patches?.map(p => ({
        line: p.line || p.line_index,
        line_index: p.line_index,
        action: p.action,
        original: p.original_line || p.original,
        modified: p.new_line || p.modified,
        reason: p.reason,
      })) || [],
      solutionGuides: [],
      expectedImprovements: [],
      llmSummary: final_summary.summary,
      llmRecommendation: final_summary.recommendation,
      printingInfo: printing_info,
    },
  };
};

/**
 * G-code 분석 폴링 훅
 */
export const useGcodeAnalysisPolling = (): UseGcodeAnalysisPollingReturn => {
  const { t } = useTranslation();
  const { toast } = useToast();

  // 분석 상태
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeline, setTimeline] = useState<TimelineStep[]>([]);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysisMessageId, setAnalysisMessageId] = useState<string | null>(null);

  // 데이터 상태
  const [reportData, setReportData] = useState<GCodeAnalysisData | null>(null);
  const [segmentData, setSegmentData] = useState<SegmentData | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // Refs
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedSegmentDataIdRef = useRef<string | null>(null);

  // 폴링 중지
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // 폴링 시작
  const startPolling = useCallback((params: StartPollingParams) => {
    const {
      analysisId: newAnalysisId,
      fileName,
      messageId,
      dbMessageId,
      userId,
      sessionId,
      gcodeContent,
      gcodeFileId,
      storagePath,
      onReportCardReady,
      onError,
    } = params;

    // 기존 폴링 중지
    stopPolling();

    // 캡처된 값들 (클로저 문제 방지)
    const capturedMessageId = messageId;
    const capturedDbMessageId = dbMessageId;

    console.log('[useGcodeAnalysisPolling] Starting polling:', {
      analysisId: newAnalysisId,
      fileName,
      messageId: capturedMessageId,
      dbMessageId: capturedDbMessageId,
    });

    // 상태 초기화
    setAnalysisId(newAnalysisId);
    setIsAnalyzing(true);
    setProgress(0);
    setTimeline([]);
    setProgressMessage(null);
    if (capturedMessageId) {
      setAnalysisMessageId(capturedMessageId);
    }

    /**
     * 분석 완료 처리 (orchestration 함수)
     * 각 책임을 명확히 분리:
     * 1. 폴링 종료 + UI 상태 초기화
     * 2. 결과 → UI 데이터 변환
     * 3. DB 작업 (서비스에 위임)
     * 4. UI 상태 업데이트 (DB 결과 반영)
     * 5. 콜백 호출
     * 6. 토스트 알림
     */
    const handleAnalysisComplete = async (result: AnalysisResult) => {
      const resolvedFileName = fileName || 'analysis.gcode';

      // 1. 폴링 종료 + 분석 상태 업데이트
      console.log('[useGcodeAnalysisPolling] Analysis complete');
      stopPolling();
      setIsAnalyzing(false);
      setProgress(100);

      // 2. 결과를 UI 데이터로 변환
      const newReportData = convertAnalysisResultToReportData(result, resolvedFileName);
      setReportData({
        ...newReportData,
        analysisId: newAnalysisId,
        gcodeContent: gcodeContent || undefined,
      });
      setActiveReportId(newAnalysisId);

      // 3. DB 작업 수행 (별도 서비스에 위임)
      const dbResult = await completeAnalysisDbOperations({
        userId,
        sessionId,
        analysisId: newAnalysisId,
        fileName: resolvedFileName,
        reportData: newReportData,
        apiResult: result,
        cachedSegmentId: savedSegmentDataIdRef.current,
        dbMessageId: capturedDbMessageId,
        gcodeFileId,
        storagePath,
      });

      // 4. DB 결과를 UI 상태에 반영
      if (dbResult.reportId) {
        setActiveReportId(dbResult.reportId);
        setReportData(prev => prev ? {
          ...prev,
          reportId: dbResult.reportId,
          analysisId: newAnalysisId,
        } : null);
      }

      if (dbResult.segmentData) {
        setSegmentData(dbResult.segmentData);
      }

      // 5. 콜백 호출 (보고서 카드 준비 완료)
      if (onReportCardReady) {
        const reportCardData = createReportCardData(
          result,
          dbResult.reportId || newAnalysisId,
          resolvedFileName
        );
        onReportCardReady(reportCardData);
      }

      // 6. 성공 토스트 알림
      toast({
        title: t('aiChat.analysisCompleteTitle', '분석 완료'),
        description: t('aiChat.analysisCompleteDesc', 'G-code 분석이 완료되었습니다.'),
      });
    };

    // 에러 처리
    const handleAnalysisError = (errorMsg: string) => {
      setIsAnalyzing(false);
      stopPolling();

      if (onError) {
        onError(errorMsg);
      }

      toast({
        title: t('aiChat.analysisErrorTitle', '분석 오류'),
        description: errorMsg,
        variant: 'destructive',
      });
    };

    // 폴링 함수
    const pollStatus = async () => {
      try {
        const statusResponse = await getAnalysisStatus(newAnalysisId);

        // 진행률 업데이트
        if (statusResponse.progress !== undefined) {
          setProgress(Math.round(statusResponse.progress * 100));
        }

        // 진행 메시지 업데이트
        if (statusResponse.progress_message) {
          setProgressMessage(statusResponse.progress_message);
        }

        // 타임라인 업데이트
        if (statusResponse.timeline) {
          setTimeline(statusResponse.timeline);
        }

        // 상태에 따른 처리
        const status = statusResponse.status;
        if (status === 'completed' || status === 'done' || status === 'finished') {
          if (statusResponse.result) {
            await handleAnalysisComplete(statusResponse.result);
          } else {
            handleAnalysisError('분석 결과가 없습니다.');
          }
        } else if (status === 'failed' || status === 'error') {
          handleAnalysisError(statusResponse.error || '알 수 없는 오류');
        }
      } catch (err) {
        handleAnalysisError(err instanceof Error ? err.message : '폴링 중 오류가 발생했습니다.');
      }
    };

    // 첫 번째 폴링 즉시 실행
    pollStatus();

    // 2초마다 폴링
    pollingIntervalRef.current = setInterval(pollStatus, 2000);
  }, [stopPolling, t, toast]);

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    // 상태
    isAnalyzing,
    progress,
    timeline,
    progressMessage,
    analysisId,
    analysisMessageId,

    // 데이터
    reportData,
    segmentData,
    activeReportId,

    // 액션
    startPolling,
    stopPolling,
    setReportData,
    setActiveReportId,
    setSegmentData,
    setAnalysisMessageId,
  };
};

export default useGcodeAnalysisPolling;
