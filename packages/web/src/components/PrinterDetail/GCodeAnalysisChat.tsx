import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare,
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  FileCode2,
  AlertCircle,
  Trash2,
  CheckCircle,
  Download,
  ThumbsUp,
  ThumbsDown,
  Play,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  FileText
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// API 서비스 import
import {
  startGCodeAnalysis,
  subscribeToAnalysisStream,
  approvePatch,
  downloadAndSaveGCode,
  getGCodeSummary,
} from "@shared/services/gcodeAnalysisService";
import {
  chatForGCodeAnalysis,
} from "@shared/services/geminiService";
import type {
  TimelineStep,
  AnalysisResult,
  CollectedInfo,
  GCodeSummaryResult,
} from "@shared/types/gcodeAnalysisTypes";
import type { GCodeAnalysisData } from "./GCodeAnalysisReport";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// 마크다운 렌더링 컴포넌트
const MarkdownContent = ({ content, isUser = false }: { content: string; isUser?: boolean }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
      li: ({ children }) => <li className="ml-2">{children}</li>,
      code: ({ children, className }) => {
        const isInline = !className;
        return isInline ? (
          <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${isUser ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
            {children}
          </code>
        ) : (
          <code className="block p-2 rounded bg-muted text-xs font-mono overflow-x-auto my-2">
            {children}
          </code>
        );
      },
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
          {children}
        </a>
      ),
      h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
      h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
      h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
      blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground my-2">
          {children}
        </blockquote>
      ),
      table: ({ children }) => (
        <div className="overflow-x-auto my-2">
          <table className="min-w-full text-xs border-collapse">{children}</table>
        </div>
      ),
      th: ({ children }) => <th className="border border-border px-2 py-1 bg-muted font-semibold">{children}</th>,
      td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
    }}
  >
    {content}
  </ReactMarkdown>
);

