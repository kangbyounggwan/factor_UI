/**
 * 채팅 관련 훅 및 유틸리티 모음
 *
 * 리팩토링된 구조:
 * - useChatUtils: 순수 유틸리티 함수 (detectToolType, createMessage 등)
 * - useChatSession: 세션 관리 로직
 * - useChatPersistence: 메시지 저장 로직
 * - useChatGcodeAnalysis: G-code 분석 후처리
 * - useFileUpload: 파일 업로드 관리 (이미지, G-code)
 * - useChatSharing: 대화 공유 기능
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
  type ReferenceInfo,
  type SuggestedAction,
} from "./useChatUtils";

// 세션 관리 훅
export { useChatSession } from "./useChatSession";

// 메시지 저장 훅
export { useChatPersistence } from "./useChatPersistence";

// G-code 분석 훅
export { useChatGcodeAnalysis } from "./useChatGcodeAnalysis";

// 파일 업로드 훅
export {
  useFileUpload,
  type UseFileUploadOptions,
  type UseFileUploadReturn,
} from "./useFileUpload";

// 대화 공유 훅
export {
  useChatSharing,
  type UseChatSharingOptions,
  type UseChatSharingReturn,
} from "./useChatSharing";
