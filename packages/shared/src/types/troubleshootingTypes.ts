/**
 * AI Troubleshooting 관련 타입 정의
 * 컨텍스트 윈도우를 고려한 DB 구조
 */

// 세션 상태
export type SessionStatus = 'active' | 'resolved' | 'archived';

// 메시지 역할
export type MessageRole = 'user' | 'assistant' | 'system';

// 대화 세션
export interface TroubleshootingSession {
  id: string;
  user_id: string;
  title: string | null;

  // 프린터 정보
  printer_manufacturer: string | null;
  printer_series: string | null;
  printer_model_id: string | null;
  printer_model_name: string | null;

  // 세션 요약 (컨텍스트 압축용)
  summary: string | null;
  summary_updated_at: string | null;

  // 상태
  status: SessionStatus;
  resolved_issue: string | null;

  // 통계
  message_count: number;
  total_tokens: number;

  // 타임스탬프
  created_at: string;
  updated_at: string;
}

// 대화 메시지
export interface TroubleshootingMessage {
  id: string;
  session_id: string;

  // 메시지 정보
  role: MessageRole;
  content: string;

  // 토큰 관리
  token_count: number;

  // 이미지 관련
  has_images: boolean;
  image_urls: string[] | null;
  image_analysis: string | null;

  // 중요도 (컨텍스트 선택용)
  importance_score: number;
  is_key_message: boolean;

  // 메타데이터
  metadata: Record<string, unknown>;

  // 타임스탬프
  created_at: string;
}

// 세션 생성 입력
export interface CreateSessionInput {
  title?: string;
  printer_manufacturer?: string;
  printer_series?: string;
  printer_model_id?: string;
  printer_model_name?: string;
}

// 메시지 생성 입력
export interface CreateMessageInput {
  session_id: string;
  role: MessageRole;
  content: string;
  token_count?: number;
  has_images?: boolean;
  image_urls?: string[];
  image_analysis?: string;
  importance_score?: number;
  is_key_message?: boolean;
  metadata?: Record<string, unknown>;
}

// 컨텍스트 윈도우 구성
export interface ContextWindow {
  // 시스템 프롬프트
  systemPrompt: string;

  // 프린터 정보
  printerContext: string | null;

  // 세션 요약 (이전 대화 압축)
  sessionSummary: string | null;

  // 최근 메시지들
  recentMessages: TroubleshootingMessage[];

  // 핵심 메시지들 (is_key_message = true)
  keyMessages: TroubleshootingMessage[];

  // 현재 사용자 입력
  currentInput: string;

  // 현재 이미지들
  currentImages?: string[];

  // 총 토큰 수 (추정)
  estimatedTokens: number;
}

// 컨텍스트 구성 옵션
export interface ContextOptions {
  maxTokens?: number;  // 최대 토큰 수 (기본: 4000)
  recentMessageCount?: number;  // 최근 메시지 수 (기본: 10)
  includeImages?: boolean;  // 이미지 분석 포함 여부
  includeSummary?: boolean;  // 세션 요약 포함 여부
}

// AI 분석 요청
export interface AnalysisRequest {
  sessionId: string;
  userMessage: string;
  imageUrls?: string[];
  contextOptions?: ContextOptions;
}

// AI 분석 응답
export interface AnalysisResponse {
  message: TroubleshootingMessage;
  tokensUsed: number;
  shouldUpdateSummary: boolean;  // 요약 업데이트 필요 여부
}

// 세션 목록 조회 옵션
export interface ListSessionsOptions {
  status?: SessionStatus;
  limit?: number;
  offset?: number;
}

// 세션 with 메시지
export interface SessionWithMessages extends TroubleshootingSession {
  messages: TroubleshootingMessage[];
}
