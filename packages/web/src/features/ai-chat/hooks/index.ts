/**
 * AI Chat 훅 내보내기
 */

// 메시지 관리 훅
export {
  useChatMessages,
  type UseChatMessagesOptions,
  type UseChatMessagesReturn,
} from './useChatMessages';

// 세션 관리 훅
export {
  useChatSessions,
  type UseChatSessionsOptions,
  type UseChatSessionsReturn,
} from './useChatSessions';

// 권한 관리 훅
export {
  useChatPermissions,
  type UseChatPermissionsOptions,
  type UseChatPermissionsReturn,
} from './useChatPermissions';

// 입력 컴포저 훅
export {
  useChatComposer,
  type UseChatComposerOptions,
  type UseChatComposerReturn,
} from './useChatComposer';

// G-code 에디터 훅
export {
  useGcodeEditor,
  type UseGcodeEditorOptions,
  type UseGcodeEditorReturn,
} from './useGcodeEditor';

// G-code 보고서 패널 훅
export {
  useGcodeReportPanel,
  type UseGcodeReportPanelOptions,
  type UseGcodeReportPanelReturn,
} from './useGcodeReportPanel';

// 메인 컨트롤러 훅 (모든 채팅 훅 조합)
export {
  useChatController,
  type UseChatControllerOptions,
  type UseChatControllerReturn,
} from './useChatController';

// 익명 사용자 채팅 훅
export {
  useAnonChat,
  type UseAnonChatOptions,
  type UseAnonChatReturn,
} from './useAnonChat';

// G-code 통합 컨트롤러 훅
export {
  useGcodeController,
  type UseGcodeControllerOptions,
  type UseGcodeControllerReturn,
  type ReportArchiveItem,
} from './useGcodeController';
