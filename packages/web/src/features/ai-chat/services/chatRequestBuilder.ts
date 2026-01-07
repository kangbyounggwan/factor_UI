/**
 * Chat API 요청 빌더
 *
 * 도구별로 적절한 요청 형식을 구성
 */

import {
  sendChatMessage,
  imagesToAttachments,
  gcodeToAttachment,
  type ChatApiRequest,
  type ChatToolType as ApiToolType,
} from '@shared/services/chatApiService';
import type { ChatTool, ChatRequestContext, ChatFiles } from '../types';

/**
 * 기본 요청 객체 생성
 */
export function createBaseRequest(context: ChatRequestContext): Partial<ChatApiRequest> {
  return {
    user_id: context.userId,
    user_plan: context.userPlan,
    language: context.language,
    conversation_id: context.sessionId,
    conversation_history: context.conversationHistory.length > 0
      ? context.conversationHistory
      : undefined,
  };
}

/**
 * G-code 분석 요청 빌드
 */
export async function buildGcodeRequest(
  baseRequest: Partial<ChatApiRequest>,
  message: string,
  gcodeFile: File | null,
  selectedModel: string
): Promise<ChatApiRequest> {
  const attachments = [];
  if (gcodeFile) {
    const gcodeAttachment = await gcodeToAttachment(gcodeFile);
    attachments.push(gcodeAttachment);
  }

  return {
    ...baseRequest,
    message: message || '이 G-code 파일을 분석해주세요',
    selected_tool: 'gcode',
    selected_model: selectedModel,
    attachments: attachments.length > 0 ? attachments : undefined,
  } as ChatApiRequest;
}

/**
 * 문제진단 (Troubleshoot) 요청 빌드
 */
export async function buildTroubleshootRequest(
  baseRequest: Partial<ChatApiRequest>,
  message: string,
  images: File[],
  selectedModel: string
): Promise<ChatApiRequest> {
  const attachments = [];
  if (images.length > 0) {
    const imageAttachments = await imagesToAttachments(images);
    attachments.push(...imageAttachments);
  }

  return {
    ...baseRequest,
    message: message || '이미지로 문제를 진단해주세요',
    selected_tool: 'troubleshoot',
    selected_model: selectedModel,
    attachments: attachments.length > 0 ? attachments : undefined,
  } as ChatApiRequest;
}

/**
 * 3D 모델링 요청 빌드
 */
export async function buildModelingRequest(
  baseRequest: Partial<ChatApiRequest>,
  message: string,
  images: File[],
  selectedModel: string
): Promise<ChatApiRequest> {
  const attachments = [];
  if (images.length > 0) {
    const imageAttachments = await imagesToAttachments(images);
    attachments.push(...imageAttachments);
  }

  return {
    ...baseRequest,
    message: message || '3D 모델을 생성해주세요',
    selected_tool: 'modelling',
    selected_model: selectedModel,
    attachments: attachments.length > 0 ? attachments : undefined,
  } as ChatApiRequest;
}

/**
 * 일반 대화 요청 빌드 (자동 도구 감지)
 */
export async function buildGeneralRequest(
  baseRequest: Partial<ChatApiRequest>,
  message: string,
  files: ChatFiles,
  selectedModel: string
): Promise<ChatApiRequest> {
  const attachments = [];

  if (files.images.length > 0) {
    const imageAttachments = await imagesToAttachments(files.images);
    attachments.push(...imageAttachments);
  }

  if (files.gcodeFile) {
    const gcodeAttachment = await gcodeToAttachment(files.gcodeFile);
    attachments.push(gcodeAttachment);
  }

  // 첨부파일에 따라 도구 자동 결정
  let autoTool: ApiToolType = null;
  if (files.gcodeFile) {
    autoTool = 'gcode';
  } else if (files.images.length > 0) {
    autoTool = 'troubleshoot';
  }

  return {
    ...baseRequest,
    message: message || '',
    selected_tool: autoTool,
    selected_model: selectedModel,
    attachments: attachments.length > 0 ? attachments : undefined,
  } as ChatApiRequest;
}

/**
 * 가격비교 요청 빌드
 */
export function buildPriceComparisonRequest(
  baseRequest: Partial<ChatApiRequest>,
  message: string,
  selectedModel: string
): ChatApiRequest {
  return {
    ...baseRequest,
    message: message || '가격을 비교해주세요',
    selected_tool: 'price_comparison',
    selected_model: selectedModel,
  } as ChatApiRequest;
}

/**
 * G-code 이슈 해결 요청 빌드
 */
export function buildResolveIssueRequest(
  baseRequest: Partial<ChatApiRequest>,
  analysisId: string,
  issue: {
    issue_id: string;
    title: string;
    severity: string;
    description?: string;
    line?: number;
    lines?: number[];
  }
): ChatApiRequest {
  return {
    ...baseRequest,
    message: '이 이슈를 해결해주세요',
    selected_tool: 'resolve_issue',
    analysis_id: analysisId,
    issue_to_resolve: {
      issue_id: issue.issue_id,
      title: issue.title,
      severity: issue.severity as 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'info',
      description: issue.description,
      line: issue.line,
      lines: issue.lines,
    },
  } as ChatApiRequest;
}

/**
 * 도구별 요청 빌드 (메인 함수)
 */
export async function buildChatRequest(params: {
  tool: ChatTool | null;
  message: string;
  files: ChatFiles;
  context: ChatRequestContext;
  selectedModel: string;
}): Promise<ChatApiRequest> {
  const { tool, message, files, context, selectedModel } = params;
  const baseRequest = createBaseRequest(context);

  switch (tool) {
    case 'gcode':
      return buildGcodeRequest(baseRequest, message, files.gcodeFile, selectedModel);

    case 'troubleshoot':
      return buildTroubleshootRequest(baseRequest, message, files.images, selectedModel);

    case 'modeling':
      return buildModelingRequest(baseRequest, message, files.images, selectedModel);

    case 'price_comparison':
      return buildPriceComparisonRequest(baseRequest, message, selectedModel);

    default:
      return buildGeneralRequest(baseRequest, message, files, selectedModel);
  }
}
