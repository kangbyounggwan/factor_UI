/**
 * 채팅 공유 기능 훅
 * - 대화 공유 링크 생성
 * - 공유 URL 복사
 * - 공유 모달 상태 관리
 */

import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { createSharedChat, type SharedMessage } from "@shared/services/supabaseService/sharedChat";
import type { Message } from "./useChatUtils";
import type { ChatSession } from "@/components/common/AppSidebar";

export interface UseChatSharingOptions {
  userId?: string;
}

export interface UseChatSharingReturn {
  // 상태
  isSharing: boolean;
  shareUrl: string | null;
  showShareModal: boolean;

  // 액션
  shareChat: (
    messages: Message[],
    options?: {
      currentSession?: ChatSession | null;
      currentSessionId?: string | null;
      chatSessions?: ChatSession[];
    }
  ) => Promise<void>;
  copyShareUrl: () => Promise<void>;
  closeShareModal: () => void;
  openShareModal: () => void;

  // 상태 설정
  setShareUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setShowShareModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useChatSharing(options?: UseChatSharingOptions): UseChatSharingReturn {
  const { t } = useTranslation();
  const { toast } = useToast();

  // 공유 관련 상태
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // 대화 공유 핸들러
  const shareChat = useCallback(async (
    messages: Message[],
    shareOptions?: {
      currentSession?: ChatSession | null;
      currentSessionId?: string | null;
      chatSessions?: ChatSession[];
    }
  ) => {
    if (messages.length === 0) {
      toast({
        title: t('aiChat.shareNoMessages', '공유할 대화가 없습니다'),
        variant: 'destructive',
      });
      return;
    }

    setIsSharing(true);
    try {
      // Message를 SharedMessage 형식으로 변환 (references, referenceImages 포함)
      const sharedMessages: SharedMessage[] = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        images: msg.images,
        files: msg.files,
        // AI 응답에 포함된 참고자료와 참조이미지도 저장
        references: msg.references,
        referenceImages: msg.referenceImages?.images?.map(img => ({
          title: img.title,
          thumbnail_url: img.thumbnail_url,
          source_url: img.source_url,
        })),
      }));

      // 세션 제목 또는 첫 메시지에서 제목 추출
      const currentSession = shareOptions?.currentSession ||
        shareOptions?.chatSessions?.find(s => s.id === shareOptions?.currentSessionId);
      const title = currentSession?.title ||
        (messages[0]?.content.slice(0, 50) + (messages[0]?.content.length > 50 ? '...' : '')) ||
        t('aiChat.sharedConversation', '공유된 대화');

      const result = await createSharedChat(sharedMessages, {
        userId: options?.userId,
        title,
        expiresInDays: 30, // 30일 후 만료
      });

      if (result) {
        setShareUrl(result.shareUrl);
        setShowShareModal(true);
      } else {
        throw new Error('Failed to create share link');
      }
    } catch (error) {
      console.error('[useChatSharing] Share error:', error);
      toast({
        title: t('aiChat.shareError', '공유 링크 생성 실패'),
        description: t('aiChat.shareErrorDesc', '잠시 후 다시 시도해주세요'),
        variant: 'destructive',
      });
    } finally {
      setIsSharing(false);
    }
  }, [options?.userId, t, toast]);

  // 클립보드 복사 핸들러
  const copyShareUrl = useCallback(async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: t('aiChat.shareCopied', '링크가 복사되었습니다'),
      });
    } catch {
      toast({
        title: t('aiChat.shareCopyError', '복사 실패'),
        variant: 'destructive',
      });
    }
  }, [shareUrl, toast, t]);

  // 공유 모달 닫기
  const closeShareModal = useCallback(() => {
    setShowShareModal(false);
  }, []);

  // 공유 모달 열기
  const openShareModal = useCallback(() => {
    setShowShareModal(true);
  }, []);

  return {
    // 상태
    isSharing,
    shareUrl,
    showShareModal,

    // 액션
    shareChat,
    copyShareUrl,
    closeShareModal,
    openShareModal,

    // 상태 설정
    setShareUrl,
    setShowShareModal,
  };
}
