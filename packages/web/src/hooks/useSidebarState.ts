import { useState, useEffect, useCallback } from 'react';

const SIDEBAR_STATE_KEY = 'app:sidebar:open';

/**
 * 사이드바 상태를 localStorage로 페이지 간 공유하는 훅
 * Dashboard, AIChat, AI (Create), UserSettings 등에서 사용
 */
export function useSidebarState(defaultOpen = true) {
  // localStorage에서 초기값 로드
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultOpen;
    const stored = localStorage.getItem(SIDEBAR_STATE_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
    return defaultOpen;
  });

  // 상태 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem(SIDEBAR_STATE_KEY, String(isOpen));
  }, [isOpen]);

  // 다른 탭/창에서 변경 시 동기화
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SIDEBAR_STATE_KEY && e.newValue !== null) {
        setIsOpen(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    setIsOpen,
    toggle,
    open,
    close,
  };
}