// 이슈 타입에 따른 아이콘 및 색상
const getIssueStyle = (issueType: string) => {
  const type = issueType?.toLowerCase() || '';
  if (type.includes('critical') || type.includes('cold') || type.includes('error')) {
    return { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
  }
  if (type.includes('warning') || type.includes('temp') || type.includes('early')) {
    return { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
  }
  return { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
};

// 이슈 상세 정보 컴포넌트
const IssueDetailsSection = ({ issues }: { issues: Array<{ line_index?: number | string; description?: string; issue_type?: string }> }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!issues || issues.length === 0) return null;

  return (
    <div className="bg-muted/30 rounded-2xl border border-border/50 overflow-hidden">
      {/* 헤더 - 클릭하면 펼침/접힘 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium">발견된 이슈 ({issues.length}개)</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* 이슈 목록 */}
      {isExpanded && (
        <div className="border-t border-border/50 p-3 space-y-2 max-h-[300px] overflow-y-auto">
          {issues.map((issue, index) => {
            const style = getIssueStyle(issue.issue_type || '');
            const IconComponent = style.icon;

            return (
              <div
                key={index}
                className={`p-3 rounded-xl ${style.bg} border ${style.border} space-y-1`}
              >
                <div className="flex items-start gap-2">
                  <IconComponent className={`w-4 h-4 mt-0.5 flex-shrink-0 ${style.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {issue.issue_type && (
                        <Badge variant="outline" className="text-[10px] h-5">
                          {issue.issue_type}
                        </Badge>
                      )}

                      {issue.line_index !== undefined && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Line {issue.line_index}
                        </span>
                      )}
                    </div>
                    {issue.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {issue.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// AnalysisResult를 GCodeAnalysisData로 변환
const convertToReportData = (
  result: AnalysisResult,
  fileName?: string,
  metadata?: FileMetadata
): GCodeAnalysisData => {
  const summary = result.final_summary;
  const issues = result.issues_found || [];

  // 이슈 분류
  const criticalIssues = issues.filter(i =>
    i.issue_type?.toLowerCase().includes('critical') ||
    i.issue_type?.toLowerCase().includes('error')
  );
  const warningIssues = issues.filter(i =>
    i.issue_type?.toLowerCase().includes('warning') ||
    i.issue_type?.toLowerCase().includes('caution')
  );
  const infoIssues = issues.filter(i =>
    !criticalIssues.includes(i) && !warningIssues.includes(i) &&
    (i.issue_type?.toLowerCase().includes('info') || i.issue_type?.toLowerCase().includes('suggestion'))
  );

  // 등급 계산
  const score = summary.overall_quality_score;
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

  return {
    fileName: fileName || 'Unknown',
    analyzedAt: new Date().toLocaleString('ko-KR'),
    metrics: {
      printTime: {
        value: result.comprehensive_summary?.print_time?.formatted_time || metadata?.print_time_formatted || '분석 필요',
        seconds: result.comprehensive_summary?.print_time?.total_seconds,
      },
      filamentUsage: {
        length: result.comprehensive_summary?.extrusion?.total_filament_used
          ? `${result.comprehensive_summary.extrusion.total_filament_used.toFixed(2)}m`
          : (metadata?.filament_used_m ? `${metadata.filament_used_m}m` : '분석 필요'),
        weight: result.comprehensive_summary?.extrusion?.filament_weight_g
          ? `${result.comprehensive_summary.extrusion.filament_weight_g}g`
          : undefined,
        cost: undefined,
      },
      layerCount: {
        value: result.comprehensive_summary?.layer?.total_layers || 0,
        layerHeight: result.comprehensive_summary?.layer?.layer_height || metadata?.layer_height || undefined,
      },
      retractionCount: {
        value: result.comprehensive_summary?.extrusion?.retraction_count || 0,
      },
    },
    support: {
      percentage: result.comprehensive_summary?.support?.support_ratio || 0,
      volume: undefined,
    },
    speedDistribution: {
      travel: 150, // Default fallback
      infill: 80,
      perimeter: 45,
      support: 60,
    },
    printSpeed: result.comprehensive_summary?.speed ? {
      max: result.comprehensive_summary.speed.max_speed,
      avg: result.comprehensive_summary.speed.average_speed,
      min: 0, // Min speed not available in standard summary
    } : undefined,
    temperature: {
      nozzle: result.comprehensive_summary?.temperature?.nozzle_max || metadata?.nozzle_temperature || 200,
      bed: result.comprehensive_summary?.temperature?.bed_max || metadata?.bed_temperature || 60,
      firstLayer: undefined,
    },
    analysis: {
      warnings: criticalIssues.map(i => ({
        title: i.issue_type || '위험',
        description: i.description || '',
        impact: 'high' as const,
      })),
      cautions: warningIssues.map(i => ({
        title: i.issue_type || '주의',
        description: i.description || '',
        impact: 'medium' as const,
      })),
      suggestions: infoIssues.map(i => ({
        title: i.issue_type || '제안',
        description: i.description || '',
        impact: 'low' as const,
      })),
      goodPoints: summary.recommendation ? [{
        title: '권장사항',
        description: summary.recommendation,
      }] : [],
    },
    overallScore: {
      value: score,
      grade,
    },
  };
};

// 분석 결과 메시지 포맷 함수
const formatAnalysisResultMessage = (
  summary: AnalysisResult['final_summary'],
  issues: AnalysisResult['issues_found'],
  patchAvailable: boolean = false,
  patchCount: number = 0
): string => {
  const scoreEmoji = summary.overall_quality_score >= 80 ? '🟢' :
    summary.overall_quality_score >= 50 ? '🟡' : '🔴';

  const criticalIssues = issues?.filter(i =>
    i.issue_type?.toLowerCase().includes('critical') ||
    i.issue_type?.toLowerCase().includes('cold') ||
    i.issue_type?.toLowerCase().includes('error')
  ) || [];

  const warningIssues = issues?.filter(i =>
    i.issue_type?.toLowerCase().includes('warning') ||
    i.issue_type?.toLowerCase().includes('temp')
  ) || [];

  const infoIssues = issues?.filter(i =>
    !criticalIssues.includes(i) && !warningIssues.includes(i)
  ) || [];

  let message = `## ✅ G-code 분석 완료\n\n`;

  // 품질 점수 섹션
  message += `### 📊 품질 점수\n`;
  message += `| 항목 | 값 |\n`;
  message += `|------|----|\n`;
  message += `| 전체 점수 | ${scoreEmoji} **${summary.overall_quality_score}/100** |\n`;
  message += `| 발견된 이슈 | ${summary.total_issues_found}개 |\n`;
  message += `| 심각한 이슈 | ${summary.critical_issues}개 |\n\n`;

  // 요약 섹션
  message += `### 📋 분석 요약\n`;
  message += `${summary.summary}\n\n`;

  // 이슈 개요 섹션 (이슈가 있는 경우에만)
  if (issues && issues.length > 0) {
    message += `### ⚠️ 발견된 이슈 개요\n\n`;

    if (criticalIssues.length > 0) {
      message += `**🔴 심각한 문제 (${criticalIssues.length}건)**\n`;
      criticalIssues.slice(0, 3).forEach((issue, idx) => {
        message += `${idx + 1}. ${issue.description || '설명 없음'}\n`;
        if (issue.line_index) {
          message += `   - 위치: Line ${issue.line_index}\n`;
        }
      });
      if (criticalIssues.length > 3) {
        message += `   - *외 ${criticalIssues.length - 3}건*\n`;
      }
      message += `\n`;
    }

    if (warningIssues.length > 0) {
      message += `**🟡 주의 필요 (${warningIssues.length}건)**\n`;
      warningIssues.slice(0, 2).forEach((issue, idx) => {
        message += `${idx + 1}. ${issue.description || '설명 없음'}\n`;
      });
      if (warningIssues.length > 2) {
        message += `   - *외 ${warningIssues.length - 2}건*\n`;
      }
      message += `\n`;
    }

    if (infoIssues.length > 0) {
      message += `**🔵 참고 사항 (${infoIssues.length}건)**\n`;
      infoIssues.slice(0, 2).forEach((issue, idx) => {
        message += `${idx + 1}. ${issue.description || '설명 없음'}\n`;
      });
      if (infoIssues.length > 2) {
        message += `   - *외 ${infoIssues.length - 2}건*\n`;
      }
      message += `\n`;
    }

    message += `> 💡 상세 이슈 목록은 아래 **발견된 이슈** 섹션에서 확인할 수 있습니다.\n\n`;
  }

  // 권장 사항
  if (summary.recommendation) {
    message += `### 💡 권장 사항\n`;
    message += `${summary.recommendation}\n\n`;
  }

  // 패치 정보
  if (patchAvailable && patchCount > 0) {
    message += `---\n\n`;
    message += `### 🔧 수정 패치 준비됨\n`;
    message += `**${patchCount}개**의 자동 수정 패치가 준비되었습니다.\n\n`;
    message += `아래 버튼을 통해 패치를 **승인** 또는 **거부**해 주세요.\n`;
  }

  return message;
};

export interface GCodeAnalysisChatHandle {
  clearChat: () => void;
  startAnalysis: () => void;
}

// 파일 메타데이터 타입 (DB에서 가져온 정보)
interface FileMetadata {
  printer_model?: string | null;
  nozzle_temperature?: number | null;
  bed_temperature?: number | null;
  layer_height?: number | null;
  filament_used_m?: number | null;
  print_time_formatted?: string | null;
}

interface GCodeAnalysisChatProps {
  selectedFileName?: string | null;
  gcodeContent?: string | null;
  fileMetadata?: FileMetadata;
  className?: string;
  hideHeader?: boolean;
  userId?: string;
  onReportGenerated?: (reportData: GCodeAnalysisData) => void;
}

export const GCodeAnalysisChat = forwardRef<GCodeAnalysisChatHandle, GCodeAnalysisChatProps>(
  ({ selectedFileName, gcodeContent, fileMetadata, className, hideHeader = false, userId, onReportGenerated }, ref) => {
    const { t } = useTranslation();
    const { toast } = useToast();

    // 채팅 상태
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // 정보 수집 상태
    const [collectedInfo, setCollectedInfo] = useState<CollectedInfo>({});
    const [chatContext, setChatContext] = useState<Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>>([]);

    // 분석 상태
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisId, setAnalysisId] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [timeline, setTimeline] = useState<TimelineStep[]>([]);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [patchApproved, setPatchApproved] = useState<boolean | null>(null);

    // 요약 분석 상태 (새 워크플로우)
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summaryResult, setSummaryResult] = useState<GCodeSummaryResult | null>(null);
    const [summaryApproved, setSummaryApproved] = useState<boolean | null>(null);

    // 자동 스크롤
    useEffect(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }, [messages, timeline]);

    // 메시지 추가 헬퍼
    const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        role,
        content,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newMessage]);

      // Gemini 컨텍스트 업데이트
      setChatContext(prev => [
        ...prev,
        { role: role === 'user' ? 'user' : 'model', parts: [{ text: content }] }
      ]);
    }, []);

    const clearChat = () => {
      setMessages([]);
      setChatContext([]);
      setCollectedInfo({});
      setAnalysisResult(null);
      setPatchApproved(null);
      setTimeline([]);
      setProgress(0);
      setAnalysisId(null);
      setSummaryResult(null);
      setSummaryApproved(null);
    };

    // 자동 요약 분석 실행
    const runSummaryAnalysis = useCallback(async () => {
      if (!gcodeContent || !selectedFileName) return;

      setIsSummarizing(true);
      addMessage('assistant', `📊 **${selectedFileName}** 파일을 분석하고 있습니다...\n\n잠시만 기다려주세요.`);

      try {
        const response = await getGCodeSummary({
          gcode_content: gcodeContent,
          user_id: userId,
        });

        if (response.status === 'completed' && response.summary) {
          setSummaryResult(response.summary);
          setAnalysisId(response.analysis_id);

          // 요약 결과 메시지 생성
          const summary = response.summary;
          const summaryMessage = formatSummaryMessage(summary);

          // 이전 "분석 중" 메시지 업데이트
          setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages.length > 0) {
              newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                content: summaryMessage
              };
            }
            return newMessages;
          });
        } else {
          addMessage('assistant', '❌ 요약 분석에 실패했습니다. 직접 대화를 시작해주세요.');
        }
      } catch (error) {
        console.error('[GCodeAnalysisChat] Summary error:', error);
        // 백엔드 연결 실패 시 Mock 요약 표시
        const mockSummary = generateMockSummary();
        setSummaryResult(mockSummary);

        const summaryMessage = formatSummaryMessage(mockSummary) +
          `\n\n> ⚠️ *서버 연결 실패로 Mock 데이터를 표시합니다.*`;

        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0) {
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              content: summaryMessage
            };
          }
          return newMessages;
        });
      } finally {
        setIsSummarizing(false);
      }
    }, [gcodeContent, selectedFileName, userId, addMessage]);

    // Mock 요약 데이터 생성
    const generateMockSummary = (): GCodeSummaryResult => ({
      total_lines: 1224830,
      slicer_name: 'Ultimaker Cura',
      slicer_version: '5.4.0',
      nozzle_temp: {
        min: 28.2,
        max: 205.0,
        average: 195.0,
        change_rate: 0.5,
        timeline: []
      },
      bed_temp: {
        min: 60.0,
        max: 60.0,
        average: 60.0,
        change_rate: 0,
        timeline: []
      },
      layer_stats: {
        total_layers: 698,
        layer_height: 0.1,
        first_layer_height: 0.2,
        average_layer_time: 9.5
      },
      filament_used_mm: 77780,
      filament_used_m: 77.78,
      filament_weight_g: 232,
      retraction_count: 10552,
      support_ratio: 56.8,
      estimated_print_time_seconds: 6660,
      estimated_print_time_formatted: '1시간 51분',
      feedrate_distribution: {
        travel: 150,
        infill: 80,
        perimeter: 45,
        support: 60,
        min: 10,
        max: 150,
        average: 65
      },
      fan_events_count: 245
    });

    // 요약 결과 메시지 포맷
    const formatSummaryMessage = (summary: GCodeSummaryResult): string => {
      let message = `## 📊 G-code 요약 분석 완료\n\n`;

      message += `### 📋 기본 정보\n`;
      message += `| 항목 | 값 |\n|------|----|\n`;
      message += `| 총 라인 수 | ${summary.total_lines.toLocaleString()}줄 |\n`;
      if (summary.slicer_name) {
        message += `| 슬라이서 | ${summary.slicer_name} ${summary.slicer_version || ''} |\n`;
      }
      message += `| 총 레이어 | ${summary.layer_stats.total_layers}층 |\n`;
      message += `| 레이어 높이 | ${summary.layer_stats.layer_height}mm |\n`;
      message += `\n`;

      message += `### 🌡️ 온도 설정\n`;
      message += `| 항목 | 값 |\n|------|----|\n`;
      message += `| 노즐 온도 | ${summary.nozzle_temp.min}°C ~ ${summary.nozzle_temp.max}°C |\n`;
      message += `| 베드 온도 | ${summary.bed_temp.average}°C |\n`;
      message += `\n`;

      message += `### 🧵 필라멘트 & 출력\n`;
      message += `| 항목 | 값 |\n|------|----|\n`;
      message += `| 필라멘트 사용량 | ${summary.filament_used_m.toFixed(2)}m |\n`;
      if (summary.filament_weight_g) {
        message += `| 필라멘트 무게 | ${summary.filament_weight_g}g |\n`;
      }
      message += `| 리트랙션 횟수 | ${summary.retraction_count.toLocaleString()}회 |\n`;
      message += `| 서포트 비율 | ${summary.support_ratio.toFixed(1)}% |\n`;
      message += `| 예상 출력 시간 | **${summary.estimated_print_time_formatted}** |\n`;
      message += `\n`;

      message += `---\n\n`;
      message += `### ✅ 분석 준비 완료\n`;
      message += `위 요약 정보를 확인해주세요.\n\n`;
      message += `**보고서를 작성**하시겠습니까? 아니면 추가 정보가 필요하시면 **대화**를 계속할 수 있습니다.\n`;

      return message;
    };

    // 파일이 변경되면 자동 요약 분석 시작
    useEffect(() => {
      if (selectedFileName && gcodeContent) {
        setMessages([]);
        setChatContext([]);
        setCollectedInfo({});
        setAnalysisResult(null);
        setPatchApproved(null);
        setTimeline([]);
        setProgress(0);
        setSummaryResult(null);
        setSummaryApproved(null);

        // fileMetadata에서 이미 알고 있는 정보를 collectedInfo에 미리 설정
        if (fileMetadata) {
          setCollectedInfo({
            printerName: fileMetadata.printer_model ?? undefined,
            maxTempBed: fileMetadata.bed_temperature ?? undefined,
            maxTempNozzle: fileMetadata.nozzle_temperature ?? undefined,
          });
        }

        // 자동 요약 분석 시작
        runSummaryAnalysis();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFileName, gcodeContent]);

    // 요약 승인 핸들러 - 보고서 작성
    const handleSummaryApprove = useCallback(() => {
      setSummaryApproved(true);
      addMessage('assistant', '📝 보고서를 작성하고 있습니다...');

      // summaryResult를 GCodeAnalysisData로 변환하여 보고서 생성
      if (summaryResult && onReportGenerated) {
        const reportData: GCodeAnalysisData = {
          fileName: selectedFileName || 'Unknown',
          analyzedAt: new Date().toLocaleString('ko-KR'),
          metrics: {
            printTime: {
              value: summaryResult.estimated_print_time_formatted,
              seconds: summaryResult.estimated_print_time_seconds,
            },
            filamentUsage: {
              length: `${summaryResult.filament_used_m.toFixed(2)}m`,
              weight: summaryResult.filament_weight_g ? `${summaryResult.filament_weight_g}g` : undefined,
            },
            layerCount: {
              value: summaryResult.layer_stats.total_layers,
              layerHeight: summaryResult.layer_stats.layer_height,
            },
            retractionCount: {
              value: summaryResult.retraction_count,
            },
          },
          support: {
            percentage: summaryResult.support_ratio,
          },
          speedDistribution: {
            travel: summaryResult.feedrate_distribution.travel,
            infill: summaryResult.feedrate_distribution.infill,
            perimeter: summaryResult.feedrate_distribution.perimeter,
            support: summaryResult.feedrate_distribution.support,
          },
          printSpeed: {
            max: summaryResult.feedrate_distribution.max,
            avg: summaryResult.feedrate_distribution.average,
            min: summaryResult.feedrate_distribution.min,
          },
          temperature: {
            nozzle: summaryResult.nozzle_temp.max,
            bed: summaryResult.bed_temp.average,
          },
          analysis: {
            warnings: [],
            cautions: [],
            suggestions: [],
            goodPoints: [{
              title: '분석 완료',
              description: '요약 분석이 정상적으로 완료되었습니다.',
            }],
          },
          overallScore: {
            value: 85,
            grade: 'B',
          },
        };

        onReportGenerated(reportData);
        addMessage('assistant', '✅ 보고서가 생성되었습니다! 오른쪽 **Report** 탭에서 확인하세요.');
      }
    }, [summaryResult, selectedFileName, onReportGenerated, addMessage]);

    // 요약 거부 핸들러 - 대화 모드로 전환
    const handleSummaryReject = useCallback(() => {
      setSummaryApproved(false);
      addMessage('assistant', '💬 대화 모드로 전환합니다.\n\n추가로 궁금한 점이나 필요한 정보가 있으시면 말씀해주세요!\n\n예시:\n- "노즐 온도가 적절한가요?"\n- "서포트 비율이 너무 높은 것 같아요"\n- "출력 시간을 줄이려면 어떻게 해야 하나요?"');
    }, [addMessage]);

    // Mock 분석 실행 (백엔드 없을 때)
    const runMockAnalysis = useCallback(() => {
      const mockTimeline: TimelineStep[] = [
        { step: 1, label: 'G-code 파일 파싱 중...', status: 'running' },
        { step: 2, label: '온도 이벤트 분석', status: 'pending' },
        { step: 3, label: 'AI 분석 진행', status: 'pending' },
        { step: 4, label: '결과 생성', status: 'pending' },
      ];

      setTimeline(mockTimeline);

      // 단계별 진행 시뮬레이션
      let currentStep = 0;
      const totalSteps = mockTimeline.length;

      const interval = setInterval(() => {
        currentStep++;
        const progressPercent = (currentStep / totalSteps) * 100;
        setProgress(progressPercent);

        setTimeline(prev => prev.map((step, idx) => ({
          ...step,
          status: idx < currentStep ? 'done' : idx === currentStep ? 'running' : 'pending'
        })));

        if (currentStep >= totalSteps) {
          clearInterval(interval);

          // Mock 결과 생성
          setTimeout(() => {
            setIsAnalyzing(false);
            setProgress(100);

            const mockResult: AnalysisResult = {
              printing_info: {
                overview: '전반적으로 양호한 G-code입니다.',
                characteristics: { complexity: 'medium', estimated_quality: 'high', difficulty: 'intermediate' },
                temperature_analysis: '적절함',
                speed_analysis: '적절함',
                material_usage: '효율적',
                warnings: [],
                recommendations: [],
                summary_text: '출력 가능'
              },
              comprehensive_summary: {
                slicer_info: 'Cura',
                print_time: { formatted_time: '1h 30m', total_seconds: 5400 },
                temperature: { nozzle_min: 200, nozzle_max: 210, nozzle_avg: 205, bed_min: 60, bed_max: 60 },
                extrusion: { total_filament_used: 10.5, retraction_count: 50 },
                layer: { total_layers: 200, layer_height: 0.2 },
                support: { has_support: true, support_ratio: 15 },
                speed: { average_speed: 60, max_speed: 150 }
              },
              final_summary: {
                overall_quality_score: 85,
                total_issues_found: 2,
                critical_issues: 0,
                summary: '전반적으로 양호한 G-code입니다. 몇 가지 최적화 제안이 있습니다.',
                recommendation: '현재 설정으로 출력해도 무방합니다.',
              },
              issues_found: [
                {
                  has_issue: true,
                  severity: 'medium',
                  description: '초기 히팅 대기 시간이 길 수 있습니다',
                  issue_type: 'warning',
                  impact: 'medium',
                  suggestion: '대기 시간 단축',
                  line_index: 15
                },
                {
                  has_issue: true,
                  severity: 'low',
                  description: 'Z-hop 설정 확인 권장',
                  issue_type: 'info',
                  impact: 'low',
                  suggestion: 'Z-hop 활성화',
                  line_index: 1250
                },
              ],
              patch_plan: {
                total_patches: 2,
                patches: [],
              },
              token_usage: { input_tokens: 1500, output_tokens: 800, total_tokens: 2300 },
            };

            setAnalysisResult(mockResult);

            const resultMessage = formatAnalysisResultMessage(
              mockResult.final_summary,
              mockResult.issues_found
            ) + `\n\n> ⚠️ *백엔드 서버가 연결되지 않아 Mock 데이터를 표시합니다.*`;

            addMessage('assistant', resultMessage);

            // 보고서 데이터 콜백 호출
            if (onReportGenerated) {
              const reportData = convertToReportData(mockResult, selectedFileName || undefined, fileMetadata);
              onReportGenerated(reportData);
            }
          }, 500);
        }
      }, 800);
    }, [addMessage, onReportGenerated, selectedFileName, fileMetadata]);

    // 분석 시작
    const startAnalysis = useCallback(async () => {
      if (!gcodeContent || !selectedFileName) {
        toast({ title: 'G-code 파일을 먼저 선택해주세요', variant: 'destructive' });
        return;
      }

      setIsAnalyzing(true);
      setProgress(0);
      setTimeline([]);
      setAnalysisResult(null);
      setPatchApproved(null);

      addMessage('assistant', '🔍 G-code 분석을 시작합니다...');

      try {
        const response = await startGCodeAnalysis({
          gcode_content: gcodeContent,
          user_id: userId,
          printer_info: collectedInfo.printerName ? {
            name: collectedInfo.printerName,
            model: collectedInfo.printerModel,
            nozzle_diameter: collectedInfo.nozzleDiameter,
            max_temp_nozzle: collectedInfo.maxTempNozzle,
            max_temp_bed: collectedInfo.maxTempBed,
            build_volume: collectedInfo.buildVolume,
          } : undefined,
          filament_type: collectedInfo.filamentType,
        });

        setAnalysisId(response.analysis_id);

        // SSE 스트리밍 구독
        subscribeToAnalysisStream(response.analysis_id, {
          onTimeline: (event) => {
            setTimeline(prev => {
              const existing = prev.find(t => t.step === event.step);
              if (existing) {
                return prev.map(t => t.step === event.step ? event : t);
              }
              return [...prev, event];
            });
          },
          onProgress: (event) => {
            setProgress(event.progress * 100);
          },
          onComplete: (event) => {
            setIsAnalyzing(false);
            setProgress(100);
            const completeResult: AnalysisResult = {
              printing_info: event.printing_info || {
                overview: '',
                characteristics: { complexity: 'medium', estimated_quality: 'medium', difficulty: 'intermediate' },
                temperature_analysis: '',
                speed_analysis: '',
                material_usage: '',
                warnings: [],
                recommendations: [],
                summary_text: ''
              },
              comprehensive_summary: event.comprehensive_summary || {
                slicer_info: '',
                print_time: { formatted_time: '', total_seconds: 0 },
                temperature: { nozzle_min: 0, nozzle_max: 0 },
                extrusion: { total_filament_used: 0, retraction_count: 0 },
                layer: { total_layers: 0 },
                support: { has_support: false },
                speed: { average_speed: 0, max_speed: 0 }
              },
              final_summary: event.final_summary,
              issues_found: event.issues_found,
              patch_plan: event.patch_plan,
              token_usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
            };
            setAnalysisResult(completeResult);

            const summary = event.final_summary;
            const resultMessage = formatAnalysisResultMessage(summary, event.issues_found);

            addMessage('assistant', resultMessage);

            // 보고서 데이터 콜백 호출
            if (onReportGenerated) {
              const reportData = convertToReportData(completeResult, selectedFileName || undefined, fileMetadata);
              onReportGenerated(reportData);
            }
          },
          onError: (event) => {
            setIsAnalyzing(false);
            addMessage('assistant', `❌ 분석 중 오류가 발생했습니다: ${event.error}`);
          },
        });
      } catch (error) {
        setIsAnalyzing(false);
        console.error('[GCodeAnalysisChat] Analysis error:', error);
        addMessage('assistant', '❌ 분석 요청에 실패했습니다. 서버 연결을 확인해 주세요.');
      }
    }, [gcodeContent, selectedFileName, userId, collectedInfo, addMessage, toast, onReportGenerated, fileMetadata]);

    useImperativeHandle(ref, () => ({
      clearChat,
      startAnalysis
    }));


    // 메시지 전송
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading || isAnalyzing) return;

      const userMessage = input.trim();
      setInput('');
      addMessage('user', userMessage);

      // "바로 분석" 키워드 체크
      if (userMessage.includes('바로 분석') || userMessage.includes('분석 시작') || userMessage.includes('분석해')) {
        startAnalysis();
        return;
      }

      setIsLoading(true);

      try {
        const result = await chatForGCodeAnalysis(userMessage, {
          messages: chatContext,
          collectedInfo,
          gcodeFileName: selectedFileName || undefined,
          gcodeContent: gcodeContent || undefined,
        });

        addMessage('assistant', result.response);
        setCollectedInfo(result.collectedInfo);

        // 분석 준비 완료 시 자동 시작
        if (result.readyToAnalyze) {
          startAnalysis();
        }
      } catch (error) {
        console.error('[GCodeAnalysisChat] Chat error:', error);
        addMessage('assistant', '죄송합니다. 오류가 발생했습니다. 다시 시도해 주세요.');
      } finally {
        setIsLoading(false);
      }
    };

    // 패치 승인/거부
    const handleApprovePatch = async (approved: boolean) => {
      if (!analysisId) return;

      try {
        await approvePatch(analysisId, { approved, selected_patches: null });
        setPatchApproved(approved);

        if (approved) {
          addMessage('assistant', '✅ 패치가 승인되었습니다! 수정된 G-code를 다운로드할 수 있습니다.');
        } else {
          addMessage('assistant', '❌ 패치가 거부되었습니다. 원본 G-code를 그대로 사용하세요.');
        }
      } catch (error) {
        toast({ title: '패치 처리 실패', variant: 'destructive' });
      }
    };

    // 수정된 G-code 다운로드
    const handleDownload = async () => {
      if (!analysisId || !selectedFileName) return;

      try {
        const patchedName = selectedFileName.replace('.gcode', '_patched.gcode');
        await downloadAndSaveGCode(analysisId, patchedName);
        toast({ title: '다운로드 완료' });
      } catch (error) {
        toast({ title: '다운로드 실패', variant: 'destructive' });
      }
    };

    return (
      <Card className={`h-full flex flex-col border border-border/50 shadow-card bg-card rounded-2xl ${className || ''}`}>
        {!hideHeader && (
          <CardHeader className="pb-3 border-b border-border/50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                </div>
                G-code AI 분석
              </CardTitle>
              <div className="flex gap-1">
                {gcodeContent && !isAnalyzing && !analysisResult && (
                  <Button variant="ghost" size="sm" onClick={startAnalysis} className="h-8">
                    <Play className="h-4 w-4 mr-1" />
                    분석
                  </Button>
                )}
                {messages.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearChat} className="h-8 w-8 p-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {selectedFileName && (
              <Badge variant="secondary" className="mt-2 w-fit text-xs">
                <FileCode2 className="h-3 w-3 mr-1" />
                {selectedFileName}
              </Badge>
            )}
            {/* 수집된 정보 표시 */}
            {Object.keys(collectedInfo).length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {collectedInfo.printerName && (
                  <Badge variant="outline" className="text-xs">🖨️ {collectedInfo.printerName}</Badge>
                )}
                {collectedInfo.filamentType && (
                  <Badge variant="outline" className="text-xs">🧵 {collectedInfo.filamentType}</Badge>
                )}
              </div>
            )}
          </CardHeader>
        )}

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          {/* 메시지 영역 */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 py-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-8">
                <MessageSquare className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-sm font-medium mb-2">G-code 분석 AI</p>
                <p className="text-xs text-muted-foreground max-w-[280px]">
                  {selectedFileName
                    ? "아래 입력창에 질문을 입력하거나 '분석 시작'이라고 입력하여 G-code 분석을 시작하세요"
                    : "왼쪽에서 G-code 파일을 선택하세요"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-violet-500" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/60 border border-border/30'
                        }`}
                    >
                      <div className="text-sm leading-relaxed">
                        <MarkdownContent content={message.content} isUser={message.role === 'user'} />
                      </div>
                      <div className="text-[10px] opacity-40 mt-2 text-right">
                        {message.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {message.role === 'user' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </div>
                ))}

                {/* 타이핑 인디케이터 */}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-violet-500" />
                    </div>
                    <div className="bg-muted/50 rounded-xl px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}

                {/* 분석 진행률 - 개선된 UI */}
                {isAnalyzing && (
                  <div className="bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5 rounded-2xl p-4 space-y-4 border border-violet-500/20">
                    {/* 진행률 헤더 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                          </div>
                          <div className="absolute inset-0 rounded-full bg-violet-500/20 animate-ping" />
                        </div>
                        <span className="font-medium text-sm">AI 분석 진행 중</span>
                      </div>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {Math.round(progress)}%
                      </Badge>
                    </div>

                    {/* 프로그레스 바 */}
                    <div className="relative">
                      <Progress value={progress} className="h-2" />
                      <div
                        className="absolute top-0 left-0 h-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    {/* 타임라인 */}
                    <div className="space-y-2">
                      {timeline.map((step, index) => (
                        <div
                          key={step.step}
                          className={`flex items-center gap-3 p-2 rounded-lg transition-all ${step.status === 'running' ? 'bg-violet-500/10' : ''
                            }`}
                        >
                          {/* 아이콘 */}
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${step.status === 'done' ? 'bg-green-500/20' :
                            step.status === 'running' ? 'bg-violet-500/20' :
                              step.status === 'error' ? 'bg-destructive/20' :
                                'bg-muted'
                            }`}>
                            {step.status === 'done' && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                            {step.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />}
                            {step.status === 'pending' && <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />}
                            {step.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
                          </div>

                          {/* 연결선 */}
                          {index < timeline.length - 1 && (
                            <div className="absolute left-[calc(1rem+11px)] mt-7 w-0.5 h-4 bg-border" />
                          )}

                          {/* 라벨 */}
                          <span className={`text-xs flex-1 ${step.status === 'done' ? 'text-muted-foreground' :
                            step.status === 'running' ? 'font-medium' :
                              ''
                            }`}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 요약 분석 승인 UI */}
                {summaryResult && summaryApproved === null && !isSummarizing && (
                  <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-2xl p-4 space-y-3 border border-emerald-500/20">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">📊</span>
                      요약 분석 완료
                    </p>
                    <p className="text-xs text-muted-foreground pl-8">
                      G-code 요약 분석이 완료되었습니다. 보고서를 작성하시겠습니까?
                    </p>
                    <div className="flex gap-2 pl-8">
                      <Button size="sm" onClick={handleSummaryApprove} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                        <FileText className="w-3.5 h-3.5 mr-1" />
                        보고서 작성
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleSummaryReject} className="flex-1">
                        <MessageSquare className="w-3.5 h-3.5 mr-1" />
                        대화하기
                      </Button>
                    </div>
                  </div>
                )}

                {/* 요약 분석 중 로딩 */}
                {isSummarizing && (
                  <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl">
                    <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
                    <span className="text-sm">요약 분석 중...</span>
                  </div>
                )}

                {/* 이슈 상세 정보 (접을 수 있는 섹션) */}
                {analysisResult && analysisResult.issues_found && analysisResult.issues_found.length > 0 && (
                  <IssueDetailsSection issues={analysisResult.issues_found} />
                )}

                {/* 패치 승인 UI - patch_plan 또는 final_summary.patch_available 기준 */}
                {analysisResult &&
                  (analysisResult.patch_plan?.total_patches > 0 || analysisResult.final_summary?.patch_available) &&
                  patchApproved === null && (
                    <div className="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-2xl p-4 space-y-3 border border-violet-500/20">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-xs">🔧</span>
                        패치 승인 요청
                      </p>
                      <p className="text-xs text-muted-foreground pl-8">
                        {analysisResult.patch_plan?.total_patches || analysisResult.final_summary?.patch_count || 0}개의 수정 사항이 준비되었습니다.
                        {analysisResult.patch_plan?.estimated_improvement &&
                          ` (예상 개선: ${analysisResult.patch_plan.estimated_improvement}%)`
                        }
                      </p>
                      <div className="flex gap-2 pl-8">
                        <Button size="sm" onClick={() => handleApprovePatch(true)} className="flex-1 bg-violet-600 hover:bg-violet-700">
                          <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                          승인하기
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleApprovePatch(false)} className="flex-1">
                          <ThumbsDown className="w-3.5 h-3.5 mr-1" />
                          거부
                        </Button>
                      </div>
                    </div>
                  )}

                {/* 다운로드 버튼 */}
                {patchApproved === true && (
                  <div className="flex justify-center">
                    <Button onClick={handleDownload} size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      수정된 G-code 다운로드
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* 입력 영역 */}
          <div className="p-4 border-t border-border/50">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={selectedFileName ? "G-code에 대해 질문하세요..." : "파일을 먼저 선택하세요"}
                disabled={isLoading || isAnalyzing || !selectedFileName}
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading || isAnalyzing || !selectedFileName}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    );
  });

GCodeAnalysisChat.displayName = 'GCodeAnalysisChat';
