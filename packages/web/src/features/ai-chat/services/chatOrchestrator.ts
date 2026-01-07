/**
 * Chat Orchestrator
 *
 * AI 채팅의 핵심 비즈니스 로직
 * - 권한 체크
 * - 요청 빌드
 * - API 호출
 * - 응답 파싱
 *
 * UI와 분리된 순수 서비스 레이어
 */

import { sendChatMessage } from '@shared/services/chatApiService';
import type {
  ChatTool,
  ChatFiles,
  ChatRequestContext,
  ChatApiResult,
  PermissionResult,
} from '../types';
import { buildChatRequest } from './chatRequestBuilder';
import { parseChatResponse, isSkippableError } from './chatResponseParser';
import { checkToolPermission, incrementToolUsage } from './chatPermissionService';

/**
 * Chat API 요청 파라미터
 */
export interface SendChatParams {
  tool: ChatTool | null;
  message: string;
  files: ChatFiles;
  context: ChatRequestContext;
  selectedModel: string;
}

/**
 * Chat API 요청 결과
 */
export interface SendChatResult {
  success: boolean;
  result?: ChatApiResult;
  error?: Error;
  permissionDenied?: PermissionResult;
}

/**
 * 채팅 메시지 전송 (메인 함수)
 *
 * @param params - 요청 파라미터
 * @returns 전송 결과
 */
export async function sendChat(params: SendChatParams): Promise<SendChatResult> {
  const { tool, message, files, context, selectedModel } = params;

  try {
    // 1. 권한 체크
    const permission = await checkToolPermission(tool, context.userId, context.userPlan);
    if (!permission.allowed) {
      return {
        success: false,
        permissionDenied: permission,
      };
    }

    // 2. 요청 빌드
    const request = await buildChatRequest({
      tool,
      message,
      files,
      context,
      selectedModel,
    });

    // 3. API 호출
    const response = await sendChatMessage(request);

    // 4. 응답 파싱
    const result = parseChatResponse(response, files.gcodeFile?.name);

    // 5. 사용량 증가
    await incrementToolUsage(tool, context.userId, result.isFallback);

    return {
      success: true,
      result,
    };
  } catch (error) {
    // 스킵 가능한 에러 (이미 UI에서 처리됨)
    if (isSkippableError(error)) {
      return {
        success: false,
        error: error as Error,
      };
    }

    // 일반 에러
    console.error('[ChatOrchestrator] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * G-code 이슈 해결 요청
 */
export async function resolveGcodeIssue(params: {
  analysisId: string;
  issue: {
    issue_id: string;
    title: string;
    severity: string;
    description?: string;
    line?: number;
    lines?: number[];
  };
  context: ChatRequestContext;
}): Promise<SendChatResult> {
  const { analysisId, issue, context } = params;

  try {
    const { buildResolveIssueRequest } = await import('./chatRequestBuilder');
    const { createBaseRequest } = await import('./chatRequestBuilder');

    const baseRequest = createBaseRequest(context);
    const request = buildResolveIssueRequest(baseRequest, analysisId, issue);

    const response = await sendChatMessage(request);
    const result = parseChatResponse(response);

    return {
      success: true,
      result,
    };
  } catch (error) {
    console.error('[ChatOrchestrator] Resolve issue error:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
