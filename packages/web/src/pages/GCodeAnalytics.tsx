/**
 * G-code 품질 분석기 페이지
 * Python 백엔드 API와 연동하여 G-code 분석 수행
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GCodeViewerCanvas } from "@/components/PrinterDetail/GCodeViewerCanvas";
import { GCodeAnalysisReport, type GCodeAnalysisData } from "@/components/PrinterDetail/GCodeAnalysisReport";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@shared/contexts/AuthContext";
import { analyzeGCodeFile, GCodeAnalysisError } from "@/lib/gcodeAnalysisService";
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
  Sparkles,
  CheckCircle,
  Archive,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  const realIssues = issues_found.filter((i) => i.has_issue);
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

  // detailedIssues 변환
  const detailedIssues = realIssues.map((issue) => {
    console.log('[transformAnalysisResult] Issue raw data:', {
      issue_type: issue.issue_type,
      layer: issue.layer,
      section: issue.section,
      event_line_index: issue.event_line_index,
    });
    return {
      issueType: issue.issue_type,
      severity: issue.severity as 'high' | 'medium' | 'low',
      line: issue.event_line_index ?? issue.line_index,  // event_line_index 우선
      line_index: issue.event_line_index ?? issue.line_index,
      code: issue.code,
      description: issue.description,
      impact: issue.impact,
      suggestion: issue.suggestion,
      layer: issue.layer,    // 레이어 번호
      section: issue.section,  // 섹션 (BODY, INFILL 등)
    };
  });

  // patchSuggestions 변환
  const patchSuggestions = patch_plan?.patches.map((patch) => ({
    line: patch.line_index,
    action: patch.action,
    original: patch.original_line,
    modified: patch.new_line,
    reason: patch.reason,
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
        travel: comprehensive_summary.feed_rate.travel_speed_avg,
        infill: comprehensive_summary.feed_rate.print_speed_avg,
        perimeter: comprehensive_summary.feed_rate.print_speed_avg * 0.7,
        support: comprehensive_summary.feed_rate.print_speed_avg * 0.9,
      }
      : undefined,
    printSpeed: comprehensive_summary?.feed_rate ? {
      max: comprehensive_summary.feed_rate.max_speed,
      avg: comprehensive_summary.feed_rate.avg_speed,
      min: comprehensive_summary.feed_rate.min_speed || 0,
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
        recommendation: final_summary.critical_issues > 0 ? '재슬라이싱 권장' : '출력 진행 가능',
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
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

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

  // 저장 상태
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // 스토리지 업로드 정보
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    gcodeFileId: string;
    storagePath: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentFileRef = useRef<File | null>(null);

  // 보고서 저장 (스토리지 업로드 정보 포함)
  const handleSaveReport = useCallback(async () => {
    if (!user?.id || !reportData || !fileName) {
      toast({
        title: "저장 실패",
        description: "로그인이 필요하거나 분석 결과가 없습니다.",
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
          title: "저장 실패",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setIsSaved(true);
      toast({
        title: "저장 완료",
        description: "분석 보고서가 아카이브에 저장되었습니다.",
      });
    } catch (err) {
      console.error('[GCodeAnalytics] Save error:', err);
      toast({
        title: "저장 실패",
        description: "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, reportData, fileName, uploadedFileInfo, apiResult, toast]);

  // 분석 실행 - 실제 API 호출
  const runAnalysis = useCallback(async (file: File) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setIsSaved(false); // 새 분석 시 저장 상태 초기화
    setAnalysisProgress({
      status: 'pending',
      progress: 0,
      message: '분석 요청 중...',
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
        message: '분석 완료!',
      });

      toast({
        title: "분석 완료",
        description: `품질 점수: ${report.overallScore?.value || 0}점 (${report.overallScore?.grade || 'N/A'} 등급)`,
      });

      // 분석 완료 후 자동 저장 (report와 result를 반환)
      return { report, result };
    } catch (error) {
      console.error('[GCodeAnalytics] Analysis error:', error);
      setIsAnalyzing(false);

      const errorMessage = error instanceof GCodeAnalysisError
        ? error.message
        : '분석 중 오류가 발생했습니다.';

      setAnalysisError(errorMessage);
      setAnalysisProgress({
        status: 'error',
        progress: 0,
        message: errorMessage,
      });

      toast({
        title: "분석 실패",
        description: errorMessage,
        variant: "destructive",
      });

      return null;
    }
  }, [toast]);

  // 파일 처리 (스토리지 업로드 + 분석)
  const processFile = useCallback(async (file: File) => {
    // G-code 파일인지 확인
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['gcode', 'gc', 'g', 'nc', 'ngc'].includes(ext || '')) {
      toast({
        title: "지원하지 않는 파일 형식",
        description: "G-code 파일(.gcode, .gc, .g, .nc, .ngc)만 업로드할 수 있습니다.",
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

      // 분석 시작
      const analysisResult = await runAnalysis(file);

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
            title: "자동 저장 실패",
            description: error.message,
            variant: "destructive",
          });
        } else {
          console.log('[GCodeAnalytics] Auto-save success:', data?.id);
          setIsSaved(true);
          toast({
            title: "보고서 저장됨",
            description: "분석 보고서가 자동으로 저장되었습니다.",
          });
        }
      }
    };
    reader.readAsText(file);
  }, [toast, runAnalysis, user?.id]);

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

  // GCode 뷰어 메모이제이션
  const gcodeViewer = useMemo(() => (
    gcodeContent ? (
      <GCodeViewerCanvas
        gcodeContent={gcodeContent}
        className="w-full h-full border-0 shadow-none rounded-none"
        bedSize={{ x: 220, y: 220 }}
      />
    ) : null
  ), [gcodeContent]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background relative overflow-hidden">
      {/* 배경 장식 제거됨 - 깔끔한 배경 유지 */}

      {/* 헤더 */}
      <div className="border-b bg-background/80 backdrop-blur-md px-6 py-4 flex-shrink-0 z-10 sticky top-0">
        <div className="flex items-center justify-between max-w-[1920px] mx-auto">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-muted ring-1 ring-border">
              <Sparkles className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">G-code 품질 분석기</h1>
              <p className="text-sm text-muted-foreground">
                AI가 당신의 G-code를 분석합니다
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 아카이브 버튼 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/gcode-analytics/archive')}
            >
              <Archive className="h-4 w-4 mr-2" />
              아카이브
            </Button>

            {fileName && (
              <>
                <Button variant="outline" size="sm" onClick={handleNewFile}>
                  <Upload className="h-4 w-4 mr-2" />
                  새 파일
                </Button>

                {/* 저장 버튼 (분석 완료 시) */}
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
                    {isSaving ? '저장 중...' : '저장'}
                  </Button>
                )}

                {/* 저장 완료 표시 */}
                {isSaved && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    저장됨
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
      </div>

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
                <h2 className="text-2xl font-bold text-slate-900 dark:text-foreground">G-code 파일을 드래그하세요</h2>
                <p className="text-slate-500 dark:text-muted-foreground font-medium">
                  또는 클릭하여 파일 선택
                </p>
                <p className="text-xs text-slate-400 dark:text-muted-foreground">
                  지원 형식: .gcode, .gc, .g, .nc, .ngc
                </p>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  AI 분석
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  실시간 진행률
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  상세 보고서
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
                  3D Preview
                </h3>
                <Badge variant="outline" className="bg-background font-mono text-xs">
                  {fileName}
                </Badge>
              </div>

              {/* 뷰어 컨텐츠 */}
              <div className="flex-1 relative bg-black/5 dark:bg-black/80 min-h-[400px]">
                {gcodeViewer}
              </div>
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
                      <p className="text-lg font-semibold">G-code AI 분석 중...</p>

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
                    data={reportData}
                    className="w-full"
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GCodeAnalytics;
