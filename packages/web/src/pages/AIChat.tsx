/**
 * 통합 AI 채팅 페이지 (슬림 버전)
 *
 * 구조:
 * - 모든 상태/로직은 훅으로 위임
 * - 이 파일은 순수 레이아웃 + 이벤트 바인딩만 담당
 *
 * 사용 훅:
 * - useFileUpload: 파일 업로드 상태
 * - useChatSharing: 대화 공유
 * - useGcodeController: G-code 분석/에디터/보고서 전체
 * - useAnonChat: 익명 사용자 localStorage 관리
 * - useSidebarState: 사이드바 상태
 */
import { useRef, useEffect, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import { useSEO } from "@/hooks/useSEO";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Share2, Cpu, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserPlan } from "@shared/hooks/useUserPlan";
import { AppSidebar } from "@/components/common/AppSidebar";
import { AppHeader } from "@/components/common/AppHeader";
import { FilePreviewList } from "@/components/ai/FilePreviewList";
import { ChatMessage } from "@/components/ai/ChatMessage";
import { LoginPromptModal } from "@/components/auth/LoginPromptModal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  getChatMessages,
  saveChatMessage,
  createChatSession,
  updateChatSessionTitle,
  updateChatSessionToolType,
} from "@shared/services/supabaseService/chat";
import { generateChatTitle } from "@shared/services/geminiService";
import { downloadAndUploadReferenceImages } from "@shared/services/supabaseService/aiStorage";
import { supabase } from "@shared/integrations/supabase/client";
import { uploadGCodeForAnalysis } from "@/lib/gcodeAnalysisDbService";
import { saveSegmentData } from "@/lib/gcodeSegmentService";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GCodeAnalysisReport } from "@/components/ai/GCodeAnalytics";
import { WelcomeScreen } from "@/components/ai/Chat/WelcomeScreen";
import { ChatInput } from "@/components/ai/Chat/ChatInput";

// 리팩토링된 훅들
import { useFileUpload, useChatSharing, createUserMessage, createAssistantMessage, createErrorMessage } from "@/hooks/chat";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useIsMobile } from "@/hooks/use-mobile";
import { SharedBottomNavigation } from "@/components/shared/SharedBottomNavigation";

// Feature 모듈
import {
  useGcodeController,
  useAnonChat,
  useChatSessions,
  useChatMessages,
  useChatComposer,
  useChatPermissions,
  sendChat,
  type Message,
  type ChatFiles,
  type ChatRequestContext,
} from "@/features/ai-chat";

