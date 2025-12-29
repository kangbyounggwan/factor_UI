/**
 * 채팅 관련 타입 정의
 * AIChat 페이지 및 관련 컴포넌트에서 사용되는 공통 타입
 */

import type { ReferenceImages } from "@shared/services/chatApiService";

// ============================================================================
// 메시지 타입
// ============================================================================

/**
 * 코드 수정 정보 타입
 */
export interface CodeFixInfo {
  line_number: number | null;
  original: string | null;
  fixed: string | null;
}

/**
 * 참고 자료 타입
 */
export interface ReferenceInfo {
  title: string;
  url: string;
  source?: string;
  snippet?: string;
}

/**
 * 제안 액션 타입
 */
export interface SuggestedAction {
  label: string;
  action: string;
  data?: Record<string, unknown>;
}

/**
 * 보고서 카드 데이터
 */
export interface ReportCardData {
  reportId: string;
  fileName: string;
  overallScore?: number;
  overallGrade?: string;
  totalIssues?: number;
  layerCount?: number;
  printTime?: string;
}

/**
 * 채팅 메시지 타입
 */
export interface Message {
  id: string;
  dbMessageId?: string; // DB에 저장된 메시지 ID (reportId 업데이트용)
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: string[];
  files?: { name: string; type: string }[];
  // 보고서 완료 카드 정보
  reportCard?: ReportCardData;
  // AI 해결하기 코드 수정 정보
  codeFixes?: CodeFixInfo[];
  // 연관된 reportId (코드 수정 시 G-code 로드용)
  analysisReportId?: string;
  // G-code 컨텍스트 (코드 수정 에디터에서 사용, 앞뒤 30라인)
  gcodeContext?: string;
  // API 응답에서 받은 참고 자료
  references?: ReferenceInfo[];
  // API 응답에서 받은 제안 액션
  suggestedActions?: SuggestedAction[];
  // API 응답에서 받은 참조 이미지 (Supabase에 저장된 URL 포함)
  referenceImages?: ReferenceImages;
}

// ============================================================================
// 채팅 모드/도구 타입
// ============================================================================

/**
 * 채팅 모드 타입
 */
export type ChatMode = "general" | "troubleshoot" | "gcode" | "modeling";

/**
 * 채팅 도구 타입
 */
export type ChatToolType = "general" | "troubleshoot" | "gcode" | "modeling";

// ============================================================================
// 세션 타입
// ============================================================================

/**
 * 채팅 세션 타입
 */
export interface ChatSession {
  id: string;
  title: string;
  timestamp: Date;
  messages: Message[];
  metadata?: {
    reportId?: string;
    toolType?: ChatToolType;
    [key: string]: unknown;
  };
}

// ============================================================================
// 파일 관련 타입
// ============================================================================

/**
 * 채팅 파일 정보
 */
export interface ChatFileInfo {
  name: string;
  type: string;
  size?: number;
}

// ============================================================================
// 보고서 관련 타입
// ============================================================================

/**
 * 보고서 아카이브 아이템
 */
export interface ReportArchiveItem {
  id: string;
  fileName: string;
  overallScore?: number;
  overallGrade?: string;
  totalIssues?: number;
  createdAt: Date;
}

// ============================================================================
// AI 해결 관련 타입
// ============================================================================

/**
 * AI 해결 시작 정보
 */
export interface AIResolveStartInfo {
  reportId: string;
  issueCategory: string;
  issueDescription: string;
  lineNumbers?: number[];
}

/**
 * AI 해결 완료 정보
 */
export interface AIResolveCompleteInfo {
  success: boolean;
  fixes?: CodeFixInfo[];
  error?: string;
}

// ============================================================================
// 에디터 관련 타입
// ============================================================================

/**
 * 에디터 수정 정보
 */
export interface EditorFixInfo {
  lineNumber: number;
  original: string;
  fixed: string;
  description?: string;
}

/**
 * 패치 정보
 */
export interface PatchInfo {
  originalCode: string;
  fixedCode: string;
}

// ============================================================================
// Re-exports
// ============================================================================

export type { ReferenceImages };
