/**
 * 채팅 관련 훅 및 유틸리티 모음
 */

// 유틸리티 함수
export {
  detectToolType,
  determineChatMode,
  createUserMessage,
  createAssistantMessage,
  createErrorMessage,
  prepareFileInfos,
  canSendMessage,
  type Message,
  type ChatMode,
} from "./useChatUtils";

// 세션 관리 훅
export { useChatSession } from "./useChatSession";

// 메시지 저장 훅
export { useChatPersistence } from "./useChatPersistence";

// G-code 분석 훅
export { useChatGcodeAnalysis } from "./useChatGcodeAnalysis";
