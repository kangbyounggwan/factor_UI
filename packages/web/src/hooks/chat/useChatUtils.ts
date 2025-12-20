/**
 * 채팅 유틸리티 함수들
 * - 순수 함수로 구성되어 테스트 가능
 * - handleSend에서 추출된 로직
 */

import type { ChatToolType, ChatFileInfo } from "@shared/services/supabaseService/chat";

// 메시지 타입 정의
export interface Message {
  id: string;
  dbMessageId?: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: string[];
  files?: { name: string; type: string }[];
  reportCard?: {
    reportId: string;
    fileName: string;
    overallScore?: number;
    overallGrade?: string;
    totalIssues?: number;
    layerCount?: number;
    printTime?: string;
  };
  codeFixes?: {
    line_number: number | null;
    original: string | null;
    fixed: string | null;
  }[];
  analysisReportId?: string;
  gcodeContext?: string;
}

export type ChatMode = "general" | "troubleshoot" | "gcode" | "modeling";

/**
 * 도구 타입 결정 (순수 함수)
 */
export const detectToolType = (
  selectedTool: string | null,
  uploadedImages: string[],
  gcodeFile: File | null
): ChatToolType => {
  if (selectedTool === 'modeling') {
    return 'modeling';
  }
  if (selectedTool === 'troubleshoot' || uploadedImages.length > 0) {
    return 'troubleshoot';
  }
  if (selectedTool === 'gcode' || gcodeFile) {
    return 'gcode';
  }
  return 'general';
};

/**
 * 채팅 모드 결정 (순수 함수)
 */
export const determineChatMode = (
  selectedTool: string | null,
  images: File[],
  gcodeFile: File | null
): ChatMode => {
  if (selectedTool === "modeling") {
    return "modeling";
  }
  if (images.length > 0 || selectedTool === "troubleshoot") {
    return "troubleshoot";
  }
  if (gcodeFile || selectedTool === "gcode") {
    return "gcode";
  }
  return "general";
};

/**
 * 사용자 메시지 생성 (순수 함수)
 */
export const createUserMessage = (
  content: string,
  uploadedImages: string[],
  gcodeFile: File | null
): Message => {
  return {
    id: `user-${Date.now()}`,
    role: "user",
    content: content.trim(),
    timestamp: new Date(),
    images: uploadedImages.length > 0 ? [...uploadedImages] : undefined,
    files: gcodeFile ? [{ name: gcodeFile.name, type: "gcode" }] : undefined,
  };
};

/**
 * AI 응답 메시지 생성 (순수 함수)
 */
export const createAssistantMessage = (content: string): Message => {
  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    content,
    timestamp: new Date(),
  };
};

/**
 * 에러 메시지 생성 (순수 함수)
 */
export const createErrorMessage = (
  error: unknown,
  t: (key: string, defaultValue: string) => string
): Message => {
  const errorText = error instanceof Error ? error.message : t('aiChat.unknownError', '알 수 없는 오류');
  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    content: `${t('aiChat.errorOccurred', '죄송합니다. 오류가 발생했습니다.')}\n\n**${t('common.error', '오류')}:** ${errorText}\n\n${t('aiChat.tryAgainLater', '잠시 후 다시 시도해주세요.')}`,
    timestamp: new Date(),
  };
};

/**
 * 파일 정보 준비 (순수 함수)
 */
export const prepareFileInfos = (gcodeFile: File | null): ChatFileInfo[] | undefined => {
  if (!gcodeFile) return undefined;
  return [{ name: gcodeFile.name, type: 'gcode', size: gcodeFile.size }];
};

/**
 * 전송 가능 여부 확인 (순수 함수)
 */
export const canSendMessage = (
  input: string,
  uploadedImages: string[],
  gcodeFile: File | null,
  isLoading: boolean
): boolean => {
  const hasContent = input.trim() || uploadedImages.length > 0 || gcodeFile;
  return Boolean(hasContent) && !isLoading;
};
