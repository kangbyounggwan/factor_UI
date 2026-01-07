/**
 * 통합 AI Chat API 서비스
 * Python 백엔드 POST /api/v1/chat 엔드포인트와 통신
 */

import i18n from '../i18n';

// API 기본 URL - .env의 VITE_AI_PYTHON_URL 사용
const API_BASE_URL = import.meta.env.VITE_AI_PYTHON_URL || 'http://127.0.0.1:7000';

// 현재 언어 가져오기 헬퍼
const getCurrentLanguage = (): 'ko' | 'en' => {
  return (i18n.language === 'en' ? 'en' : 'ko') as 'ko' | 'en';
};

// ============================================
// 타입 정의
// ============================================

export type ChatToolType = 'troubleshoot' | 'gcode' | 'modelling' | 'resolve_issue' | 'price_comparison' | null;
export type ChatIntent =
  | 'troubleshoot'
  | 'gcode_analysis'
  | 'modelling_text'
  | 'modelling_image'
  | 'price_comparison'
  | 'general';

// 첨부파일 타입
export interface ChatAttachment {
  type: 'image' | 'gcode';
  content: string; // base64 encoded
  filename: string;
  mime_type?: string;
}

// 프린터 정보
export interface PrinterInfo {
  manufacturer?: string;
  model?: string;
  name?: string;
  nozzle_diameter?: number;
}

// 대화 히스토리 메시지 타입
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 검색 필요 여부 힌트 (Query Gate용)
export type SearchHint = 'none' | 'maybe' | 'required';

// G-code 이슈 해결용 타입
export interface IssueToResolve {
  issue_id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'info';
  description?: string;
  line?: number;
  lines?: number[];
}

// 가격비교 요청 옵션
export interface PriceComparisonOptions {
  // 검색할 마켓플레이스 (미지정시 전체)
  marketplaces?: ('naver' | 'coupang' | 'amazon' | 'ebay')[];
  // 가격 범위 필터
  min_price?: number;
  max_price?: number;
  // 정렬 기준
  sort_by?: 'price_asc' | 'price_desc' | 'rating' | 'review_count' | 'relevance';
  // 최대 결과 수
  max_results?: number;
  // 카테고리 필터
  category?: '3d_printer' | 'filament' | 'parts' | 'accessories';
  // 재고 있는 상품만
  in_stock_only?: boolean;
}

// API 요청 타입
export interface ChatApiRequest {
  user_id?: string;
  user_plan: 'free' | 'starter' | 'pro' | 'enterprise';
  message: string;
  selected_tool?: ChatToolType;
  selected_model?: string;
  attachments?: ChatAttachment[];
  printer_info?: PrinterInfo;
  filament_type?: string;
  language: 'ko' | 'en';
  conversation_id?: string;
  conversation_history?: ConversationMessage[]; // 최근 대화 히스토리 (컨텍스트 윈도우)
  search_hint?: SearchHint; // 프론트엔드에서 검색 필요 여부 힌트 제공
  // G-code 이슈 해결용 필드
  analysis_id?: string;
  issue_to_resolve?: IssueToResolve;
  // 가격비교 옵션
  price_comparison_options?: PriceComparisonOptions;
}

// 출처 링크 타입
export interface SourceReference {
  title: string;
  url: string;
  source?: string;
  snippet?: string;
}

// 참조 이미지 타입
export interface ReferenceImage {
  title: string;
  thumbnail_url: string;
  source_url: string;
  width?: number;
  height?: number;
}

export interface ReferenceImages {
  search_query?: string;
  total_count?: number;
  images: ReferenceImage[];
}

// 프린터 문제 진단 결과
export interface TroubleshootData {
  problem?: {
    type: string;
    confidence: number;
    description: string;
  };
  solutions?: {
    title: string;
    steps: string[];
    difficulty: 'easy' | 'medium' | 'hard' | 'expert';
    estimated_time: string;
    source_refs?: SourceReference[];
  }[];
  expert_opinion?: {
    summary: string;
    prevention_tips: string[];
    source_refs?: SourceReference[];
  };
  references?: SourceReference[];
  reference_images?: ReferenceImages;
}

