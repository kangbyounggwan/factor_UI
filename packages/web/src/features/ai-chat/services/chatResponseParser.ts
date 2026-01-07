/**
 * Chat API 응답 파서
 *
 * API 응답을 UI에서 사용할 수 있는 형식으로 변환
 */

import {
  formatChatResponse,
  type ChatApiResponse,
  type PriceComparisonData,
} from '@shared/services/chatApiService';
import type { ChatApiResult, ReferenceInfo, ReferenceImages, SuggestedAction } from '../types';

/**
 * API 응답에서 참고 자료 추출
 */
function extractReferences(response: ChatApiResponse): ReferenceInfo[] | undefined {
  const toolData = response.tool_result?.data as Record<string, unknown> | null | undefined;
  const references = (toolData?.references || response.references) as ReferenceInfo[] | undefined;
  return references;
}

/**
 * API 응답에서 참조 이미지 추출
 */
function extractReferenceImages(response: ChatApiResponse): ReferenceImages | undefined {
  const toolData = response.tool_result?.data as Record<string, unknown> | null | undefined;
  const toolResultAny = response.tool_result as unknown as Record<string, unknown> | undefined;

  const referenceImages = (
    toolData?.reference_images ||
    toolResultAny?.reference_images ||
    response.reference_images
  ) as ReferenceImages | undefined;

  if (referenceImages?.images?.length) {
    console.log('[ChatResponseParser] Found reference images:', referenceImages.images.length);
  }

  return referenceImages;
}

/**
 * API 응답에서 제안 액션 추출
 */
function extractSuggestedActions(response: ChatApiResponse): SuggestedAction[] | undefined {
  return response.suggested_actions;
}

/**
 * API 응답에서 세그먼트 데이터 추출
 */
function extractSegments(response: ChatApiResponse): unknown | undefined {
  return response.segments || response.tool_result?.segments;
}

/**
 * API 응답에서 가격비교 데이터 추출
 */
function extractPriceComparisonData(response: ChatApiResponse): PriceComparisonData | undefined {
  console.log('[ChatResponseParser] Extracting price comparison data:', {
    tool_name: response.tool_result?.tool_name,
    intent: response.intent,
    has_tool_result_data: !!response.tool_result?.data,
    tool_result_keys: response.tool_result?.data ? Object.keys(response.tool_result.data) : [],
  });

  // 1. tool_result.data에서 가격비교 데이터 확인
  if (response.tool_result?.tool_name === 'price_comparison' && response.tool_result.data) {
    const data = response.tool_result.data as PriceComparisonData;
    console.log('[ChatResponseParser] Price comparison from tool_result:', {
      query: data.query,
      productCount: data.products?.length,
      firstProductUrl: data.products?.[0]?.product_url,
    });
    return data;
  }

  // 2. intent가 price_comparison인 경우
  if (response.intent === 'price_comparison' && response.tool_result?.data) {
    const data = response.tool_result.data as PriceComparisonData;
    console.log('[ChatResponseParser] Price comparison from intent:', {
      query: data.query,
      productCount: data.products?.length,
      firstProductUrl: data.products?.[0]?.product_url,
    });
    return data;
  }

  // 3. tool_result.data 자체가 products 배열을 가진 경우
  const toolData = response.tool_result?.data as Record<string, unknown> | undefined;
  if (toolData && Array.isArray(toolData.products)) {
    console.log('[ChatResponseParser] Price comparison from generic tool_result.data:', {
      query: toolData.query,
      productCount: (toolData.products as unknown[]).length,
    });
    return toolData as unknown as PriceComparisonData;
  }

  console.log('[ChatResponseParser] No price comparison data found');
  return undefined;
}

/**
 * API 응답 파싱 (메인 함수)
 */
export function parseChatResponse(
  response: ChatApiResponse,
  gcodeFileName?: string
): ChatApiResult {
  // 전체 응답 데이터 로그
  console.log('[ChatResponseParser] ===== FULL RESPONSE DATA =====');
  console.log('[ChatResponseParser] Raw response:', JSON.stringify(response, null, 2));
  console.log('[ChatResponseParser] =============================');

  // 에러 체크
  if (response.error) {
    throw new Error(response.error);
  }

  // 응답 포맷팅
  const formattedResponse = formatChatResponse(response);

  return {
    response: formattedResponse,
    analysisId: response.analysis_id || undefined,
    fileName: gcodeFileName,
    segments: extractSegments(response),
    isFallback: response.is_fallback || false,
    references: extractReferences(response),
    referenceImages: extractReferenceImages(response),
    suggestedActions: extractSuggestedActions(response),
    priceComparisonData: extractPriceComparisonData(response),
  };
}

/**
 * 에러 메시지 생성
 */
export function createErrorResponse(
  error: unknown,
  t: (key: string, defaultValue: string) => string
): string {
  const errorText = error instanceof Error ? error.message : t('aiChat.unknownError', '알 수 없는 오류');
  return `${t('aiChat.errorOccurred', '죄송합니다. 오류가 발생했습니다.')}\n\n**${t('common.error', '오류')}:** ${errorText}\n\n${t('aiChat.tryAgainLater', '잠시 후 다시 시도해주세요.')}`;
}

/**
 * 스킵해야 하는 에러인지 확인
 * (이미 toast로 처리된 에러들)
 */
export function isSkippableError(error: unknown): boolean {
  const skipErrorMessages = [
    'AI_GENERATION_LIMIT_REACHED',
    'LOGIN_REQUIRED_FOR_MODELING',
    'TROUBLESHOOT_DAILY_LIMIT_REACHED',
  ];

  return error instanceof Error && skipErrorMessages.includes(error.message);
}
