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
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ChevronRight,
  Share2,
  Copy,
  ExternalLink,
  Cpu,
  FileCode2,
  Check,
} from "lucide-react";
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
import { useLocation, useSearchParams } from "react-router-dom";
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

// 리팩토링된 채팅 훅 및 유틸리티 함수
import {
  detectToolType,
  determineChatMode,
  createUserMessage,
  createAssistantMessage,
  createErrorMessage,
  prepareFileInfos,
  canSendMessage,
  useFileUpload,
  useChatSharing,
} from "@/hooks/chat";
import { GCodeAnalysisReport, type AIResolveStartInfo, type AIResolveCompleteInfo, type GCodeAnalysisData } from "@/components/ai/GCodeAnalytics";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useIsMobile } from "@/hooks/use-mobile";
import { SharedBottomNavigation } from "@/components/shared/SharedBottomNavigation";
import {
  useGcodeAnalysisPolling,
  type ReportCardData,
} from "@/components/ai/GCodeAnalytics/useGcodeAnalysisPolling";
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
import { supabase } from "@shared/integrations/supabase/client";
import { downloadAndUploadReferenceImages } from "@shared/services/supabaseService/aiStorage";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GCodeAnalyticsArchive } from "@/components/ai/GCodeAnalytics";
import { WelcomeScreen } from "@/components/ai/Chat/WelcomeScreen";
import { ChatInput, type SelectedModel } from "@/components/ai/Chat/ChatInput";

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
  // API 응답에서 받은 참조 이미지 (Supabase에 저장된 URL 포함)
  referenceImages?: {
    search_query?: string;
    total_count?: number;
    images: Array<{
      title: string;
      thumbnail_url: string;  // Supabase에 저장된 URL 또는 원본 URL
      source_url: string;     // 원본 소스 사이트 URL
      width?: number;
      height?: number;
    }>;
  };
}

type ChatMode = "general" | "troubleshoot" | "gcode" | "modeling";