// G-code 분석 결과 (통합 Chat API 응답)
export interface GcodeAnalysisData {
  analysis_id: string;
  status: 'segments_ready' | 'analyzing' | 'completed' | 'error';
  filename?: string;
  quality_score?: number;
  // 세그먼트 데이터 (즉시 반환)
  segments?: {
    layers?: unknown[];
    metadata?: {
      layerCount?: number;
      totalLines?: number;
      fileSize?: number;
    };
  };
  // SSE 스트림 URL
  stream_url?: string;
  // 레이어 카운트 (즉시 제공)
  layer_count?: number;
  // 상세 분석 결과 (SSE complete 이벤트에서 제공)
  summary?: {
    print_time: { formatted: string; seconds: number };
    filament: { total_extrusion_mm: number; retraction_count: number };
    layers: { total_layers: number; layer_height_mm: number; first_layer_height_mm: number };
    temperature: {
      nozzle: { max: number; min: number; avg: number };
      bed: { max: number; min: number; avg: number };
    };
    speed: { print_speed_avg: number; travel_speed_avg: number };
  };
  issues?: {
    type: string;
    message: string;
    severity: 'warning' | 'error' | 'info';
  }[];
}

// 3D 모델링 결과
export interface ModellingData {
  task_id: string;
  model_id: string;
  status: 'processing' | 'completed' | 'failed';
  prompt: string;
  glb_url: string | null;
  stl_url: string | null;
  thumbnail_url: string | null;
}

// 가격비교 상품 데이터
export interface PriceComparisonProduct {
  id: string;
  title: string;
  price: number;
  currency: string;
  price_krw: number;
  original_price?: number;
  discount_percent?: number;
  marketplace: 'naver' | 'coupang' | 'amazon' | 'ebay';
  product_url: string;
  image_url?: string;
  rating?: number;
  review_count?: number;
  in_stock: boolean;
}

// 가격비교 결과 데이터
export interface PriceComparisonData {
  query: string;
  results_count: number;
  products: PriceComparisonProduct[];
  markets_searched: string[];
}

// 도구 실행 결과
export interface ToolResult {
  tool_name: string;
  success: boolean;
  data: TroubleshootData | GcodeAnalysisData | ModellingData | PriceComparisonData | null;
  error?: string;
  // G-code 분석용 필드 (편의를 위해 최상위에도 노출)
  analysis_id?: string;
  stream_url?: string;
  segments?: GcodeAnalysisData['segments'];
}

// 추천 액션
export interface SuggestedAction {
  label: string;
  action: string;
  data: Record<string, unknown>;
}

// 토큰 사용량
export interface TokenUsage {
  intent_classification: number;
  tool_execution: number;
  response_generation: number;
  total: number;
}

// API 응답 타입
export interface ChatApiResponse {
  conversation_id: string;
  message_id: string;
  timestamp: string;
  intent: ChatIntent;
  confidence: number;
  response: string;
  tool_result?: ToolResult;
  suggested_actions?: SuggestedAction[];
  token_usage?: TokenUsage;
  error?: string;
  // G-code 분석용 필드 (최상위 노출)
  analysis_id?: string;
  stream_url?: string;
  segments?: GcodeAnalysisData['segments'];
  // Fallback 응답 여부 (서버 연결 실패 시 true - 유료 모델 차감 안함)
  is_fallback?: boolean;
  // 참고 자료 (문제진단 등에서 웹 검색 결과)
  references?: SourceReference[];
  // 참조 이미지 (문제진단에서 검색된 예시 이미지)
  reference_images?: ReferenceImages;
}

// ============================================
// API 호출 함수
// ============================================

/**
 * 통합 채팅 API 호출
 */
export async function sendChatMessage(request: ChatApiRequest): Promise<ChatApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API 오류: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    // 백엔드 서버가 없을 때 임시 fallback 응답
    console.warn('[chatApiService] API 연결 실패, fallback 응답 사용:', error);
    return generateFallbackResponse(request);
  }
}

/**
 * 백엔드 서버 없을 때 임시 fallback 응답 생성
 */
