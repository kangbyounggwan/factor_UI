/**
 * 채팅 컨트롤러 훅 - 모든 채팅 관련 훅들을 조합
 *
 * 책임:
 * - 하위 훅들을 조합하여 단일 인터페이스 제공
 * - 채팅 전송 로직 orchestration
 * - 세션/메시지/권한 연동
 *
 * Usage:
 *   const chat = useChatController({ userId, userPlan });
 *   // chat.messages, chat.sendMessage, chat.composer, etc.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useChatMessages } from './useChatMessages';
import { useChatSessions } from './useChatSessions';
import { useChatPermissions } from './useChatPermissions';
import { useChatComposer } from './useChatComposer';
import { useGcodeEditor } from './useGcodeEditor';
import { useGcodeReportPanel } from './useGcodeReportPanel';
import { sendChat, type SendChatParams, type SendChatResult } from '../services';
import type { ChatTool, Message, SelectedModel } from '../types';

export interface UseChatControllerOptions {
  userId?: string;
  userPlan?: 'free' | 'starter' | 'pro' | 'enterprise';
  language?: 'ko' | 'en';
  onLoginRequired?: () => void;
}

export interface UseChatControllerReturn {
  // 메시지 상태
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;

  // 세션 상태
  sessions: ReturnType<typeof useChatSessions>['sessions'];
  currentSessionId: string | null;
  isLoadingSessions: boolean;

  // 입력 상태 (composer)
  input: string;
  setInput: (value: string) => void;
  uploadedImages: string[];
  imageFiles: File[];
  gcodeFile: File | null;
  gcodeContent: string | null;
  selectedTool: ChatTool | null;
  selectedModel: SelectedModel;

  // 권한 상태
  showLoginModal: boolean;
  isAnonymous: boolean;

  // G-code 에디터 상태
  editor: ReturnType<typeof useGcodeEditor>;

  // G-code 보고서 패널 상태
  reportPanel: ReturnType<typeof useGcodeReportPanel>;

  // 메시지 액션
  sendMessage: () => Promise<void>;
  addUserMessage: ReturnType<typeof useChatMessages>['addUserMessage'];
  addAssistantMessage: ReturnType<typeof useChatMessages>['addAssistantMessage'];
  updateMessage: ReturnType<typeof useChatMessages>['updateMessage'];
  updateMessageReportCard: ReturnType<typeof useChatMessages>['updateMessageReportCard'];
  clearMessages: ReturnType<typeof useChatMessages>['clearMessages'];
  loadSessionMessages: ReturnType<typeof useChatMessages>['loadSessionMessages'];

  // 세션 액션
  loadSessions: ReturnType<typeof useChatSessions>['loadSessions'];
  createNewSession: ReturnType<typeof useChatSessions>['createNewSession'];
  deleteSession: ReturnType<typeof useChatSessions>['deleteSession'];
  setCurrentSessionId: ReturnType<typeof useChatSessions>['setCurrentSessionId'];

  // 입력 액션 (composer)
  setSelectedTool: (tool: ChatTool | null) => void;
  setSelectedModel: (model: SelectedModel) => void;
  addImages: ReturnType<typeof useChatComposer>['addImages'];
  removeImage: ReturnType<typeof useChatComposer>['removeImage'];
  clearImages: ReturnType<typeof useChatComposer>['clearImages'];
  setGcodeFile: ReturnType<typeof useChatComposer>['setGcodeFile'];
  clearGcodeFile: ReturnType<typeof useChatComposer>['clearGcodeFile'];
  canSend: () => boolean;
  getChatMode: ReturnType<typeof useChatComposer>['getChatMode'];

  // 권한 액션
  setShowLoginModal: ReturnType<typeof useChatPermissions>['setShowLoginModal'];
  closeLoginModal: ReturnType<typeof useChatPermissions>['closeLoginModal'];

  // 전체 초기화
  resetChat: () => void;
}

/**
 * 채팅 컨트롤러 훅
 */
