/**
 * AI Chat 기능의 모든 타입 정의
 *
 * 중앙화된 타입 관리로 일관성 유지
 */

import type { PriceComparisonData } from '@shared/services/chatApiService';

// ============================================
// 기본 타입
// ============================================

/** 채팅 도구 타입 */
export type ChatTool = 'general' | 'gcode' | 'troubleshoot' | 'modeling' | 'price_comparison' | 'resolve_issue';

/** 채팅 모드 (UI 상태용) */
export type ChatMode = 'general' | 'troubleshoot' | 'gcode' | 'modeling';

/** AI 모델 선택 */
export interface SelectedModel {
  provider: 'google' | 'anthropic' | 'openai';
  model: string;
}

// ============================================
// 메시지 관련 타입
// ============================================

/** 코드 수정 정보 */
export interface CodeFixInfo {
  line_number: number | null;
  original: string | null;
  fixed: string | null;
}

/** 참고 자료 */
export interface ReferenceInfo {
  title: string;
  url: string;
  source?: string;
  snippet?: string;
}

/** 제안 액션 */
export interface SuggestedAction {
  label: string;
  action: string;
  data?: Record<string, unknown>;
}

/** 참조 이미지 */
export interface ReferenceImages {
  search_query?: string;
  total_count?: number;
  images: Array<{
    title: string;
    thumbnail_url: string;
    source_url: string;
    width?: number;
    height?: number;
  }>;
}

/** 보고서 카드 정보 */
export interface ReportCard {
  reportId: string;
  fileName: string;
  overallScore?: number;
  overallGrade?: string;
  totalIssues?: number;
  layerCount?: number;
  printTime?: string;
}

/** ReportCard 별칭 (훅에서 사용) */
export type ReportCardData = ReportCard;

/** CodeFix 별칭 (훅에서 사용) */
export type CodeFix = CodeFixInfo;

/** 채팅 메시지 */
export interface Message {
  id: string;
  dbMessageId?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  images?: string[];
  files?: { name: string; type: string }[];
  // G-code 분석 관련
  reportCard?: ReportCard;
  codeFixes?: CodeFixInfo[];
  analysisReportId?: string;
  gcodeContext?: string;
  // API 응답 데이터
  references?: ReferenceInfo[];
  suggestedActions?: SuggestedAction[];
  referenceImages?: ReferenceImages;
  priceComparisonData?: PriceComparisonData;
}

// ============================================
// 세션 관련 타입
// ============================================

/** 채팅 세션 */
export interface ChatSession {
  id: string;
  title: string;
  timestamp: Date;
  messages: Message[];
  toolType?: ChatTool;
  metadata?: Record<string, unknown>;
}

/** 보고서 아카이브 아이템 */
export interface ReportArchiveItem {
  id: string;
  fileName: string;
  overallScore?: number;
  overallGrade?: string;
  totalIssues?: number;
  createdAt: Date;
}

// ============================================
// API 관련 타입
// ============================================

/** 채팅 API 요청 컨텍스트 */
export interface ChatRequestContext {
  userId?: string;
  userPlan: 'free' | 'starter' | 'pro' | 'enterprise';
  language: 'ko' | 'en';
  sessionId?: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/** 채팅 파일 정보 */
export interface ChatFiles {
  images: File[];
  gcodeFile: File | null;
}

/** 채팅 API 결과 */
export interface ChatApiResult {
  response: string;
  analysisId?: string;
  fileName?: string;
  segments?: unknown;
  isFallback?: boolean;
  references?: ReferenceInfo[];
  referenceImages?: ReferenceImages;
  suggestedActions?: SuggestedAction[];
  priceComparisonData?: PriceComparisonData;
}

// ============================================
// 권한 관련 타입
// ============================================

/** 권한 체크 결과 */
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  showLoginModal?: boolean;
}

/** 사용량 정보 */
export interface UsageInfo {
  used: number;
  limit: number;
  canUse: boolean;
  resetDate?: Date;
}

// ============================================
// G-code 관련 타입
// ============================================

/** G-code 이슈 */
export interface GcodeIssue {
  issue_id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'info';
  description?: string;
  line?: number;
  lines?: number[];
}

/** 패치 정보 */
export interface PatchInfo {
  originalCode: string;
  fixedCode: string;
}

/** 에디터 수정 정보 */
export interface EditorFixInfo {
  lineNumber: number;
  original: string;
  fixed: string;
  description?: string;
}

/** G-code 세그먼트 데이터 */
export interface GcodeSegmentData {
  layers: unknown[];
  metadata?: unknown;
  temperatures?: unknown[];
}

// ============================================
// UI 상태 타입
// ============================================

/** 보고서 패널 탭 */
export type ReportPanelTab = 'report' | 'viewer' | 'editor';

/** 모달 상태 */
export interface ModalStates {
  showLoginModal: boolean;
  showNewChatModal: boolean;
  showShareModal: boolean;
}

/** 토스트 옵션 */
export interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}
