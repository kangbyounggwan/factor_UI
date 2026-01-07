/**
 * Chat 권한/사용량 체크 서비스
 *
 * 각 도구별 사용 권한 및 한도 체크 로직
 */

import {
  checkUsageLimit,
  incrementUsage,
  checkTroubleshootAdvancedUsage,
  incrementTroubleshootAdvancedUsage,
  checkAnonymousUsage,
  incrementAnonymousUsage,
} from '@shared/utils/subscription';
import { USAGE_TYPES } from '@shared/types/subscription';
import type { ChatTool, PermissionResult } from '../types';

/**
 * 익명 사용자 사용 가능 여부 체크
 */
export function checkAnonymousPermission(): PermissionResult {
  const usage = checkAnonymousUsage();

  if (!usage.canUse) {
    return {
      allowed: false,
      reason: '비로그인 사용자는 하루 10회까지 사용 가능합니다. 로그인하면 더 많이 사용할 수 있습니다.',
      showLoginModal: true,
    };
  }

  return { allowed: true };
}

/**
 * 문제진단 도구 사용 가능 여부 체크
 */
export async function checkTroubleshootPermission(userId: string): Promise<PermissionResult> {
  const usage = await checkTroubleshootAdvancedUsage(userId);

  if (usage.isFreePlan && !usage.canUse) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getMonth() + 1}월 ${tomorrow.getDate()}일`;

    return {
      allowed: false,
      reason: `무료 플랜은 하루 5회까지 문제진단을 사용할 수 있습니다. 내일(${tomorrowStr})부터 다시 사용 가능합니다.`,
    };
  }

  return { allowed: true };
}

/**
 * 3D 모델링 도구 사용 가능 여부 체크
 */
export async function checkModelingPermission(
  userId: string | undefined,
  userPlan: string | undefined
): Promise<PermissionResult> {
  // 비로그인 사용자 체크
  if (!userId) {
    return {
      allowed: false,
      reason: '3D 모델 생성은 로그인 후 사용할 수 있습니다. 로그인하시면 다양한 AI 도구를 무료로 체험해보실 수 있습니다.',
      showLoginModal: true,
    };
  }

  // 사용량 한도 체크
  const usageCheck = await checkUsageLimit(userId, USAGE_TYPES.AI_MODEL_GENERATION);

  if (usageCheck && !usageCheck.can_use) {
    const limit = usageCheck.limit === -1 ? '∞' : usageCheck.limit;
    return {
      allowed: false,
      reason: `AI 생성 한도에 도달했습니다. (한도: ${limit}, 플랜: ${userPlan?.toUpperCase() || 'FREE'})`,
    };
  }

  return { allowed: true };
}

/**
 * 도구별 권한 체크 (메인 함수)
 */
export async function checkToolPermission(
  tool: ChatTool | null,
  userId: string | undefined,
  userPlan: string | undefined
): Promise<PermissionResult> {
  // 익명 사용자 기본 체크
  if (!userId) {
    const anonCheck = checkAnonymousPermission();
    if (!anonCheck.allowed) {
      return anonCheck;
    }
  }

  // 도구별 추가 체크
  switch (tool) {
    case 'troubleshoot':
      if (userId) {
        return checkTroubleshootPermission(userId);
      }
      break;

    case 'modeling':
      return checkModelingPermission(userId, userPlan);

    // gcode, price_comparison, general 등은 추가 체크 불필요
    default:
      break;
  }

  return { allowed: true };
}

/**
 * 도구별 사용량 증가
 */
export async function incrementToolUsage(
  tool: ChatTool | null,
  userId: string | undefined,
  isFallback: boolean = false
): Promise<void> {
  // 서버 연결 실패(fallback) 시 차감 안함
  if (isFallback) return;

  // 익명 사용자
  if (!userId) {
    incrementAnonymousUsage();
    return;
  }

  // 도구별 사용량 증가
  switch (tool) {
    case 'modeling':
      await incrementUsage(userId, USAGE_TYPES.AI_MODEL_GENERATION);
      break;

    case 'troubleshoot':
      await incrementTroubleshootAdvancedUsage(userId);
      break;

    // 다른 도구는 별도 사용량 추적 없음
    default:
      break;
  }
}