export function useChatController({
  userId,
  userPlan = 'free',
  language = 'ko',
  onLoginRequired,
}: UseChatControllerOptions = {}): UseChatControllerReturn {
  const { t } = useTranslation();
  const { toast } = useToast();

  // 하위 훅들 초기화
  const messagesHook = useChatMessages();
  const sessionsHook = useChatSessions({ userId });
  const permissionsHook = useChatPermissions({ userId, userPlan });
  const composerHook = useChatComposer();
  const editorHook = useGcodeEditor();
  const reportPanelHook = useGcodeReportPanel();

  // 로딩 상태
  const isLoadingRef = useRef(false);

  // 메시지 전송
  const sendMessage = useCallback(async () => {
    const {
      input,
      uploadedImages,
      imageFiles,
      gcodeFile,
      gcodeContent,
      selectedTool,
      selectedModel,
      getToolType,
      resetAfterSend,
    } = composerHook;

    const { addUserMessage, addAssistantMessage, messages } = messagesHook;
    const { ensureSession, currentSessionId, generateAndUpdateTitle } = sessionsHook;
    const { checkAndHandlePermission, incrementUsage, setShowLoginModal } = permissionsHook;

    // 전송 가능 여부 확인
    if (!input.trim() && uploadedImages.length === 0 && !gcodeFile) {
      return;
    }

    if (isLoadingRef.current) {
      return;
    }

    const toolType = getToolType();

    // 권한 체크
    const hasPermission = await checkAndHandlePermission(toolType);
    if (!hasPermission) {
      if (onLoginRequired) {
        onLoginRequired();
      }
      return;
    }

    isLoadingRef.current = true;

    try {
      // 사용자 메시지 추가
      const userMessage = addUserMessage(input, {
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
        files: gcodeFile ? [{ name: gcodeFile.name, type: 'gcode' }] : undefined,
      });

      // 세션 확보
      let sessionId = currentSessionId;
      if (userId && !sessionId) {
        sessionId = await ensureSession(toolType);
      }

      // 대화 히스토리 구성
      const conversationHistory = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // API 요청 파라미터 구성
      const params: SendChatParams = {
        message: input,
        tool: toolType,
        model: selectedModel,
        userId,
        userPlan,
        language,
        sessionId: sessionId || undefined,
        conversationHistory,
        files: {
          images: imageFiles,
          gcodeFile,
          gcodeContent: gcodeContent || undefined,
        },
      };

      // 채팅 전송
      const result: SendChatResult = await sendChat(params);

      // 응답 메시지 추가
      if (result.success && result.data) {
        addAssistantMessage(result.data.response, {
          references: result.data.references,
          referenceImages: result.data.referenceImages,
          suggestedActions: result.data.suggestedActions,
          priceComparisonData: result.data.priceComparisonData,
        });

        // 사용량 증가
        await incrementUsage(toolType, result.data.isFallback);

        // 첫 메시지인 경우 제목 생성
        if (sessionId && messages.length === 0) {
          generateAndUpdateTitle(sessionId, input);
        }
      } else {
        // 에러 메시지
        addAssistantMessage(
          result.error || t('aiChat.unknownError', '알 수 없는 오류가 발생했습니다.')
        );
      }

      // 입력 초기화
      resetAfterSend();

    } catch (error) {
      console.error('[useChatController] sendMessage error:', error);

      const errorMessage = error instanceof Error
        ? error.message
        : t('aiChat.unknownError', '알 수 없는 오류가 발생했습니다.');

      messagesHook.addAssistantMessage(
        `${t('aiChat.errorOccurred', '죄송합니다. 오류가 발생했습니다.')}\n\n**${t('common.error', '오류')}:** ${errorMessage}`
      );

      toast({
        title: t('common.error', '오류'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      isLoadingRef.current = false;
    }
  }, [
    composerHook,
    messagesHook,
    sessionsHook,
    permissionsHook,
    userId,
    userPlan,
    language,
    onLoginRequired,
    t,
    toast,
  ]);

  // 전체 초기화
  const resetChat = useCallback(() => {
    messagesHook.clearMessages();
    composerHook.clearAll();
    editorHook.resetEditor();
    reportPanelHook.resetPanel();
    sessionsHook.clearCurrentSession();
  }, [messagesHook, composerHook, editorHook, reportPanelHook, sessionsHook]);

  // 전송 가능 여부
  const canSend = useCallback(() => {
    return composerHook.canSend(isLoadingRef.current);
  }, [composerHook]);

  return {
    // 메시지 상태
    messages: messagesHook.messages,
    isLoading: isLoadingRef.current,
    isStreaming: messagesHook.isStreaming,

    // 세션 상태
    sessions: sessionsHook.sessions,
    currentSessionId: sessionsHook.currentSessionId,
    isLoadingSessions: sessionsHook.isLoadingSessions,

    // 입력 상태 (composer)
    input: composerHook.input,
    setInput: composerHook.setInput,
    uploadedImages: composerHook.uploadedImages,
    imageFiles: composerHook.imageFiles,
    gcodeFile: composerHook.gcodeFile,
    gcodeContent: composerHook.gcodeContent,
    selectedTool: composerHook.selectedTool,
    selectedModel: composerHook.selectedModel,

    // 권한 상태
    showLoginModal: permissionsHook.showLoginModal,
    isAnonymous: permissionsHook.isAnonymous,

    // G-code 에디터 상태
    editor: editorHook,

    // G-code 보고서 패널 상태
    reportPanel: reportPanelHook,

    // 메시지 액션
    sendMessage,
    addUserMessage: messagesHook.addUserMessage,
    addAssistantMessage: messagesHook.addAssistantMessage,
    updateMessage: messagesHook.updateMessage,
    updateMessageReportCard: messagesHook.updateMessageReportCard,
    clearMessages: messagesHook.clearMessages,
    loadSessionMessages: messagesHook.loadSessionMessages,

    // 세션 액션
    loadSessions: sessionsHook.loadSessions,
    createNewSession: sessionsHook.createNewSession,
    deleteSession: sessionsHook.deleteSession,
    setCurrentSessionId: sessionsHook.setCurrentSessionId,

    // 입력 액션 (composer)
    setSelectedTool: composerHook.setSelectedTool,
    setSelectedModel: composerHook.setSelectedModel,
    addImages: composerHook.addImages,
    removeImage: composerHook.removeImage,
    clearImages: composerHook.clearImages,
    setGcodeFile: composerHook.setGcodeFile,
    clearGcodeFile: composerHook.clearGcodeFile,
    canSend,
    getChatMode: composerHook.getChatMode,

    // 권한 액션
    setShowLoginModal: permissionsHook.setShowLoginModal,
    closeLoginModal: permissionsHook.closeLoginModal,

    // 전체 초기화
    resetChat,
  };
}

export default useChatController;