const AIChat = () => {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // SEO 메타데이터 적용
  useSEO('ai-chat');

  // 사용자 플랜
  const { plan: userPlan } = useUserPlan(user?.id);

  // === 통합 훅들 ===

  // 파일 업로드
  const fileUpload = useFileUpload();

  // 사이드바
  const sidebar = useSidebarState(false);

  // 공유
  const sharing = useChatSharing({ userId: user?.id });

  // 익명 채팅
  const anonChat = useAnonChat({ userId: user?.id });

  // 메시지 관리
  const chatMessages = useChatMessages();

  // 세션 관리
  const chatSessions = useChatSessions({ userId: user?.id });

  // 입력 컴포저
  const composer = useChatComposer();

  // 권한 관리
  const permissions = useChatPermissions({ userId: user?.id, userPlan: userPlan as 'free' | 'starter' | 'pro' | 'enterprise' });

  // G-code 통합 컨트롤러
  const gcode = useGcodeController({
    userId: user?.id,
    currentSessionId: chatSessions.currentSessionId,
    setMessages: chatMessages.loadSessionMessages as unknown as React.Dispatch<React.SetStateAction<Message[]>>,
    messagesEndRef,
  });

  // 로컬 상태 (모달 등 UI 전용)
  const [isLoading, setIsLoading] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [pendingToolId, setPendingToolId] = useState<string | null>(null);

  // === 초기화 ===

  // 세션 로드
  useEffect(() => {
    if (user?.id) {
      chatSessions.loadSessions();
    } else {
      // 익명 사용자: localStorage에서 로드
      const anonMessages = anonChat.loadAnonMessages();
      if (anonMessages.length > 0) {
        chatMessages.loadSessionMessages(anonMessages);
      }
    }
  }, [user?.id]);

  // G-code 파일 업로드 시 기본 메시지 설정
  useEffect(() => {
    if (fileUpload.gcodeFile && !composer.input) {
      composer.setInput(t('aiChat.gcodeAnalyzePrompt', '이 출력 파일 확인해줘'));
    }
  }, [fileUpload.gcodeFile]);

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.messages]);

  // === 핸들러 ===

  // 메시지 전송
  const handleSend = useCallback(async () => {
    const currentInput = composer.input.trim();
    const currentImages = [...fileUpload.imageFiles];
    const currentGcodeFile = fileUpload.gcodeFile;
    const currentGcodeContent = fileUpload.gcodeFileContent;

    if (!currentInput && fileUpload.uploadedImages.length === 0 && !currentGcodeFile) {
      return;
    }
    if (isLoading) return;

    // 도구 타입 결정
    const toolType = composer.getToolType();

    // 권한 체크
    const hasPermission = await permissions.checkAndHandlePermission(toolType);
    if (!hasPermission) return;

    setIsLoading(true);
    const isFirstMessage = chatMessages.messages.length === 0;

    try {
      // 1. 세션 확보/생성
      let sessionId = chatSessions.currentSessionId;
      if (user?.id && !sessionId) {
        const tempTitle = t('aiChat.newChat', '새 대화');
        const newSession = await createChatSession(user.id, tempTitle, toolType || 'general');
        if (newSession) {
          sessionId = newSession.id;
          chatSessions.setCurrentSessionId(newSession.id);
          chatSessions.addSession({
            id: newSession.id,
            title: newSession.title,
            timestamp: new Date(newSession.created_at),
            messages: [],
          });
        }
      } else if (user?.id && sessionId && isFirstMessage) {
        await updateChatSessionToolType(sessionId, toolType || 'general');
      }

      // 2. 사용자 메시지 생성 및 UI 반영
      const userMessage = createUserMessage(currentInput, fileUpload.uploadedImages, currentGcodeFile);
      chatMessages.addMessage(userMessage);

      // 3. 사용자 메시지 DB 저장
      if (user?.id && sessionId) {
        saveChatMessage(sessionId, user.id, 'user', currentInput, {
          images: fileUpload.uploadedImages.length > 0 ? [...fileUpload.uploadedImages] : undefined,
          files: currentGcodeFile ? [{ name: currentGcodeFile.name, type: 'gcode' }] : undefined,
          metadata: { tool: toolType },
        });
      }

      // 4. 입력 초기화
      composer.resetAfterSend();
      fileUpload.clearAllFiles();

      // 5. API 요청 컨텍스트 구성
      const contextLimit = user?.id ? 15 : 10;
      const conversationHistory = chatMessages.messages
        .slice(-contextLimit)
        .map(m => ({ role: m.role, content: m.content }));

      const context: ChatRequestContext = {
        userId: user?.id,
        userPlan: (userPlan as 'free' | 'starter' | 'pro' | 'enterprise') || 'free',
        language: i18n.language === 'ko' ? 'ko' : 'en',
        sessionId: sessionId || undefined,
        conversationHistory,
      };

      const files: ChatFiles = {
        images: currentImages,
        gcodeFile: currentGcodeFile,
      };

      // 6. Chat API 호출
      const result = await sendChat({
        tool: toolType,
        message: currentInput,
        files,
        context,
        selectedModel: composer.selectedModel.model,
      });

      // 7. 응답 처리
      if (result.success && result.result) {
        const apiResult = result.result;

        // 디버그 로그
        console.log('[AIChat] API result received:', {
          hasResponse: !!apiResult.response,
          responseLength: apiResult.response?.length,
          hasPriceComparisonData: !!apiResult.priceComparisonData,
          priceComparisonProductCount: apiResult.priceComparisonData?.products?.length,
          firstProductUrl: apiResult.priceComparisonData?.products?.[0]?.product_url,
        });

        // AI 응답 메시지 생성
        const assistantMessage = createAssistantMessage(apiResult.response, {
          references: apiResult.references,
          referenceImages: apiResult.referenceImages,
          suggestedActions: apiResult.suggestedActions,
          priceComparisonData: apiResult.priceComparisonData,
        });
        chatMessages.addMessage(assistantMessage);

        // 참조 이미지 Supabase 저장 (로그인 사용자)
        let storedReferenceImages = apiResult.referenceImages;
        if (user?.id && sessionId && apiResult.referenceImages?.images?.length) {
          try {
            const storedImages = await downloadAndUploadReferenceImages(
              supabase,
              user.id,
              sessionId,
              apiResult.referenceImages.images
            );
            storedReferenceImages = {
              search_query: apiResult.referenceImages.search_query,
              total_count: apiResult.referenceImages.total_count,
              images: storedImages.map(img => ({
                title: img.title,
                thumbnail_url: img.stored_url,
                source_url: img.source_url,
                width: img.width,
                height: img.height,
              })),
            };
            chatMessages.updateMessage(assistantMessage.id, { referenceImages: storedReferenceImages });
          } catch (e) {
            console.error('[AIChatSlim] Failed to store reference images:', e);
          }
        }

        // AI 응답 DB 저장
        let savedDbMessageId: string | null = null;
        if (user?.id && sessionId) {
          const savedMsg = await saveChatMessage(sessionId, user.id, 'assistant', apiResult.response, {
            metadata: {
              tool: toolType,
              referenceImages: storedReferenceImages,
              priceComparisonData: apiResult.priceComparisonData,
              references: apiResult.references,
              suggestedActions: apiResult.suggestedActions,
            },
          });
          if (savedMsg?.id) {
            savedDbMessageId = savedMsg.id;
            chatMessages.updateMessage(assistantMessage.id, { dbMessageId: savedMsg.id });
          }
        }

        // G-code 분석 후처리
        if (apiResult.analysisId) {
          let gcodeFileId: string | undefined;
          let storagePath: string | undefined;

          // G-code 파일 스토리지 업로드 (로그인 사용자)
          if (user?.id && currentGcodeFile) {
            try {
              const uploadResult = await uploadGCodeForAnalysis(user.id, currentGcodeFile);
              if (!uploadResult.error && uploadResult.gcodeFileId) {
                gcodeFileId = uploadResult.gcodeFileId;
                storagePath = uploadResult.storagePath;
              }
            } catch {
              // Upload failed - continue without storage
            }
          }

          // G-code 분석 시작
          gcode.startAnalysis({
            analysisId: apiResult.analysisId,
            fileName: apiResult.fileName,
            messageId: assistantMessage.id,
            dbMessageId: savedDbMessageId,
            gcodeFileId,
            storagePath,
            sessionId,
            gcodeContent: currentGcodeContent,
          });

          // 세그먼트 DB 저장
          if (user?.id && apiResult.segments) {
            saveSegmentData({
              userId: user.id,
              analysisId: apiResult.analysisId,
              segmentResponse: {
                analysis_id: apiResult.analysisId,
                status: 'segments_ready',
                segments: apiResult.segments,
                llm_analysis_started: true,
              },
            });
          }
        }

        // 세션 제목 생성 (첫 메시지)
        if (user?.id && sessionId && isFirstMessage) {
          const title = await generateChatTitle(currentInput);
          await updateChatSessionTitle(sessionId, title);
          chatSessions.updateSessionTitle(sessionId, title);
        }

        // 익명 사용자 localStorage 저장
        if (!user?.id) {
          anonChat.appendAnonMessage('user', currentInput);
          anonChat.appendAnonMessage('assistant', apiResult.response);
        }

      } else if (result.permissionDenied) {
        // 권한 거부 처리
        if (result.permissionDenied.showLoginModal) {
          permissions.setShowLoginModal(true);
        }
        toast({
          title: t('aiChat.permissionDenied', '권한 없음'),
          description: result.permissionDenied.reason || t('aiChat.upgradeRequired', '플랜 업그레이드가 필요합니다.'),
          variant: 'destructive',
        });
      } else if (result.error) {
        // 에러 처리
        const errorMsg = createErrorMessage(result.error, t);
        chatMessages.addMessage(errorMsg);

        if (user?.id && sessionId) {
          saveChatMessage(sessionId, user.id, 'assistant', errorMsg.content);
        }
      }

    } catch (error) {
      console.error('[AIChatSlim] handleSend error:', error);
      const errorMsg = createErrorMessage(error, t);
      chatMessages.addMessage(errorMsg);

      toast({
        title: t('common.error', '오류'),
        description: error instanceof Error ? error.message : t('aiChat.unknownError', '알 수 없는 오류'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [composer, fileUpload, chatMessages, chatSessions, permissions, gcode, anonChat, user?.id, userPlan, i18n.language, isLoading, toast, t]);

  // 새 채팅
  const handleNewChat = useCallback(() => {
    chatMessages.clearMessages();
    chatSessions.clearCurrentSession();
    composer.clearAll();
    fileUpload.clearAllFiles();
    gcode.resetGcode();
  }, [chatMessages, chatSessions, composer, fileUpload, gcode]);

  // 세션 로드
  const handleLoadSession = useCallback(async (session: { id: string }) => {
    if (!user?.id) return;

    const sessionId = session.id;
    chatSessions.setCurrentSessionId(sessionId);
    const messages = await getChatMessages(sessionId);

    const formattedMessages: Message[] = messages.map(m => ({
      id: m.id,
      dbMessageId: m.id,
      role: m.type === 'user' ? 'user' : 'assistant',
      content: m.content,
      timestamp: new Date(m.created_at),
      images: m.images || undefined,
      reportCard: (m.metadata as any)?.reportCard,
      codeFixes: (m.metadata as any)?.codeFixes,
      analysisReportId: (m.metadata as any)?.analysisReportId,
      gcodeContext: (m.metadata as any)?.gcodeContext,
      references: (m.metadata as any)?.references,
      referenceImages: (m.metadata as any)?.referenceImages,
      suggestedActions: (m.metadata as any)?.suggestedActions,
      priceComparisonData: (m.metadata as any)?.priceComparisonData,
    }));

    chatMessages.loadSessionMessages(formattedMessages);
  }, [user?.id, chatSessions, chatMessages]);

  // 세션 삭제
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await chatSessions.deleteSession(sessionId);
    if (chatSessions.currentSessionId === sessionId) {
      handleNewChat();
    }
  }, [chatSessions, handleNewChat]);

  // 공유
  const handleShareChat = useCallback(async () => {
    if (chatMessages.messages.length === 0) return;
    await sharing.shareChat(chatMessages.messages, {
      currentSessionId: chatSessions.currentSessionId,
      chatSessions: chatSessions.sessions,
    });
  }, [sharing, chatMessages.messages, chatSessions.currentSessionId, chatSessions.sessions]);

  // 도구 선택
  const handleToolSelect = useCallback((toolId: string | null) => {
    // 세션에 메시지가 있고 다른 도구 타입이면 새 채팅 유도
    if (chatMessages.messages.length > 0 && toolId && toolId !== composer.selectedTool) {
      setPendingToolId(toolId);
      setShowNewChatModal(true);
      return;
    }
    composer.setSelectedTool(toolId as any);
  }, [chatMessages.messages.length, composer]);

  // 새 채팅 모달 확인
  const handleStartNewChatWithTool = useCallback(() => {
    handleNewChat();
    if (pendingToolId) {
      composer.setSelectedTool(pendingToolId as any);
    }
    setShowNewChatModal(false);
    setPendingToolId(null);
  }, [handleNewChat, pendingToolId, composer]);

  // === 렌더링 ===

  const hasMessages = chatMessages.messages.length > 0;

  return (
    <div className={cn("h-screen bg-background flex", isMobile && "pb-16")}>
      {/* Hidden file inputs */}
      <input
        ref={fileUpload.fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={fileUpload.handleImageUpload}
      />
      <input
        ref={fileUpload.gcodeInputRef}
        type="file"
        accept=".gcode,.gco,.gc,.g,.nc,.ngc"
        className="hidden"
        onChange={fileUpload.handleGcodeUpload}
      />

      {/* 사이드바 */}
      {!isMobile && (
        <AppSidebar
          isOpen={sidebar.isOpen}
          onToggle={sidebar.toggle}
          sessions={chatSessions.sessions as any}
          currentSessionId={chatSessions.currentSessionId}
          onNewChat={handleNewChat}
          onLoadSession={handleLoadSession}
          onDeleteSession={handleDeleteSession}
          user={user}
          userPlan={userPlan}
          onLoginClick={() => permissions.setShowLoginModal(true)}
          onSignOut={signOut}
          mode="chat"
          reports={gcode.reportArchive as any}
          currentReportId={gcode.activeReportId}
          onSelectReport={gcode.handleSelectReport}
          onDeleteReport={gcode.handleDeleteReport}
          onViewMoreReports={gcode.handleArchiveToggle}
          archiveViewActive={gcode.archiveViewActive}
        />
      )}

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex min-w-0">
        {/* 채팅 영역 */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300",
          gcode.reportPanelOpen && "flex-[0_0_48%]"
        )}>
          {/* 헤더 */}
          <AppHeader
            sidebarOpen={sidebar.isOpen}
            onLoginRequired={() => permissions.setShowLoginModal(true)}
            rightContent={
              hasMessages && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShareChat}
                  disabled={sharing.isSharing}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  {sharing.isSharing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">{t('aiChat.share', '공유')}</span>
                </Button>
              )
            }
          />

          {/* 메시지 영역 */}
          <ScrollArea className="flex-1 w-full">
            <div className={cn(
              "flex flex-col w-full h-full",
              !hasMessages && "min-h-[calc(100vh-64px-64px)] justify-center",
              isMobile && !hasMessages && "min-h-[calc(100vh-56px-64px)]"
            )}>
              {!hasMessages ? (
                <WelcomeScreen
                  uploadedImages={fileUpload.uploadedImages}
                  gcodeFile={fileUpload.gcodeFile}
                  onRemoveImage={fileUpload.removeImage}
                  onRemoveGcode={fileUpload.removeGcodeFile}
                  selectedTool={composer.selectedTool}
                  setSelectedTool={handleToolSelect}
                  setInput={composer.setInput}
                  user={user}
                  onLoginRequired={() => permissions.setShowLoginModal(true)}
                  renderInputBox={(placeholder) => (
                    <ChatInput
                      input={composer.input}
                      setInput={composer.setInput}
                      isLoading={isLoading}
                      isDragging={fileUpload.isDragging}
                      uploadedImages={fileUpload.uploadedImages}
                      gcodeFile={fileUpload.gcodeFile}
                      selectedTool={composer.selectedTool}
                      setSelectedTool={handleToolSelect as any}
                      selectedModel={composer.selectedModel as any}
                      setSelectedModel={composer.setSelectedModel}
                      user={user}
                      userPlan={userPlan}
                      onSend={handleSend}
                      onLoginRequired={() => permissions.setShowLoginModal(true)}
                      fileInputRef={fileUpload.fileInputRef}
                      gcodeInputRef={fileUpload.gcodeInputRef}
                      onDragOver={fileUpload.handleDragOver}
                      onDragEnter={fileUpload.handleDragEnter}
                      onDragLeave={fileUpload.handleDragLeave}
                      onDrop={fileUpload.handleDrop}
                      onPaste={fileUpload.handlePaste}
                      placeholder={placeholder}
                    />
                  )}
                />
              ) : (
                <div className="flex-1">
                  {chatMessages.messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      message={message as any}
                      onCodeFixClick={(fix) => gcode.handleViewCodeFix(fix as any, chatMessages.messages)}
                      reportPanelOpen={gcode.reportPanelOpen}
                      activeReportId={gcode.activeReportId}
                      onRevert={(lineNumber) => gcode.handleRevert(lineNumber)}
                      onReportCardClick={gcode.handleReportCardClick}
                      onSuggestedAction={(action) => {
                        if (action.action === 'follow_up' && action.data?.question) {
                          composer.setInput(action.data.question as string);
                        }
                      }}
                    />
                  ))}

                  {/* 로딩 표시 */}
                  {(isLoading || gcode.isAIResolving) && (
                    <div className="bg-muted/30 w-full">
                      <div className="max-w-4xl mx-auto px-6 py-5">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                            <Cpu className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-sm font-semibold">FACTOR AI</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground pl-8">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">{t('aiChat.thinkingText', '생각하는 중...')}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* G-code 분석 진행률 */}
                  {gcode.isAnalyzing && (
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
                            {gcode.analysisProgress}%
                          </span>
                        </div>
                        <Progress value={gcode.analysisProgress} className="h-2 ml-8" />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </ScrollArea>

          {/* 하단 입력창 */}
          {hasMessages && (
            <div className="shrink-0 bg-background/95 backdrop-blur">
              <div className="max-w-4xl mx-auto px-6 py-4">
                <FilePreviewList
                  images={fileUpload.uploadedImages}
                  gcodeFile={fileUpload.gcodeFile}
                  onRemoveImage={fileUpload.removeImage}
                  onRemoveGcode={fileUpload.removeGcodeFile}
                  className="mb-3"
                />
                <ChatInput
                  input={composer.input}
                  setInput={composer.setInput}
                  isLoading={isLoading}
                  isDragging={fileUpload.isDragging}
                  uploadedImages={fileUpload.uploadedImages}
                  gcodeFile={fileUpload.gcodeFile}
                  selectedTool={composer.selectedTool}
                  setSelectedTool={handleToolSelect as any}
                  selectedModel={composer.selectedModel}
                  setSelectedModel={composer.setSelectedModel}
                  user={user}
                  userPlan={userPlan}
                  onSend={handleSend}
                  onLoginRequired={() => permissions.setShowLoginModal(true)}
                  fileInputRef={fileUpload.fileInputRef}
                  gcodeInputRef={fileUpload.gcodeInputRef}
                  onDragOver={fileUpload.handleDragOver}
                  onDragEnter={fileUpload.handleDragEnter}
                  onDragLeave={fileUpload.handleDragLeave}
                  onDrop={fileUpload.handleDrop}
                  onPaste={fileUpload.handlePaste}
                />
              </div>
            </div>
          )}
        </div>

        {/* G-code 보고서 패널 */}
        {(gcode.isAnalyzing || gcode.reportPanelOpen) && (
          <div className="flex-[0_0_52%] w-full bg-muted/20 flex flex-col overflow-hidden h-full pr-4 py-4">
            {(gcode.isAnalyzing || (gcode.reportPanelOpen && !gcode.reportData)) ? (
              <div className="h-full rounded-2xl overflow-hidden bg-background border flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <div className="text-center">
                    <p className="text-lg font-medium">{t('aiChat.analyzingGcode', 'G-code 분석 중...')}</p>
                    {gcode.analysisProgressMessage && (
                      <p className="text-sm text-muted-foreground mt-1">{gcode.analysisProgressMessage}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : gcode.reportData && (
              <div className="h-full rounded-2xl overflow-hidden">
                <GCodeAnalysisReport
                  data={gcode.reportData}
                  embedded={true}
                  onClose={gcode.closeReportPanel}
                  initialSegments={gcode.segmentData || undefined}
                  onAIResolveStart={gcode.handleAIResolveStart}
                  onAIResolveComplete={gcode.handleAIResolveComplete}
                  onAIResolveError={gcode.handleAIResolveError}
                  isAIResolving={gcode.isAIResolving}
                  activeTab={gcode.reportPanelTab}
                  onTabChange={gcode.setReportPanelTab}
                  editorContent={gcode.editorContent}
                  editorLoading={gcode.editorLoading}
                  editorFixInfo={gcode.editorFixInfo}
                  onEditorApplyFix={gcode.handleApplyFix}
                  appliedPatchCount={gcode.resolvedLines.size}
                  revertLineNumber={gcode.revertLineNumber}
                  onSaveModifiedGCode={gcode.handleSaveModifiedGCode}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 모달들 */}
      <LoginPromptModal
        open={permissions.showLoginModal}
        onOpenChange={permissions.setShowLoginModal}
      />

      {/* 새 채팅 유도 모달 */}
      <Dialog open={showNewChatModal} onOpenChange={setShowNewChatModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('aiChat.newChatRequired', '새 채팅 필요')}</DialogTitle>
            <DialogDescription>
              {t('aiChat.newChatRequiredDesc', '다른 도구를 사용하려면 새 채팅을 시작해야 합니다.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewChatModal(false)}>
              {t('common.cancel', '취소')}
            </Button>
            <Button onClick={handleStartNewChatWithTool}>
              {t('aiChat.startNewChat', '새 채팅 시작')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 공유 모달 */}
      <Dialog open={sharing.showShareModal} onOpenChange={sharing.setShowShareModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('aiChat.shareChat', '대화 공유')}</DialogTitle>
          </DialogHeader>
          {sharing.shareUrl && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded">
              <input
                type="text"
                value={sharing.shareUrl}
                readOnly
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <Button size="sm" onClick={sharing.copyShareUrl}>
                {t('common.copy', '복사')}
              </Button>
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
