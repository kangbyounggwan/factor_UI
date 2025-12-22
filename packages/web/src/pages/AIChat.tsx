/**
 * 통합 AI 채팅 페이지 (Gemini 스타일)
 * G-code 분석 + 프린터 닥터 기능을 하나의 채팅 인터페이스로 통합
 *
 * 리팩토링된 구조:
 * - useChatUtils: 순수 유틸리티 함수 (detectToolType, createMessage 등)
 * - useChatSession: 세션 관리 로직
 * - useChatPersistence: 메시지 저장 로직
 * - useChatGcodeAnalysis: G-code 분석 후처리
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Send,
  Cpu,
  FileCode2,
  Stethoscope,
  Loader2,
  X,
  Plus,
  Settings2,
  ChevronDown,
  ChevronRight,
  Check,
  Box,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  sendChatMessage,
  imagesToAttachments,
  gcodeToAttachment,
  formatChatResponse,
  type ChatApiRequest,
  type ChatToolType as ApiToolType,
} from "@shared/services/chatApiService";
import { useUserPlan } from "@shared/hooks/useUserPlan";
import {
  checkUsageLimit,
  incrementUsage,
  getPlanInfo,
  checkTroubleshootAdvancedUsage,
  incrementTroubleshootAdvancedUsage,
  checkAnonymousUsage,
  incrementAnonymousUsage
} from "@shared/utils/subscription";
import { USAGE_TYPES, type SubscriptionPlanInfo } from "@shared/types/subscription";
import { AppSidebar, type ChatSession, type ReportArchiveItem } from "@/components/common/AppSidebar";
import { AppHeader } from "@/components/common/AppHeader";
import { FilePreviewList } from "@/components/ai/FilePreviewList";
import { ChatMessage, type ChatMessageData } from "@/components/ai/ChatMessage";
import { LoginPromptModal } from "@/components/auth/LoginPromptModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getChatSessions,
  getChatSession,
  createChatSession,
  deleteChatSession as deleteDBSession,
  getChatMessages,
  saveChatMessage,
  updateChatSessionTitle,
  updateChatSessionToolType,
} from "@shared/services/supabaseService/chat";
import { generateChatTitle } from "@shared/services/geminiService";
import {
  getAnonymousId,
  saveAnonChat,
  loadAnonChat,
  clearAnonChat,
  type AnonChatMessage,
} from "@shared/utils/anonymousId";

// 리팩토링된 채팅 유틸리티 함수
import {
  detectToolType,
  determineChatMode,
  createUserMessage,
  createAssistantMessage,
  createErrorMessage,
  prepareFileInfos,
  canSendMessage,
} from "@/hooks/chat";
import { GCodeAnalysisReport, type AIResolveStartInfo, type AIResolveCompleteInfo, type GCodeAnalysisData } from "@/components/PrinterDetail/GCodeAnalysisReport";
import { useSidebarState } from "@/hooks/useSidebarState";
import {
  useGcodeAnalysisPolling,
  type ReportCardData,
} from "@/components/gcodeAnalysis/useGcodeAnalysisPolling";
import {
  convertDbReportToUiData,
  getAnalysisReportById,
  uploadGCodeForAnalysis,
  downloadGCodeContent,
  getAnalysisReportsList,
  deleteAnalysisReport,
} from "@/lib/gcodeAnalysisDbService";
import { saveSegmentData, loadFullSegmentDataByReportId } from "@/lib/gcodeSegmentService";
import { extractGcodeContext } from "@/lib/api/gcode";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { ko, enUS } from "date-fns/locale";
import {
  Search,
  Filter,
  SortDesc,
  Clock,
  Layers,
  AlertTriangle,
  CheckCircle,
  ChevronLeft as ChevronLeftIcon,
  ArrowLeft,
  Ruler,
  Trash2,
} from "lucide-react";
import type {
  GCodeAnalysisReportListItem,
  AnalysisReportFilters,
  AnalysisReportSortOption,
  OverallGrade,
} from "@shared/types/gcodeAnalysisDbTypes";

// 코드 수정 정보 타입
interface CodeFixInfo {
  line_number: number | null;
  original: string | null;
  fixed: string | null;
}

interface Message {
  id: string;
  dbMessageId?: string; // DB에 저장된 메시지 ID (reportId 업데이트용)
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: string[];
  files?: { name: string; type: string }[];
  // 보고서 완료 카드 정보
  reportCard?: {
    reportId: string;
    fileName: string;
    overallScore?: number;
    overallGrade?: string;
    totalIssues?: number;
    layerCount?: number;
    printTime?: string;
  };
  // AI 해결하기 코드 수정 정보
  codeFixes?: CodeFixInfo[];
  // 연관된 reportId (코드 수정 시 G-code 로드용)
  analysisReportId?: string;
  // G-code 컨텍스트 (코드 수정 에디터에서 사용, 앞뒤 30라인)
  gcodeContext?: string;
  // API 응답에서 받은 참고 자료
  references?: Array<{ title: string; url: string; source?: string; snippet?: string }>;
  // API 응답에서 받은 제안 액션
  suggestedActions?: Array<{ label: string; action: string; data?: Record<string, unknown> }>;
}

type ChatMode = "general" | "troubleshoot" | "gcode" | "modeling";

const AIChat = () => {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as { openSidebar?: boolean } | null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("general");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [gcodeFile, setGcodeFile] = useState<File | null>(null);
  const [gcodeFileContent, setGcodeFileContent] = useState<string | null>(null); // G-code 파일 내용 (코드 수정 컨텍스트용)
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  // 사이드바 상태 (페이지 간 공유)
  const { isOpen: sidebarOpen, toggle: toggleSidebar, setIsOpen: setSidebarOpen } = useSidebarState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [_isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{ provider: string; model: string }>({ provider: 'google', model: 'gemini-2.5-flash-lite' });

  // 보고서 아카이브 상태
  const [reportArchive, setReportArchive] = useState<ReportArchiveItem[]>([]);

  // 현재 세션의 도구 타입 추적 (한 세션에서 하나의 도구만 사용 가능)
  const [currentSessionToolType, setCurrentSessionToolType] = useState<string | null>(null);
  // 새 채팅 유도 모달 상태
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [pendingToolId, setPendingToolId] = useState<string | null>(null);

  // G-code 분석 보고서 패널 상태
  const [reportPanelOpen, setReportPanelOpen] = useState(false);

  // 아카이브 뷰 상태 (메인 콘텐츠 영역에 표시)
  const [archiveViewActive, setArchiveViewActive] = useState(false);
  const [archiveClosing, setArchiveClosing] = useState(false);
  const [archiveReports, setArchiveReports] = useState<GCodeAnalysisReportListItem[]>([]);
  const [archiveTotalCount, setArchiveTotalCount] = useState(0);
  const [archiveCurrentPage, setArchiveCurrentPage] = useState(1);
  const [archiveIsLoading, setArchiveIsLoading] = useState(false);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState("");
  const [archiveGradeFilter, setArchiveGradeFilter] = useState<OverallGrade | "all">("all");
  const [archiveSortOption, setArchiveSortOption] = useState<AnalysisReportSortOption>({
    field: "created_at",
    direction: "desc",
  });
  const [archiveSelectedReport, setArchiveSelectedReport] = useState<GCodeAnalysisData | null>(null);
  const [archiveSelectedReportName, setArchiveSelectedReportName] = useState<string>("");
  const [archiveIsLoadingDetail, setArchiveIsLoadingDetail] = useState(false);
  const [archiveDeleteDialogOpen, setArchiveDeleteDialogOpen] = useState(false);
  const [archiveReportToDelete, setArchiveReportToDelete] = useState<string | null>(null);
  const ARCHIVE_PAGE_SIZE = 12;
  const dateLocale = i18n.language === "ko" ? ko : enUS;

  // G-code 분석 폴링 훅 사용
  const {
    isAnalyzing: isGcodeAnalyzing,
    progress: gcodeAnalysisProgress,
    timeline: gcodeAnalysisTimeline,
    progressMessage: gcodeAnalysisProgressMessage,
    analysisId: gcodeAnalysisId,
    analysisMessageId: gcodeAnalysisMessageId,
    reportData: gcodeReportData,
    segmentData: gcodeSegments,
    activeReportId,
    startPolling: startGcodeAnalysisPolling,
    stopPolling: stopGcodeAnalysisPolling,
    setReportData: setGcodeReportData,
    setActiveReportId,
    setSegmentData: setGcodeSegments,
    setAnalysisMessageId: setGcodeAnalysisMessageId,
  } = useGcodeAnalysisPolling();

  // 세그먼트 데이터 ID (3D 뷰어용 - 보고서 저장 시 함께 저장)
  const savedSegmentDataIdRef = useRef<string | null>(null);
  // G-code 파일 내용 ref (콜백 내에서 최신 상태 참조용)
  const gcodeFileContentRef = useRef<string | null>(null);

  // AI 해결하기 상태
  const [isAIResolving, setIsAIResolving] = useState(false);

  // 보고서 에디터 탭 관련 상태
  const [reportPanelTab, setReportPanelTab] = useState<'report' | 'viewer' | 'editor'>('report');
  const [editorContent, setEditorContent] = useState<string | undefined>(undefined);
  const [editorLoading, setEditorLoading] = useState(false); // G-code 로딩 상태
  const [editorFixInfo, setEditorFixInfo] = useState<{
    lineNumber: number;
    original: string;
    fixed: string;
    description?: string;
  } | undefined>(undefined);

  // 해결된 라인 번호 추적 (패치 적용 시 추가)
  const [resolvedLines, setResolvedLines] = useState<Set<number>>(new Set());

  // 대기 중인 패치들 (수정본 저장 시 한 번에 적용)
  // key: lineNumber, value: { originalCode, fixedCode }
  const [pendingPatches, setPendingPatches] = useState<Map<number, { originalCode: string; fixedCode: string }>>(new Map());

  // 되돌리기 상태 (라인 번호 설정 시 해당 라인 되돌리기)
  const [revertLineNumber, setRevertLineNumber] = useState<number | undefined>(undefined);

  // 사용자 플랜 정보 가져오기 (shared 훅 사용)
  const { plan: userPlan } = useUserPlan(user?.id);
  const [planInfo, setPlanInfo] = useState<SubscriptionPlanInfo | null>(null);

  // 플랜 정보 로드
  useEffect(() => {
    const loadPlanInfo = async () => {
      if (userPlan) {
        const info = await getPlanInfo(userPlan);
        setPlanInfo(info);
      }
    };
    loadPlanInfo();
  }, [userPlan]);

  // gcodeFileContent 상태를 ref에 동기화 (콜백에서 최신 상태 참조)
  useEffect(() => {
    gcodeFileContentRef.current = gcodeFileContent;
  }, [gcodeFileContent]);

  // G-code 파일 업로드 시 기본 메시지 설정
  useEffect(() => {
    if (gcodeFile && !input) {
      setInput(t('aiChat.gcodeAnalyzePrompt', '이 출력 파일 확인해줘'));
    } else if (!gcodeFile && input === t('aiChat.gcodeAnalyzePrompt', '이 출력 파일 확인해줘')) {
      setInput('');
    }
  }, [gcodeFile, t]);

  // 비로그인 사용자: localStorage에서 대화 불러오기
  useEffect(() => {
    if (!user?.id) {
      const savedMessages = loadAnonChat();
      if (savedMessages.length > 0) {
        const formattedMessages: Message[] = savedMessages.map((m, idx) => ({
          id: `anon-${idx}`,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp),
        }));
        setMessages(formattedMessages);
      }
    }
  }, [user?.id]);

  // 로그인 사용자: DB에서 세션 불러오기
  useEffect(() => {
    const loadSessions = async () => {
      if (!user?.id) {
        setChatSessions([]);
        return;
      }

      setIsLoadingSessions(true);
      try {
        const dbSessions = await getChatSessions(user.id);
        // DB 세션을 ChatSession 형식으로 변환
        const formattedSessions: ChatSession[] = dbSessions.map(s => ({
          id: s.id,
          title: s.title,
          timestamp: new Date(s.last_message_at || s.created_at),
          messages: [], // 메시지는 세션 로드 시 별도로 가져옴
          metadata: s.metadata, // G-code 보고서 ID 등
        }));
        setChatSessions(formattedSessions);
      } catch {
        // 세션 로드 실패
      } finally {
        setIsLoadingSessions(false);
      }
    };

    loadSessions();
  }, [user?.id]);

  // 사이드바용 보고서 아카이브 로드 함수
  const loadReportArchive = useCallback(async () => {
    if (!user?.id) {
      setReportArchive([]);
      return;
    }

    try {
      const { data } = await getAnalysisReportsList(user.id, { limit: 10 });
      const formattedReports: ReportArchiveItem[] = data.map(r => ({
        id: r.id,
        fileName: r.file_name,
        overallScore: r.overall_score ?? undefined,
        overallGrade: r.overall_grade ?? undefined,
        totalIssues: r.total_issues_count ?? undefined,
        createdAt: new Date(r.created_at),
      }));
      setReportArchive(formattedReports);
    } catch {
      // 보고서 로드 실패
    }
  }, [user?.id]);

  // 로그인 사용자: 보고서 아카이브 불러오기
  useEffect(() => {
    loadReportArchive();
  }, [loadReportArchive]);

  // 아카이브 시트용: 보고서 목록 로드
  const loadArchiveReports = useCallback(async () => {
    if (!user?.id) return;

    setArchiveIsLoading(true);
    try {
      const filters: AnalysisReportFilters = {
        status: "completed",
      };

      if (archiveGradeFilter !== "all") {
        filters.grade = archiveGradeFilter;
      }

      const offset = (archiveCurrentPage - 1) * ARCHIVE_PAGE_SIZE;

      const { data, count } = await getAnalysisReportsList(user.id, {
        filters,
        sort: archiveSortOption,
        limit: ARCHIVE_PAGE_SIZE,
        offset,
      });

      // 검색어 필터링 (클라이언트 사이드)
      const filtered = archiveSearchQuery
        ? data.filter((r) =>
            r.file_name?.toLowerCase().includes(archiveSearchQuery.toLowerCase())
          )
        : data;

      setArchiveReports(filtered);
      setArchiveTotalCount(count);
    } catch (err) {
      console.error("[AIChat] Archive load error:", err);
    } finally {
      setArchiveIsLoading(false);
    }
  }, [user?.id, archiveCurrentPage, archiveGradeFilter, archiveSortOption, archiveSearchQuery]);

  // 아카이브 뷰 활성화 시 로드
  useEffect(() => {
    if (archiveViewActive) {
      loadArchiveReports();
    }
  }, [archiveViewActive, loadArchiveReports]);

  // 아카이브 보고서 상세 보기
  const handleArchiveViewReport = async (reportId: string, fileName?: string) => {
    setArchiveIsLoadingDetail(true);
    setArchiveSelectedReportName(fileName || t("gcodeAnalytics.reportTitle"));

    try {
      const { data, error } = await getAnalysisReportById(reportId);

      if (error || !data) {
        toast({
          title: t("gcodeAnalytics.reportLoadFailed"),
          description: error?.message || t("gcodeAnalytics.reportNotFound"),
          variant: "destructive",
        });
        return;
      }

      const uiData = convertDbReportToUiData(data);

      // G-code 컨텐츠가 없고 스토리지 경로가 있고 이슈가 있으면 다운로드 (에디터용)
      if (!uiData.gcodeContent && data.file_storage_path && data.total_issues_count > 0) {
        try {
          const content = await downloadGCodeContent(data.file_storage_path);
          if (content) {
            uiData.gcodeContent = content;
          }
        } catch (downloadErr) {
          console.error("[AIChat] G-code download error:", downloadErr);
        }
      }

      setArchiveSelectedReport(uiData);
    } catch (err) {
      console.error("[AIChat] Archive view error:", err);
    } finally {
      setArchiveIsLoadingDetail(false);
    }
  };

  // 아카이브 뷰 토글 (닫을 때 애니메이션 적용)
  const handleArchiveToggle = () => {
    if (archiveViewActive) {
      // 닫기: 애니메이션 시작 후 상태 변경
      setArchiveClosing(true);
      setTimeout(() => {
        setArchiveClosing(false);
        setArchiveViewActive(false);
        setArchiveSelectedReport(null);
      }, 200); // duration-200과 동일
    } else {
      // 열기
      setArchiveViewActive(true);
    }
  };

  // 아카이브 보고서 삭제
  const handleArchiveDelete = async () => {
    if (!archiveReportToDelete) return;

    try {
      const { error } = await deleteAnalysisReport(archiveReportToDelete);
      if (error) {
        toast({
          title: t("gcodeAnalytics.deleteFailed"),
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t("gcodeAnalytics.deleteSuccess"),
        description: t("gcodeAnalytics.reportDeleted"),
      });

      // 목록 새로고침
      loadArchiveReports();
      // 사이드바 보고서 목록도 새로고침
      loadReportArchive();
    } catch (err) {
      console.error("[AIChat] Archive delete error:", err);
    } finally {
      setArchiveDeleteDialogOpen(false);
      setArchiveReportToDelete(null);
    }
  };

  // 아카이브 등급 배지 색상
  const getArchiveGradeBadgeColor = (grade?: OverallGrade) => {
    switch (grade) {
      case "A":
        return "bg-green-500 text-white";
      case "B":
        return "bg-blue-500 text-white";
      case "C":
        return "bg-yellow-500 text-white";
      case "D":
        return "bg-orange-500 text-white";
      case "F":
        return "bg-red-500 text-white";
      default:
        return "bg-slate-500 text-white";
    }
  };

  const archiveTotalPages = Math.ceil(archiveTotalCount / ARCHIVE_PAGE_SIZE);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gcodeInputRef = useRef<HTMLInputElement>(null);

  // 새 채팅 시작
  const handleNewChat = async () => {
    // 새 채팅 초기화
    setMessages([]);
    setCurrentSessionId(null);
    setInput("");
    setUploadedImages([]);
    setImageFiles([]);
    setGcodeFile(null);
    setSelectedTool(null);
    setChatMode("general");
    setCurrentSessionToolType(null); // 도구 타입 초기화

    // 보고서 상태 초기화
    setReportPanelOpen(false);
    setGcodeReportData(null);
    setActiveReportId(null);
    setGcodeSegments(null);

    // 비로그인 사용자: localStorage 클리어
    if (!user?.id) {
      clearAnonChat();
    }
  };

  // 채팅 세션 불러오기
  const handleLoadSession = async (session: ChatSession) => {
    if (!user?.id) return;

    // 아카이브 뷰가 열려있으면 닫기
    if (archiveViewActive) {
      setArchiveViewActive(false);
      setArchiveSelectedReport(null);
    }

    try {
      // DB에서 세션 정보 가져오기 (tool_type 포함)
      const sessionData = await getChatSession(session.id);
      if (sessionData) {
        // 세션의 도구 타입 설정 (general이 아닌 경우에만)
        if (sessionData.tool_type && sessionData.tool_type !== 'general') {
          setCurrentSessionToolType(sessionData.tool_type);
          setSelectedTool(sessionData.tool_type);
        } else {
          setCurrentSessionToolType(null);
          setSelectedTool(null);
        }
      }

      // DB에서 메시지 가져오기
      const dbMessages = await getChatMessages(session.id);

      // 메시지에서 reportId가 있는 것들 수집
      const reportIds = [...new Set(dbMessages.filter(m => m.reportId).map(m => m.reportId!))];

      // 보고서 ID별로 reportCardData 캐시
      const reportCardCache: Record<string, Message['reportCard']> = {};

      // 각 보고서를 DB에서 조회
      for (const reportId of reportIds) {
        const { data: report } = await getAnalysisReportById(reportId);
        if (report) {
          reportCardCache[reportId] = {
            reportId: report.id,
            fileName: report.file_name || 'analysis.gcode',
            overallScore: report.overall_score,
            overallGrade: report.overall_grade,
            totalIssues: report.total_issues_count,
            layerCount: report.layer_count,
            printTime: report.print_time_formatted,
          };
        }
      }

      const formattedMessages: Message[] = dbMessages.map(m => {
        // 메시지에 reportId가 있으면 해당 보고서 카드 연결 (메시지 자체의 reportId만 사용)
        let reportCard: Message['reportCard'] | undefined;
        if (m.reportId && reportCardCache[m.reportId]) {
          reportCard = reportCardCache[m.reportId];
        }

        // metadata에서 codeFixes, gcodeContext 추출
        const metadata = m.metadata as {
          codeFixes?: CodeFixInfo[];
          gcodeContext?: string;
          analysisReportId?: string;
        } | undefined;

        return {
          id: m.id,
          role: m.type as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.created_at),
          images: m.images || undefined,
          files: m.files || undefined,
          reportCard,
          // metadata에서 복원
          codeFixes: metadata?.codeFixes,
          gcodeContext: metadata?.gcodeContext,
          analysisReportId: metadata?.analysisReportId || m.reportId,
        };
      });

      setMessages(formattedMessages);
      setCurrentSessionId(session.id);

      // 세션 변경 시 항상 보고서 상태 초기화 (이전 세션의 보고서가 남아있지 않도록)
      setReportPanelOpen(false);
      setGcodeReportData(null);
      setActiveReportId(null);
      setGcodeSegments(null);
    } catch (e) {
      toast({
        title: t('aiChat.loadError', '세션 로드 실패'),
        description: t('aiChat.tryAgainLater', '잠시 후 다시 시도해주세요.'),
        variant: 'destructive',
      });
    }
  };

  // 채팅 세션 삭제
  const handleDeleteSession = async (sessionId: string) => {
    if (!user?.id) return;

    try {
      const success = await deleteDBSession(sessionId);
      if (success) {
        setChatSessions(prev => prev.filter(s => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          setMessages([]);
          setCurrentSessionId(null);
          // 보고서 상태 초기화
          setReportPanelOpen(false);
          setGcodeReportData(null);
          setActiveReportId(null);
          setGcodeSegments(null);
        }
      }
    } catch (e) {
      toast({
        title: t('aiChat.deleteError', '세션 삭제 실패'),
        variant: 'destructive',
      });
    }
  };

  // 보고서 아카이브 선택 핸들러 (사이드바에서 클릭 시)
  const handleSelectReport = async (report: ReportArchiveItem) => {
    // 아카이브 뷰를 열고 해당 보고서 상세 보기로 이동
    setArchiveViewActive(true);
    await handleArchiveViewReport(report.id, report.fileName);
  };

  // 보고서 아카이브 삭제 핸들러
  const handleDeleteReport = async (reportId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await deleteAnalysisReport(reportId);
      if (!error) {
        setReportArchive(prev => prev.filter(r => r.id !== reportId));
        // 현재 열린 보고서가 삭제된 경우 패널 닫기
        if (activeReportId === reportId) {
          setReportPanelOpen(false);
          setGcodeReportData(null);
          setActiveReportId(null);
          setGcodeSegments(null);
        }
        toast({
          title: t('aiChat.reportDeleted', '보고서가 삭제되었습니다'),
        });
      }
    } catch {
      toast({
        title: t('aiChat.reportDeleteError', '보고서 삭제 실패'),
        variant: 'destructive',
      });
    }
  };

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Textarea 자동 높이 조절
  useEffect(() => {
    if (textareaRef.current) {
      // 입력이 비어있으면 최소 높이로 리셋
      if (!input.trim()) {
        textareaRef.current.style.height = "44px"; // min-h-[44px]과 동일
        return;
      }
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  // 이미지 업로드 처리
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) {
        setImageFiles((prev) => [...prev, file]);
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setUploadedImages((prev) => [...prev, event.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      }
    });

    e.target.value = "";
  }, []);

  // G-code 파일 업로드 처리
  const handleGcodeUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.gcode') || file.name.endsWith('.gco'))) {
      setGcodeFile(file);
      // 파일 내용 읽기 (코드 수정 컨텍스트용)
      try {
        const content = await file.text();
        setGcodeFileContent(content);
      } catch (err) {
        console.error('[AIChat] Failed to read gcode file content:', err);
      }
      toast({
        title: t('aiChat.gcodeUploaded', 'G-code 파일 업로드됨'),
        description: file.name,
      });
    }
    e.target.value = "";
  }, [toast, t]);

  // 이미지 제거
  const removeImage = (index: number) => {
    setUploadedImages((prev) => {
      const newImages = prev.filter((_, i) => i !== index);
      // 모든 이미지가 제거되면 도구 선택 해제
      if (newImages.length === 0 && selectedTool === "troubleshoot") {
        setSelectedTool(null);
      }
      return newImages;
    });
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // G-code 파일 제거
  const removeGcodeFile = () => {
    setGcodeFile(null);
    setGcodeFileContent(null);
    if (chatMode === "gcode") {
      setChatMode("general");
    }
    if (selectedTool === "gcode") {
      setSelectedTool(null);
    }
  };

  // 이미지 파일 처리 공통 함수
  const processImageFile = useCallback((file: File) => {
    if (file.type.startsWith("image/")) {
      setImageFiles((prev) => [...prev, file]);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setUploadedImages((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // 드래그 앤 드롭 핸들러
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        processImageFile(file);
      } else if (file.name.endsWith('.gcode') || file.name.endsWith('.gco')) {
        setGcodeFile(file);
        // 파일 내용 읽기 (코드 수정 컨텍스트용)
        try {
          const content = await file.text();
          setGcodeFileContent(content);
        } catch (err) {
          console.error('[AIChat] Failed to read gcode file content:', err);
        }
        toast({
          title: t('aiChat.gcodeUploaded', 'G-code 파일 업로드됨'),
          description: file.name,
        });
      }
    }
  }, [processImageFile, toast, t]);

  // 클립보드 붙여넣기 핸들러
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          processImageFile(file);
        }
      }
    }
  }, [processImageFile]);

  /**
   * 메시지 전송 (리팩토링된 orchestrator)
   *
   * 책임:
   * 1. 입력 유효성 검사 → canSendMessage()
   * 2. 도구 타입 결정 → detectToolType()
   * 3. 세션 관리 (생성/업데이트)
   * 4. 메시지 생성 → createUserMessage()
   * 5. Chat API 호출
   * 6. 응답 처리 및 후처리
   */
  const handleSend = async () => {
    // 1. 입력 유효성 검사
    if (!canSendMessage(input, uploadedImages, gcodeFile, isLoading)) return;

    // 1-0. 익명 사용자 일일 한도 체크 (10회)
    if (!user) {
      const anonUsage = checkAnonymousUsage();
      if (!anonUsage.canUse) {
        toast({
          title: t('aiChat.anonymousLimitReached', '일일 사용 한도 도달'),
          description: t('aiChat.anonymousLimitDescription', '비로그인 사용자는 하루 10회까지 사용 가능합니다. 로그인하면 더 많이 사용할 수 있습니다.'),
          variant: 'destructive',
        });
        setShowLoginModal(true);
        return;
      }
    }

    // 1-1. G-code 분석 도구 선택 시 G-code 파일 필수 체크
    if (selectedTool === 'gcode' && !gcodeFile) {
      toast({
        title: t('aiChat.gcodeRequired', 'G-code 파일 필요'),
        description: t('aiChat.gcodeRequiredDescription', 'G-code 분석을 위해 먼저 G-code 파일을 업로드해주세요.'),
        variant: 'destructive',
      });
      return;
    }

    // 2. 도구 타입 결정
    const toolType = detectToolType(selectedTool, uploadedImages, gcodeFile);

    // 3. 세션 관리
    let sessionId = currentSessionId;
    const isFirstMessage = messages.length === 0;

    if (user?.id && !sessionId) {
      const tempTitle = t('aiChat.newChat', '새 대화');
      const newSession = await createChatSession(user.id, tempTitle, toolType);
      if (newSession) {
        sessionId = newSession.id;
        setCurrentSessionId(newSession.id);
        setChatSessions(prev => [{
          id: newSession.id,
          title: newSession.title,
          timestamp: new Date(newSession.created_at),
          messages: [],
        }, ...prev]);
        // 세션 도구 타입 상태 업데이트 (general이 아닌 경우)
        if (toolType !== 'general') {
          setCurrentSessionToolType(toolType);
        }
      }
    } else if (user?.id && sessionId && isFirstMessage) {
      await updateChatSessionToolType(sessionId, toolType);
      // 세션 도구 타입 상태 업데이트 (general이 아닌 경우)
      if (toolType !== 'general') {
        setCurrentSessionToolType(toolType);
      }
    }

    // 4. 사용자 메시지 생성 및 UI 반영
    const userMessage = createUserMessage(input, uploadedImages, gcodeFile);
    setMessages((prev) => [...prev, userMessage]);

    // 5. 사용자 메시지 DB 저장
    const fileInfos = prepareFileInfos(gcodeFile);
    if (user?.id && sessionId) {
      saveChatMessage(sessionId, user.id, 'user', input.trim(), {
        images: uploadedImages.length > 0 ? [...uploadedImages] : undefined,
        files: fileInfos,
        metadata: { tool: toolType },
      });
    }

    // 6. 입력 상태 캡처 후 초기화
    const currentInput = input.trim();
    const currentImages = [...imageFiles];
    const currentGcodeFile = gcodeFile;

    setInput("");
    setUploadedImages([]);
    setImageFiles([]);
    setGcodeFile(null);
    setIsLoading(true);

    try {
      // 7. 채팅 모드 설정
      setChatMode(determineChatMode(selectedTool, currentImages, currentGcodeFile));

      // 8. Chat API 호출
      const apiResult = await callChatAPI(currentInput, currentImages, currentGcodeFile, selectedTool);

      // 9. AI 응답 메시지 생성 및 UI 반영 (참고 자료 및 제안 액션 포함)
      const assistantMessage = createAssistantMessage(apiResult.response, {
        references: apiResult.references,
        suggestedActions: apiResult.suggestedActions,
      });
      setMessages((prev) => [...prev, assistantMessage]);

      // 10. AI 응답 DB 저장
      let savedDbMessageId: string | null = null;
      if (user?.id && sessionId) {
        const savedMsg = await saveChatMessage(sessionId, user.id, 'assistant', apiResult.response, {
          metadata: { tool: toolType },
        });
        if (savedMsg?.id) {
          savedDbMessageId = savedMsg.id;
          setMessages(prev => prev.map(m =>
            m.id === assistantMessage.id ? { ...m, dbMessageId: savedMsg.id } : m
          ));
        }
      }

      // 10-1. 모델링 성공 시 사용량 증가
      if (selectedTool === 'modeling' && user?.id) {
        await incrementUsage(user.id, USAGE_TYPES.AI_MODEL_GENERATION);
      }

      // 10-2. 문제진단 성공 시 사용량 증가 (모든 모델 포함)
      if (selectedTool === 'troubleshoot' && user?.id) {
        await incrementTroubleshootAdvancedUsage(user.id);
      }

      // 10-3. 익명 사용자 사용량 증가 (일일 10회)
      if (!user && !apiResult.isFallback) {
        incrementAnonymousUsage();
      }

      // 11. G-code 분석 후처리
      if (apiResult.analysisId) {
        // 상태 초기화
        setReportPanelOpen(false);
        setGcodeReportData(null);
        setActiveReportId(null);
        setGcodeSegments(null);

        // G-code 파일 스토리지 업로드 (로그인 사용자)
        let gcodeFileId: string | undefined;
        let storagePath: string | undefined;
        if (user?.id && currentGcodeFile) {
          try {
            const uploadResult = await uploadGCodeForAnalysis(user.id, currentGcodeFile);
            if (!uploadResult.error && uploadResult.gcodeFileId) {
              gcodeFileId = uploadResult.gcodeFileId;
              storagePath = uploadResult.storagePath;
            }
          } catch {
            // G-code upload failed - continue without storage
          }
        }

        // 폴링 시작 (gcodeFileId, storagePath, sessionId 전달)
        setGcodeAnalysisMessageId(assistantMessage.id);
        handleGcodeAnalysisStream(
          apiResult.analysisId,
          apiResult.fileName,
          assistantMessage.id,
          savedDbMessageId,
          gcodeFileId,
          storagePath,
          sessionId
        );

        // 세그먼트 데이터 처리
        if (apiResult.segments) {
          setGcodeSegments({
            layers: apiResult.segments.layers || [],
            metadata: apiResult.segments.metadata,
            temperatures: apiResult.segments.temperatures || [],
          });
        }

        // 세그먼트 DB 저장 (로그인 사용자)
        if (user?.id && apiResult.segments) {
          savedSegmentDataIdRef.current = null;
          saveSegmentData({
            userId: user.id,
            analysisId: apiResult.analysisId,
            segmentResponse: {
              analysis_id: apiResult.analysisId,
              status: 'segments_ready',
              segments: apiResult.segments,
              llm_analysis_started: true,
            },
          }).then(({ data, error }) => {
            if (!error && data?.id) {
              savedSegmentDataIdRef.current = data.id;
            }
          });
        }
      }

      // 12. 세션 제목 생성 (첫 메시지)
      if (user?.id && sessionId && isFirstMessage) {
        const title = await generateChatTitle(currentInput);
        await updateChatSessionTitle(sessionId, title);
        setChatSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, title } : s
        ));
      }

      // 13. 비로그인 사용자 localStorage 저장
      if (!user?.id) {
        const updatedMessages: AnonChatMessage[] = [
          ...messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp.getTime() })),
          { role: 'user' as const, content: currentInput, timestamp: userMessage.timestamp.getTime() },
          { role: 'assistant' as const, content: apiResult.response, timestamp: assistantMessage.timestamp.getTime() },
        ];
        saveAnonChat(updatedMessages);
      }
    } catch (error) {
      // 14. 에러 처리
      // AI 생성 한도 초과 에러는 이미 toast로 표시했으므로 에러 메시지 추가하지 않음
      if (error instanceof Error && error.message === 'AI_GENERATION_LIMIT_REACHED') {
        // toast 이미 표시됨 - 메시지 리스트에 추가하지 않음
      } else {
        const errorMsg = createErrorMessage(error, t);
        setMessages((prev) => [...prev, errorMsg]);

        if (user?.id && sessionId) {
          saveChatMessage(sessionId, user.id, 'assistant', errorMsg.content);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 통합 Chat API 호출 - 도구별 요청 형식 구성
  const callChatAPI = async (
    message: string,
    images: File[],
    gcodeFile: File | null,
    tool: string | null
  ): Promise<{
    response: string;
    analysisId?: string;
    fileName?: string;
    segments?: any;
    isFallback?: boolean; // 서버 연결 실패 시 true - 유료 모델 차감 안함
    references?: Array<{ title: string; url: string; source?: string; snippet?: string }>;
    suggestedActions?: Array<{ label: string; action: string; data?: Record<string, unknown> }>;
  }> => {
    const gcodeFileName = gcodeFile?.name;

    // 기본 요청 구성
    const baseRequest: Partial<ChatApiRequest> = {
      user_id: user?.id || `anonymous_${getAnonymousId()}`,
      user_plan: (userPlan as 'free' | 'starter' | 'pro' | 'enterprise') || 'free',
      language: i18n.language === 'ko' ? 'ko' : 'en',
      conversation_id: currentSessionId || undefined,
    };

    // 컨텍스트 윈도우: 최근 대화 히스토리 구성 (비로그인: 10개, 로그인: 15개)
    const contextLimit = user?.id ? 15 : 10;
    const conversationHistory = messages
      .slice(-contextLimit)
      .map(m => ({ role: m.role, content: m.content }));

    let request: ChatApiRequest;

    // 도구별 요청 형식 구성
    switch (tool) {
      case 'gcode': {
        // 1. G-code 분석 요청
        const attachments = [];
        if (gcodeFile) {
          const gcodeAttachment = await gcodeToAttachment(gcodeFile);
          attachments.push(gcodeAttachment);
        }
        request = {
          ...baseRequest,
          message: message || t('aiChat.analyzeGcode', '이 G-code 파일을 분석해주세요'),
          selected_tool: 'gcode',
          selected_model: selectedModel.model,
          attachments: attachments.length > 0 ? attachments : undefined,
          conversation_history: conversationHistory.length > 0 ? conversationHistory : undefined,
        } as ChatApiRequest;
        break;
      }

      case 'troubleshoot': {
        // 2. 문제 진단 (Troubleshoot) 요청
        // 무료 사용자 일일 사용량 체크 (5회/일, 모든 모델 포함)
        if (user?.id) {
          const troubleshootUsage = await checkTroubleshootAdvancedUsage(user.id);
          if (troubleshootUsage.isFreePlan && !troubleshootUsage.canUse) {
            // 다음날 날짜 계산
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = `${tomorrow.getMonth() + 1}월 ${tomorrow.getDate()}일`;

            toast({
              title: t('aiChat.troubleshootLimitReached', '오늘 문제진단 한도 도달'),
              description: t('aiChat.troubleshootLimitDescriptionWithDate', `무료 플랜은 하루 5회까지 문제진단을 사용할 수 있습니다. 내일(${tomorrowStr})부터 다시 사용 가능합니다.`),
              variant: "destructive"
            });
            throw new Error('TROUBLESHOOT_DAILY_LIMIT_REACHED');
          }
        }

        const attachments = [];
        if (images.length > 0) {
          const imageAttachments = await imagesToAttachments(images);
          attachments.push(...imageAttachments);
        }
        request = {
          ...baseRequest,
          message: message || t('aiChat.diagnoseWithImage', '이미지로 문제를 진단해주세요'),
          selected_tool: 'troubleshoot',
          selected_model: selectedModel.model,
          attachments: attachments.length > 0 ? attachments : undefined,
          conversation_history: conversationHistory.length > 0 ? conversationHistory : undefined,
        } as ChatApiRequest;
        break;
      }

      case 'modeling': {
        // 3. Text-to-3D 또는 Image-to-3D 모델링 요청
        // AI 모델 생성 한도 체크
        if (user?.id) {
          const usageCheck = await checkUsageLimit(user.id, USAGE_TYPES.AI_MODEL_GENERATION);
          if (usageCheck && !usageCheck.can_use) {
            toast({
              title: t('ai.limitReached', 'AI 생성 한도 도달'),
              description: t('ai.limitReachedDescription', {
                limit: usageCheck.limit === -1 ? '∞' : usageCheck.limit,
                plan: userPlan?.toUpperCase() || 'FREE'
              }),
              variant: "destructive"
            });
            // 사용량 한도 초과 시 에러 throw
            throw new Error('AI_GENERATION_LIMIT_REACHED');
          }
        }

        const attachments = [];
        if (images.length > 0) {
          // Image-to-3D
          const imageAttachments = await imagesToAttachments(images);
          attachments.push(...imageAttachments);
        }
        request = {
          ...baseRequest,
          message: message || t('aiChat.generateModel', '3D 모델을 생성해주세요'),
          selected_tool: 'modelling',
          selected_model: selectedModel.model,
          attachments: attachments.length > 0 ? attachments : undefined,
          conversation_history: conversationHistory.length > 0 ? conversationHistory : undefined,
        } as ChatApiRequest;
        break;
      }

      default: {
        // 일반 대화 또는 자동 감지
        const attachments = [];
        if (images.length > 0) {
          const imageAttachments = await imagesToAttachments(images);
          attachments.push(...imageAttachments);
        }
        if (gcodeFile) {
          const gcodeAttachment = await gcodeToAttachment(gcodeFile);
          attachments.push(gcodeAttachment);
        }

        // 첨부파일에 따라 도구 자동 결정
        let autoTool: ApiToolType = null;
        if (gcodeFile) {
          autoTool = 'gcode';
        } else if (images.length > 0) {
          // 이미지가 있으면 문제 진단으로 추정 (사용자가 명시적으로 선택하지 않은 경우)
          autoTool = 'troubleshoot';
        }

        request = {
          ...baseRequest,
          message: message || '',
          selected_tool: autoTool,
          selected_model: selectedModel.model,
          attachments: attachments.length > 0 ? attachments : undefined,
          conversation_history: conversationHistory.length > 0 ? conversationHistory : undefined,
        } as ChatApiRequest;
        break;
      }
    }

    // API 호출
    const response = await sendChatMessage(request);

    if (response.error) {
      throw new Error(response.error);
    }

    // 응답 포맷팅
    const formattedResponse = formatChatResponse(response);

    // G-code 분석인 경우 세그먼트 데이터 추출
    // 세그먼트는 response.segments 또는 response.tool_result.segments에 있을 수 있음
    const segments = response.segments || response.tool_result?.segments;

    // 참고 자료 추출 (tool_result.data.references 또는 response.references)
    // 각 솔루션별 출처는 마크다운 응답에 포함되어야 함 (백엔드에서 처리)
    // TroubleshootData만 references를 가지므로 타입 단언 사용
    const toolData = response.tool_result?.data as { references?: typeof response.references } | null | undefined;
    const references = toolData?.references || response.references;

    // 제안 액션 추출 (suggested_actions)
    const suggestedActions = response.suggested_actions;

    // G-code 분석 정보와 함께 반환 (handleSubmit에서 처리)
    // analysis_id가 있으면 폴링 시작
    return {
      response: formattedResponse,
      analysisId: response.analysis_id || undefined,
      fileName: gcodeFileName,
      segments: segments,
      isFallback: response.is_fallback || false, // 서버 연결 실패 시 차감 안함
      references: references,
      suggestedActions: suggestedActions,
    };
  };

  // G-code 이슈 해결 요청 (보고서에서 호출)
  const resolveGcodeIssue = async (
    analysisId: string,
    issue: { issue_id: string; title: string; severity: string; description?: string; line?: number; lines?: number[] }
  ): Promise<string> => {
    const request: ChatApiRequest = {
      user_id: user?.id || `anonymous_${getAnonymousId()}`,
      user_plan: (userPlan as 'free' | 'starter' | 'pro' | 'enterprise') || 'free',
      message: t('aiChat.resolveIssue', '이 이슈를 해결해주세요'),
      selected_tool: 'resolve_issue',
      language: i18n.language === 'ko' ? 'ko' : 'en',
      analysis_id: analysisId,
      issue_to_resolve: {
        issue_id: issue.issue_id,
        title: issue.title,
        severity: issue.severity as 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'info',
        description: issue.description,
        line: issue.line,
        lines: issue.lines,
      },
    };

    const response = await sendChatMessage(request);

    if (response.error) {
      throw new Error(response.error);
    }

    return formatChatResponse(response);
  };

  // G-code 분석 폴링 처리 (훅 기반 래퍼 함수)
  const handleGcodeAnalysisStream = useCallback((
    analysisId: string,
    fileName?: string,
    messageId?: string,
    dbMessageId?: string | null,
    gcodeFileId?: string,
    storagePath?: string,
    sessionId?: string | null
  ) => {
    // 분석 시작 시 보고서 패널 열기 (로딩 표시)
    setReportPanelOpen(true);

    // 훅의 startPolling 호출
    startGcodeAnalysisPolling({
      analysisId,
      fileName,
      messageId,
      dbMessageId,
      userId: user?.id,
      sessionId: sessionId ?? currentSessionId,
      gcodeContent: gcodeFileContentRef.current,
      gcodeFileId,
      storagePath,
      onReportCardReady: (reportCard: ReportCardData) => {
        // 보고서 패널 열기
        setReportPanelOpen(true);

        // 보고서 아카이브에 추가 (맨 앞에)
        if (reportCard.reportId) {
          setReportArchive(prev => {
            // 이미 존재하는지 확인
            if (prev.some(r => r.id === reportCard.reportId)) {
              return prev;
            }
            const newReport: ReportArchiveItem = {
              id: reportCard.reportId,
              fileName: reportCard.fileName,
              overallScore: reportCard.overallScore,
              overallGrade: reportCard.overallGrade,
              totalIssues: reportCard.totalIssues,
              createdAt: new Date(),
            };
            return [newReport, ...prev].slice(0, 10); // 최대 10개 유지
          });
        }

        // 메시지에 reportCard 추가
        setMessages(prev => {
          if (messageId) {
            return prev.map(msg =>
              msg.id === messageId
                ? { ...msg, reportCard }
                : msg
            );
          } else {
            // 마지막 assistant 메시지에 reportCard 추가
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i].role === 'assistant') {
                const updated = [...prev];
                updated[i] = { ...updated[i], reportCard };
                return updated;
              }
            }
            return prev;
          }
        });
      },
      onError: (errorMsg: string) => {
        // 에러 발생 시 보고서 패널 닫기
        setReportPanelOpen(false);

        // 에러 메시지 추가
        const errorMessage: Message = {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: `❌ ${t('aiChat.analysisError', '분석 중 오류가 발생했습니다')}: ${errorMsg}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      },
    });
  }, [startGcodeAnalysisPolling, user?.id, currentSessionId, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 도구 목록
  const tools = [
    {
      id: "troubleshoot",
      icon: Stethoscope,
      label: t('ai.printerTroubleshooting', '프린터 문제 진단'),
      description: t('ai.troubleshootDesc', '이미지로 프린터 문제를 분석합니다'),
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      id: "gcode",
      icon: FileCode2,
      label: t('ai.gcodeAnalysis', 'G-code 분석'),
      description: t('ai.gcodeDesc', 'G-code 파일을 분석하고 최적화합니다'),
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      id: "modeling",
      icon: Box,
      label: t('ai.modeling3d', '3D 모델링'),
      description: t('ai.modelingDesc', '텍스트로 3D 모델을 생성합니다'),
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  // 선택된 도구 정보
  const currentTool = tools.find(t => t.id === selectedTool);

  // 도구 선택 핸들러
  const handleToolSelect = (toolId: string) => {
    // 익명 사용자는 general 외 도구 사용 불가 - 로그인 모달 표시
    if (!user && toolId !== 'general') {
      setShowLoginModal(true);
      return;
    }

    // 3D 모델링 선택 시 create 페이지로 이동
    if (toolId === 'modeling') {
      navigate('/create');
      return;
    }

    if (selectedTool === toolId) {
      // 이미 선택된 도구를 다시 클릭하면 해제 (general로 되돌아감)
      // 단, 이미 해당 도구로 메시지가 있으면 해제 불가
      if (currentSessionToolType && currentSessionToolType !== 'general') {
        // 이미 도구가 사용된 세션에서는 해제 불가
        return;
      }
      setSelectedTool(null);
    } else {
      // 다른 도구 선택 시
      // 1. general 모드에서는 자유롭게 도구 변경 가능
      // 2. 이미 특정 도구(troubleshoot, gcode)가 사용된 세션에서는 다른 도구 선택 시 새 채팅 유도
      if (currentSessionToolType && currentSessionToolType !== 'general' && currentSessionToolType !== toolId) {
        // 이미 다른 도구가 사용된 세션 -> 새 채팅 유도 모달
        setPendingToolId(toolId);
        setShowNewChatModal(true);
        return;
      }
      setSelectedTool(toolId);
    }
  };

  // 새 채팅 모달에서 "새 채팅 시작" 클릭 시
  const handleStartNewChatWithTool = () => {
    handleNewChat(); // 새 채팅 초기화
    if (pendingToolId) {
      setSelectedTool(pendingToolId);
    }
    setShowNewChatModal(false);
    setPendingToolId(null);
  };

  // 새 채팅 모달 닫기
  const handleCloseNewChatModal = () => {
    setShowNewChatModal(false);
    setPendingToolId(null);
  };

  // AI 해결하기 시작 핸들러 (사용자 질문 메시지 추가)
  const handleAIResolveStart = useCallback((info: AIResolveStartInfo) => {
    setIsAIResolving(true);

    const userContent = `"${info.issueTitle}" 이슈를 해결해줘`;

    // 토스트 알림 표시
    toast({
      title: t('aiChat.aiResolving', 'AI 분석 중'),
      description: `"${info.issueTitle}" ${t('aiChat.analyzing', '분석 중...')}`,
    });

    // 사용자 질문 메시지 추가
    const userMessage: Message = {
      id: `user-resolve-${Date.now()}`,
      role: 'user',
      content: userContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    // 자동 스크롤 (메시지 추가 후 약간의 딜레이)
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    // 로그인 사용자: DB에 저장
    if (user?.id && currentSessionId) {
      saveChatMessage(currentSessionId, user.id, 'user', userContent, {
        metadata: { tool: 'resolve_issue' },
      });
    }
  }, [user, currentSessionId, toast, t]);

  // AI 해결하기 완료 핸들러 (AI 응답 메시지 추가)
  const handleAIResolveComplete = useCallback((info: AIResolveCompleteInfo) => {
    setIsAIResolving(false);

    const { resolution, updated_issue } = info.resolution;
    const { explanation, solution, tips } = resolution;

    // 마크다운 텍스트로 응답 구성
    let content = '';

    // 제목 + 심각도
    const severityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
      none: '🟢',
    };
    const emoji = severityEmoji[explanation.severity as keyof typeof severityEmoji] || '⚪';
    content += `## ${emoji} ${updated_issue?.title || 'AI 분석 결과'}\n\n`;

    // 오탐 여부
    if (explanation.is_false_positive) {
      content += `> ✅ **오탐 확인됨** - 실제 문제가 아닙니다.\n\n`;
    }

    // 요약
    content += `### 📋 요약\n${explanation.summary}\n\n`;

    // 원인
    content += `### 🔍 원인\n${explanation.cause}\n\n`;

    // 해결 방법
    if (solution.action_needed && solution.steps && solution.steps.length > 0) {
      content += `### 🔧 해결 방법\n`;
      solution.steps.forEach((step, i) => {
        content += `${i + 1}. ${step}\n`;
      });
      content += '\n';
    }

    // 코드 수정 정보 추출
    const codeFixesRaw = solution.code_fixes && solution.code_fixes.length > 0
      ? solution.code_fixes.filter(fix => fix.has_fix)
      : solution.code_fix?.has_fix ? [solution.code_fix] : [];

    // CodeFixInfo 형식으로 변환 (메시지에 저장용)
    const codeFixesForMessage: CodeFixInfo[] = codeFixesRaw.map(fix => ({
      line_number: fix.line_number ?? null,
      original: fix.original ?? null,
      fixed: fix.fixed ?? null,
    }));

    // 코드 수정이 있으면 클릭 가능한 안내 텍스트 추가
    if (codeFixesRaw.length > 0) {
      content += `### 💻 코드 수정 (${codeFixesRaw.length}건)\n`;
      content += `> 아래 코드 수정 카드를 클릭하면 에디터에서 직접 수정할 수 있습니다.\n\n`;
    }

    // 팁
    if (tips && tips.length > 0) {
      content += `### 💡 팁\n`;
      tips.forEach(tip => {
        content += `- ${tip}\n`;
      });
      content += '\n';
    }

    // 조치 불필요
    if (!solution.action_needed) {
      content += `> ✅ 별도의 조치가 필요하지 않습니다.\n`;
    }

    // AI 응답 메시지 추가 (codeFixes, reportId, gcodeContext 포함)
    const assistantMessage: Message = {
      id: `assistant-resolve-${Date.now()}`,
      role: 'assistant',
      content: content.trim(),
      timestamp: new Date(),
      codeFixes: codeFixesForMessage.length > 0 ? codeFixesForMessage : undefined,
      analysisReportId: info.reportId,
      gcodeContext: info.gcodeContext, // 에디터에서 사용할 G-code 컨텍스트 (앞뒤 30라인)
    };

    setMessages(prev => [...prev, assistantMessage]);

    // 로그인 사용자: DB에 저장
    if (user?.id && currentSessionId) {
      saveChatMessage(currentSessionId, user.id, 'assistant', content.trim(), {
        metadata: {
          tool: 'resolve_issue',
          codeFixes: codeFixesForMessage.length > 0 ? codeFixesForMessage : undefined,
          gcodeContext: info.gcodeContext, // 에디터용 G-code 컨텍스트도 저장
          analysisReportId: info.reportId,
        },
      });
    }
  }, [user, currentSessionId]);

  // AI 해결하기 에러 핸들러
  const handleAIResolveError = useCallback((error: string) => {
    setIsAIResolving(false);

    const errorContent = `AI 해결 중 오류가 발생했습니다: ${error}`;

    // 에러 메시지 추가
    const errorMessage: Message = {
      id: `assistant-error-${Date.now()}`,
      role: 'assistant',
      content: errorContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, errorMessage]);

    // 로그인 사용자: DB에 저장
    if (user?.id && currentSessionId) {
      saveChatMessage(currentSessionId, user.id, 'assistant', errorContent, {
        metadata: { tool: 'resolve_issue' },
      });
    }
  }, [user, currentSessionId]);

  // 입력 박스 렌더링 (초기 화면과 채팅 화면에서 공통 사용)
  const renderInputBox = (placeholder: string) => (
    <div
      className={cn(
        "bg-muted/50 rounded-3xl border shadow-sm hover:shadow-md transition-all overflow-hidden",
        isDragging
          ? "border-primary border-2 bg-primary/5"
          : "border-gray-300 dark:border-border"
      )}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 드래그 오버레이 */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 z-10 rounded-3xl">
          <p className="text-primary font-medium">이미지를 여기에 놓으세요</p>
        </div>
      )}
      {/* 상단: 입력창 */}
      <div className="relative flex items-end">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          className="flex-1 min-h-[44px] max-h-[200px] py-3 px-5 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-muted-foreground/60 overflow-hidden"
          rows={1}
        />

        {/* 전송 버튼 */}
        <div className="flex items-center gap-1 pr-3 pb-2">
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "shrink-0 rounded-full h-9 w-9 transition-colors",
              (input.trim() || uploadedImages.length > 0 || gcodeFile)
                ? "text-primary hover:text-primary/80 hover:bg-primary/10"
                : "text-muted-foreground/50"
            )}
            disabled={(!input.trim() && uploadedImages.length === 0 && !gcodeFile) || isLoading}
            onClick={handleSend}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

      {/* 하단: 도구 라인 */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border/50">
        {/* + 버튼 - 선택된 도구에 따라 다른 파일 업로드 */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 h-9 w-9 rounded-full hover:bg-muted"
          onClick={() => {
            // G-code 분석 도구 선택 시 G-code 파일 업로드
            if (selectedTool === 'gcode') {
              gcodeInputRef.current?.click();
            } else {
              // 그 외에는 이미지 업로드
              fileInputRef.current?.click();
            }
          }}
          title={selectedTool === 'gcode' ? t('aiChat.attachGcode', 'G-code 파일 첨부') : t('aiChat.attachImage', '이미지 첨부')}
        >
          <Plus className="w-5 h-5 text-muted-foreground" />
        </Button>

        {/* 도구 드롭다운 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 px-4 rounded-full text-sm font-medium gap-2 transition-colors",
                selectedTool && currentTool
                  ? `${currentTool.bgColor} ${currentTool.color} border border-current/30 hover:opacity-80`
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {currentTool ? (
                <>
                  <currentTool.icon className="w-4 h-4" />
                  {currentTool.label}
                </>
              ) : (
                <>
                  <Settings2 className="w-4 h-4" />
                  {t('aiChat.tools', '도구')}
                </>
              )}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80 p-3 rounded-3xl">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const isSelected = selectedTool === tool.id;
              return (
                <DropdownMenuItem
                  key={tool.id}
                  onClick={() => handleToolSelect(tool.id)}
                  className={cn(
                    "flex items-start gap-4 cursor-pointer rounded-2xl p-4 transition-all",
                    isSelected ? `${tool.bgColor} ${tool.color}` : "hover:bg-muted"
                  )}
                >
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                    isSelected ? "bg-background shadow-sm" : tool.bgColor
                  )}>
                    <Icon className={cn("w-6 h-6", tool.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-sm font-semibold",
                      isSelected ? tool.color : "text-foreground"
                    )}>
                      {tool.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {tool.description}
                    </div>
                  </div>
                  {isSelected && <Check className={cn("w-5 h-5 shrink-0 mt-1", tool.color)} />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 선택된 도구가 있을 때 해제 버튼 */}
        {selectedTool && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => setSelectedTool(null)}
          >
            <X className="w-4 h-4" />
          </Button>
        )}

        {/* 오른쪽 정렬을 위한 spacer */}
        <div className="flex-1" />

        {/* 모델 선택 드롭다운 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-4 rounded-full text-sm font-medium gap-2 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Cpu className="w-4 h-4" />
              {selectedModel.model === 'gemini-2.5-flash-lite' ? 'Gemini 2.5 Flash Lite' :
                selectedModel.model === 'gemini-2.5-flash' ? 'Gemini 2.5 Flash' :
                  selectedModel.model === 'gemini-2.5-pro' ? 'Gemini 2.5 Pro' :
                    selectedModel.model === 'gpt-4o-mini' ? 'GPT-4o mini' :
                      selectedModel.model === 'gpt-4o' ? 'GPT-4o' :
                        selectedModel.model === 'gpt-4.1' ? 'GPT-4.1' :
                          t('aiChat.model', '모델')}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-2 rounded-2xl">
            {/* Google */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={cn(
                "flex items-center gap-3 cursor-pointer rounded-xl p-3",
                selectedModel.provider === 'google' ? "bg-blue-500/10" : "hover:bg-muted"
              )}>
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Cpu className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">Google</div>
                  <div className="text-xs text-muted-foreground">Gemini 모델</div>
                </div>
                {selectedModel.provider === 'google' && <Check className="w-4 h-4 text-blue-500" />}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64 p-2 rounded-2xl">
                {/* 무료 모델 - 모든 사용자 */}
                <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">{t('aiChat.freeModels', '무료 모델')}</DropdownMenuLabel>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 cursor-pointer rounded-xl p-3 hover:bg-muted",
                    selectedModel.provider === 'google' && selectedModel.model === 'gemini-2.5-flash-lite' && "bg-blue-500/10"
                  )}
                  onClick={() => setSelectedModel({ provider: 'google', model: 'gemini-2.5-flash-lite' })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">Gemini 2.5 Flash Lite</div>
                    <div className="text-xs text-muted-foreground">{t('aiChat.fastAndEfficient', '빠르고 효율적')}</div>
                  </div>
                  {selectedModel.provider === 'google' && selectedModel.model === 'gemini-2.5-flash-lite' && <Check className="w-4 h-4 text-blue-500" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* 유료 모델 - Starter 이상 */}
                <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">{t('aiChat.paidModels', '유료 모델')}</DropdownMenuLabel>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    (!userPlan || userPlan === 'free') ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === 'google' && selectedModel.model === 'gemini-2.5-flash' && "bg-blue-500/10"
                  )}
                  disabled={!userPlan || userPlan === 'free'}
                  onClick={() => userPlan && userPlan !== 'free' && setSelectedModel({ provider: 'google', model: 'gemini-2.5-flash' })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">Gemini 2.5 Flash</div>
                    <div className="text-xs text-muted-foreground">{t('aiChat.starterAndAbove', 'Starter 이상')}</div>
                  </div>
                  {selectedModel.provider === 'google' && selectedModel.model === 'gemini-2.5-flash' && <Check className="w-4 h-4 text-blue-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    (!userPlan || userPlan === 'free') ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === 'google' && selectedModel.model === 'gemini-2.5-pro' && "bg-blue-500/10"
                  )}
                  disabled={!userPlan || userPlan === 'free'}
                  onClick={() => userPlan && userPlan !== 'free' && setSelectedModel({ provider: 'google', model: 'gemini-2.5-pro' })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">Gemini 2.5 Pro</div>
                    <div className="text-xs text-muted-foreground">{t('aiChat.latestModel', '최신 모델')}</div>
                  </div>
                  {selectedModel.provider === 'google' && selectedModel.model === 'gemini-2.5-pro' && <Check className="w-4 h-4 text-blue-500" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* OpenAI - Starter 이상 */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={cn(
                "flex items-center gap-3 rounded-xl p-3",
                (!userPlan || userPlan === 'free') ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                selectedModel.provider === 'openai' ? "bg-emerald-500/10" : "hover:bg-muted"
              )}>
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Cpu className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">OpenAI</div>
                  <div className="text-xs text-muted-foreground">{(!userPlan || userPlan === 'free') ? t('aiChat.starterAndAbove', 'Starter 이상') : 'GPT 모델'}</div>
                </div>
                {selectedModel.provider === 'openai' && <Check className="w-4 h-4 text-emerald-500" />}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64 p-2 rounded-2xl">
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    (!userPlan || userPlan === 'free') ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === 'openai' && selectedModel.model === 'gpt-4o-mini' && "bg-emerald-500/10"
                  )}
                  disabled={!userPlan || userPlan === 'free'}
                  onClick={() => userPlan && userPlan !== 'free' && setSelectedModel({ provider: 'openai', model: 'gpt-4o-mini' })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">GPT-4o mini</div>
                    <div className="text-xs text-muted-foreground">{t('aiChat.fastAndEfficient', '빠르고 효율적')}</div>
                  </div>
                  {selectedModel.provider === 'openai' && selectedModel.model === 'gpt-4o-mini' && <Check className="w-4 h-4 text-emerald-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    (!userPlan || userPlan === 'free') ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === 'openai' && selectedModel.model === 'gpt-4o' && "bg-emerald-500/10"
                  )}
                  disabled={!userPlan || userPlan === 'free'}
                  onClick={() => userPlan && userPlan !== 'free' && setSelectedModel({ provider: 'openai', model: 'gpt-4o' })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">GPT-4o</div>
                    <div className="text-xs text-muted-foreground">{t('aiChat.webSearchEnabled', '웹 검색 지원')}</div>
                  </div>
                  {selectedModel.provider === 'openai' && selectedModel.model === 'gpt-4o' && <Check className="w-4 h-4 text-emerald-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    (!userPlan || userPlan === 'free') ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === 'openai' && selectedModel.model === 'gpt-4.1' && "bg-emerald-500/10"
                  )}
                  disabled={!userPlan || userPlan === 'free'}
                  onClick={() => userPlan && userPlan !== 'free' && setSelectedModel({ provider: 'openai', model: 'gpt-4.1' })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">GPT-4.1</div>
                    <div className="text-xs text-muted-foreground">{t('aiChat.latestModel', '최신 모델')}</div>
                  </div>
                  {selectedModel.provider === 'openai' && selectedModel.model === 'gpt-4.1' && <Check className="w-4 h-4 text-emerald-500" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-background flex">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageUpload}
      />
      <input
        ref={gcodeInputRef}
        type="file"
        accept=".gcode,.gco,.gc,.g,.nc,.ngc"
        className="hidden"
        onChange={handleGcodeUpload}
      />

      {/* 왼쪽 사이드바 */}
      <AppSidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        sessions={chatSessions}
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onLoadSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
        user={user}
        userPlan={userPlan}
        onLoginClick={() => setShowLoginModal(true)}
        onSignOut={signOut}
        mode="chat"
        // 보고서 아카이브 props
        reports={reportArchive}
        currentReportId={activeReportId}
        onSelectReport={handleSelectReport}
        onDeleteReport={handleDeleteReport}
        onViewMoreReports={handleArchiveToggle}
        archiveViewActive={archiveViewActive}
      />

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col min-w-0 relative transition-all duration-300">
        {/* 상단 헤더 - AppHeader 재사용 */}
        <AppHeader sidebarOpen={sidebarOpen} onLoginRequired={() => setShowLoginModal(true)} />

        {archiveViewActive ? (
          // 아카이브 뷰 모드 - 열기/닫기 슬라이드 애니메이션
          <div className={cn(
            "flex-1 flex flex-col overflow-hidden",
            archiveClosing
              ? "animate-out slide-out-to-top duration-200 ease-in fill-mode-forwards"
              : "animate-in slide-in-from-top duration-300 ease-out"
          )}>
            {archiveSelectedReport ? (
              // 아카이브 보고서 상세 보기
              <>
                <div className="bg-background/95 backdrop-blur-sm border-b shrink-0">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setArchiveSelectedReport(null)}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t("gcodeAnalytics.backToList")}
                  </Button>
                  <span className="text-sm text-muted-foreground truncate">
                    {archiveSelectedReportName}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="max-w-6xl mx-auto p-4 h-full">
                  <GCodeAnalysisReport data={archiveSelectedReport} />
                </div>
              </div>
            </>
          ) : (
            // 아카이브 목록
            <>
              {/* 아카이브 헤더 */}
              <div className="bg-background/95 backdrop-blur-sm border-b shrink-0">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {t("gcodeAnalytics.reportArchiveTitle", "보고서 아카이브")}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleArchiveToggle}
                    className="h-8 w-8 rounded-full hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* 필터 바 */}
              <div className="bg-background/95 backdrop-blur-sm shrink-0">
                <div className="max-w-7xl mx-auto px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* 검색 */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t("gcodeAnalytics.searchPlaceholder")}
                        value={archiveSearchQuery}
                        onChange={(e) => setArchiveSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    {/* 정렬 */}
                    <Select
                      value={`${archiveSortOption.field}-${archiveSortOption.direction}`}
                      onValueChange={(v) => {
                        const [field, direction] = v.split("-") as [
                          typeof archiveSortOption.field,
                          "asc" | "desc"
                        ];
                        setArchiveSortOption({ field, direction });
                      }}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SortDesc className="h-4 w-4 mr-2" />
                        <SelectValue placeholder={t("gcodeAnalytics.sort")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created_at-desc">{t("gcodeAnalytics.sortNewest")}</SelectItem>
                        <SelectItem value="created_at-asc">{t("gcodeAnalytics.sortOldest")}</SelectItem>
                        <SelectItem value="overall_score-desc">{t("gcodeAnalytics.sortScoreHigh")}</SelectItem>
                        <SelectItem value="overall_score-asc">{t("gcodeAnalytics.sortScoreLow")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 아카이브 목록 */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto px-4 py-6">
                  {archiveIsLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {[...Array(8)].map((_, i) => (
                        <Card key={i} className="overflow-hidden">
                          <CardHeader className="pb-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2 mt-2" />
                          </CardHeader>
                          <CardContent>
                            <Skeleton className="h-20 w-full" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : archiveReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <FileCode2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium">{t("gcodeAnalytics.noReports")}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("gcodeAnalytics.noReportsDesc")}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {archiveReports.map((report) => (
                          <Card
                            key={report.id}
                            className="overflow-hidden cursor-pointer transition-all hover:shadow-md h-full flex flex-col"
                            onClick={() => handleArchiveViewReport(report.id, report.file_name)}
                          >
                            <CardHeader className="pb-2 shrink-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-sm font-medium truncate">
                                    {report.file_name || t("gcodeAnalytics.noName")}
                                  </CardTitle>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {formatDistanceToNow(new Date(report.created_at), {
                                      addSuffix: true,
                                      locale: dateLocale,
                                    })}
                                  </p>
                                </div>
                                {report.overall_grade && (
                                  <Badge
                                    className={cn(
                                      "text-xs font-bold",
                                      getArchiveGradeBadgeColor(report.overall_grade)
                                    )}
                                  >
                                    {report.overall_grade}
                                  </Badge>
                                )}
                              </div>
                            </CardHeader>

                            <CardContent className="pt-2 flex-1 flex flex-col">
                              {/* 점수 */}
                              {report.overall_score !== undefined && (
                                <div className="mb-3">
                                  <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="text-muted-foreground">
                                      {t("gcodeAnalytics.qualityScore")}
                                    </span>
                                    <span className="font-semibold">{report.overall_score}/100</span>
                                  </div>
                                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full transition-all",
                                        report.overall_score >= 80
                                          ? "bg-green-500"
                                          : report.overall_score >= 60
                                          ? "bg-yellow-500"
                                          : report.overall_score >= 40
                                          ? "bg-orange-500"
                                          : "bg-red-500"
                                      )}
                                      style={{ width: `${report.overall_score}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* 메타 정보 */}
                              <div className="grid grid-cols-2 gap-2 text-xs mt-auto">
                                {report.print_time_formatted && (
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span className="truncate">{report.print_time_formatted}</span>
                                  </div>
                                )}
                                {report.layer_count && (
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Layers className="h-3.5 w-3.5" />
                                    <span>{report.layer_count} layers</span>
                                  </div>
                                )}
                                {report.filament_length_mm !== undefined && report.filament_length_mm > 0 && (
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Ruler className="h-3.5 w-3.5" />
                                    <span>{(report.filament_length_mm / 1000).toFixed(1)}m</span>
                                  </div>
                                )}
                                {report.total_issues_count > 0 ? (
                                  <div className="flex items-center gap-1.5 text-orange-500">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    <span>{report.total_issues_count} issues</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-green-500">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    <span>{t("gcodeAnalytics.noIssues")}</span>
                                  </div>
                                )}
                              </div>

                              {/* 삭제 버튼 */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full mt-3 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setArchiveReportToDelete(report.id);
                                  setArchiveDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t("gcodeAnalytics.delete")}
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* 페이지네이션 */}
                      {archiveTotalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-8">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={archiveCurrentPage === 1}
                            onClick={() => setArchiveCurrentPage((p) => p - 1)}
                          >
                            <ChevronLeftIcon className="h-4 w-4" />
                          </Button>
                          <span className="text-sm text-muted-foreground px-4">
                            {archiveCurrentPage} / {archiveTotalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={archiveCurrentPage === archiveTotalPages}
                            onClick={() => setArchiveCurrentPage((p) => p + 1)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* 상세 로딩 오버레이 */}
              {archiveIsLoadingDetail && (
                <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {t("gcodeAnalytics.loadingReport")}
                    </p>
                  </div>
                </div>
              )}

              {/* 삭제 확인 다이얼로그 */}
              <AlertDialog open={archiveDeleteDialogOpen} onOpenChange={setArchiveDeleteDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("gcodeAnalytics.deleteReportTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("gcodeAnalytics.deleteReportDesc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("gcodeAnalytics.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleArchiveDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("gcodeAnalytics.delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          </div>
        ) : messages.length === 0 ? (
          // Gemini 스타일 초기 화면
          <div className="flex-1 flex flex-col px-4">
            {/* 상단 여백 */}
            <div className="flex-1" />
            {/* 메인 컨텐츠 (중앙 정렬) */}
            <div className="flex flex-col items-center">
            {/* 인사말 */}
            <div className="text-center mb-8">
              {/* 스타카토 애니메이션 */}
              <div className="flex justify-center gap-1.5 mb-4">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2 whitespace-pre-line">
                {t('aiChat.askAnything', '출력하다가\n뭔가 이상할 때')}
              </h1>
              <p className="text-xl sm:text-2xl font-medium text-muted-foreground">
                {t('aiChat.greeting', '지금 어떤 문제가 생겼는지 그대로 보여주세요')}
              </p>
            </div>

            {/* 중앙 입력창 */}
            <div className="w-full max-w-2xl mb-6">
              {/* 업로드된 미리보기 */}
              <FilePreviewList
                images={uploadedImages}
                gcodeFile={gcodeFile}
                onRemoveImage={removeImage}
                onRemoveGcode={removeGcodeFile}
                className="mb-3 px-2"
              />

              {renderInputBox(
                selectedTool === "troubleshoot"
                  ? t('aiChat.troubleshootPlaceholder', '문제 상황에 대한 이미지와 증상 내용이 있으면 더 좋아요')
                  : selectedTool === "gcode"
                    ? t('aiChat.gcodePlaceholder', 'G-code 파일을 업로드하거나 문제 내용을 붙여넣어보세요')
                    : selectedTool === "modeling"
                      ? t('aiChat.modelingPlaceholder', '만들고 싶은 3D 모델을 설명해주세요')
                      : t('aiChat.defaultPlaceholder', 'FACTOR AI에게 물어보세요')
              )}

              {/* 빠른 테스트 버튼 - 도구별 활용 예시 (첫째 줄 3개, 둘째 줄 2개) */}
              <div className="flex flex-col items-center gap-2 mt-10">
                {/* 첫째 줄: G-code 2개 + 프린터 문제 진단 1개 */}
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => {
                      if (!user) {
                        setShowLoginModal(true);
                        return;
                      }
                      setSelectedTool('gcode');
                      setInput(t('aiChat.quickPrompt.gcodeOptimize', '출력 시간 줄이고 싶은데 G-code 봐줘'));
                    }}
                    className="px-4 py-2 text-sm bg-blue-500/10 hover:bg-blue-500/20 rounded-full border border-blue-500/30 transition-colors text-blue-600 dark:text-blue-400"
                  >
                    {t('aiChat.quickPrompt.gcodeOptimize', '출력 시간 줄이고 싶어')}
                  </button>
                  <button
                    onClick={() => {
                      if (!user) {
                        setShowLoginModal(true);
                        return;
                      }
                      setSelectedTool('gcode');
                      setInput(t('aiChat.quickPrompt.gcodeCheck', '이 G-code 문제 있는지 확인해줘'));
                    }}
                    className="px-4 py-2 text-sm bg-blue-500/10 hover:bg-blue-500/20 rounded-full border border-blue-500/30 transition-colors text-blue-600 dark:text-blue-400"
                  >
                    {t('aiChat.quickPrompt.gcodeCheck', 'G-code 문제 확인해줘')}
                  </button>
                  <button
                    onClick={() => {
                      if (!user) {
                        setShowLoginModal(true);
                        return;
                      }
                      setSelectedTool('troubleshoot');
                      setInput(t('aiChat.quickPrompt.stringing', '출력물에 실 같은 게 달려있어요'));
                    }}
                    className="px-4 py-2 text-sm bg-emerald-500/10 hover:bg-emerald-500/20 rounded-full border border-emerald-500/30 transition-colors text-emerald-600 dark:text-emerald-400"
                  >
                    {t('aiChat.quickPrompt.stringing', '실 같은 게 달려있어요')}
                  </button>
                </div>

                {/* 둘째 줄: 프린터 문제 진단 1개 + 3D 모델링 1개 */}
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => {
                      if (!user) {
                        setShowLoginModal(true);
                        return;
                      }
                      setSelectedTool('troubleshoot');
                      setInput(t('aiChat.quickPrompt.warping', '첫 레이어가 베드에서 떨어져요'));
                    }}
                    className="px-4 py-2 text-sm bg-emerald-500/10 hover:bg-emerald-500/20 rounded-full border border-emerald-500/30 transition-colors text-emerald-600 dark:text-emerald-400"
                  >
                    {t('aiChat.quickPrompt.warping', '베드에서 떨어져요')}
                  </button>
                  <button
                    onClick={() => {
                      if (!user) {
                        setShowLoginModal(true);
                        return;
                      }
                      const prompt = t('aiChat.quickPrompt.modeling', '스마트폰 거치대 만들어줘');
                      navigate('/create', { state: { prompt } });
                    }}
                    className="px-4 py-2 text-sm bg-purple-500/10 hover:bg-purple-500/20 rounded-full border border-purple-500/30 transition-colors text-purple-600 dark:text-purple-400"
                  >
                    {t('aiChat.quickPrompt.modeling', '스마트폰 거치대 만들어줘')}
                  </button>
                </div>
              </div>
            </div>
            </div>
            {/* 하단 여백 */}
            <div className="flex-1" />
          </div>
        ) : (
          // 채팅 화면 + 보고서 레이아웃
          <div className="flex-1 flex overflow-hidden h-full">
            {/* 채팅 영역 */}
            <div className={cn(
              "flex-1 flex flex-col min-w-0 transition-all duration-300",
              gcodeReportData && reportPanelOpen && "flex-[0_0_48%]"
            )}>
              <ScrollArea className="flex-1">
                <div className="py-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <ChatMessage
                        key={message.id}
                        message={message as ChatMessageData}
                        gcodeContent={gcodeReportData?.gcodeContent}
                        extractGcodeContext={extractGcodeContext}
                        resolvedLines={resolvedLines}
                        onCodeFixClick={async (fix, _context, analysisReportId) => {
                          // 수정 정보 설정
                          setEditorFixInfo({
                            lineNumber: fix.line_number!,
                            original: fix.original || '',
                            fixed: fix.fixed || '',
                          });

                          // 에디터 탭으로 전환하고 패널 열기 (먼저 UI 전환)
                          setReportPanelTab('editor');
                          setReportPanelOpen(true);

                          // 로딩 상태 시작
                          setEditorLoading(true);

                          try {
                            // 연결된 보고서가 있고 현재 열린 보고서와 다르면 로드
                            let currentStoragePath = gcodeReportData?.storagePath;
                            if (analysisReportId && activeReportId !== analysisReportId) {
                              const { data: report } = await getAnalysisReportById(analysisReportId);
                              if (report) {
                                const { data: segmentData } = await loadFullSegmentDataByReportId(analysisReportId);
                                const reportUiData = convertDbReportToUiData(report);
                                setGcodeReportData({
                                  ...reportUiData,
                                  analysisId: segmentData?.analysisId,
                                });
                                setActiveReportId(analysisReportId);
                                currentStoragePath = reportUiData.storagePath;
                                if (segmentData && segmentData.layers && segmentData.layers.length > 0) {
                                  setGcodeSegments({
                                    layers: segmentData.layers,
                                    metadata: segmentData.metadata,
                                    temperatures: segmentData.temperatures,
                                  });
                                }
                              }
                            }

                            // 전체 G-code에서 해당 라인 기준 위아래 30줄 발췌
                            if (fix.line_number) {
                              let gcodeContent = gcodeFileContentRef.current;

                              // ref에 없으면 스토리지에서 다운로드
                              if (!gcodeContent && currentStoragePath) {
                                gcodeContent = await downloadGCodeContent(currentStoragePath);
                                if (gcodeContent) {
                                  gcodeFileContentRef.current = gcodeContent; // 캐시
                                  setGcodeFileContent(gcodeContent);
                                }
                              }

                              if (gcodeContent) {
                                const extracted = extractGcodeContext(gcodeContent, fix.line_number, 30);
                                setEditorContent(extracted);
                              }
                            }
                          } finally {
                            setEditorLoading(false);
                          }
                        }}
                        reportPanelOpen={reportPanelOpen}
                        activeReportId={activeReportId}
                        onRevert={(lineNumber, _fixedCode, _originalCode) => {
                          // 로컬 상태에서만 제거 (아직 저장 전이므로 스토리지 수정 불필요)
                          // 1. 대기 중인 패치에서 제거
                          setPendingPatches(prev => {
                            const newMap = new Map(prev);
                            newMap.delete(lineNumber);
                            return newMap;
                          });

                          // 2. 해결된 라인에서 제거
                          setResolvedLines(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(lineNumber);
                            return newSet;
                          });

                          // 3. 에디터에 되돌리기 신호 전송 (patchHistory에서 복원)
                          setRevertLineNumber(lineNumber);

                          toast({
                            title: t('aiChat.revertSuccess', '되돌리기 완료'),
                            description: t('aiChat.revertSuccessDesc', '패치가 취소되었습니다.'),
                          });
                        }}
                        onReportCardClick={async (clickedReportId) => {
                          // 같은 보고서가 이미 열려있으면 닫기
                          if (reportPanelOpen && activeReportId === clickedReportId) {
                            setReportPanelOpen(false);
                            setActiveReportId(null);
                            setReportPanelTab('report'); // 탭 상태 초기화
                            // 에디터 상태 초기화
                            setEditorContent(undefined);
                            setEditorFixInfo(undefined);
                            return;
                          }

                          // 다른 보고서로 전환하거나 새로 열기
                          const { data: report } = await getAnalysisReportById(clickedReportId);
                          if (report) {
                            // 3D 뷰어용 segment 데이터 로드 (analysisId도 함께 가져옴)
                            const { data: segmentData } = await loadFullSegmentDataByReportId(clickedReportId);

                            // 보고서 UI 데이터 변환 + analysisId 추가 (AI 해결하기 버튼 활성화용)
                            const reportUiData = convertDbReportToUiData(report);
                            setGcodeReportData({
                              ...reportUiData,
                              analysisId: segmentData?.analysisId,
                            });
                            setActiveReportId(clickedReportId);
                            setReportPanelOpen(true);
                            setReportPanelTab('report'); // 탭 상태 초기화
                            // 에디터 상태 초기화
                            setEditorContent(undefined);
                            setEditorFixInfo(undefined);

                            // G-code 원본 파일 로드 (에디터 탭용)
                            if (reportUiData.storagePath) {
                              const gcodeContent = await downloadGCodeContent(reportUiData.storagePath);
                              if (gcodeContent) {
                                setGcodeFileContent(gcodeContent);
                                gcodeFileContentRef.current = gcodeContent;
                              }
                            }

                            if (segmentData && segmentData.layers && segmentData.layers.length > 0) {
                              setGcodeSegments({
                                layers: segmentData.layers,
                                metadata: segmentData.metadata,
                                temperatures: segmentData.temperatures,
                              });
                            } else {
                              setGcodeSegments(null);
                            }
                          }
                        }}
                        onSuggestedAction={(action) => {
                          // 제안 액션 처리
                          if (action.action === 'follow_up' && action.data?.question) {
                            // 후속 질문: 입력창에 텍스트 설정
                            setInput(action.data.question as string);
                          } else if (action.action === 'open_link' && action.data?.url) {
                            // 링크 열기
                            window.open(action.data.url as string, '_blank');
                          } else if (action.action === 'copy' && action.data?.text) {
                            // 텍스트 복사
                            navigator.clipboard.writeText(action.data.text as string);
                            toast({
                              title: t('common.copied', '복사됨'),
                              description: t('common.copiedToClipboard', '클립보드에 복사되었습니다'),
                            });
                          } else if (action.action === 'detailed_diagnosis' || action.label?.includes('자세한 진단')) {
                            // 더 자세한 진단: 후속 질문으로 처리
                            setSelectedTool('troubleshoot');
                            setInput(t('aiChat.detailedDiagnosis', '더 자세하게 진단해주세요. 원인과 해결 방법을 단계별로 알려주세요.'));
                          } else if (action.action === 'new_issue' || action.label?.includes('다른 문제')) {
                            // 다른 문제 상담: 도구 선택하고 입력 포커스
                            setSelectedTool('troubleshoot');
                            setInput('');
                            // 입력창에 포커스
                            setTimeout(() => {
                              const textarea = document.querySelector('textarea');
                              textarea?.focus();
                            }, 100);
                            toast({
                              title: t('aiChat.newIssue', '새 문제 상담'),
                              description: t('aiChat.describeNewIssue', '새로운 문제를 설명해주세요'),
                            });
                          }
                        }}
                      />
                    ))}

                    {/* 로딩 표시 (일반 로딩 또는 AI 해결하기 로딩) */}
                    {(isLoading || isAIResolving) && (
                      <div className="bg-muted/30 w-full">
                        <div className="max-w-4xl mx-auto px-6 py-5">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                              <Cpu className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="text-sm font-semibold text-foreground">
                              FACTOR AI
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground pl-8">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">
                              {t('aiChat.thinkingText', '생각하는 중...')}
                              {isAIResolving && ` - ${t('aiChat.resolvingIssue', '이슈 해결책 찾는 중')}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* G-code 분석 진행률 표시 */}
                    {isGcodeAnalyzing && (
                      <div className="bg-blue-50 dark:bg-blue-950/30 w-full border-y border-blue-100 dark:border-blue-900">
                        <div className="max-w-4xl mx-auto px-6 py-5">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                              <FileCode2 className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                              {t('aiChat.gcodeAnalysisInProgress', 'G-code 분석 중...')}
                            </span>
                            <span className="text-sm text-blue-600 dark:text-blue-400 ml-auto">
                              {gcodeAnalysisProgress}%
                            </span>
                          </div>
                          <div className="pl-8 space-y-3">
                            <Progress value={gcodeAnalysisProgress} className="h-2" />
                            {/* 타임라인 + 진행 메시지 한 줄 표시 */}
                            {(gcodeAnalysisTimeline.length > 0 || gcodeAnalysisProgressMessage) && (
                              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                                {/* 완료된 타임라인 항목들 */}
                                {gcodeAnalysisTimeline.filter(step => step.status === 'done').map((step, idx, arr) => (
                                  <span key={step.step} className="flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                    <span className="text-muted-foreground">{step.label}</span>
                                    {idx < arr.length - 1 && <span className="mx-1 text-muted-foreground">→</span>}
                                  </span>
                                ))}
                                {/* 진행 중인 메시지 */}
                                {gcodeAnalysisProgressMessage && (
                                  <span className="flex items-center gap-1">
                                    {gcodeAnalysisTimeline.some(s => s.status === 'done') && <span className="mx-1 text-muted-foreground">→</span>}
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>{gcodeAnalysisProgressMessage}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </div>
              </ScrollArea>

              {/* 하단 입력창 */}
              <div className="shrink-0 bg-background/95 backdrop-blur">
                <div className="max-w-4xl mx-auto px-6 py-4">
                  <FilePreviewList
                    images={uploadedImages}
                    gcodeFile={gcodeFile}
                    onRemoveImage={removeImage}
                    onRemoveGcode={removeGcodeFile}
                    className="mb-3"
                  />

                  {renderInputBox(
                    uploadedImages.length > 0
                      ? t('aiChat.imageQuestionPlaceholder', '이미지에 대해 질문하세요...')
                      : gcodeFile
                        ? t('aiChat.gcodeQuestionPlaceholder', 'G-code에 대해 질문하세요...')
                        : selectedTool === "troubleshoot"
                          ? t('aiChat.troubleshootPlaceholder', '문제 상황에 대한 이미지와 증상 내용이 있으면 더 좋아요')
                          : selectedTool === "gcode"
                            ? t('aiChat.gcodePlaceholder', 'G-code 파일을 업로드하거나 문제 내용을 붙여넣어보세요')
                            : selectedTool === "modeling"
                              ? t('aiChat.modelingPlaceholder', '만들고 싶은 3D 모델을 설명해주세요')
                              : t('aiChat.chatPlaceholder', '메시지를 입력하세요...')
                  )}
                </div>
              </div>
            </div>

            {/* G-code 분석 보고서 - 인라인 카드 (채팅 옆에 표시) */}
            {/* 분석 중이거나 보고서가 있을 때 표시 */}
            {(isGcodeAnalyzing || (gcodeReportData && reportPanelOpen) || (reportPanelOpen && !gcodeReportData)) && (
              <div className="flex-[0_0_52%] w-full bg-muted/20 flex flex-col overflow-hidden h-full pr-4 py-4">
                {/* 로딩 상태 - 분석 중이거나 보고서 패널 열림 + 데이터 없음 */}
                {(isGcodeAnalyzing || (reportPanelOpen && !gcodeReportData)) && (
                  <div className="h-full rounded-2xl overflow-hidden bg-background border flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-10 h-10 animate-spin text-primary" />
                      <div className="text-center">
                        <p className="text-lg font-medium">{t('aiChat.analyzingGcode', 'G-code 분석 중...')}</p>
                        {gcodeAnalysisProgressMessage && (
                          <p className="text-sm text-muted-foreground mt-1">{gcodeAnalysisProgressMessage}</p>
                        )}
                        {gcodeAnalysisProgress > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">{gcodeAnalysisProgress}%</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {/* 보고서 내용 - 높이 100% 설정 */}
                {gcodeReportData && reportPanelOpen && (
                <div className="h-full rounded-2xl overflow-hidden">
                  <GCodeAnalysisReport
                    data={gcodeReportData}
                    embedded={true}
                    onClose={() => {
                      setReportPanelOpen(false);
                      setActiveReportId(null);
                      setReportPanelTab('report'); // 탭 상태 초기화
                      // 에디터 상태 초기화
                      setEditorContent(undefined);
                      setEditorFixInfo(undefined);
                    }}
                    initialSegments={gcodeSegments || undefined}
                    onAIResolveStart={handleAIResolveStart}
                    onAIResolveComplete={handleAIResolveComplete}
                    onAIResolveError={handleAIResolveError}
                    isAIResolving={isAIResolving}
                    activeTab={reportPanelTab}
                    onTabChange={setReportPanelTab}
                    editorContent={editorContent}
                    editorLoading={editorLoading}
                    editorFixInfo={editorFixInfo}
                    onViewCodeFix={(fix) => {
                      // AI 해결 응답의 메시지에서 gcodeContext를 찾아서 에디터 탭으로 이동
                      const resolveMessage = messages.find(m => m.codeFixes && m.gcodeContext);
                      if (resolveMessage?.gcodeContext && fix.line_number) {
                        // 에디터 탭으로 전환하고 수정 정보 설정
                        setEditorContent(resolveMessage.gcodeContext);
                        setEditorFixInfo({
                          lineNumber: fix.line_number,
                          original: fix.original || '',
                          fixed: fix.fixed || '',
                        });
                        setReportPanelTab('editor');
                      } else {
                        toast({
                          title: t('aiChat.noGcodeData', 'G-code 데이터 없음'),
                          description: t('aiChat.noGcodeDataDesc', '연결된 G-code 데이터를 찾을 수 없습니다. AI 해결하기를 먼저 실행해주세요.'),
                          variant: 'destructive',
                        });
                      }
                    }}
                    onEditorApplyFix={(lineNumber, originalCode, fixedCode, _contextContent) => {
                      // 로컬 상태에만 저장 (스토리지 저장 X) - 수정본 저장 시 한 번에 처리
                      // 1. 대기 중인 패치에 추가
                      setPendingPatches(prev => new Map(prev).set(lineNumber, { originalCode, fixedCode }));

                      // 2. 해결된 라인 추적 (UI 표시용)
                      setResolvedLines(prev => new Set(prev).add(lineNumber));

                      toast({
                        title: t('aiChat.patchQueued', '패치 대기 중'),
                        description: t('aiChat.patchQueuedDesc', '수정본 저장 시 적용됩니다.'),
                      });
                    }}
                    appliedPatchCount={resolvedLines.size}
                    revertLineNumber={revertLineNumber}
                    onRevertComplete={() => {
                      // 되돌리기 완료 시 상태 초기화
                      if (revertLineNumber !== undefined) {
                        // 대기 중인 패치에서 제거
                        setPendingPatches(prev => {
                          const newMap = new Map(prev);
                          newMap.delete(revertLineNumber);
                          return newMap;
                        });
                        setResolvedLines(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(revertLineNumber);
                          return newSet;
                        });
                        setRevertLineNumber(undefined);
                      }
                    }}
                    onSaveModifiedGCode={async () => {
                      // 모든 대기 중인 패치를 병합하여 저장 + 다운로드
                      if (pendingPatches.size === 0) {
                        toast({
                          title: t('aiChat.noPendingPatches', '적용할 패치 없음'),
                          description: t('aiChat.noPendingPatchesDesc', '저장할 수정사항이 없습니다.'),
                          variant: 'destructive',
                        });
                        return;
                      }

                      if (!gcodeReportData?.storagePath) {
                        toast({
                          title: t('aiChat.noStoragePath', '저장 경로 없음'),
                          description: t('aiChat.noStoragePathDesc', 'G-code 파일의 저장 경로를 찾을 수 없습니다.'),
                          variant: 'destructive',
                        });
                        return;
                      }

                      try {
                        // 1. 전체 G-code 파일 로드
                        let fullContent = gcodeFileContentRef.current;
                        if (!fullContent) {
                          fullContent = await downloadGCodeContent(gcodeReportData.storagePath);
                          if (fullContent) {
                            gcodeFileContentRef.current = fullContent;
                            setGcodeFileContent(fullContent);
                          }
                        }

                        if (!fullContent) {
                          toast({
                            title: t('aiChat.loadFailed', '파일 로드 실패'),
                            description: t('aiChat.loadFailedDesc', 'G-code 파일을 불러올 수 없습니다.'),
                            variant: 'destructive',
                          });
                          return;
                        }

                        // 2. 모든 패치 적용
                        const lines = fullContent.split('\n');
                        let appliedCount = 0;

                        for (const [lineNumber, patch] of pendingPatches) {
                          const originalCodeTrimmed = patch.originalCode.trim();
                          let found = false;

                          // 먼저 정확한 라인 번호에서 찾기
                          const targetIndex = lineNumber - 1;
                          if (targetIndex >= 0 && targetIndex < lines.length) {
                            if (lines[targetIndex].trim() === originalCodeTrimmed) {
                              lines[targetIndex] = patch.fixedCode;
                              found = true;
                            }
                          }

                          // 전체에서 검색
                          if (!found) {
                            for (let i = 0; i < lines.length; i++) {
                              if (lines[i].trim() === originalCodeTrimmed) {
                                lines[i] = patch.fixedCode;
                                found = true;
                                break;
                              }
                            }
                          }

                          if (found) appliedCount++;
                        }

                        const mergedContent = lines.join('\n');

                        // 3. 파일 다운로드 (원본 DB는 덮어쓰지 않음)
                        const blob = new Blob([mergedContent], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        const baseName = (gcodeReportData.fileName || 'gcode').replace(/\.gcode$/i, '');
                        link.download = `${baseName}_modified.gcode`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);

                        // 4. 대기 패치 초기화 (다운로드 후 패치 상태 리셋)
                        setPendingPatches(new Map());

                        toast({
                          title: t('aiChat.saveSuccess', '저장 완료'),
                          description: t('aiChat.saveSuccessDesc', `${appliedCount}개 패치가 적용되어 저장되었습니다.`),
                        });
                      } catch (err) {
                        console.error('[AIChat] Failed to save modified gcode:', err);
                        toast({
                          title: t('aiChat.patchSaveFailed', '패치 저장 실패'),
                          description: String(err),
                          variant: 'destructive',
                        });
                      }
                    }}
                  />
                </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 로그인 모달 */}
      <LoginPromptModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
        title={t('auth.loginRequired', '로그인이 필요합니다')}
        description={t('auth.loginModalDescription', '로그인하시면 대화 기록 저장, 분석 히스토리 등 더 많은 기능을 이용하실 수 있습니다.')}
      />

      {/* 새 채팅 유도 모달 (한 세션에서 하나의 도구만 사용 가능) */}
      <Dialog open={showNewChatModal} onOpenChange={handleCloseNewChatModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('aiChat.newChatRequired', '새 채팅이 필요합니다')}</DialogTitle>
            <DialogDescription>
              {t('aiChat.newChatRequiredDesc', '한 세션에서는 하나의 도구만 사용할 수 있습니다. 다른 도구를 사용하려면 새 채팅을 시작해주세요.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCloseNewChatModal}>
              {t('common.cancel', '취소')}
            </Button>
            <Button onClick={handleStartNewChatWithTool}>
              {t('aiChat.startNewChat', '새 채팅 시작')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AIChat;