function generateFallbackResponse(request: ChatApiRequest): ChatApiResponse {
  const isKorean = request.language === 'ko';
  let responseText = '';

  // 도구에 따른 응답 생성
  if (request.selected_tool === 'troubleshoot' || (request.attachments?.some(a => a.type === 'image'))) {
    responseText = isKorean
      ? `**🔍 프린터 문제 분석**\n\n문제 상황을 접수했습니다.\n\n**입력하신 내용:**\n${request.message || '이미지로 진단 요청'}\n\n현재 AI 서버에 연결되지 않아 상세 분석이 불가능합니다.\n잠시 후 다시 시도해주세요.\n\n**일반적인 해결 방법:**\n1. 베드 레벨링 확인\n2. 노즐 온도 점검\n3. 필라멘트 상태 확인`
      : `**🔍 Printer Issue Analysis**\n\nWe received your issue.\n\n**Your input:**\n${request.message || 'Diagnosis request with image'}\n\nDetailed analysis is currently unavailable as the AI server is not connected.\nPlease try again later.\n\n**General solutions:**\n1. Check bed leveling\n2. Check nozzle temperature\n3. Check filament condition`;
  } else if (request.selected_tool === 'gcode' || (request.attachments?.some(a => a.type === 'gcode'))) {
    const filename = request.attachments?.find(a => a.type === 'gcode')?.filename || 'file.gcode';
    responseText = isKorean
      ? `**📊 G-code 분석**\n\n**파일:** ${filename}\n\n현재 AI 서버에 연결되지 않아 상세 분석이 불가능합니다.\n잠시 후 다시 시도해주세요.\n\n**질문:** ${request.message || 'G-code 분석 요청'}`
      : `**📊 G-code Analysis**\n\n**File:** ${filename}\n\nDetailed analysis is currently unavailable as the AI server is not connected.\nPlease try again later.\n\n**Question:** ${request.message || 'G-code analysis request'}`;
  } else if (request.selected_tool === 'modelling') {
    responseText = isKorean
      ? `**🎨 3D 모델 생성**\n\n**프롬프트:** ${request.message}\n\n현재 AI 서버에 연결되지 않아 모델 생성이 불가능합니다.\n잠시 후 다시 시도해주세요.`
      : `**🎨 3D Model Generation**\n\n**Prompt:** ${request.message}\n\nModel generation is currently unavailable as the AI server is not connected.\nPlease try again later.`;
  } else {
    // 일반 대화
    const lowerMessage = request.message.toLowerCase();
    if (lowerMessage.includes('안녕') || lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      responseText = isKorean
        ? `안녕하세요! 👋 FACTOR AI입니다.\n\n3D 프린팅에 관한 모든 것을 도와드릴게요:\n\n**🔧 프린터 문제 진단**\n증상을 설명하거나 출력물 사진을 업로드해주세요\n\n**📊 G-code 분석**\nG-code 파일을 업로드하면 상세 분석을 제공합니다\n\n**🎨 3D 모델링**\n텍스트로 3D 모델을 생성할 수 있습니다\n\n무엇을 도와드릴까요?`
        : `Hello! 👋 I'm FACTOR AI.\n\nI can help you with everything about 3D printing:\n\n**🔧 Printer Troubleshooting**\nDescribe your symptoms or upload photos of your prints\n\n**📊 G-code Analysis**\nUpload G-code files for detailed analysis\n\n**🎨 3D Modeling**\nGenerate 3D models from text descriptions\n\nHow can I help you?`;
    } else {
      responseText = isKorean
        ? `FACTOR AI가 도와드릴게요!\n\n**입력하신 내용:** ${request.message}\n\n현재 AI 서버에 연결되지 않아 상세 응답이 불가능합니다.\n\n✅ 유료 모델 체험은 차감되지 않습니다.\n\n잠시 후 다시 시도해주세요.`
        : `FACTOR AI is here to help!\n\n**Your input:** ${request.message}\n\nDetailed response is currently unavailable as the AI server is not connected.\n\n✅ Premium model trial was not charged.\n\nPlease try again later.`;
    }
  }

  return {
    conversation_id: `fallback-${Date.now()}`,
    message_id: `msg-${Date.now()}`,
    timestamp: new Date().toISOString(),
    intent: request.selected_tool === 'troubleshoot' ? 'troubleshoot' :
            request.selected_tool === 'gcode' ? 'gcode_analysis' :
            request.selected_tool === 'modelling' ? 'modelling_text' : 'general',
    confidence: 1.0,
    response: responseText,
    is_fallback: true, // 서버 연결 실패 - 유료 모델 차감 안함
  };
}

/**
 * 3D 모델링 상태 확인
 */
