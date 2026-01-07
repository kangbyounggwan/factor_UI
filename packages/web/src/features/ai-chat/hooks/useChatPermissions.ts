/**
 * 채팅 권한 관리 훅
 *
 * 책임:
 * - 도구별 사용 권한 체크
 * - 사용량 추적 및 증가
 * - 로그인 모달 표시 로직
 */

import { useState, useCallback } from 'react';
import type { ChatTool, PermissionResult } from '../types';
import {
  checkToolPermission,
  incrementToolUsage,
  checkAnonymousPermission,
  checkTroubleshootPermission,
  checkModelingPermission,
} from '../services';

export interface UseChatPermissionsOptions {
  userId?: string;
  userPlan?: 'free' | 'starter' | 'pro' | 'enterprise';
}

export interface UseChatPermissionsReturn {
  // 상태
  showLoginModal: boolean;
  lastPermissionError: string | null;

  // 권한 체크
  checkPermission: (tool: ChatTool) => Promise<PermissionResult>;
  checkAndHandlePermission: (tool: ChatTool) => Promise<boolean>;

  // 사용량 증가
  incrementUsage: (tool: ChatTool, isFallback?: boolean) => Promise<void>;

  // 모달 제어
  setShowLoginModal: (show: boolean) => void;
  closeLoginModal: () => void;

  // 권한 유틸리티
  isAnonymous: boolean;
  canUseTroubleshoot: () => Promise<boolean>;
  canUseModeling: () => Promise<boolean>;
}

/**
 * 채팅 권한 관리 훅
 */
export function useChatPermissions({
  userId,
  userPlan = 'free',
}: UseChatPermissionsOptions = {}): UseChatPermissionsReturn {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [lastPermissionError, setLastPermissionError] = useState<string | null>(null);

  const isAnonymous = !userId || userId.startsWith('anonymous_');

  /**
   * 권한 체크
   */
  const checkPermission = useCallback(
    async (tool: ChatTool): Promise<PermissionResult> => {
      setLastPermissionError(null);

      const result = await checkToolPermission(tool, userId, userPlan);

      if (!result.allowed && result.reason) {
        setLastPermissionError(result.reason);
      }

      return result;
    },
    [userId, userPlan]
  );

  /**
   * 권한 체크 및 처리 (모달 표시 포함)
   */
  const checkAndHandlePermission = useCallback(
    async (tool: ChatTool): Promise<boolean> => {
      const result = await checkPermission(tool);

      if (!result.allowed) {
        if (result.showLoginModal) {
          setShowLoginModal(true);
        }
        return false;
      }

      return true;
    },
    [checkPermission]
  );

  /**
   * 사용량 증가
   */
  const incrementUsage = useCallback(
    async (tool: ChatTool, isFallback?: boolean) => {
      await incrementToolUsage(tool, userId, isFallback);
    },
    [userId]
  );

  /**
   * 로그인 모달 닫기
   */
  const closeLoginModal = useCallback(() => {
    setShowLoginModal(false);
    setLastPermissionError(null);
  }, []);

  /**
   * 문제진단 사용 가능 여부
   */
  const canUseTroubleshoot = useCallback(async (): Promise<boolean> => {
    if (isAnonymous) {
      const result = checkAnonymousPermission();
      return result.allowed;
    }

    if (userId) {
      const result = await checkTroubleshootPermission(userId);
      return result.allowed;
    }

    return false;
  }, [userId, isAnonymous]);

  /**
   * 모델링 사용 가능 여부
   */
  const canUseModeling = useCallback(async (): Promise<boolean> => {
    const result = await checkModelingPermission(userId, userPlan);
    return result.allowed;
  }, [userId, userPlan]);

  return {
    showLoginModal,
    lastPermissionError,
    checkPermission,
    checkAndHandlePermission,
    incrementUsage,
    setShowLoginModal,
    closeLoginModal,
    isAnonymous,
    canUseTroubleshoot,
    canUseModeling,
  };
}

export default useChatPermissions;
