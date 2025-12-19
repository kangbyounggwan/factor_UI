/**
 * 통합 AI 채팅 페이지 (Gemini 스타일)
 * G-code 분석 + 프린터 닥터 기능을 하나의 채팅 인터페이스로 통합
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
  File,
  Plus,
  Settings2,
  ChevronDown,
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
import { AppSidebar, type ChatSession } from "@/components/common/AppSidebar";
import { AppHeader } from "@/components/common/AppHeader";
import { FilePreviewList } from "@/components/ai/FilePreviewList";
import { LoginPromptModal } from "@/components/auth/LoginPromptModal";
import { useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getChatSessions,
  createChatSession,
  deleteChatSession as deleteDBSession,
  getChatMessages,
  saveChatMessage,
  updateChatSessionTitle,
  updateChatSessionToolType,
  updateChatSessionMetadata,
  updateMessageReportId,
  type ChatToolType,
  type ChatFileInfo,
  type ChatMessageMetadata,
} from "@shared/services/supabaseService/chat";
import { generateChatTitle } from "@shared/services/geminiService";
import {
  getAnonymousId,
  saveAnonChat,
  loadAnonChat,
  clearAnonChat,
  MAX_LOGGED_IN_MESSAGES,
  type AnonChatMessage,
} from "@shared/utils/anonymousId";
import { GCodeAnalysisReport, type GCodeAnalysisData, type AIResolveStartInfo, type AIResolveCompleteInfo } from "@/components/PrinterDetail/GCodeAnalysisReport";
import { ReportCompletionCard } from "@/components/gcodeAnalysis/ReportCompletionCard";
import { PanelRightOpen } from "lucide-react";
import {
  getAnalysisStatus,
} from "@shared/services/gcodeAnalysisService";
import type { TimelineStep, AnalysisResult } from "@shared/types/gcodeAnalysisTypes";
import {
  saveAnalysisReport,
  convertDbReportToUiData,
  getAnalysisReportById,
} from "@/lib/gcodeAnalysisDbService";
import { saveSegmentData, linkSegmentToReport, getSegmentDataIdByAnalysisId, loadFullSegmentDataByReportId, loadFullSegmentData } from "@/lib/gcodeSegmentService";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

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
}

type ChatMode = "general" | "troubleshoot" | "gcode" | "modeling";

const AIChat = () => {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const locationState = location.state as { openSidebar?: boolean } | null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("general");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [gcodeFile, setGcodeFile] = useState<File | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(locationState?.openSidebar ?? false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [_isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{ provider: string; model: string }>({ provider: 'openai', model: 'gpt-4o-mini' });

  // G-code 분석 보고서 패널 상태
  const [gcodeReportData, setGcodeReportData] = useState<GCodeAnalysisData | null>(null);
  const [reportPanelOpen, setReportPanelOpen] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null); // 현재 활성화된 보고서 ID

  // G-code 분석 폴링 상태
  const [gcodeAnalysisId, setGcodeAnalysisId] = useState<string | null>(null);
  const [gcodeAnalysisProgress, setGcodeAnalysisProgress] = useState(0);
  const [gcodeAnalysisTimeline, setGcodeAnalysisTimeline] = useState<TimelineStep[]>([]);
  const [gcodeAnalysisProgressMessage, setGcodeAnalysisProgressMessage] = useState<string | null>(null);
  const [isGcodeAnalyzing, setIsGcodeAnalyzing] = useState(false);
  const [gcodeAnalysisMessageId, setGcodeAnalysisMessageId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 세그먼트 데이터 ID (3D 뷰어용 - 보고서 저장 시 함께 저장)
  const savedSegmentDataIdRef = useRef<string | null>(null);
  // 3D 뷰어용 세그먼트 데이터 (API 응답에서 직접 받은 데이터)
  const [gcodeSegments, setGcodeSegments] = useState<{ layers: any[]; metadata?: any; temperatures?: any[] } | null>(null);

  // AI 해결하기 상태
  const [isAIResolving, setIsAIResolving] = useState(false);

  // 사용자 플랜 정보 가져오기 (shared 훅 사용)
  const { plan: userPlan } = useUserPlan(user?.id);

  // G-code 분석 도구 선택 시 기본 메시지 설정
  useEffect(() => {
    if (selectedTool === 'gcode' && !input) {
      setInput(t('aiChat.gcodeAnalyzePrompt', 'G-code 분석해줘!'));
    } else if (selectedTool !== 'gcode' && input === t('aiChat.gcodeAnalyzePrompt', 'G-code 분석해줘!')) {
      setInput('');
    }
  }, [selectedTool, t]);

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gcodeInputRef = useRef<HTMLInputElement>(null);

  // 사용자 이름 가져오기
  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || t('common.user', '사용자');

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

    // 비로그인 사용자: localStorage 클리어
    if (!user?.id) {
      clearAnonChat();
    }
  };

  // 채팅 세션 불러오기
  const handleLoadSession = async (session: ChatSession) => {
    if (!user?.id) return;

    try {
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

        return {
          id: m.id,
          role: m.type as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.created_at),
          images: m.images || undefined,
          files: m.files || undefined,
          reportCard,
        };
      });

      setMessages(formattedMessages);
      setCurrentSessionId(session.id);

      // 보고서가 있으면 패널 상태 초기화 (닫힌 상태로 시작)
      if (Object.keys(reportCardCache).length > 0) {
        setReportPanelOpen(false);
        setGcodeReportData(null);
        setActiveReportId(null);
      }
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
        }
      }
    } catch (e) {
      toast({
        title: t('aiChat.deleteError', '세션 삭제 실패'),
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
  const handleGcodeUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.gcode') || file.name.endsWith('.gco'))) {
      setGcodeFile(file);
      toast({
        title: t('aiChat.gcodeUploaded', 'G-code 파일 업로드됨'),
        description: file.name,
      });
    }
    e.target.value = "";
  }, [toast]);

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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        processImageFile(file);
      } else if (file.name.endsWith('.gcode') || file.name.endsWith('.gco')) {
        setGcodeFile(file);
        toast({
          title: t('aiChat.gcodeUploaded', 'G-code 파일 업로드됨'),
          description: file.name,
        });
      }
    });
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

  // 메시지 전송
  const handleSend = async () => {
    if ((!input.trim() && uploadedImages.length === 0 && !gcodeFile) || isLoading) return;

    // 도구 타입 결정
    let detectedToolType: ChatToolType = 'general';
    if (selectedTool === 'modeling') {
      detectedToolType = 'modeling';
    } else if (selectedTool === 'troubleshoot' || uploadedImages.length > 0) {
      detectedToolType = 'troubleshoot';
    } else if (selectedTool === 'gcode' || gcodeFile) {
      detectedToolType = 'gcode';
    }

    // 로그인 사용자: 새 세션이면 DB에 세션 생성
    let sessionId = currentSessionId;
    const isFirstMessage = messages.length === 0;

    if (user?.id && !sessionId) {
      // 임시 제목으로 세션 생성 (나중에 AI로 요약)
      const tempTitle = t('aiChat.newChat', '새 대화');
      const newSession = await createChatSession(user.id, tempTitle, detectedToolType);
      if (newSession) {
        sessionId = newSession.id;
        setCurrentSessionId(newSession.id);
        // 세션 목록에 추가
        setChatSessions(prev => [{
          id: newSession.id,
          title: newSession.title,
          timestamp: new Date(newSession.created_at),
          messages: [],
        }, ...prev]);
      }
    } else if (user?.id && sessionId && isFirstMessage) {
      // 기존 세션이지만 첫 메시지면 도구 타입 업데이트
      await updateChatSessionToolType(sessionId, detectedToolType);
    }

    // 파일 정보 준비
    const fileInfos: ChatFileInfo[] | undefined = gcodeFile
      ? [{ name: gcodeFile.name, type: 'gcode', size: gcodeFile.size }]
      : undefined;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
      images: uploadedImages.length > 0 ? [...uploadedImages] : undefined,
      files: gcodeFile ? [{ name: gcodeFile.name, type: "gcode" }] : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);

    // 로그인 사용자: 사용자 메시지 DB에 저장 (이미지, 파일 정보 포함)
    if (user?.id && sessionId) {
      saveChatMessage(sessionId, user.id, 'user', input.trim(), {
        images: uploadedImages.length > 0 ? [...uploadedImages] : undefined,
        files: fileInfos,
        metadata: { tool: detectedToolType },
      });
    }

    const currentInput = input.trim();
    const currentImages = [...imageFiles];
    const currentGcodeFile = gcodeFile;

    setInput("");
    setUploadedImages([]);
    setImageFiles([]);
    setGcodeFile(null);
    setIsLoading(true);

    try {
      const responseMetadata: ChatMessageMetadata = { tool: detectedToolType };

      // 채팅 모드 설정
      if (selectedTool === "modeling") {
        setChatMode("modeling");
      } else if (currentImages.length > 0 || selectedTool === "troubleshoot") {
        setChatMode("troubleshoot");
      } else if (currentGcodeFile || selectedTool === "gcode") {
        setChatMode("gcode");
      } else {
        setChatMode("general");
      }

      // 통합 Chat API 호출
      const apiResult = await callChatAPI(
        currentInput,
        currentImages,
        currentGcodeFile,
        selectedTool
      );
      const aiResponse = apiResult.response;

      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: aiResponse,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // 로그인 사용자: AI 응답 DB에 저장 (메타데이터 포함) - 폴링 시작 전에 먼저 저장
      let savedDbMessageId: string | null = null;
      if (user?.id && sessionId) {
        const savedMsg = await saveChatMessage(sessionId, user.id, 'assistant', aiResponse, {
          metadata: responseMetadata,
        });
        // DB 메시지 ID를 UI 메시지에 동기화 (reportId 업데이트용)
        if (savedMsg?.id) {
          savedDbMessageId = savedMsg.id;
          setMessages(prev => prev.map(m =>
            m.id === assistantMessageId ? { ...m, dbMessageId: savedMsg.id } : m
          ));
        }
      }

      // G-code 분석인 경우 폴링 시작 + 세그먼트 저장 (DB 저장 후)
      console.log('[DEBUG] apiResult:', { analysisId: apiResult.analysisId, fileName: apiResult.fileName, hasSegments: !!apiResult.segments });
      if (apiResult.analysisId) {
        console.log('[DEBUG] Starting G-code analysis polling...');

        // 새로운 분석 시작 시 기존 보고서 패널 닫고 상태 초기화
        setReportPanelOpen(false);
        setGcodeReportData(null);
        setActiveReportId(null);
        setGcodeSegments(null);

        // 메시지 ID 저장 후 폴링 시작 (올바른 메시지에 보고서 카드 연결)
        setGcodeAnalysisMessageId(assistantMessageId);
        handleGcodeAnalysisStream(apiResult.analysisId, apiResult.fileName, assistantMessageId, savedDbMessageId);

        // 세그먼트 데이터가 있으면 상태에 저장 (3D 뷰어용)
        if (apiResult.segments) {
          console.log('[DEBUG] Setting gcodeSegments for 3D viewer, layerCount:', apiResult.segments.layers?.length);
          setGcodeSegments({
            layers: apiResult.segments.layers || [],
            metadata: apiResult.segments.metadata,
          });
        }

        // 세그먼트 데이터가 있으면 DB에 저장 (로그인 사용자만)
        if (user?.id && apiResult.segments) {
          savedSegmentDataIdRef.current = null;
          console.log('[DEBUG] Saving segment data to DB, analysisId:', apiResult.analysisId, 'layerCount:', apiResult.segments.layers?.length);
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
            if (error) {
              console.log('[DEBUG] Segment save FAILED:', error);
            } else {
              console.log('[DEBUG] Segment saved, id:', data?.id);
              savedSegmentDataIdRef.current = data?.id || null;
              console.log('[DEBUG] savedSegmentDataIdRef.current =', savedSegmentDataIdRef.current);
            }
          });
        }
      }

      // 첫 메시지면 AI로 제목 생성 (15자 초과 시 요약)
      if (user?.id && sessionId && isFirstMessage) {
        const title = await generateChatTitle(currentInput);
        await updateChatSessionTitle(sessionId, title);
        setChatSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, title } : s
        ));
      }

      // 비로그인 사용자: localStorage에 저장 (최근 10개)
      if (!user?.id) {
        const updatedMessages: AnonChatMessage[] = [
          ...messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp.getTime() })),
          { role: 'user' as const, content: currentInput, timestamp: userMessage.timestamp.getTime() },
          { role: 'assistant' as const, content: aiResponse, timestamp: assistantMessage.timestamp.getTime() },
        ];
        saveAnonChat(updatedMessages);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `${t('aiChat.errorOccurred', '죄송합니다. 오류가 발생했습니다.')}\n\n**${t('common.error', '오류')}:** ${error instanceof Error ? error.message : t('aiChat.unknownError', '알 수 없는 오류')}\n\n${t('aiChat.tryAgainLater', '잠시 후 다시 시도해주세요.')}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);

      // 에러 메시지도 저장 (선택적)
      if (user?.id && sessionId) {
        saveChatMessage(sessionId, user.id, 'assistant', errorMessage.content);
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
    const contextLimit = user?.id ? MAX_LOGGED_IN_MESSAGES : 10;
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
    console.log('[DEBUG] Chat API response:', {
      analysis_id: response.analysis_id,
      hasSegments: !!segments,
      segmentsLayerCount: segments?.layers?.length,
      userId: user?.id,
    });

    // G-code 분석 정보와 함께 반환 (handleSubmit에서 처리)
    // analysis_id가 있으면 폴링 시작
    return {
      response: formattedResponse,
      analysisId: response.analysis_id || undefined,
      fileName: gcodeFileName,
      segments: segments,
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

  // G-code 분석 폴링 처리 (2초마다 상태 조회)
  const handleGcodeAnalysisStream = useCallback((analysisId: string, fileName?: string, messageId?: string, dbMessageId?: string | null) => {
    // 기존 폴링이 있으면 중지
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // messageId와 dbMessageId를 로컬 변수로 캡처 (클로저 문제 방지)
    const capturedMessageId = messageId;
    const capturedDbMessageId = dbMessageId;
    console.log('[DEBUG] handleGcodeAnalysisStream called:', { analysisId, fileName, messageId: capturedMessageId, dbMessageId: capturedDbMessageId });

    console.log('[DEBUG] handleGcodeAnalysisStream: Setting isGcodeAnalyzing to TRUE');
    setGcodeAnalysisId(analysisId);
    setIsGcodeAnalyzing(true);
    setGcodeAnalysisProgress(0);
    setGcodeAnalysisTimeline([]);
    setGcodeAnalysisProgressMessage(null);
    if (capturedMessageId) {
      setGcodeAnalysisMessageId(capturedMessageId);
    }
    console.log('[DEBUG] handleGcodeAnalysisStream: State updates dispatched');

    // 분석 완료 처리 함수 - capturedMessageId를 직접 사용
    const handleAnalysisComplete = async (result: AnalysisResult) => {
      console.log('[DEBUG] handleAnalysisComplete called with capturedMessageId:', capturedMessageId);
      setIsGcodeAnalyzing(false);
      setGcodeAnalysisProgress(100);

      // 폴링 중지
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      // 결과를 UI 데이터로 변환 (analysisId 포함 - AI 해결하기 버튼 활성화용)
      const reportData = convertAnalysisResultToReportData(result, fileName);
      setGcodeReportData({
        ...reportData,
        analysisId: analysisId,
      });
      setReportPanelOpen(true);

      // DB에 저장 (로그인 사용자만)
      let savedReportId: string | null = null;
      // 임시로 analysisId를 활성 보고서로 설정 (DB 저장 후 실제 ID로 업데이트)
      setActiveReportId(analysisId);
      if (user?.id) {
        try {
          // 세그먼트 ID가 ref에 없으면 DB에서 조회 (비동기 저장 타이밍 이슈 대응)
          let segmentDataId = savedSegmentDataIdRef.current;
          console.log('[DEBUG] Before saving report - savedSegmentDataIdRef.current:', segmentDataId);
          if (!segmentDataId) {
            const { segmentDataId: fetchedId } = await getSegmentDataIdByAnalysisId(analysisId);
            segmentDataId = fetchedId;
            console.log('[DEBUG] Fetched segmentDataId from DB:', segmentDataId);
          }

          console.log('[DEBUG] Calling saveAnalysisReport with segmentDataId:', segmentDataId);
          const { data: savedReport, error } = await saveAnalysisReport(
            user.id,
            fileName || 'analysis.gcode',
            reportData,
            {
              apiResult: result,
              segmentDataId: segmentDataId || undefined,
            }
          );
          if (error) {
            console.log('[DEBUG] saveAnalysisReport FAILED:', error);
          } else {
            console.log('[DEBUG] saveAnalysisReport SUCCESS - reportId:', savedReport?.id, 'passed segmentDataId:', segmentDataId);
            savedReportId = savedReport?.id || null;

            // 실제 저장된 reportId로 activeReportId 업데이트
            if (savedReportId) {
              setActiveReportId(savedReportId);

              // gcodeReportData에 reportId와 analysisId 추가 (3D 뷰어용)
              setGcodeReportData(prev => prev ? {
                ...prev,
                reportId: savedReportId,
                analysisId: analysisId,
              } : null);
            }

            // 세그먼트 데이터와 보고서 연결 (gcode_segment_data.report_id 업데이트)
            if (savedReportId) {
              linkSegmentToReport(analysisId, savedReportId).then(({ success, error: linkError }) => {
                if (linkError) {
                  console.log('[DEBUG] linkSegmentToReport FAILED:', linkError);
                } else if (success) {
                  console.log('[DEBUG] linkSegmentToReport SUCCESS - report_id updated in gcode_segment_data');
                }
              });
            }

            // 세그먼트 데이터가 아직 gcodeSegments에 없으면 DB에서 로드 (3D 뷰어용)
            const currentSegmentId = savedSegmentDataIdRef.current || segmentDataId;
            if (currentSegmentId) {
              console.log('[DEBUG] Loading segment data for 3D viewer, segmentId:', currentSegmentId);
              loadFullSegmentData(currentSegmentId).then(({ data: segmentData, error: segmentError }) => {
                if (segmentError) {
                  console.log('[DEBUG] loadFullSegmentData FAILED:', segmentError);
                } else if (segmentData) {
                  console.log('[DEBUG] loadFullSegmentData SUCCESS, layers:', segmentData.layers.length);
                  setGcodeSegments({
                    layers: segmentData.layers,
                    metadata: segmentData.metadata,
                    temperatures: segmentData.temperatures,
                  });
                }
              });
            }
          }
        } catch (err) {
          console.log('[DEBUG] saveAnalysisReport exception:', err);
        }
      }

      // 보고서 카드 정보 생성
      const reportCardData = {
        reportId: savedReportId || analysisId,
        fileName: fileName || 'analysis.gcode',
        overallScore: result.final_summary?.overall_quality_score,
        overallGrade: result.final_summary?.overall_quality_score >= 90 ? 'A' :
          result.final_summary?.overall_quality_score >= 75 ? 'B' :
            result.final_summary?.overall_quality_score >= 60 ? 'C' :
              result.final_summary?.overall_quality_score >= 40 ? 'D' : 'F',
        totalIssues: result.final_summary?.total_issues_found,
        layerCount: result.comprehensive_summary?.layer?.total_layers,
        printTime: result.comprehensive_summary?.print_time?.formatted_time,
      };
      console.log('[DEBUG] reportCardData:', reportCardData);
      console.log('[DEBUG] capturedMessageId (from closure):', capturedMessageId);

      // 기존 분석 시작 메시지에 reportCard 추가 (병합)
      // capturedMessageId를 직접 사용 (클로저 캡처 문제 방지)
      setMessages(prev => {
        const targetMessageId = capturedMessageId;
        console.log('[DEBUG] setMessages - targetMessageId:', targetMessageId, 'messages count:', prev.length);
        if (targetMessageId) {
          // 특정 메시지 업데이트
          return prev.map(msg =>
            msg.id === targetMessageId
              ? { ...msg, reportCard: reportCardData }
              : msg
          );
        } else {
          // 마지막 assistant 메시지에 reportCard 추가
          const lastIndex = prev.length - 1;
          for (let i = lastIndex; i >= 0; i--) {
            if (prev[i].role === 'assistant') {
              const updated = [...prev];
              updated[i] = { ...updated[i], reportCard: reportCardData };
              return updated;
            }
          }
          return prev;
        }
      });

      // 세션 메타데이터 및 메시지 reportId 저장 (세션 복원 시 사용)
      if (user?.id && currentSessionId && savedReportId) {
        // 세션 메타데이터 업데이트
        await updateChatSessionMetadata(currentSessionId, {
          gcode_report_id: savedReportId,
          gcode_report_file_name: fileName || 'analysis.gcode',
        });

        // 해당 메시지의 reportId 업데이트 (DB) - capturedDbMessageId 직접 사용 (상태 의존 제거)
        if (capturedDbMessageId) {
          console.log('[DEBUG] Updating message reportId:', { dbMessageId: capturedDbMessageId, reportId: savedReportId });
          updateMessageReportId(capturedDbMessageId, savedReportId).catch(err => {
            console.log('[DEBUG] updateMessageReportId failed:', err);
          });
        } else {
          console.log('[DEBUG] No dbMessageId available, skipping reportId update');
        }
      }

      toast({
        title: t('aiChat.analysisCompleteTitle', '분석 완료'),
        description: t('aiChat.analysisCompleteDesc', 'G-code 분석이 완료되었습니다.'),
      });
    };

    // 에러 처리 함수
    const handleAnalysisError = (errorMsg: string) => {
      setIsGcodeAnalyzing(false);

      // 폴링 중지
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      const errorMessage: Message = {
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        content: `❌ ${t('aiChat.analysisError', '분석 중 오류가 발생했습니다')}: ${errorMsg}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);

      toast({
        title: t('aiChat.analysisErrorTitle', '분석 오류'),
        description: errorMsg,
        variant: "destructive",
      });
    };

    // 폴링 함수
    const pollStatus = async () => {
      try {
        const statusResponse = await getAnalysisStatus(analysisId);
        console.log('[DEBUG] pollStatus response:', {
          status: statusResponse.status,
          progress: statusResponse.progress,
          progress_message: statusResponse.progress_message,
          timeline: statusResponse.timeline,
        });

        // 진행률 업데이트
        if (statusResponse.progress !== undefined) {
          setGcodeAnalysisProgress(Math.round(statusResponse.progress * 100));
        }

        // 진행 메시지 업데이트
        if (statusResponse.progress_message) {
          setGcodeAnalysisProgressMessage(statusResponse.progress_message);
        }

        // 타임라인 업데이트
        if (statusResponse.timeline) {
          setGcodeAnalysisTimeline(statusResponse.timeline);
        }

        // 상태에 따른 처리
        const status = statusResponse.status;
        if (status === 'completed' || status === 'done' || status === 'finished') {
          // 분석 완료
          if (statusResponse.result) {
            await handleAnalysisComplete(statusResponse.result);
          } else {
            handleAnalysisError('분석 결과가 없습니다.');
          }
        } else if (status === 'failed' || status === 'error') {
          // 분석 실패
          handleAnalysisError(statusResponse.error || '알 수 없는 오류');
        }
        // pending, running 상태면 계속 폴링
      } catch (err) {
        handleAnalysisError(err instanceof Error ? err.message : '폴링 중 오류가 발생했습니다.');
      }
    };

    // 즉시 첫 번째 폴링 실행
    pollStatus();

    // 2초마다 폴링
    pollingIntervalRef.current = setInterval(pollStatus, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentSessionId, t, toast]);

  // 분석 결과를 UI 보고서 데이터로 변환
  const convertAnalysisResultToReportData = (result: AnalysisResult, fileName?: string): GCodeAnalysisData => {
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
        grade: final_summary.overall_quality_score >= 90 ? 'A' :
          final_summary.overall_quality_score >= 75 ? 'B' :
            final_summary.overall_quality_score >= 60 ? 'C' :
              final_summary.overall_quality_score >= 40 ? 'D' : 'F',
      },
      printSpeed: {
        max: comprehensive_summary.feed_rate?.max_speed || 0,
        avg: comprehensive_summary.feed_rate?.avg_speed || 0,
        min: comprehensive_summary.feed_rate?.min_speed,
      },
      detailedAnalysis: {
        diagnosisSummary: {
          keyIssue: {
            title: final_summary.summary,
            description: final_summary.recommendation,
          },
          totalIssues: final_summary.total_issues_found,
          severity: final_summary.critical_issues > 0 ? 'critical' :
            final_summary.total_issues_found > 5 ? 'high' : 'medium',
          recommendation: final_summary.recommendation,
        },
        issueStatistics: [],
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
          all_issues: issue.all_issues,
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

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

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
    if (selectedTool === toolId) {
      // 이미 선택된 도구를 다시 클릭하면 해제
      setSelectedTool(null);
    } else {
      setSelectedTool(toolId);
    }
  };

  // AI 해결하기 시작 핸들러 (사용자 질문 메시지 추가)
  const handleAIResolveStart = useCallback((info: AIResolveStartInfo) => {
    setIsAIResolving(true);

    const userContent = `"${info.issueTitle}" 이슈를 해결해줘`;

    // 사용자 질문 메시지 추가
    const userMessage: Message = {
      id: `user-resolve-${Date.now()}`,
      role: 'user',
      content: userContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    // 로그인 사용자: DB에 저장
    if (user?.id && currentSessionId) {
      saveChatMessage(currentSessionId, user.id, 'user', userContent, {
        metadata: { tool: 'resolve_issue' },
      });
    }
  }, [user, currentSessionId]);

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

    // 코드 수정 (Git diff 스타일)
    const codeFixes = solution.code_fixes && solution.code_fixes.length > 0
      ? solution.code_fixes.filter(fix => fix.has_fix)
      : solution.code_fix?.has_fix ? [solution.code_fix] : [];

    if (codeFixes.length > 0) {
      content += `### 💻 코드 수정\n`;
      codeFixes.forEach((fix, i) => {
        if (fix.original && fix.fixed) {
          content += `**Line ${fix.line_number}**${codeFixes.length > 1 ? ` (${i + 1}/${codeFixes.length})` : ''}\n`;
          content += '```diff\n';
          // 원본 코드 (라인번호: 코드 형식에서 코드만 추출)
          const origLines = fix.original.split('\n');
          origLines.forEach(line => {
            const match = line.match(/^\d+:\s*(.*)$/);
            content += `- ${match ? match[1] : line}\n`;
          });
          // 수정 코드
          const fixedLines = fix.fixed.split('\n');
          fixedLines.forEach(line => {
            const match = line.match(/^\d+:\s*(.*)$/);
            content += `+ ${match ? match[1] : line}\n`;
          });
          content += '```\n\n';
        }
      });
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

    // AI 응답 메시지 추가
    const assistantMessage: Message = {
      id: `assistant-resolve-${Date.now()}`,
      role: 'assistant',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);

    // 로그인 사용자: DB에 저장
    if (user?.id && currentSessionId) {
      saveChatMessage(currentSessionId, user.id, 'assistant', content.trim(), {
        metadata: { tool: 'resolve_issue' },
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
                selectedModel.model === 'gemini-2.5-pro' ? 'Gemini 2.5 Pro' :
                  selectedModel.model === 'gemini-3.0-pro' ? 'Gemini 3.0 Pro' :
                    selectedModel.model === 'gpt-4o-mini' ? 'GPT-4o mini' :
                      selectedModel.model === 'gpt-4o' ? 'GPT-4o' :
                        selectedModel.model === 'gpt-5.1' ? 'GPT-5.1' :
                          selectedModel.model === 'claude-3.5-sonnet' ? 'Claude 3.5 Sonnet' :
                            selectedModel.model === 'claude-3.5-opus' ? 'Claude 3.5 Opus' :
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
                <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">{t('aiChat.paidModels', '유료 모델')}</DropdownMenuLabel>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    userPlan === 'free' ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === 'google' && selectedModel.model === 'gemini-2.5-pro' && "bg-blue-500/10"
                  )}
                  disabled={userPlan === 'free'}
                  onClick={() => userPlan !== 'free' && setSelectedModel({ provider: 'google', model: 'gemini-2.5-pro' })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">Gemini 2.5 Pro</div>
                    <div className="text-xs text-muted-foreground">{t('aiChat.fastResponse', '빠른 응답')}</div>
                  </div>
                  {selectedModel.provider === 'google' && selectedModel.model === 'gemini-2.5-pro' && <Check className="w-4 h-4 text-blue-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    userPlan === 'free' ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === 'google' && selectedModel.model === 'gemini-3.0-pro' && "bg-blue-500/10"
                  )}
                  disabled={userPlan === 'free'}
                  onClick={() => userPlan !== 'free' && setSelectedModel({ provider: 'google', model: 'gemini-3.0-pro' })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">Gemini 3.0 Pro</div>
                    <div className="text-xs text-muted-foreground">{t('aiChat.latestModel', '최신 모델')}</div>
                  </div>
                  {selectedModel.provider === 'google' && selectedModel.model === 'gemini-3.0-pro' && <Check className="w-4 h-4 text-blue-500" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* OpenAI */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={cn(
                "flex items-center gap-3 cursor-pointer rounded-xl p-3",
                selectedModel.provider === 'openai' ? "bg-emerald-500/10" : "hover:bg-muted"
              )}>
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Cpu className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">OpenAI</div>
                  <div className="text-xs text-muted-foreground">GPT 모델</div>
                </div>
                {selectedModel.provider === 'openai' && <Check className="w-4 h-4 text-emerald-500" />}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64 p-2 rounded-2xl">
                <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">{t('aiChat.freeModels', '무료 모델')}</DropdownMenuLabel>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 cursor-pointer rounded-xl p-3 hover:bg-muted",
                    selectedModel.provider === 'openai' && selectedModel.model === 'gpt-4o-mini' && "bg-emerald-500/10"
                  )}
                  onClick={() => setSelectedModel({ provider: 'openai', model: 'gpt-4o-mini' })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">GPT-4o mini</div>
                    <div className="text-xs text-muted-foreground">{t('aiChat.fastAndEfficient', '빠르고 효율적')}</div>
                  </div>
                  {selectedModel.provider === 'openai' && selectedModel.model === 'gpt-4o-mini' && <Check className="w-4 h-4 text-emerald-500" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">{t('aiChat.paidModels', '유료 모델')}</DropdownMenuLabel>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    userPlan === 'free' ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === 'openai' && selectedModel.model === 'gpt-4o' && "bg-emerald-500/10"
                  )}
                  disabled={userPlan === 'free'}
                  onClick={() => userPlan !== 'free' && setSelectedModel({ provider: 'openai', model: 'gpt-4o' })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">GPT-4o</div>
                    <div className="text-xs text-muted-foreground">{t('aiChat.mostPowerful', '가장 강력한 모델')}</div>
                  </div>
                  {selectedModel.provider === 'openai' && selectedModel.model === 'gpt-4o' && <Check className="w-4 h-4 text-emerald-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    userPlan === 'free' ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === 'openai' && selectedModel.model === 'gpt-5.1' && "bg-emerald-500/10"
                  )}
                  disabled={userPlan === 'free'}
                  onClick={() => userPlan !== 'free' && setSelectedModel({ provider: 'openai', model: 'gpt-5.1' })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">GPT-5.1</div>
                    <div className="text-xs text-muted-foreground">{t('aiChat.latestModel', '최신 모델')}</div>
                  </div>
                  {selectedModel.provider === 'openai' && selectedModel.model === 'gpt-5.1' && <Check className="w-4 h-4 text-emerald-500" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Anthropic - 유료 플랜 전용 */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={cn(
                "flex items-center gap-3 rounded-xl p-3",
                userPlan === 'free' ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                selectedModel.provider === 'anthropic' ? "bg-orange-500/10" : "hover:bg-muted"
              )}>
                <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Cpu className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">Anthropic</div>
                  <div className="text-xs text-muted-foreground">{userPlan === 'free' ? t('aiChat.paidOnly', '유료 플랜 전용') : 'Claude 모델'}</div>
                </div>
                {selectedModel.provider === 'anthropic' && <Check className="w-4 h-4 text-orange-500" />}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64 p-2 rounded-2xl">
                <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">{t('aiChat.paidModels', '유료 모델')}</DropdownMenuLabel>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    userPlan === 'free' ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === 'anthropic' && selectedModel.model === 'claude-3.5-sonnet' && "bg-orange-500/10"
                  )}
                  disabled={userPlan === 'free'}
                  onClick={() => userPlan !== 'free' && setSelectedModel({ provider: 'anthropic', model: 'claude-3.5-sonnet' })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">Claude 3.5 Sonnet</div>
                    <div className="text-xs text-muted-foreground">{t('aiChat.balancedPerformance', '균형 잡힌 성능')}</div>
                  </div>
                  {selectedModel.provider === 'anthropic' && selectedModel.model === 'claude-3.5-sonnet' && <Check className="w-4 h-4 text-orange-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    userPlan === 'free' ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === 'anthropic' && selectedModel.model === 'claude-3.5-opus' && "bg-orange-500/10"
                  )}
                  disabled={userPlan === 'free'}
                  onClick={() => userPlan !== 'free' && setSelectedModel({ provider: 'anthropic', model: 'claude-3.5-opus' })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">Claude 3.5 Opus</div>
                    <div className="text-xs text-muted-foreground">{t('aiChat.mostIntelligent', '최고 지능 모델')}</div>
                  </div>
                  {selectedModel.provider === 'anthropic' && selectedModel.model === 'claude-3.5-opus' && <Check className="w-4 h-4 text-orange-500" />}
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
        onToggle={() => setSidebarOpen(!sidebarOpen)}
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
      />

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col min-w-0 relative transition-all duration-300">
        {/* 상단 헤더 - AppHeader 재사용 */}
        <AppHeader sidebarOpen={sidebarOpen} />

        {messages.length === 0 ? (
          // Gemini 스타일 초기 화면
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            {/* 인사말 */}
            <div className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-medium text-muted-foreground mb-2 flex items-center justify-center gap-2">
                <Cpu className="w-7 h-7 text-blue-500" />
                <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent font-semibold">
                  {userName}
                </span>
                {t('aiChat.greeting', '님, 안녕하세요')}
              </h1>
              <p className="text-3xl sm:text-4xl font-bold text-foreground">
                {t('aiChat.askAnything', '3D 프린터에 대해 무엇이든 물어보세요')}
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
            </div>
          </div>
        ) : (
          // 채팅 화면 + 보고서 레이아웃
          <div className="flex-1 flex overflow-hidden h-full">
            {/* 채팅 영역 */}
            <div className={cn(
              "flex-1 flex flex-col min-w-0 transition-all duration-300",
              gcodeReportData && reportPanelOpen && "flex-[0_0_45%]"
            )}>
              <ScrollArea className="flex-1">
                <div className="py-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "w-full",
                          message.role === "user" ? "bg-transparent" : "bg-muted/30"
                        )}
                      >
                        <div className={cn(
                          "max-w-4xl mx-auto px-6 py-5",
                          message.role === "user" && "flex flex-col items-end"
                        )}>
                          {message.role === "user" ? (
                            // 사용자 메시지 - 오른쪽 정렬, 말풍선 스타일
                            <>
                              {/* 이미지 미리보기 */}
                              {message.images && message.images.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2 justify-end">
                                  {message.images.map((img, imgIdx) => (
                                    <img
                                      key={imgIdx}
                                      src={img}
                                      alt={`uploaded-${imgIdx}`}
                                      className="w-24 h-24 object-cover rounded-lg border"
                                    />
                                  ))}
                                </div>
                              )}
                              {/* 파일 미리보기 */}
                              {message.files && message.files.length > 0 && (
                                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground justify-end">
                                  <File className="w-4 h-4" />
                                  {message.files.map((f, fIdx) => (
                                    <span key={fIdx} className="bg-muted px-2 py-1 rounded">{f.name}</span>
                                  ))}
                                </div>
                              )}
                              {/* 메시지 내용 */}
                              <div className="bg-blue-100 text-blue-900 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%]">
                                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                  {message.content}
                                </div>
                              </div>
                            </>
                          ) : (
                            // AI 메시지 - 좌측 정렬, 전체 너비
                            <>
                              {/* 역할 라벨 */}
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                                  <Cpu className="w-3.5 h-3.5 text-white" />
                                </div>
                                <span className="text-sm font-semibold text-foreground">
                                  FACTOR AI
                                </span>
                              </div>
                              {/* 메시지 내용 - 마크다운 렌더링 */}
                              <div className="prose prose-sm max-w-none text-foreground pl-8 dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-ul:my-4 prose-ol:my-4 prose-li:my-1 prose-p:my-3 prose-headings:my-4 prose-headings:mt-6">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    // 제목 스타일링
                                    h1: ({ children }) => (
                                      <h1 className="text-xl font-bold mt-6 mb-4 pb-2 border-b border-border">
                                        {children}
                                      </h1>
                                    ),
                                    h2: ({ children }) => (
                                      <h2 className="text-lg font-bold mt-6 mb-3 pb-1.5 border-b border-border/50">
                                        {children}
                                      </h2>
                                    ),
                                    h3: ({ children }) => (
                                      <h3 className="text-base font-semibold mt-5 mb-3">
                                        {children}
                                      </h3>
                                    ),
                                    // 문단 스타일링 - 볼드만 있는 줄은 제목처럼 표시
                                    p: ({ children }) => {
                                      // children이 단일 strong 요소인지 확인 (볼드만 있는 줄)
                                      const childArray = Array.isArray(children) ? children : [children];
                                      const isBoldOnlyLine = childArray.length === 1 &&
                                        typeof childArray[0] === 'object' &&
                                        childArray[0] !== null &&
                                        (childArray[0] as React.ReactElement).type === 'strong';

                                      if (isBoldOnlyLine) {
                                        // 볼드만 있는 줄은 제목처럼 크게 표시
                                        return (
                                          <p className="my-4 mt-6 text-base font-bold leading-relaxed">
                                            {children}
                                          </p>
                                        );
                                      }
                                      return (
                                        <p className="my-3 leading-relaxed">
                                          {children}
                                        </p>
                                      );
                                    },
                                    // 링크 스타일링
                                    a: ({ children, href }) => (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline"
                                      >
                                        {children}
                                      </a>
                                    ),
                                    // 코드 블록 스타일링
                                    code: ({ className, children, ...props }) => {
                                      const isInline = !className;
                                      return isInline ? (
                                        <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                          {children}
                                        </code>
                                      ) : (
                                        <code className={cn("block bg-muted p-3 rounded-lg text-sm font-mono overflow-x-auto", className)} {...props}>
                                          {children}
                                        </code>
                                      );
                                    },
                                    // pre 태그 스타일링
                                    pre: ({ children }) => (
                                      <pre className="bg-muted rounded-lg overflow-x-auto my-4">
                                        {children}
                                      </pre>
                                    ),
                                    // 리스트 스타일링
                                    ul: ({ children }) => (
                                      <ul className="list-disc list-inside space-y-2 my-4">
                                        {children}
                                      </ul>
                                    ),
                                    ol: ({ children }) => (
                                      <ol className="list-decimal list-inside space-y-2 my-4">
                                        {children}
                                      </ol>
                                    ),
                                    li: ({ children }) => {
                                      // 빈 리스트 아이템 필터링 (숫자만 있는 경우)
                                      const childArray = Array.isArray(children) ? children : [children];
                                      const hasContent = childArray.some(child => {
                                        if (typeof child === 'string') return child.trim().length > 0;
                                        if (typeof child === 'object' && child !== null) return true;
                                        return false;
                                      });

                                      if (!hasContent) {
                                        return null; // 빈 아이템은 렌더링하지 않음
                                      }

                                      return (
                                        <li className="my-1.5 leading-relaxed">
                                          {children}
                                        </li>
                                      );
                                    },
                                    // 테이블 스타일링
                                    table: ({ children }) => (
                                      <div className="overflow-x-auto my-5">
                                        <table className="min-w-full border-collapse border border-border">
                                          {children}
                                        </table>
                                      </div>
                                    ),
                                    th: ({ children }) => (
                                      <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
                                        {children}
                                      </th>
                                    ),
                                    td: ({ children }) => (
                                      <td className="border border-border px-3 py-2">
                                        {children}
                                      </td>
                                    ),
                                    // 구분선 스타일링 - 간격 더 넓게
                                    hr: () => (
                                      <hr className="my-8 border-t-2 border-border/60" />
                                    ),
                                    // 인용구 스타일링
                                    blockquote: ({ children }) => (
                                      <blockquote className="border-l-4 border-primary/50 pl-4 my-5 italic text-muted-foreground bg-muted/30 py-2 rounded-r-lg">
                                        {children}
                                      </blockquote>
                                    ),
                                  }}
                                >
                                  {message.content}
                                </ReactMarkdown>
                              </div>
                              {/* 보고서 완료 카드 (Gemini 스타일) */}
                              {message.reportCard && (
                                <div className="pl-8 mt-4">
                                  <ReportCompletionCard
                                    reportId={message.reportCard.reportId}
                                    fileName={message.reportCard.fileName}
                                    completedAt={message.timestamp}
                                    overallScore={message.reportCard.overallScore}
                                    overallGrade={message.reportCard.overallGrade}
                                    totalIssues={message.reportCard.totalIssues}
                                    layerCount={message.reportCard.layerCount}
                                    printTime={message.reportCard.printTime}
                                    isOpen={reportPanelOpen && activeReportId === message.reportCard.reportId}
                                    isActive={!reportPanelOpen || activeReportId === message.reportCard.reportId}
                                    onClick={async () => {
                                      const clickedReportId = message.reportCard?.reportId;

                                      // 같은 보고서가 이미 열려있으면 닫기
                                      if (reportPanelOpen && activeReportId === clickedReportId) {
                                        setReportPanelOpen(false);
                                        setActiveReportId(null);
                                        return;
                                      }

                                      // 다른 보고서로 전환하거나 새로 열기
                                      if (clickedReportId) {
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

                                          if (segmentData && segmentData.layers && segmentData.layers.length > 0) {
                                            console.log('[ReportCard onClick] Loaded segment data, layers:', segmentData.layers.length, 'analysisId:', segmentData.analysisId);
                                            setGcodeSegments({
                                              layers: segmentData.layers,
                                              metadata: segmentData.metadata,
                                              temperatures: segmentData.temperatures,
                                            });
                                          } else {
                                            console.log('[ReportCard onClick] No segment data found for report:', clickedReportId);
                                            setGcodeSegments(null);
                                          }
                                        }
                                      }
                                    }}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}

                    {isLoading && (
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
                              {chatMode === "troubleshoot" ? t('aiChat.analyzingProblem', '문제를 분석하는 중...') :
                                chatMode === "gcode" ? t('aiChat.analyzingGcode', 'G-code를 분석하는 중...') :
                                  chatMode === "modeling" ? t('aiChat.generatingModel', '3D 모델을 생성하는 중...') :
                                    t('aiChat.thinkingText', '생각하는 중...')}
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
            {gcodeReportData && reportPanelOpen && (
              <div className="flex-[0_0_55%] bg-muted/20 flex flex-col overflow-hidden h-full pr-4 py-4">
                {/* 보고서 내용 - 높이 100% 설정 */}
                <div className="h-full">
                  <GCodeAnalysisReport
                    data={gcodeReportData}
                    onClose={() => {
                      setReportPanelOpen(false);
                      setActiveReportId(null);
                    }}
                    initialSegments={gcodeSegments || undefined}
                    onAIResolveStart={handleAIResolveStart}
                    onAIResolveComplete={handleAIResolveComplete}
                    onAIResolveError={handleAIResolveError}
                    isAIResolving={isAIResolving}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 보고서 보기 버튼 (보고서가 있고 닫혀있을 때 채팅 영역에 표시) */}
      {gcodeReportData && !reportPanelOpen && messages.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="fixed right-4 bottom-24 z-40 gap-2 bg-background shadow-lg border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950"
          onClick={() => setReportPanelOpen(true)}
        >
          <PanelRightOpen className="w-4 h-4 text-blue-500" />
          {t('aiChat.showReport', '보고서 보기')}
        </Button>
      )}

      {/* 로그인 모달 */}
      <LoginPromptModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
        title={t('auth.loginRequired', '로그인이 필요합니다')}
        description={t('auth.loginModalDescription', '로그인하시면 대화 기록 저장, 분석 히스토리 등 더 많은 기능을 이용하실 수 있습니다.')}
      />
    </div>
  );
};

export default AIChat;
