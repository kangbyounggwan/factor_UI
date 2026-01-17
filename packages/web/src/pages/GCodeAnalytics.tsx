/**
 * G-code 품질 분석기 페이지
 * Python 백엔드 API와 연동하여 G-code 분석 수행
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useTheme } from 'next-themes';
import { GCodeAnalysisReport, type GCodeAnalysisData } from "@/components/ai/GCodeAnalytics";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@shared/contexts/AuthContext";
import { useUserPlan } from "@shared/hooks/useUserPlan";
import { analyzeGCodeFile, GCodeAnalysisError, pollAnalysisProgress } from "@/lib/gcodeAnalysisService";
import { saveAnalysisReport, uploadGCodeForAnalysis } from "@/lib/gcodeAnalysisDbService";
import type { AnalysisProgress, AnalysisResult } from "@shared/types/gcodeAnalysisTypes";
import {
  calculateIssueStatistics,
  getGradeFromScore,
  ISSUE_TYPE_LABELS,
} from "@shared/types/gcodeAnalysisTypes";
import {
  FileCode2,
  Loader2,
  Upload,
  CheckCircle,
  Archive,
  Save,
  Grid3x3,
  Box,
  ChevronLeft,
  ChevronRight,
  Thermometer,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Share2,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LoginPromptModal } from "@/components/auth/LoginPromptModal";
import { analyzeGCodeWithSegments, type GCodeAnalysisResponse } from "@/lib/api/gcode";
import { GCodePath3DFromAPI } from "@/components/PrinterDetail/GCodePath3DFromAPI";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AppSidebar } from "@/components/common/AppSidebar";
import { ChatSidebarContent, type ChatSession, type ReportArchiveItem } from "@/components/sidebar";
import { AppHeader } from "@/components/common/AppHeader";
import { useSidebarState } from "@/hooks/useSidebarState";
import { getChatSessions } from "@shared/services/supabaseService/chat";
import { getAnalysisReportsList, getAnalysisReportById, convertDbReportToUiData, downloadGCodeContent } from "@/lib/gcodeAnalysisDbService";
import { createReportShare } from "@/lib/sharedReportService";

// ============================================================================
// 3D 뷰어 컴포넌트
// ============================================================================

// 베드 플레이트
function BedPlate({ size, isDarkMode = true }: { size: { x: number; y: number }; isDarkMode?: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[size.x / 2, 0, size.y / 2]} receiveShadow>
      <planeGeometry args={[size.x, size.y]} />
      <meshStandardMaterial color={isDarkMode ? "#2a2a2a" : "#e8e8e8"} transparent opacity={0.8} />
    </mesh>
  );
}

// ============================================================================
// API 분석 결과 → UI 보고서 데이터 변환
// ============================================================================

function convertApiResultToReportData(
  result: AnalysisResult,
  fileName: string
): GCodeAnalysisData {
  const {
    printing_info,
    comprehensive_summary,
    final_summary,
    issues_found,
    patch_plan,
  } = result;

  // 이슈 통계 계산
  // has_issue가 true이거나 is_grouped가 true인 이슈를 포함 (그룹화된 이슈도 표시)
  const realIssues = issues_found.filter((i) => i.has_issue || i.is_grouped);
  const issueStatistics = calculateIssueStatistics(issues_found);

  // 점수 및 등급
  const score = final_summary.overall_quality_score;
  const grade = getGradeFromScore(score);

  // 심각도 결정
  const getSeverity = (): 'critical' | 'high' | 'medium' | 'low' => {
    if (score < 30) return 'critical';
    if (score < 50) return 'high';
    if (score < 70) return 'medium';
    return 'low';
  };

  // 분석 항목 생성 (warnings/cautions/suggestions/goodPoints)
  const warnings: GCodeAnalysisData['analysis']['warnings'] = [];
  const cautions: GCodeAnalysisData['analysis']['cautions'] = [];
  const suggestions: GCodeAnalysisData['analysis']['suggestions'] = [];
  const goodPoints: GCodeAnalysisData['analysis']['goodPoints'] = [];

  // printing_info.warnings → 경고로 변환
  if (printing_info?.warnings) {
    for (const warn of printing_info.warnings) {
      warnings.push({
        title: '주의 필요',
        description: warn,
        impact: 'high',
      });
    }
  }

  // printing_info.recommendations → 제안으로 변환
  if (printing_info?.recommendations) {
    for (const rec of printing_info.recommendations) {
      suggestions.push({
        title: '권장사항',
        description: rec,
        impact: 'medium',
      });
    }
  }

  // 품질이 high면 양호 항목 추가
  if (printing_info?.characteristics?.estimated_quality === 'high') {
    goodPoints.push({
      title: '고품질 설정',
      description: '슬라이서 설정이 고품질 출력에 최적화되어 있습니다.',
    });
  }

  // 슬라이서 정보
  if (comprehensive_summary?.slicer_info) {
    suggestions.push({
      title: '슬라이서 정보',
      description: comprehensive_summary.slicer_info,
      impact: 'low',
    });
  }

  // detailedIssues 변환 (그룹화된 이슈 필드 포함)
  const detailedIssues = realIssues.map((issue) => {
    console.log('[transformAnalysisResult] Issue raw data:', {
      id: issue.id,
      issue_type: issue.issue_type,
      type: issue.type,
      title: issue.title,
      layer: issue.layer,
      section: issue.section,
      event_line_index: issue.event_line_index,
      is_grouped: issue.is_grouped,
      count: issue.count,
      lines: issue.lines,
    });
    return {
      id: issue.id,
      issueType: issue.issue_type || issue.type || 'unknown',
      type: issue.type,
      severity: issue.severity as 'critical' | 'high' | 'medium' | 'low',
      line: issue.event_line_index ?? issue.line_index ?? issue.line ?? (issue.lines?.[0]),
      line_index: issue.event_line_index ?? issue.line_index,
      code: issue.code,
      description: issue.description || '',
      impact: issue.impact || '',
      suggestion: issue.suggestion || '',
      layer: issue.layer,
      section: issue.section,
      title: issue.title,
      gcode_context: issue.gcode_context,  // G-code 컨텍스트 (독립 이슈용)
      // 그룹화 관련 필드
      is_grouped: issue.is_grouped,
      count: issue.count,
      lines: issue.lines,
      all_issues: issue.all_issues,  // 그룹 내 모든 개별 이슈 (gcode_context 포함)
      representative: issue.representative,
    };
  });

  // patchSuggestions 변환 (API 필드 전체 매핑)
  const patchSuggestions = patch_plan?.patches.map((patch) => ({
    id: patch.id,
    issue_id: patch.issue_id,
    line: patch.line ?? patch.line_index,
    line_index: patch.line_index,
    layer: patch.layer,
    action: patch.action,
    original: patch.original ?? patch.original_line,
    original_line: patch.original_line,
    modified: patch.modified ?? patch.new_line,
    new_line: patch.new_line,
    position: patch.position,
    reason: patch.reason,
    issue_type: patch.issue_type,
    autofix_allowed: patch.autofix_allowed,
    vendor_extension: patch.vendor_extension,
  })) || [];

  // 솔루션 가이드 생성 (recommendations에서 추출)
  const solutionGuides = printing_info?.recommendations?.length
    ? [
      {
        title: '권장 조치 사항',
        description: '분석 결과를 기반으로 한 최우선 해결 방안입니다.',
        steps: printing_info.recommendations,
      },
    ]
    : [];

  return {
    fileName,
    analyzedAt: new Date().toLocaleString('ko-KR'),
    metrics: {
      printTime: {
        value: comprehensive_summary?.print_time?.formatted_time || '알 수 없음',
        seconds: comprehensive_summary?.print_time?.total_seconds,
      },
      filamentUsage: {
        length: comprehensive_summary?.extrusion?.total_filament_used
          ? `${comprehensive_summary.extrusion.total_filament_used.toFixed(2)} m`
          : '알 수 없음',
        weight: comprehensive_summary?.extrusion?.filament_weight_g
          ? `${comprehensive_summary.extrusion.filament_weight_g}g`
          : undefined,
      },
      layerCount: {
        value: comprehensive_summary?.layer?.total_layers || 0,
        layerHeight: comprehensive_summary?.layer?.layer_height,
      },
      retractionCount: {
        value: comprehensive_summary?.extrusion?.retraction_count || 0,
      },
    },
    support: {
      percentage: comprehensive_summary?.support?.support_ratio || 0,
    },
    speedDistribution: comprehensive_summary?.feed_rate
      ? {
        travel: comprehensive_summary.feed_rate.travel_speed_avg,  // 백엔드에서 mm/s로 제공
        infill: comprehensive_summary.feed_rate.print_speed_avg,   // 백엔드에서 mm/s로 제공
        perimeter: comprehensive_summary.feed_rate.print_speed_avg * 0.7,  // 백엔드에서 mm/s로 제공
        support: comprehensive_summary.feed_rate.print_speed_avg * 0.9,    // 백엔드에서 mm/s로 제공
      }
      : undefined,
    printSpeed: comprehensive_summary?.feed_rate ? {
      max: comprehensive_summary.feed_rate.max_speed,      // 백엔드에서 mm/s로 제공
      avg: comprehensive_summary.feed_rate.avg_speed,      // 백엔드에서 mm/s로 제공
      min: comprehensive_summary.feed_rate.min_speed || 0,  // 백엔드에서 mm/s로 제공
    } : undefined,
    temperature: {
      nozzle: comprehensive_summary?.temperature?.nozzle_max || 0,
      bed: comprehensive_summary?.temperature?.bed_max || 0,
    },
    analysis: {
      warnings,
      cautions,
      suggestions,
      goodPoints,
    },
    overallScore: {
      value: score,
      grade,
    },
    // AI 상세 분석 결과
    detailedAnalysis: {
      diagnosisSummary: {
        keyIssue: {
          title: final_summary.critical_issues > 0
            ? '치명적인 문제 감지'
            : '분석 완료',
          description: final_summary.summary,
        },
        totalIssues: final_summary.total_issues_found,
        severity: getSeverity(),
        recommendation: final_summary.recommendation,
      },
      issueStatistics: issueStatistics.map((stat) => ({
        ...stat,
        description: stat.description || ISSUE_TYPE_LABELS[stat.type] || stat.type,
      })),
      detailedIssues,
      patchSuggestions,
      solutionGuides,
      expectedImprovements: final_summary.expected_improvement
        ? [
          { label: '예상 개선', value: '적용 시', progress: 80 },
        ]
        : undefined,
      llmSummary: final_summary.summary,
      llmRecommendation: final_summary.recommendation,
      // 프린팅 정보 추가
      printingInfo: printing_info,
    },
  };
}

// ============================================================================
// 메인 컴포넌트
// ============================================================================

const GCodeAnalytics = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { plan: userPlan } = useUserPlan(user?.id);
  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId?: string }>();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  // 사이드바 상태
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarState(true);

  // 채팅 세션 상태 (사이드바용)
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);

  // 보고서 아카이브 상태 (사이드바용)
  const [reportArchive, setReportArchive] = useState<ReportArchiveItem[]>([]);

  // 파일 상태
  const [fileName, setFileName] = useState<string | null>(null);
  const [gcodeContent, setGcodeContent] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 분석 상태
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [reportData, setReportData] = useState<GCodeAnalysisData | null>(null);
  const [apiResult, setApiResult] = useState<AnalysisResult | null>(null);  // API 원본 응답
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // 세그먼트 API 응답 (3D 렌더링용)
  const [segmentData, setSegmentData] = useState<GCodeAnalysisResponse | null>(null);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('3D');

  // OrbitControls ref for camera control
  const orbitControlsRef = useRef<any>(null);

  // 온도 차트 라인 표시 상태
  const [showNozzleLine, setShowNozzleLine] = useState(true);
  const [showBedLine, setShowBedLine] = useState(true);

  // 3D 경로 렌더링 표시 상태
  const [showCurrentLayer, setShowCurrentLayer] = useState(true);
  const [showPreviousLayers, setShowPreviousLayers] = useState(true);
  const [showWipePath, setShowWipePath] = useState(true);
  const [showTravelPath, setShowTravelPath] = useState(true);
  const [showSupports, setShowSupports] = useState(true);

  // 범례 아코디언 상태
  const [isLegendExpanded, setIsLegendExpanded] = useState(true);

  // 저장 상태
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // 공유 상태
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // 스토리지 업로드 정보
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    gcodeFileId: string;
    storagePath: string;
  } | null>(null);

  // 로그인 프롬프트 모달 상태
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentFileRef = useRef<File | null>(null);

  // 보고서 저장 (스토리지 업로드 정보 포함)
  const handleSaveReport = useCallback(async () => {
    // 비로그인 사용자는 로그인 유도 모달 표시
    if (!user?.id) {
      setShowLoginPrompt(true);
      return;
    }

    if (!reportData || !fileName) {
      toast({
        title: t('gcodeAnalytics.saveFailed'),
        description: t('gcodeAnalytics.noDataToSave', '저장할 분석 데이터가 없습니다.'),
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // 스토리지 업로드 정보와 API 원본 응답 함께 저장
      const { error } = await saveAnalysisReport(user.id, fileName, reportData, {
        gcodeFileId: uploadedFileInfo?.gcodeFileId,
        storagePath: uploadedFileInfo?.storagePath,
        apiResult: apiResult || undefined,  // API 원본 응답 전체 저장
      });

      if (error) {
        toast({
          title: t('gcodeAnalytics.saveFailed'),
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setIsSaved(true);
      toast({
        title: t('gcodeAnalytics.saveSuccess'),
        description: t('gcodeAnalytics.reportSaved'),
      });
    } catch (err) {
      console.error('[GCodeAnalytics] Save error:', err);
      toast({
        title: t('gcodeAnalytics.saveFailed'),
        description: t('gcodeAnalytics.analysisError'),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, reportData, fileName, uploadedFileInfo, apiResult, toast, t]);

  // 공유 링크 생성
  const handleShare = useCallback(async () => {
    if (!user?.id) {
      setShowLoginPrompt(true);
      return;
    }

    if (!reportData?.reportId) {
      toast({
        title: t('gcodeAnalytics.shareFailed', '공유 실패'),
        description: t('gcodeAnalytics.saveFirst', '먼저 보고서를 저장해주세요.'),
        variant: "destructive",
      });
      return;
    }

    setIsSharing(true);
    try {
      const { shareUrl: url, error } = await createReportShare(
        user.id,
        reportData.reportId,
        { title: fileName }
      );

      if (error || !url) {
        toast({
          title: t('gcodeAnalytics.shareFailed', '공유 실패'),
          description: error?.message || t('gcodeAnalytics.shareError', '공유 링크를 생성할 수 없습니다.'),
          variant: "destructive",
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
      console.error('[GCodeAnalytics] Share error:', err);
      toast({
        title: t('gcodeAnalytics.shareFailed', '공유 실패'),
        description: t('gcodeAnalytics.shareError', '공유 링크를 생성할 수 없습니다.'),
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  }, [user?.id, reportData?.reportId, fileName, toast, t]);

  // 클립보드 복사 (이미 생성된 URL)
  const handleCopyShareUrl = useCallback(async () => {
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
      console.error('[GCodeAnalytics] Copy error:', err);
    }
  }, [shareUrl, toast, t]);

  // 분석 실행 - 실제 API 호출
  const runAnalysis = useCallback(async (file: File) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setIsSaved(false); // 새 분석 시 저장 상태 초기화
    setAnalysisProgress({
      status: 'pending',
      progress: 0,
      message: t('gcodeAnalytics.analysisRequest'),
    });

    try {
      // 실제 API 호출
      const result = await analyzeGCodeFile(file, (progress) => {
        setAnalysisProgress(progress);
      });

      // API 결과 → UI 보고서 데이터 변환
      const report = convertApiResultToReportData(result, file.name);

      setReportData(report);
      setApiResult(result);  // API 원본 응답 저장
      setIsAnalyzing(false);
      setAnalysisProgress({
        status: 'done',
        progress: 100,
        message: t('gcodeAnalytics.analysisComplete'),
      });

      toast({
        title: t('gcodeAnalytics.analysisComplete'),
        description: `${t('gcodeAnalytics.qualityScore')}: ${report.overallScore?.value || 0} (${report.overallScore?.grade || 'N/A'} ${t('gcodeAnalytics.grade')})`,
      });

      // 분석 완료 후 자동 저장 (report와 result를 반환)
      return { report, result };
    } catch (error) {
      console.error('[GCodeAnalytics] Analysis error:', error);
      setIsAnalyzing(false);

      const errorMessage = error instanceof GCodeAnalysisError
        ? error.message
        : t('gcodeAnalytics.analysisError');

      setAnalysisError(errorMessage);
      setAnalysisProgress({
        status: 'error',
        progress: 0,
        message: errorMessage,
      });

      toast({
        title: t('gcodeAnalytics.analysisFailed'),
        description: errorMessage,
        variant: "destructive",
      });

      return null;
    }
  }, [toast, t]);

  // 파일 처리 (스토리지 업로드 + 분석)
  // NOTE: 비로그인 사용자도 분석은 가능, 저장/히스토리 접근 시에만 로그인 유도
  const processFile = useCallback(async (file: File) => {
    // G-code 파일인지 확인
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['gcode', 'gc', 'g', 'nc', 'ngc'].includes(ext || '')) {
      toast({
        title: t('gcodeAnalytics.unsupportedFormat'),
        description: t('gcodeAnalytics.unsupportedFormatDesc'),
        variant: "destructive",
      });
      return;
    }

    // 이전 업로드 정보 초기화
    setUploadedFileInfo(null);

    // 파일 읽기 (뷰어용)
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setFileName(file.name);
      setGcodeContent(content);
      setReportData(null);
      setSegmentData(null); // 이전 세그먼트 데이터 초기화
      setCurrentLayer(0);
      currentFileRef.current = file;

      // 로그인된 사용자면 스토리지에 업로드
      let fileInfo: { gcodeFileId: string; storagePath: string } | null = null;
      if (user?.id) {
        console.log('[GCodeAnalytics] Uploading to storage...');
        const uploadResult = await uploadGCodeForAnalysis(user.id, file);

        if (uploadResult.error) {
          console.warn('[GCodeAnalytics] Storage upload failed:', uploadResult.error);
          // 업로드 실패해도 분석은 계속 진행 (로컬 분석)
        } else {
          console.log('[GCodeAnalytics] Storage upload success:', uploadResult);
          fileInfo = {
            gcodeFileId: uploadResult.gcodeFileId,
            storagePath: uploadResult.storagePath,
          };
          setUploadedFileInfo(fileInfo);
        }
      }

      // 통합 API 호출: /api/v1/gcode/analyze-with-segments
      // - 세그먼트 데이터 즉시 반환 (3D 렌더링용)
      // - LLM 분석을 백그라운드에서 시작 (analysis_id 제공)
      let segmentResult: GCodeAnalysisResponse | null = null;
      try {
        segmentResult = await analyzeGCodeWithSegments(content, {
          binaryFormat: true,
          language: 'ko'
        });

        console.log('[GCodeAnalytics] Segment API response:', segmentResult);

        // 세그먼트 데이터 설정 (3D 뷰어용)
        if (segmentResult.status === 'segments_ready' && segmentResult.segments) {
          setSegmentData(segmentResult);
          setCurrentLayer(0);
        }
      } catch (err) {
        console.error('[GCodeAnalytics] Segment API error:', err);
        toast({
          title: t('gcodeAnalytics.analysisFailed'),
          description: '세그먼트 분석 중 오류가 발생했습니다.',
          variant: "destructive",
        });
        return;
      }

      // LLM 분석이 시작된 경우, analysis_id로 폴링하여 결과 가져오기
      let analysisResult = null;
      if (segmentResult?.analysis_id && segmentResult?.llm_analysis_started) {
        console.log('[GCodeAnalytics] LLM analysis started with ID:', segmentResult.analysis_id);

        setIsAnalyzing(true);
        setAnalysisProgress({
          status: 'running',
          progress: 5,
          message: 'LLM 분석 시작...',
        });

        try {
          // analysis_id로 LLM 분석 결과 폴링
          const result = await pollAnalysisProgress(
            segmentResult.analysis_id,
            (progress) => {
              setAnalysisProgress(progress);
            },
            {
              pollInterval: 2000,
              timeout: 600000, // 10분
            }
          );

          // API 결과 → UI 보고서 데이터 변환
          const report = convertApiResultToReportData(result, file.name);

          setReportData(report);
          setApiResult(result);
          setIsAnalyzing(false);
          setAnalysisProgress({
            status: 'done',
            progress: 100,
            message: t('gcodeAnalytics.analysisComplete'),
          });

          toast({
            title: t('gcodeAnalytics.analysisComplete'),
            description: `${t('gcodeAnalytics.qualityScore')}: ${report.overallScore?.value || 0} (${report.overallScore?.grade || 'N/A'} ${t('gcodeAnalytics.grade')})`,
          });

          analysisResult = { report, result };
        } catch (error) {
          console.error('[GCodeAnalytics] LLM analysis polling error:', error);
          setIsAnalyzing(false);
          setAnalysisError(error instanceof Error ? error.message : 'LLM 분석 중 오류가 발생했습니다.');
          setAnalysisProgress({
            status: 'error',
            progress: 0,
            message: error instanceof Error ? error.message : 'LLM 분석 실패',
          });

          toast({
            title: t('gcodeAnalytics.analysisFailed'),
            description: error instanceof Error ? error.message : 'LLM 분석 중 오류가 발생했습니다.',
            variant: "destructive",
          });
        }
      } else {
        console.warn('[GCodeAnalytics] LLM analysis not started:', {
          analysis_id: segmentResult?.analysis_id,
          llm_analysis_started: segmentResult?.llm_analysis_started,
        });
      }

      // 분석 성공 시 자동 저장
      if (analysisResult && user?.id) {
        console.log('[GCodeAnalytics] Auto-saving analysis report...');
        const { report, result } = analysisResult;

        const { data, error } = await saveAnalysisReport(user.id, file.name, report, {
          gcodeFileId: fileInfo?.gcodeFileId,
          storagePath: fileInfo?.storagePath,
          apiResult: result,
        });

        if (error) {
          console.error('[GCodeAnalytics] Auto-save failed:', error);
          toast({
            title: t('gcodeAnalytics.autoSaveFailed'),
            description: error.message,
            variant: "destructive",
          });
        } else {
          console.log('[GCodeAnalytics] Auto-save success:', data?.id);
          setIsSaved(true);

          // reportId를 report에 설정하고 상태 업데이트
          if (data?.id) {
            report.reportId = data.id;
            setReportData({ ...report });
            console.log('[GCodeAnalytics] reportId set:', data.id);
          }

          toast({
            title: t('gcodeAnalytics.autoSaveSuccess'),
            description: t('gcodeAnalytics.autoSaveDesc'),
          });
        }
      }
    };
    reader.readAsText(file);
  }, [toast, runAnalysis, user?.id, t]);

  // 드래그 앤 드롭 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
    // input 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFile]);

  // 재분석
  const handleReanalyze = useCallback(() => {
    if (currentFileRef.current) {
      runAnalysis(currentFileRef.current);
    }
  }, [runAnalysis]);

  // 새 파일
  const handleNewFile = useCallback(() => {
    setFileName(null);
    setGcodeContent(null);
    setReportData(null);
    setAnalysisError(null);
    setAnalysisProgress(null);
    currentFileRef.current = null;
  }, []);

  // 채팅 세션 및 보고서 로드 (사이드바용)
  useEffect(() => {
    const loadSidebarData = async () => {
      if (!user?.id) return;

      try {
        // 채팅 세션 로드
        const sessions = await getChatSessions(user.id, 10);
        setChatSessions(sessions.map(s => ({
          id: s.id,
          title: s.title,
          timestamp: new Date(s.last_message_at || s.created_at),
          messages: [],
        })));

        // 보고서 아카이브 로드
        const { data: reports } = await getAnalysisReportsList(user.id, { limit: 5 });
        if (reports) {
          setReportArchive(reports.map(r => ({
            id: r.id,
            fileName: r.file_name,
            overallScore: r.overall_score,
            overallGrade: r.overall_grade,
            createdAt: new Date(r.created_at),
          })));
        }
      } catch (error) {
        console.error('Failed to load sidebar data:', error);
      }
    };

    loadSidebarData();
  }, [user?.id]);

  // URL의 reportId로 보고서 자동 로드
  useEffect(() => {
    const loadReportFromUrl = async () => {
      if (!reportId || !user?.id) return;

      setIsAnalyzing(true);
      setAnalysisProgress({ stage: 'loading', progress: 50, message: t('gcodeAnalytics.loadingReport', '보고서 로딩 중...') });

      try {
        const { data, error } = await getAnalysisReportById(reportId);

        if (error || !data) {
          toast({
            title: t('gcodeAnalytics.reportLoadFailed', '보고서 로드 실패'),
            description: error?.message || t('gcodeAnalytics.reportNotFound', '보고서를 찾을 수 없습니다'),
            variant: 'destructive',
          });
          setIsAnalyzing(false);
          setAnalysisProgress(null);
          return;
        }

        // DB 보고서 데이터를 UI 데이터로 변환
        const uiData = convertDbReportToUiData(data);

        // G-code 컨텐츠 로드 (에디터용)
        if (!uiData.gcodeContent && data.file_storage_path && data.total_issues_count > 0) {
          try {
            const content = await downloadGCodeContent(data.file_storage_path);
            if (content) {
              uiData.gcodeContent = content;
              setGcodeContent(content);
            }
          } catch (downloadErr) {
            console.error('[GCodeAnalytics] G-code download error:', downloadErr);
          }
        }

        setReportData(uiData);
        setFileName(data.file_name);
        setIsSaved(true); // 이미 저장된 보고서
        setIsAnalyzing(false);
        setAnalysisProgress(null);
      } catch (err) {
        console.error('[GCodeAnalytics] Load report error:', err);
        toast({
          title: t('gcodeAnalytics.reportLoadFailed', '보고서 로드 실패'),
          variant: 'destructive',
        });
        setIsAnalyzing(false);
        setAnalysisProgress(null);
      }
    };

    loadReportFromUrl();
  }, [reportId, user?.id, t, toast]);

  // 사이드바 핸들러
  const handleNewChat = useCallback(() => {
    navigate('/ai-chat');
  }, [navigate]);

  const handleLoadSession = useCallback((session: ChatSession) => {
    navigate(`/ai-chat?session=${session.id}`);
  }, [navigate]);

  const handleSelectReport = useCallback((report: ReportArchiveItem) => {
    navigate(`/ai-chat?view=archive&reportId=${report.id}`);
  }, [navigate]);

  const handleDeleteReport = useCallback(async (reportId: string) => {
    // 삭제 후 목록 새로고침
    setReportArchive(prev => prev.filter(r => r.id !== reportId));
  }, []);

  return (
    <div className="h-screen bg-background flex">
      {/* 사이드바 */}
      <AppSidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        user={user}
        userPlan={userPlan}
        onLoginClick={() => setShowLoginPrompt(true)}
        onSignOut={signOut}
      >
        <ChatSidebarContent
          sessions={chatSessions}
          onNewChat={handleNewChat}
          onLoadSession={handleLoadSession}
          reports={reportArchive}
          onSelectReport={handleSelectReport}
          onDeleteReport={handleDeleteReport}
        />
      </AppSidebar>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* reportId가 있는 경우: 목록으로 버튼 + 파일명 표시 */}
        {reportId && (
          <div className="border-b bg-background px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/ai-chat?view=archive')}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                {t('gcodeAnalytics.backToList', '목록으로')}
              </Button>
              {fileName && (
                <span className="text-sm text-muted-foreground truncate max-w-md">
                  {fileName}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 상단 헤더 */}
        <AppHeader
          sidebarOpen={sidebarOpen}
          rightContent={
            <div className="flex items-center gap-2">
              {/* 아카이브 버튼 */}
              {!reportId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!user?.id) {
                      setShowLoginPrompt(true);
                      return;
                    }
                    navigate('/ai-chat?view=archive');
                  }}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  {t('gcodeAnalytics.archive')}
                </Button>
              )}

              {fileName && (
                <>
                  <Button variant="outline" size="sm" onClick={handleNewFile}>
                    <Upload className="h-4 w-4 mr-2" />
                    {t('gcodeAnalytics.newFile')}
                  </Button>

                  {reportData && !isSaved && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSaveReport}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {isSaving ? t('gcodeAnalytics.saving') : t('gcodeAnalytics.save')}
                    </Button>
                  )}

                  {isSaved && (
                    <>
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {t('gcodeAnalytics.saved')}
                      </Badge>

                      {/* 공유 버튼 - 저장된 보고서만 */}
                      {shareUrl ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyShareUrl}
                          className="gap-2"
                        >
                          {isCopied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          {isCopied ? t('gcodeAnalytics.copied', '복사됨') : t('gcodeAnalytics.copyLink', '링크 복사')}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleShare}
                          disabled={isSharing}
                          className="gap-2"
                        >
                          {isSharing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Share2 className="h-4 w-4" />
                          )}
                          {t('gcodeAnalytics.share', '공유')}
                        </Button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          }
        />

        {/* 페이지 콘텐츠 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 메인 컨텐츠 */}
          <div className="flex-1 p-4 lg:p-6 overflow-hidden max-w-[1920px] mx-auto w-full">
            {!gcodeContent ? (
              /* 업로드 영역 */
              <div className="h-full flex items-center justify-center">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "w-full max-w-2xl aspect-video rounded-3xl border-2 border-dashed transition-all cursor-pointer",
                    "flex flex-col items-center justify-center gap-6 p-8",
                    isDragging
                      ? "border-primary bg-primary/5 scale-[1.02]"
                      : "border-slate-300 dark:border-border/50 bg-white/50 dark:bg-muted/30 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-muted/30 shadow-sm"
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".gcode,.gc,.g,.nc,.ngc"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-muted flex items-center justify-center shadow-inner">
                    <FileCode2 className="h-10 w-10 text-slate-500 dark:text-muted-foreground" />
                  </div>

                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-foreground">{t('gcodeAnalytics.dragDropTitle')}</h2>
                    <p className="text-slate-500 dark:text-muted-foreground font-medium">
                      {t('gcodeAnalytics.clickToSelect')}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-muted-foreground">
                      {t('gcodeAnalytics.supportedFormats')}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {t('gcodeAnalytics.aiAnalysis')}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {t('gcodeAnalytics.realtimeProgress')}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {t('gcodeAnalytics.detailedReport')}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* 분석 결과 영역 */
              <div className="h-full flex gap-4 lg:gap-6">
                {/* 왼쪽: 3D 뷰어 (50%) */}
                <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border/50 shadow-lg flex flex-col overflow-hidden">
                  {/* 뷰어 헤더 */}
                  <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/20">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileCode2 className="h-5 w-5 text-primary" />
                      {t('gcodeAnalytics.preview3d')}
                    </h3>

                    <Badge variant="outline" className="bg-background font-mono text-xs">
                      {fileName}
                    </Badge>
                  </div>

                  {/* 뷰어 컨텐츠 */}
                  <div className="flex-1 relative bg-black/5 dark:bg-black/80 min-h-[400px]">
                    {segmentData && segmentData.segments ? (
                      /* API 기반 3D 렌더링 */
                      <>
                        <Canvas
                          shadows
                          camera={{
                            position: viewMode === '2D'
                              ? [128, 300, 128]  // 2D: 위에서 수직으로 내려다봄 (Top View)
                              : [256 + 100, 150, 256 + 100],  // 3D: 대각선 시점
                            fov: 50,
                            near: 0.1,
                            far: 2000
                          }}
                          gl={{
                            preserveDrawingBuffer: true,
                            powerPreference: 'high-performance',
                          }}
                          key={viewMode}  // viewMode가 변경되면 Canvas 재생성
                        >
                          <color attach="background" args={[isDarkMode ? '#1a1a1a' : '#f5f5f5']} />
                          <ambientLight intensity={isDarkMode ? 0.6 : 0.8} />
                          <directionalLight position={[100, 150, 100]} intensity={isDarkMode ? 1.2 : 1.0} castShadow />
                          <pointLight position={[128, 100, 128]} intensity={0.5} />

                          {/* 베드 */}
                          <BedPlate size={{ x: 256, y: 256 }} isDarkMode={isDarkMode} />

                          {/* G-code 경로 (API 세그먼트 데이터) */}
                          <GCodePath3DFromAPI
                            layers={segmentData.segments.layers}
                            maxLayer={currentLayer}
                            isDarkMode={isDarkMode}
                            showCurrentLayer={showCurrentLayer}
                            showPreviousLayers={showPreviousLayers}
                            showWipePath={showWipePath}
                            showTravelPath={showTravelPath}
                            showSupports={showSupports}
                          />

                          {/* 그리드 */}
                          <gridHelper
                            args={[256, 25.6, isDarkMode ? '#444444' : '#cccccc', isDarkMode ? '#333333' : '#dddddd']}
                            position={[128, 0, 128]}
                          />

                          {/* 카메라 컨트롤 */}
                          <OrbitControls
                            ref={orbitControlsRef}
                            enableDamping
                            dampingFactor={0.05}
                            target={viewMode === '2D' ? [128, 0, 128] : [128, 30, 128]}
                            minDistance={50}
                            maxDistance={500}
                            enableRotate={viewMode === '3D'}  // 2D 모드에서는 회전 비활성화
                            maxPolarAngle={viewMode === '2D' ? 0 : Math.PI}  // 2D 모드에서는 수평 고정
                          />
                        </Canvas>

                        {/* 좌상단: 2D/3D 전환 버튼 */}
                        <div className="absolute top-4 left-4 flex gap-1 bg-background/90 backdrop-blur-sm rounded-md p-1 border border-border/50 shadow-lg">
                          <Button
                            variant={viewMode === '2D' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 px-3 text-xs gap-1.5"
                            onClick={() => setViewMode('2D')}
                          >
                            <Grid3x3 className="h-3.5 w-3.5" />
                            2D
                          </Button>
                          <Button
                            variant={viewMode === '3D' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 px-3 text-xs gap-1.5"
                            onClick={() => setViewMode('3D')}
                          >
                            <Box className="h-3.5 w-3.5" />
                            3D
                          </Button>
                        </div>

                        {/* 우상단: 범례 - 아코디언 */}
                        <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm rounded-md border border-border/50 shadow-lg overflow-hidden">
                          {/* 범례 헤더 */}
                          <button
                            onClick={() => setIsLegendExpanded(!isLegendExpanded)}
                            className="w-full flex items-center justify-between p-2 hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-xs font-semibold text-foreground">범례</span>
                            {isLegendExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>

                          {/* 범례 내용 */}
                          {isLegendExpanded && (
                            <div className="p-2 pt-0 space-y-1">
                              <button
                                onClick={() => setShowCurrentLayer(!showCurrentLayer)}
                                className={cn(
                                  "w-full flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-1 transition-all",
                                  !showCurrentLayer && "opacity-40"
                                )}
                              >
                                <div className="w-6 h-0.5 rounded" style={{ backgroundColor: isDarkMode ? '#ff6600' : '#ff0000' }}></div>
                                <span className="text-xs text-foreground">현재 레이어</span>
                              </button>
                              <button
                                onClick={() => setShowPreviousLayers(!showPreviousLayers)}
                                className={cn(
                                  "w-full flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-1 transition-all",
                                  !showPreviousLayers && "opacity-40"
                                )}
                              >
                                <div className="w-6 h-0.5 rounded opacity-30" style={{ backgroundColor: isDarkMode ? '#00ffff' : '#2563eb' }}></div>
                                <span className="text-xs text-foreground">이전 레이어</span>
                              </button>
                              {/* Wipe 데이터가 있을 때만 표시 */}
                              {segmentData.segments.layers.some(layer => layer.wipeData && layer.wipeCount && layer.wipeCount > 0) && (
                                <button
                                  onClick={() => setShowWipePath(!showWipePath)}
                                  className={cn(
                                    "w-full flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-1 transition-all",
                                    !showWipePath && "opacity-40"
                                  )}
                                >
                                  <div className="w-6 h-0.5 rounded opacity-50" style={{ backgroundColor: isDarkMode ? '#ff00ff' : '#cc00cc' }}></div>
                                  <span className="text-xs text-foreground">Wipe (노즐 닦기)</span>
                                </button>
                              )}
                              <button
                                onClick={() => setShowTravelPath(!showTravelPath)}
                                className={cn(
                                  "w-full flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-1 transition-all",
                                  !showTravelPath && "opacity-40"
                                )}
                              >
                                <div className="w-6 h-0.5 rounded opacity-10" style={{ backgroundColor: isDarkMode ? '#999999' : '#aaaaaa' }}></div>
                                <span className="text-xs text-foreground">이동 경로</span>
                              </button>
                              {/* Supports 데이터가 있을 때만 표시 */}
                              {segmentData.segments.layers.some(layer => layer.supportData && layer.supportCount && layer.supportCount > 0) && (
                                <button
                                  onClick={() => setShowSupports(!showSupports)}
                                  className={cn(
                                    "w-full flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-1 transition-all",
                                    !showSupports && "opacity-40"
                                  )}
                                >
                                  <div className="w-6 h-0.5 rounded opacity-40" style={{ backgroundColor: isDarkMode ? '#ffff00' : '#ffa500' }}></div>
                                  <span className="text-xs text-foreground">서포트</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 하단: 레이어 슬라이더 (화살표 버튼 추가) */}
                        <div className="absolute bottom-4 left-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 border border-border/50 shadow-lg">
                          <div className="flex items-center gap-3">
                            {/* 이전 레이어 버튼 */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setCurrentLayer(Math.max(0, currentLayer - 1))}
                              disabled={currentLayer === 0}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>

                            {/* 레이어 정보 */}
                            <span className="text-sm font-medium whitespace-nowrap min-w-[100px] text-center">
                              레이어: {currentLayer + 1} / {segmentData.segments.metadata.layerCount}
                            </span>

                            {/* 슬라이더 */}
                            <Slider
                              value={[currentLayer]}
                              onValueChange={(value) => setCurrentLayer(value[0])}
                              max={segmentData.segments.metadata.layerCount - 1}
                              step={1}
                              className="flex-1"
                            />

                            {/* 다음 레이어 버튼 */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setCurrentLayer(Math.min(segmentData.segments.metadata.layerCount - 1, currentLayer + 1))}
                              disabled={currentLayer === segmentData.segments.metadata.layerCount - 1}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>

                            {/* 온도 표시 - 항상 표시 (마지막 온도 값 유지) */}
                            {segmentData.segments.temperatures && segmentData.segments.temperatures.length > 0 && (() => {
                              // 현재 레이어 또는 이전 레이어의 온도 찾기
                              let nozzleTemp: number | null = null;
                              let bedTemp: number | null = null;

                              // 현재 레이어 이하의 온도 데이터를 역순으로 검색하여 마지막 온도 값 찾기
                              for (let i = currentLayer; i >= 0; i--) {
                                const temp = segmentData.segments.temperatures.find(t => t.layer === i);
                                if (temp) {
                                  if (nozzleTemp === null && temp.nozzleTemp !== null) {
                                    nozzleTemp = temp.nozzleTemp;
                                  }
                                  if (bedTemp === null && temp.bedTemp !== null) {
                                    bedTemp = temp.bedTemp;
                                  }
                                  // 둘 다 찾았으면 종료
                                  if (nozzleTemp !== null && bedTemp !== null) break;
                                }
                              }

                              // 온도 데이터가 하나라도 있으면 표시
                              if (nozzleTemp !== null || bedTemp !== null) {
                                return (
                                  <div className="flex items-center gap-3 ml-2 pl-3 border-l border-border">
                                    <Thermometer className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    {nozzleTemp !== null && (
                                      <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-red-500" title="노즐" />
                                        <span className="text-xs font-medium">{nozzleTemp}°C</span>
                                      </div>
                                    )}
                                    {bedTemp !== null && (
                                      <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-orange-500" title="베드" />
                                        <span className="text-xs font-medium">{bedTemp}°C</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </>
                    ) : (
                      /* 로딩 중 또는 데이터 없음 */
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">3D 모델 로딩 중...</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 온도 차트 섹션 - 3D 뷰어 아래 */}
                  {segmentData && segmentData.segments.temperatures && segmentData.segments.temperatures.length > 0 && (
                    <div className="border-t bg-background/95 backdrop-blur p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">레이어별 온도 변화</span>
                        </div>
                        {/* 범례 - 클릭하여 토글 */}
                        <div className="flex items-center gap-4 text-xs">
                          <button
                            onClick={() => setShowNozzleLine(!showNozzleLine)}
                            className={cn(
                              "flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity",
                              !showNozzleLine && "opacity-40"
                            )}
                          >
                            <div className="w-3 h-[2px] bg-red-500 rounded" />
                            <span className="text-muted-foreground">노즐</span>
                          </button>
                          <button
                            onClick={() => setShowBedLine(!showBedLine)}
                            className={cn(
                              "flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity",
                              !showBedLine && "opacity-40"
                            )}
                          >
                            <div className="w-3 h-[2px] bg-orange-500 rounded" />
                            <span className="text-muted-foreground">베드</span>
                          </button>
                        </div>
                      </div>
                      <div className="h-[150px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={segmentData.segments.temperatures}
                            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={isDarkMode ? '#374151' : '#e5e7eb'}
                              vertical={false}
                            />
                            <XAxis
                              dataKey="layer"
                              tick={{ fontSize: 10, fill: isDarkMode ? '#9ca3af' : '#6b7280' }}
                              axisLine={{ stroke: isDarkMode ? '#4b5563' : '#d1d5db' }}
                              tickLine={false}
                              interval="preserveStartEnd"
                              tickFormatter={(value) => `L${value}`}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: isDarkMode ? '#9ca3af' : '#6b7280' }}
                              axisLine={{ stroke: isDarkMode ? '#4b5563' : '#d1d5db' }}
                              tickLine={false}
                              width={35}
                              domain={['auto', 'auto']}
                              tickFormatter={(value) => `${value}°`}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                                border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                                borderRadius: '6px',
                                fontSize: '12px',
                              }}
                              labelStyle={{ color: isDarkMode ? '#f3f4f6' : '#111827' }}
                              formatter={(value: number | null, name: string) => {
                                if (value === null) return ['N/A', name === 'nozzleTemp' ? '노즐' : '베드'];
                                return [`${value}°C`, name === 'nozzleTemp' ? '노즐' : '베드'];
                              }}
                              labelFormatter={(label) => `레이어 ${label}`}
                            />
                            {/* 현재 레이어 위치 표시 */}
                            <ReferenceLine
                              x={currentLayer}
                              stroke={isDarkMode ? '#60a5fa' : '#3b82f6'}
                              strokeWidth={2}
                              strokeDasharray="4 4"
                            />
                            {/* 노즐 온도 라인 */}
                            {showNozzleLine && (
                              <Line
                                type="stepAfter"
                                dataKey="nozzleTemp"
                                stroke="#ef4444"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4, fill: '#ef4444' }}
                                connectNulls
                              />
                            )}
                            {/* 베드 온도 라인 */}
                            {showBedLine && (
                              <Line
                                type="stepAfter"
                                dataKey="bedTemp"
                                stroke="#f97316"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4, fill: '#f97316' }}
                                connectNulls
                              />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>

                {/* 오른쪽: 분석 보고서 (50%) */}
                <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border/50 shadow-lg flex flex-col overflow-hidden">
                  {/* 보고서 컨텐츠 */}
                  <div className="flex-1 overflow-auto">
                    {isAnalyzing ? (
                      /* 분석 중 - 실시간 진행 상황 표시 */
                      <div className="h-full flex flex-col items-center justify-center gap-6 p-8">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>

                        <div className="text-center space-y-4 w-full max-w-md">
                          <p className="text-lg font-semibold">{t('gcodeAnalytics.analyzing')}</p>
                          <p className="text-xs text-muted-foreground">
                            💡 이번 업데이트로 더 정확한 분석을 위해 고도화된 모델을 채택했어요. 시간이 조금 오래 걸립니다...
                          </p>

                          {/* 진행률 바 */}
                          <div className="space-y-2">
                            <Progress value={analysisProgress?.progress || 0} className="h-3" />
                            <div className="flex justify-between text-sm text-muted-foreground">
                              <span>{analysisProgress?.progress || 0}%</span>
                              <span>{analysisProgress?.status || 'pending'}</span>
                            </div>
                          </div>

                          {/* 현재 단계 메시지 */}
                          <div className="bg-muted/50 rounded-lg p-4 text-sm min-h-[5rem] flex items-center justify-center">
                            <div className="text-muted-foreground w-full">
                              {analysisProgress?.message ? (
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    p: ({ children }) => <p className="mb-1 last:mb-0 leading-relaxed">{children}</p>,
                                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                                    em: ({ children }) => <em className="italic">{children}</em>,
                                    code: ({ children }) => <code className="bg-muted-foreground/20 rounded px-1">{children}</code>,
                                  }}
                                >
                                  {analysisProgress.message}
                                </ReactMarkdown>
                              ) : (
                                '분석 준비 중...'
                              )}
                            </div>
                          </div>

                          {/* 단계 표시 */}
                          <div className="flex justify-center gap-2 flex-wrap">
                            {['파싱', '요약', '이슈 분석', '패치 생성', '완료'].map((step, idx) => {
                              const progress = analysisProgress?.progress || 0;
                              const isActive = progress >= idx * 20 && progress < (idx + 1) * 20;
                              const isDone = progress >= (idx + 1) * 20;
                              return (
                                <Badge
                                  key={step}
                                  variant={isDone ? 'default' : isActive ? 'secondary' : 'outline'}
                                  className={cn(
                                    "text-xs",
                                    isActive && "animate-pulse"
                                  )}
                                >
                                  {step}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : analysisError ? (
                      /* 분석 오류 */
                      <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
                        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                          <span className="text-4xl">!</span>
                        </div>
                        <div className="text-center space-y-2">
                          <p className="text-lg font-semibold text-red-500">분석 실패</p>
                          <p className="text-sm text-muted-foreground max-w-md">
                            {analysisError}
                          </p>
                        </div>
                        <Button onClick={handleReanalyze} variant="outline">
                          다시 시도
                        </Button>
                      </div>
                    ) : reportData ? (
                      /* 분석 완료 - 상세 보고서 */
                      <GCodeAnalysisReport
                        data={{
                          ...reportData,
                          gcodeContent: gcodeContent || undefined
                        }}
                        className="w-full"
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 로그인 프롬프트 모달 */}
          <LoginPromptModal
            open={showLoginPrompt}
            onOpenChange={setShowLoginPrompt}
            title={t('auth.loginRequired', '로그인이 필요합니다')}
            description={t('gcodeAnalytics.loginToAnalyze', 'G-code 분석 기능을 이용하려면 로그인이 필요합니다.')}
          />
        </div>
      </div>
    </div>
  );
};

export default GCodeAnalytics;