const AIChat = () => {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const locationState = location.state as { openSidebar?: boolean } | null;
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("general");
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  // 파일 업로드 훅 사용
  const {
    uploadedImages,
    imageFiles,
    gcodeFile,
    gcodeFileContent,
    isDragging,
    fileInputRef,
    gcodeInputRef,
    handleImageUpload,
    handleGcodeUpload,
    removeImage: fileUploadRemoveImage,
    removeGcodeFile: fileUploadRemoveGcodeFile,
    clearAllFiles,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handlePaste,
    setUploadedImages,
    setImageFiles,
    setGcodeFile,
    setGcodeFileContent,
  } = useFileUpload();
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
  const [_currentSessionToolType, setCurrentSessionToolType] = useState<string | null>(null);
  // 새 채팅 유도 모달 상태
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [pendingToolId, setPendingToolId] = useState<string | null>(null);

  // G-code 분석 보고서 패널 상태
  const [reportPanelOpen, setReportPanelOpen] = useState(false);

  // 아카이브 뷰 상태 (메인 콘텐츠 영역에 표시)
  const [archiveViewActive, setArchiveViewActive] = useState(false);
  const [archiveClosing, setArchiveClosing] = useState(false);

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

  // 공유 훅 사용
  const {
    isSharing,
    shareUrl,
    showShareModal,
    shareChat,
    copyShareUrl,
    closeShareModal,
    setShowShareModal,
  } = useChatSharing({ userId: user?.id });

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

  // URL 쿼리 파라미터로 아카이브 뷰 활성화 (예: /ai-chat?view=archive)
  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'archive' && user?.id) {
      setArchiveViewActive(true);
      // URL에서 쿼리 파라미터 제거 (히스토리 교체)
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, user?.id, setSearchParams]);

  // 아카이브 뷰 토글 (닫을 때 애니메이션 적용)
  const handleArchiveToggle = () => {
    if (archiveViewActive) {
      // 닫기: 애니메이션 시작 후 상태 변경
      setArchiveClosing(true);
      setTimeout(() => {
        setArchiveClosing(false);
        setArchiveViewActive(false);
      }, 200); // duration-200과 동일
    } else {
      // 열기
      setArchiveViewActive(true);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

        // metadata에서 codeFixes, gcodeContext, referenceImages 추출
        const metadata = m.metadata as {
          codeFixes?: CodeFixInfo[];
          gcodeContext?: string;
          analysisReportId?: string;
          referenceImages?: Message['referenceImages'];
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
          referenceImages: metadata?.referenceImages,  // 저장된 참조 이미지 복원
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

  // 보고서 아카이브 상세 보기 핸들러
  const handleArchiveViewReport = async (reportId: string, fileName: string) => {
    try {
      // 1. 보고서 데이터 가져오기
      const { data: report, error } = await getAnalysisReportById(reportId);

      if (error || !report) {
        toast({
          title: t('aiChat.reportLoadError', '보고서 로드 실패'),
          description: t('aiChat.reportLoadErrorDesc', '보고서를 불러오는 중 오류가 발생했습니다.'),
          variant: 'destructive',
        });
        return;
      }

      // 2. UI 데이터로 변환
      const uiData = convertDbReportToUiData(report);

      // 3. 상태 업데이트
      setGcodeReportData(uiData);
      setActiveReportId(reportId);

      // 4. G-code 파일 내용 로드 (스토리지 경로가 있는 경우)
      if (report.file_storage_path) {
        setEditorLoading(true);
        try {
          const content = await downloadGCodeContent(report.file_storage_path);
          if (content) {
            setGcodeFileContent(content);
            setEditorContent(content);
          }
        } catch (e) {
          console.error('[AIChat] Failed to load G-code content:', e);
        } finally {
          setEditorLoading(false);
        }
      }

      // 5. 세그먼트 데이터 로드
      try {
        const { data: segments } = await loadFullSegmentDataByReportId(reportId);
        if (segments) {
          setGcodeSegments(segments);
        }
      } catch (e) {
        console.warn('[AIChat] Failed to load segments:', e);
      }

      // 6. 패널 열기
      setReportPanelOpen(true);
      setReportPanelTab('report');

    } catch (e) {
      console.error('Failed to load archive report:', e);
      toast({
        title: t('aiChat.reportLoadError', '보고서 로드 실패'),
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

  // 대화 공유 핸들러 (useChatSharing 훅 사용)
  const handleShareChat = async () => {
    await shareChat(messages, {
      currentSessionId,
      chatSessions,
    });
  };

  // 클립보드 복사 핸들러 (useChatSharing 훅 사용)
  const handleCopyShareUrl = async () => {
    await copyShareUrl();
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

  // 이미지 제거 (훅의 removeImage에 도구 선택 해제 로직 추가)
  const removeImage = (index: number) => {
    fileUploadRemoveImage(index);
    // 모든 이미지가 제거되면 도구 선택 해제
    if (uploadedImages.length <= 1 && selectedTool === "troubleshoot") {
      setSelectedTool(null);
    }
  };

  // G-code 파일 제거 (훅의 removeGcodeFile에 모드/도구 초기화 로직 추가)
  const removeGcodeFile = () => {
    fileUploadRemoveGcodeFile();
    if (chatMode === "gcode") {
      setChatMode("general");
    }
    if (selectedTool === "gcode") {
      setSelectedTool(null);
    }
  };

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

      // 9. AI 응답 메시지 생성 및 UI 반영 (참고 자료, 참조 이미지 및 제안 액션 포함)
      const assistantMessage = createAssistantMessage(apiResult.response, {
        references: apiResult.references,
        referenceImages: apiResult.referenceImages,
        suggestedActions: apiResult.suggestedActions,
      });
      setMessages((prev) => [...prev, assistantMessage]);

      // 10. 참조 이미지 Supabase 저장 및 메시지 업데이트 (로그인 사용자 + 세션 있을 때)
      let storedReferenceImages: Message['referenceImages'] | undefined = apiResult.referenceImages;
      if (user?.id && sessionId && apiResult.referenceImages?.images?.length) {
        try {
          console.log('[AIChat] Storing reference images to Supabase...');
          const storedImages = await downloadAndUploadReferenceImages(
            supabase,
            user.id,
            sessionId,
            apiResult.referenceImages.images
          );

          // 저장된 URL로 referenceImages 업데이트
          storedReferenceImages = {
            search_query: apiResult.referenceImages.search_query,
            total_count: apiResult.referenceImages.total_count,
            images: storedImages.map(img => ({
              title: img.title,
              thumbnail_url: img.stored_url,  // Supabase URL 사용
              source_url: img.source_url,
              width: img.width,
              height: img.height,
            })),
          };

          // 메시지 상태 업데이트 (저장된 URL로)
          setMessages(prev => prev.map(m =>
            m.id === assistantMessage.id ? { ...m, referenceImages: storedReferenceImages } : m
          ));
          console.log('[AIChat] Reference images stored successfully');
        } catch (error) {
          console.error('[AIChat] Failed to store reference images:', error);
          // 실패해도 원본 URL로 계속 진행
        }
      }

      // 11. AI 응답 DB 저장 (저장된 참조 이미지 URL 포함)
      let savedDbMessageId: string | null = null;
      if (user?.id && sessionId) {
        const savedMsg = await saveChatMessage(sessionId, user.id, 'assistant', apiResult.response, {
          metadata: {
            tool: toolType,
            referenceImages: storedReferenceImages,  // 저장된 이미지 URL 포함
          },
        });
        if (savedMsg?.id) {
          savedDbMessageId = savedMsg.id;
          setMessages(prev => prev.map(m =>
            m.id === assistantMessage.id ? { ...m, dbMessageId: savedMsg.id } : m
          ));
        }
      }

      // 11-1. 모델링 성공 시 사용량 증가
      if (selectedTool === 'modeling' && user?.id) {
        await incrementUsage(user.id, USAGE_TYPES.AI_MODEL_GENERATION);
      }

      // 11-2. 문제진단 성공 시 사용량 증가 (모든 모델 포함)
      if (selectedTool === 'troubleshoot' && user?.id) {
        await incrementTroubleshootAdvancedUsage(user.id);
      }

      // 11-3. 익명 사용자 사용량 증가 (일일 10회)
      if (!user && !apiResult.isFallback) {
        incrementAnonymousUsage();
      }

      // 12. G-code 분석 후처리
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
      // 특정 에러는 이미 toast로 표시했으므로 에러 메시지 추가하지 않음
      const skipErrorMessages = [
        'AI_GENERATION_LIMIT_REACHED',
        'LOGIN_REQUIRED_FOR_MODELING',
        'TROUBLESHOOT_DAILY_LIMIT_REACHED'
      ];
      if (error instanceof Error && skipErrorMessages.includes(error.message)) {
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
    referenceImages?: { search_query?: string; total_count?: number; images: Array<{ title: string; thumbnail_url: string; source_url: string; width?: number; height?: number }> };
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
        // 비로그인 사용자는 3D 모델링 사용 불가 - 로그인 유도
        if (!user?.id) {
          toast({
            title: t('aiChat.loginRequiredForModeling', '로그인이 필요합니다'),
            description: t('aiChat.loginRequiredForModelingDescription', '3D 모델 생성은 로그인 후 사용할 수 있습니다. 로그인하시면 다양한 AI 도구를 무료로 체험해보실 수 있습니다.'),
            variant: "default"
          });
          setShowLoginModal(true);
          throw new Error('LOGIN_REQUIRED_FOR_MODELING');
        }

        // AI 모델 생성 한도 체크
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
    const toolData = response.tool_result?.data as Record<string, unknown> | null | undefined;
    const references = (toolData?.references || response.references) as typeof response.references;

    // 참조 이미지 추출 (문제진단에서 검색된 이미지)
    const toolResultAny = response.tool_result as unknown as Record<string, unknown> | undefined;
    const referenceImages = (toolData?.reference_images || toolResultAny?.reference_images || response.reference_images) as typeof response.reference_images;

    if (referenceImages?.images?.length) {
      console.log('[AIChat] Found reference images:', referenceImages.images.length);
    }

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
      referenceImages: referenceImages,
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
  const renderInputBox = (placeholder?: string) => (
    <ChatInput
      input={input}
      setInput={setInput}
      isLoading={isLoading}
      isDragging={isDragging}
      uploadedImages={uploadedImages}
      gcodeFile={gcodeFile}
      selectedTool={selectedTool}
      setSelectedTool={setSelectedTool}
      selectedModel={selectedModel as SelectedModel}
      setSelectedModel={setSelectedModel}
      user={user}
      userPlan={userPlan}
      onSend={handleSend}
      onLoginRequired={() => setShowLoginModal(true)}
      fileInputRef={fileInputRef}
      gcodeInputRef={gcodeInputRef}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      placeholder={placeholder}
    />
  );

  return (
    <div className={cn("h-screen bg-background flex", isMobile && "pb-16")}>
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

      {/* 왼쪽 사이드바 - 모바일에서는 숨김 */}
      {!isMobile && <AppSidebar
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
      />}

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col min-w-0 relative transition-all duration-300">
        {/* 상단 헤더 - AppHeader 재사용 */}
        <AppHeader
          sidebarOpen={sidebarOpen}
          onLoginRequired={() => setShowLoginModal(true)}
          rightContent={
            messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShareChat}
                disabled={isSharing}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                {isSharing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{t('aiChat.share', '공유')}</span>
              </Button>
            )
          }
        />

        {archiveViewActive && user?.id ? (
          // 아카이브 뷰 모드 - GCodeAnalyticsArchive 컴포넌트 사용
          <GCodeAnalyticsArchive
            userId={user.id}
            onClose={handleArchiveToggle}
            onReportDeleted={loadReportArchive}
            isClosing={archiveClosing}
          />
        ) : messages.length === 0 ? (
          // WelcomeScreen 컴포넌트 (초기 화면)
          <WelcomeScreen
            uploadedImages={uploadedImages}
            gcodeFile={gcodeFile}
            onRemoveImage={removeImage}
            onRemoveGcode={removeGcodeFile}
            selectedTool={selectedTool}
            setSelectedTool={setSelectedTool}
            setInput={setInput}
            user={user}
            onLoginRequired={() => setShowLoginModal(true)}
            renderInputBox={renderInputBox}
          />
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

      {/* 대화 공유 모달 */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              {t('aiChat.shareTitle', '대화 공유')}
            </DialogTitle>
            <DialogDescription>
              {t('aiChat.shareDescription', '이 링크를 통해 다른 사람과 대화 내용을 공유할 수 있습니다. 링크는 30일간 유효합니다.')}
            </DialogDescription>
          </DialogHeader>

          {shareUrl && (
            <div className="space-y-4">
              {/* 공유 URL */}
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-muted rounded-lg border text-sm truncate font-mono">
                  {shareUrl}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyShareUrl}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>

              {/* 버튼 */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={handleCopyShareUrl}
                >
                  <Copy className="w-4 h-4" />
                  {t('aiChat.copyLink', '링크 복사')}
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => window.open(shareUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('aiChat.openLink', '열기')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 모바일 하단 네비게이션 */}
      {isMobile && <SharedBottomNavigation />}
    </div>
  );
};

export default AIChat;