export async function checkModellingStatus(taskId: string): Promise<ModellingData> {
  const response = await fetch(`${API_BASE_URL}/api/v1/modelling/status/${taskId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`상태 확인 실패: ${response.status}`);
  }

  return response.json();
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * File을 base64로 변환
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:image/png;base64, 부분 제거
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 이미지 파일들을 ChatAttachment 배열로 변환
 */
export async function imagesToAttachments(files: File[]): Promise<ChatAttachment[]> {
  const attachments: ChatAttachment[] = [];

  for (const file of files) {
    const base64 = await fileToBase64(file);
    attachments.push({
      type: 'image',
      content: base64,
      filename: file.name,
      mime_type: file.type,
    });
  }

  return attachments;
}

/**
 * G-code 파일을 ChatAttachment로 변환
 */
export async function gcodeToAttachment(file: File): Promise<ChatAttachment> {
  const base64 = await fileToBase64(file);
  return {
    type: 'gcode',
    content: base64,
    filename: file.name,
  };
}

/**
 * API 응답에서 포맷된 응답 텍스트 생성
 */
export function formatChatResponse(response: ChatApiResponse): string {
  // 기본 응답 사용
  if (response.response) {
    let formattedResponse = response.response;

    // troubleshoot 응답인 경우, 솔루션별 출처를 마크다운에 주입
    if (response.tool_result?.data && isTroubleshootData(response.tool_result.data)) {
      formattedResponse = injectSolutionSources(formattedResponse, response.tool_result.data);
    }

    return formattedResponse;
  }

  // 도구 결과에서 응답 생성 (fallback)
  if (response.tool_result?.success && response.tool_result.data) {
    const { tool_name, data } = response.tool_result;

    if (tool_name === 'troubleshoot' && isTroubleshootData(data)) {
      return formatTroubleshootResponse(data);
    }

    if (tool_name === 'gcode_analysis' && isGcodeAnalysisData(data)) {
      return formatGcodeResponse(data);
    }

    if ((tool_name === 'modelling_text' || tool_name === 'modelling_image') && isModellingData(data)) {
      return formatModellingResponse(data);
    }
  }

  const lang = getCurrentLanguage();
  return lang === 'en' ? 'Unable to process the response.' : '응답을 처리할 수 없습니다.';
}

/**
 * 솔루션별 출처를 마크다운 응답에 주입
 * 백엔드가 response 텍스트와 tool_result.data를 모두 반환할 때 사용
 */
function injectSolutionSources(markdown: string, data: TroubleshootData): string {
  if (!data.solutions || data.solutions.length === 0) {
    return markdown;
  }

  let result = markdown;

  // 각 솔루션의 출처를 해당 솔루션 섹션 뒤에 추가
  data.solutions.forEach((sol, index) => {
    if (sol.source_refs && sol.source_refs.length > 0) {
      const solutionNumber = index + 1;
      const nextSolutionNumber = index + 2;

      // 솔루션 제목 패턴 찾기 (예: "**1. 리트랙션 설정 조정**" 또는 "1. Adjust Retraction")
      // 다음 솔루션 시작 또는 다음 섹션 시작 전까지의 영역을 찾음 (한/영 모두 지원)
      const solutionPatterns = [
        // 볼드 숫자 패턴: **1. Title**
        new RegExp(`(\\*\\*${solutionNumber}\\.\\s*[^*]+\\*\\*[\\s\\S]*?)(?=\\*\\*${nextSolutionNumber}\\.\\s|\\*\\*💡|\\*\\*전문가|\\*\\*Expert|\\*\\*예방|\\*\\*Prevention|\\*\\*📚|$)`, 'i'),
        // 일반 숫자 패턴: 1. Title
        new RegExp(`(${solutionNumber}\\.\\s*[^\\n]+[\\s\\S]*?)(?=${nextSolutionNumber}\\.\\s|💡|전문가|Expert|예방|Prevention|📚|$)`, 'i'),
      ];

      for (const pattern of solutionPatterns) {
        const match = result.match(pattern);
        if (match && match[1]) {
          const solutionSection = match[1];
          // 이미 출처가 포함되어 있는지 확인 (한/영 모두 체크)
          if (!solutionSection.includes('📎') && !solutionSection.includes('출처:') && !solutionSection.includes('Sources:')) {
            const sourceLinks = formatSourceRefs(sol.source_refs, '   ');
            // 솔루션 섹션 끝에 출처 추가
            const updatedSection = solutionSection.trimEnd() + '\n' + sourceLinks;
            result = result.replace(solutionSection, updatedSection);
          }
          break;
        }
      }
    }
  });

  // 전문가 의견 출처 추가
  if (data.expert_opinion?.source_refs && data.expert_opinion.source_refs.length > 0) {
    // 전문가 의견 섹션 찾기 (한/영 모두 지원)
    const expertPattern = /(💡\s*(전문가\s*의견|Expert\s*Opinion)[:\s]*[^\n]*[\s\S]*?)(?=📚|$)/i;
    const expertMatch = result.match(expertPattern);
    if (expertMatch && expertMatch[1] && !expertMatch[1].includes('📎')) {
      const expertSection = expertMatch[1];
      const sourceLinks = formatSourceRefs(data.expert_opinion.source_refs, '');
      const updatedSection = expertSection.trimEnd() + '\n\n' + sourceLinks;
      result = result.replace(expertSection, updatedSection);
    }
  }

  return result;
}

// 타입 가드
function isTroubleshootData(data: unknown): data is TroubleshootData {
  return typeof data === 'object' && data !== null && 'problem' in data;
}

function isGcodeAnalysisData(data: unknown): data is GcodeAnalysisData {
  return typeof data === 'object' && data !== null && 'analysis_id' in data;
}

function isModellingData(data: unknown): data is ModellingData {
  return typeof data === 'object' && data !== null && 'task_id' in data;
}

// 출처 링크 포맷팅 헬퍼
function formatSourceRefs(refs: SourceReference[], indent = ''): string {
  if (!refs || refs.length === 0) return '';

  const lang = getCurrentLanguage();
  const sourceLabel = lang === 'en' ? 'Sources' : '출처';
  let result = `${indent}📎 **${sourceLabel}:**\n`;
  refs.forEach(ref => {
    result += `${indent}- [${ref.title}](${ref.url})`;
    if (ref.source) result += ` *(${ref.source})*`;
    result += '\n';
  });
  return result;
}

// 포맷 함수들
function formatTroubleshootResponse(data: TroubleshootData): string {
  const lang = getCurrentLanguage();
  const isEn = lang === 'en';

  // 다국어 레이블
  const labels = {
    analysisResult: isEn ? 'Problem Analysis Result' : '문제 분석 결과',
    detectedProblem: isEn ? 'Detected Problem' : '감지된 문제',
    confidence: isEn ? 'Confidence' : '확신도',
    recommendedSolutions: isEn ? 'Recommended Solutions' : '추천 해결 방법',
    difficulty: isEn ? 'Difficulty' : '난이도',
    estimatedTime: isEn ? 'Est. Time' : '예상 시간',
    expertOpinion: isEn ? 'Expert Opinion' : '전문가 의견',
    preventionTips: isEn ? 'Prevention Tips' : '예방 팁',
    references: isEn ? 'References' : '참고자료',
  };

  let response = `**${labels.analysisResult}** 🔍\n\n`;

  if (data.problem) {
    response += `**${labels.detectedProblem}:** ${data.problem.description} (${labels.confidence}: ${Math.round(data.problem.confidence * 100)}%)\n\n`;
  }

  if (data.solutions && data.solutions.length > 0) {
    response += `**🔧 ${labels.recommendedSolutions}:**\n\n`;
    data.solutions.forEach((sol, i) => {
      response += `**${i + 1}. ${sol.title}**\n`;
      response += `   ${labels.difficulty}: ${sol.difficulty} | ${labels.estimatedTime}: ${sol.estimated_time}\n`;
      sol.steps.forEach((step, j) => {
        response += `   ${j + 1}. ${step}\n`;
      });
      // 솔루션별 출처 링크 추가
      if (sol.source_refs && sol.source_refs.length > 0) {
        response += formatSourceRefs(sol.source_refs, '   ');
      }
      response += '\n';
    });
  }

  if (data.expert_opinion) {
    response += `**💡 ${labels.expertOpinion}:** ${data.expert_opinion.summary}\n`;
    if (data.expert_opinion.prevention_tips && data.expert_opinion.prevention_tips.length > 0) {
      response += `\n**${labels.preventionTips}:**\n`;
      data.expert_opinion.prevention_tips.forEach(tip => {
        response += `- ${tip}\n`;
      });
    }
    // 전문가 의견 출처 링크 추가
    if (data.expert_opinion.source_refs && data.expert_opinion.source_refs.length > 0) {
      response += '\n' + formatSourceRefs(data.expert_opinion.source_refs);
    }
    response += '\n';
  }

  // 전체 참고자료 섹션
  if (data.references && data.references.length > 0) {
    response += `\n**📚 ${labels.references}:**\n`;
    data.references.forEach(ref => {
      response += `- [${ref.title}](${ref.url})`;
      if (ref.source) response += ` *(${ref.source})*`;
      response += '\n';
    });
  }

  return response;
}

function formatGcodeResponse(data: GcodeAnalysisData): string {
  const lang = getCurrentLanguage();
  const isEn = lang === 'en';

  const labels = {
    analysisComplete: isEn ? 'G-code Analysis Complete!' : 'G-code 분석 완료!',
    file: isEn ? 'File' : '파일',
    qualityScore: isEn ? 'Quality Score' : '품질 점수',
    basicInfo: isEn ? 'Basic Info' : '기본 정보',
    printTime: isEn ? 'Est. Print Time' : '예상 출력 시간',
    filamentUsage: isEn ? 'Filament Usage' : '필라멘트 사용량',
    totalLayers: isEn ? 'Total Layers' : '총 레이어',
    layerHeight: isEn ? 'Layer Height' : '레이어 높이',
    tempSettings: isEn ? 'Temperature Settings' : '온도 설정',
    nozzle: isEn ? 'Nozzle' : '노즐',
    bed: isEn ? 'Bed' : '베드',
    issuesFound: isEn ? 'Issues Found' : '발견된 이슈',
  };

  let response = `**${labels.analysisComplete}** 📊\n\n`;
  response += `**${labels.file}:** ${data.filename}\n`;
  response += `**${labels.qualityScore}:** ${data.quality_score}/100\n\n`;

  const { summary } = data;
  response += `**📋 ${labels.basicInfo}:**\n`;
  response += `- ${labels.printTime}: ${summary.print_time.formatted}\n`;
  response += `- ${labels.filamentUsage}: ${(summary.filament.total_extrusion_mm / 1000).toFixed(1)}m\n`;
  response += `- ${labels.totalLayers}: ${summary.layers.total_layers}${isEn ? '' : '개'}\n`;
  response += `- ${labels.layerHeight}: ${summary.layers.layer_height_mm}mm\n\n`;

  response += `**🌡️ ${labels.tempSettings}:**\n`;
  response += `- ${labels.nozzle}: ${summary.temperature.nozzle.avg}°C\n`;
  response += `- ${labels.bed}: ${summary.temperature.bed.avg}°C\n\n`;

  if (data.issues && data.issues.length > 0) {
    response += `**⚠️ ${labels.issuesFound} (${data.issues.length}${isEn ? '' : '개'}):**\n`;
    data.issues.forEach((issue, i) => {
      response += `${i + 1}. ${issue.message}\n`;
    });
  }

  return response;
}

function formatModellingResponse(data: ModellingData): string {
  const lang = getCurrentLanguage();
  const isEn = lang === 'en';

  const labels = {
    started: isEn ? '3D Model Generation Started!' : '3D 모델 생성 시작!',
    completed: isEn ? '3D Model Generation Complete!' : '3D 모델 생성 완료!',
    prompt: isEn ? 'Prompt' : '프롬프트',
    generating: isEn ? 'Generating model... (approx. 2-3 min)\n\nWe\'ll notify you when it\'s done!' : '모델을 생성 중입니다... (약 2-3분 소요)\n\n완료되면 알려드릴게요!',
    modelComplete: isEn ? 'Model is ready!' : '모델이 완료되었습니다!',
    downloadGLB: isEn ? 'Download GLB' : 'GLB 다운로드',
    downloadSTL: isEn ? 'Download STL' : 'STL 다운로드',
    failed: isEn ? 'Model generation failed. Please try again.' : '모델 생성에 실패했습니다. 다시 시도해주세요.',
  };

  let response = `**${data.status === 'completed' ? labels.completed : labels.started}** 🎨\n\n`;
  response += `**${labels.prompt}:** ${data.prompt}\n\n`;

  if (data.status === 'processing') {
    response += labels.generating;
  } else if (data.status === 'completed') {
    response += `${labels.modelComplete}\n`;
    if (data.glb_url) response += `- [${labels.downloadGLB}](${data.glb_url})\n`;
    if (data.stl_url) response += `- [${labels.downloadSTL}](${data.stl_url})\n`;
  } else {
    response += labels.failed;
  }

  return response;
}
