/**
 * 모바일 AI Chat 페이지
 * - 출력 문제 해결 도우미
 * - 모바일 최적화 UI (로고 없음, 하단 고정 입력창)
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { PlatformHeader } from "@/components/PlatformHeader";
import { useSafeAreaStyle, useKeyboardVisible } from "@/hooks/usePlatform";
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import {
  Send,
  Cpu,
  Loader2,
  X,
  Plus,
  Settings2,
  ChevronDown,
  ImageIcon,
  FileCode2,
  Stethoscope,
  Sparkles,
  Menu,
  Activity,
  Trash2,
  MessageSquarePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMessage, LoadingMessage, type ChatMessageData, type ReferenceInfo, type SuggestedAction } from "@/components/ai/ChatMessage";
import {
  sendChatMessage,
  formatChatResponse,
  type ChatApiRequest,
  type ChatApiResponse,
} from "@shared/services/chatApiService";
import { useUserPlan } from "@shared/hooks/useUserPlan";
import {
  checkUsageLimit,
  incrementUsage,
  checkAnonymousUsage,
  incrementAnonymousUsage,
} from "@shared/utils/subscription";
import { USAGE_TYPES } from "@shared/types/subscription";
import {
  getChatSessions,
  getChatMessages,
  createChatSession,
  saveChatMessage,
  deleteChatSession,
  type ChatSession,
  type ChatToolType,
} from "@shared/services/supabaseService/chat";

// 메시지 타입 (ChatMessageData 확장)
interface Message extends ChatMessageData {
  // ChatMessageData와 동일한 타입 사용
}

// 도구 정의
const tools = [
  {
    id: 'troubleshoot',
    label: '프린터 문제 진단',
    icon: Stethoscope,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    description: '출력 문제 사진을 보여주시면 원인과 해결책을 알려드려요',
  },
  {
    id: 'gcode',
    label: 'G-code 분석',
    icon: FileCode2,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
    description: 'G-code 파일을 분석하고 최적화 방법을 알려드려요',
  },
  {
    id: 'modeling',
    label: '3D 모델링',
    icon: Sparkles,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/10',
    description: '텍스트나 이미지로 3D 모델을 생성해요',
    navigateTo: '/create',
  },
];

const AIChat = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [showToolSheet, setShowToolSheet] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedModel] = useState({ provider: 'google', model: 'gemini-2.5-flash-lite' });

  // 채팅 세션 관리
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 키보드 상태 감지
  const isKeyboardVisible = useKeyboardVisible();

  // Safe Area 스타일
  const safeAreaStyle = useSafeAreaStyle({ bottom: false });

  // 입력창 하단 패딩 (키보드 상태에 따라)
  // BottomNavigation 높이(4rem = 64px) + safe area 고려
  const inputAreaStyle: React.CSSProperties = {
    paddingBottom: isKeyboardVisible
      ? '0.5rem'
      : 'calc(0.5rem + 4rem + env(safe-area-inset-bottom, 0px))',
  };

  // 사용자 플랜 정보
  const { plan: userPlan } = useUserPlan(user?.id);

  // 현재 선택된 도구 정보
  const currentTool = tools.find(t => t.id === selectedTool);

  // 스크롤 맨 아래로
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  // 메시지 변경 시 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 채팅 세션 로드
  const loadChatSessions = useCallback(async () => {
    if (!user?.id) return;

    setIsLoadingSessions(true);
    try {
      const sessions = await getChatSessions(user.id, 20);
      setChatSessions(sessions);
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [user?.id]);

  // 세션 메시지 로드
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      const chatMessages = await getChatMessages(sessionId);
      const formattedMessages: Message[] = chatMessages.map(msg => ({
        id: msg.id,
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: new Date(msg.created_at),
        images: msg.images,
      }));
      setMessages(formattedMessages);
      setCurrentSessionId(sessionId);
      setShowSidebar(false);
    } catch (error) {
      console.error('Failed to load session messages:', error);
    }
  }, []);

  // 사용자 로그인 시 세션 로드
  useEffect(() => {
    if (user?.id) {
      loadChatSessions();
    }
  }, [user?.id, loadChatSessions]);

  // Textarea 자동 높이 조절
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  // 이미지 업로드 (카메라 or 갤러리)
  const handleImageCapture = async (source: 'camera' | 'gallery') => {
    try {
      if (Capacitor.isNativePlatform()) {
        const photo = await CapacitorCamera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        });

        if (photo.base64String) {
          const dataUrl = `data:image/${photo.format};base64,${photo.base64String}`;
          setUploadedImages(prev => [...prev, dataUrl]);
          // 이미지 업로드 시 자동으로 문제 진단 도구 선택
          if (!selectedTool) {
            setSelectedTool('troubleshoot');
          }
        }
      } else {
        // 웹 환경에서는 파일 선택
        fileInputRef.current?.click();
      }
    } catch (error) {
      console.error('Image capture error:', error);
    }
  };

  // 웹 파일 업로드
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setUploadedImages(prev => [...prev, event.target!.result as string]);
            if (!selectedTool) {
              setSelectedTool('troubleshoot');
            }
          }
        };
        reader.readAsDataURL(file);
      }
    });

    e.target.value = '';
  };

  // 이미지 제거
  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  // 메시지 전송
  const handleSend = async () => {
    if ((!input.trim() && uploadedImages.length === 0) || isLoading) return;

    // 사용량 체크
    if (user?.id) {
      const canUse = await checkUsageLimit(user.id, USAGE_TYPES.AI_CHAT, userPlan || 'free');
      if (!canUse) {
        toast({
          title: t('aiChat.usageLimitReached', '사용량 한도 도달'),
          description: t('aiChat.upgradeForMore', '더 많은 사용을 위해 요금제를 업그레이드하세요'),
          variant: 'destructive',
        });
        return;
      }
    } else {
      const canUse = await checkAnonymousUsage('ai_chat');
      if (!canUse) {
        toast({
          title: t('aiChat.loginRequired', '로그인이 필요합니다'),
          description: t('aiChat.loginForMore', '더 많은 대화를 위해 로그인해주세요'),
          variant: 'destructive',
        });
        return;
      }
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
      images: uploadedImages.length > 0 ? [...uploadedImages] : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setUploadedImages([]);
    setIsLoading(true);

    // 세션 관리 (로그인 사용자만)
    let sessionId = currentSessionId;
    if (user?.id && !sessionId) {
      // 새 세션 생성
      const toolType = (selectedTool as ChatToolType) || 'general';
      const session = await createChatSession(user.id, input.slice(0, 50) || '새 대화', toolType);
      if (session) {
        sessionId = session.id;
        setCurrentSessionId(session.id);
        setChatSessions(prev => [session, ...prev]);
      }
    }

    try {
      // 사용자 메시지 저장 (로그인 사용자만)
      if (user?.id && sessionId) {
        await saveChatMessage(sessionId, user.id, 'user', input, {
          images: uploadedImages.length > 0 ? uploadedImages : undefined,
        });
      }

      // API 요청 구성 - 모바일에서는 이미지가 dataURL 형태로 저장되므로 직접 변환
      const attachments = uploadedImages.length > 0
        ? uploadedImages.map((dataUrl, index) => ({
            type: 'image' as const,
            content: dataUrl.split(',')[1] || dataUrl,  // base64 부분만 추출
            filename: `image_${index}.jpg`,
            mime_type: dataUrl.match(/data:(.*?);/)?.[1] || 'image/jpeg',
          }))
        : undefined;

      const request: ChatApiRequest = {
        user_id: user?.id,
        user_plan: (userPlan as 'free' | 'starter' | 'pro' | 'enterprise') || 'free',
        message: input,
        selected_tool: selectedTool as any,
        selected_model: selectedModel.model,
        attachments,
        language: i18n.language === 'ko' ? 'ko' : 'en',
      };

      const response = await sendChatMessage(request);
      const formattedContent = formatChatResponse(response);

      // 참조 정보 변환
      const references: ReferenceInfo[] | undefined = response.references?.map(ref => ({
        title: ref.title,
        url: ref.url,
        source: ref.source,
        snippet: ref.snippet,
      }));

      // 제안 액션 변환
      const suggestedActions: SuggestedAction[] | undefined = response.suggested_actions?.map(action => ({
        label: action.label,
        action: action.action,
        data: action.data,
      }));

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: formattedContent,
        timestamp: new Date(),
        references,
        suggestedActions,
        referenceImages: response.reference_images,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // AI 응답 저장 (로그인 사용자만)
      if (user?.id && sessionId) {
        await saveChatMessage(sessionId, user.id, 'assistant', formattedContent);
      }

      // 사용량 증가
      if (user?.id) {
        await incrementUsage(user.id, USAGE_TYPES.AI_CHAT, userPlan || 'free');
      } else {
        await incrementAnonymousUsage('ai_chat');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: t('aiChat.errorMessage', '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.'),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 키보드 Enter 처리
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 빠른 질문 버튼 클릭
  const handleQuickPrompt = (prompt: string, tool?: string) => {
    if (tool) setSelectedTool(tool);
    setInput(prompt);
    textareaRef.current?.focus();
  };

  // 도구 선택
  const handleToolSelect = (toolId: string) => {
    const tool = tools.find(t => t.id === toolId);

    // navigateTo가 있는 도구는 해당 페이지로 이동
    if (tool && 'navigateTo' in tool && tool.navigateTo) {
      setShowToolSheet(false);
      navigate(tool.navigateTo);
      return;
    }

    setSelectedTool(toolId === selectedTool ? null : toolId);
    setShowToolSheet(false);
  };

  // 제안 액션 처리
  const handleSuggestedAction = (action: SuggestedAction) => {
    if (action.action === 'follow_up' && action.data?.prompt) {
      setInput(action.data.prompt as string);
      textareaRef.current?.focus();
    } else if (action.action === 'open_link' && action.data?.url) {
      window.open(action.data.url as string, '_blank');
    }
  };

  // 새 대화 시작
  const handleNewChat = () => {
    setMessages([]);
    setInput('');
    setUploadedImages([]);
    setSelectedTool(null);
    setCurrentSessionId(null);
    setShowSidebar(false);
  };

  // 세션 삭제
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteChatSession(sessionId);
      setChatSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        handleNewChat();
      }
      toast({
        title: t('aiChat.sessionDeleted', '대화가 삭제되었습니다'),
      });
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast({
        title: t('aiChat.sessionDeleteError', '삭제 실패'),
        variant: 'destructive',
      });
    }
  };

  // 상대 시간 포맷
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('aiChat.justNow', '방금 전');
    if (diffMins < 60) return t('aiChat.minutesAgo', '{{count}}분 전', { count: diffMins });
    if (diffHours < 24) return t('aiChat.hoursAgo', '{{count}}시간 전', { count: diffHours });
    if (diffDays < 7) return t('aiChat.daysAgo', '{{count}}일 전', { count: diffDays });
    return date.toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 상단 헤더 - 로고 + 메뉴 */}
      <PlatformHeader sticky={false} className="border-b">
        <div className="flex items-center">
          {/* 메뉴 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSidebar(true)}
            className="h-9 w-9 -ml-1"
          >
            <Menu className="w-5 h-5" />
          </Button>
          {/* 로고 - 웹과 동일 스타일 */}
          <div className="flex items-center gap-2 ml-2">
            <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-orbitron text-primary tracking-wide">
              FACTOR
            </span>
          </div>
        </div>
      </PlatformHeader>

      {/* 메인 콘텐츠 */}
      {messages.length === 0 ? (
        // 초기 화면 - 중앙 정렬 (BottomNavigation 높이 고려)
        <div
          className="flex-1 flex flex-col px-4 justify-center"
          style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {/* 인사말 */}
          <div className="text-center mb-6">
            {/* 스타카토 애니메이션 */}
            <div className="flex justify-center gap-1.5 mb-4">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2 whitespace-pre-line">
              {t('aiChat.askAnything', '출력 문제가 생겼나요? 뭔가\n이상하다면')}
            </h1>
            <p className="text-base text-muted-foreground">
              {t('aiChat.greeting', '지금 어떤 문제가 생겼는지 그대로 보여주세요')}
            </p>
          </div>

          {/* 입력창 */}
          <div className="w-full mb-4">
            {/* 업로드된 이미지 미리보기 */}
            {uploadedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 px-2">
                {uploadedImages.map((img, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => removeImage(idx)}
                      className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-muted/50 rounded-2xl border border-border overflow-hidden">
              <div className="relative flex items-end">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('aiChat.placeholder', 'FACTOR AI에게 물어보세요')}
                  className="flex-1 min-h-[44px] max-h-[120px] py-3 px-4 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
                  rows={1}
                />
                <div className="flex items-center gap-1 pr-2 pb-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "shrink-0 rounded-full h-9 w-9",
                      (input.trim() || uploadedImages.length > 0)
                        ? "text-primary"
                        : "text-muted-foreground/50"
                    )}
                    disabled={(!input.trim() && uploadedImages.length === 0) || isLoading}
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

              {/* 하단 도구바 */}
              <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
                {/* 이미지 추가 버튼 */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => handleImageCapture('gallery')}
                >
                  <Plus className="w-5 h-5 text-muted-foreground" />
                </Button>

                {/* 도구 선택 */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 px-3 rounded-full text-sm gap-1.5",
                    currentTool
                      ? `${currentTool.bgColor} ${currentTool.color}`
                      : "text-muted-foreground"
                  )}
                  onClick={() => setShowToolSheet(true)}
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
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>

                {selectedTool && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => setSelectedTool(null)}
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </Button>
                )}

                <div className="flex-1" />

                {/* 모델 표시 */}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5" />
                  Gemini 2.5 Flash Lite
                </span>
              </div>
            </div>
          </div>

          {/* 빠른 질문 버튼들 */}
          <div className="flex flex-col items-center gap-2 pb-4">
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => handleQuickPrompt(t('aiChat.quickPrompt.gcodeCheck', 'G-code 문제 확인해줘'), 'gcode')}
                className="px-3 py-1.5 text-sm bg-blue-500/10 hover:bg-blue-500/20 rounded-full border border-blue-500/30 text-blue-600 dark:text-blue-400"
              >
                {t('aiChat.quickPrompt.gcodeCheck', 'G-code 문제 확인해줘')}
              </button>
              <button
                onClick={() => handleQuickPrompt(t('aiChat.quickPrompt.stringing', '실 같은 게 달려있어요'), 'troubleshoot')}
                className="px-3 py-1.5 text-sm bg-emerald-500/10 hover:bg-emerald-500/20 rounded-full border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              >
                {t('aiChat.quickPrompt.stringing', '실 같은 게 달려있어요')}
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => handleQuickPrompt(t('aiChat.quickPrompt.warping', '베드에서 떨어져요'), 'troubleshoot')}
                className="px-3 py-1.5 text-sm bg-emerald-500/10 hover:bg-emerald-500/20 rounded-full border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              >
                {t('aiChat.quickPrompt.warping', '베드에서 떨어져요')}
              </button>
              <button
                onClick={() => navigate('/create', { state: { prompt: t('aiChat.quickPrompt.modeling', '스마트폰 거치대 만들어줘') } })}
                className="px-3 py-1.5 text-sm bg-purple-500/10 hover:bg-purple-500/20 rounded-full border border-purple-500/30 text-purple-600 dark:text-purple-400"
              >
                {t('aiChat.quickPrompt.modeling', '스마트폰 거치대 만들어줘')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        // 채팅 화면
        <div className="flex-1 flex flex-col min-h-0">
          {/* 메시지 목록 */}
          <ScrollArea ref={scrollAreaRef} className="flex-1">
            <div className="px-4 py-4 space-y-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onSuggestedAction={handleSuggestedAction}
                />
              ))}
              {isLoading && <LoadingMessage />}
            </div>
          </ScrollArea>

          {/* 하단 입력창 */}
          <div className="flex-shrink-0 border-t bg-background px-4 pt-2" style={inputAreaStyle}>
            {/* 업로드된 이미지 미리보기 */}
            {uploadedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {uploadedImages.map((img, idx) => (
                  <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => removeImage(idx)}
                      className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full"
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-muted/50 rounded-2xl border border-border overflow-hidden">
              <div className="relative flex items-end">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('aiChat.placeholder', 'FACTOR AI에게 물어보세요')}
                  className="flex-1 min-h-[40px] max-h-[100px] py-2.5 px-4 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                  rows={1}
                />
                <div className="flex items-center gap-1 pr-2 pb-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full"
                    onClick={() => handleImageCapture('gallery')}
                  >
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "shrink-0 rounded-full h-8 w-8",
                      (input.trim() || uploadedImages.length > 0)
                        ? "text-primary"
                        : "text-muted-foreground/50"
                    )}
                    disabled={(!input.trim() && uploadedImages.length === 0) || isLoading}
                    onClick={handleSend}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 도구 선택 Sheet - 네이티브 스타일 둥근 모달 */}
      {showToolSheet && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setShowToolSheet(false)}
          />
          {/* 모달 */}
          <div
            className="fixed left-0 right-0 z-50 bg-background rounded-t-3xl px-4 pt-2 pb-3 shadow-xl animate-in slide-in-from-bottom duration-200"
            style={{
              bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))'
            }}
          >
            {/* 드래그 핸들 */}
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* 도구 목록 - 가로 배치 */}
            <div className="flex justify-center gap-4">
              {tools.map((tool) => {
                const Icon = tool.icon;
                const isSelected = selectedTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleToolSelect(tool.id)}
                    className="flex flex-col items-center gap-1.5 p-2 min-w-[80px]"
                  >
                    <div className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center transition-all",
                      isSelected
                        ? `${tool.bgColor} ring-2 ring-offset-2 ring-offset-background`
                        : tool.bgColor,
                      isSelected && tool.id === 'troubleshoot' && 'ring-emerald-500',
                      isSelected && tool.id === 'gcode' && 'ring-blue-500',
                      isSelected && tool.id === 'modeling' && 'ring-purple-500'
                    )}>
                      <Icon className={cn("w-8 h-8", tool.color)} />
                    </div>
                    <span className={cn(
                      "text-xs font-medium text-center leading-tight",
                      isSelected ? tool.color : "text-muted-foreground"
                    )}>
                      {tool.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* 사이드바 메뉴 */}
      {showSidebar && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowSidebar(false)}
          />
          {/* 사이드바 */}
          <div
            className="fixed top-0 left-0 bottom-0 w-72 bg-background z-50 shadow-2xl animate-in slide-in-from-left duration-200 flex flex-col"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            {/* 사이드바 헤더 - 닫기 버튼 + 새 대화 */}
            <div className="flex items-center justify-between px-3 py-3 border-b">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSidebar(false)}
                className="h-9 w-9"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewChat}
                className="h-9 w-9"
              >
                <MessageSquarePlus className="w-5 h-5" />
              </Button>
            </div>

            {/* 최근 대화 목록 */}
            <div className="flex-1 overflow-y-auto">
              <div className="text-xs font-medium text-muted-foreground px-4 py-2">
                {t('aiChat.recentChats', '최근 대화')}
              </div>

              {!user ? (
                <div className="text-sm text-muted-foreground text-center py-8 px-4">
                  {t('aiChat.loginRequired', '로그인하면 대화 기록이 저장됩니다')}
                </div>
              ) : isLoadingSessions ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : chatSessions.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8 px-4">
                  {t('aiChat.noRecentChats', '최근 대화가 없습니다')}
                </div>
              ) : (
                <div className="space-y-1 px-2">
                  {chatSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => loadSessionMessages(session.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors group",
                        currentSessionId === session.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {session.title || t('aiChat.newChat', '새 대화')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatRelativeTime(session.last_message_at || session.created_at)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 하단 메뉴 */}
            <div className="border-t p-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
              <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                <Cpu className="w-4 h-4" />
                <span>Gemini 2.5 Flash Lite</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIChat;
