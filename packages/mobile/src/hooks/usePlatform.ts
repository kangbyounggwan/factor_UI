import { useState, useEffect, CSSProperties } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

export type Platform = 'ios' | 'android' | 'web';

/**
 * 키보드 표시 상태를 감지하는 훅
 * 키보드가 올라오면 하단 SafeArea를 비활성화하는 데 사용
 */
export const useKeyboardVisible = (): boolean => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let showListener: { remove: () => Promise<void> } | null = null;
    let hideListener: { remove: () => Promise<void> } | null = null;

    const setupListeners = async () => {
      showListener = await Keyboard.addListener('keyboardWillShow', () => {
        setIsKeyboardVisible(true);
      });
      hideListener = await Keyboard.addListener('keyboardWillHide', () => {
        setIsKeyboardVisible(false);
      });
    };

    setupListeners();

    return () => {
      showListener?.remove();
      hideListener?.remove();
    };
  }, []);

  return isKeyboardVisible;
};

export const usePlatform = (): Platform => {
  // 초기값을 직접 Capacitor.getPlatform()으로 설정하여 첫 렌더링부터 올바른 플랫폼 감지
  const [platform, setPlatform] = useState<Platform>(() => Capacitor.getPlatform() as Platform);

  useEffect(() => {
    const currentPlatform = Capacitor.getPlatform() as Platform;
    // 플랫폼이 변경되었을 때만 업데이트 (hot reload 대응)
    if (currentPlatform !== platform) {
      setPlatform(currentPlatform);
    }
  }, [platform]);

  return platform;
};

export const getPlatform = (): Platform => {
  return Capacitor.getPlatform() as Platform;
};

/**
 * 플랫폼별 SafeArea 스타일 반환
 * iOS: env(safe-area-inset-*) 사용
 * Android/Web: 고정 패딩 사용
 */
export interface SafeAreaConfig {
  top?: boolean;
  bottom?: boolean;
  topPadding?: string; // 추가 패딩 (예: '1rem')
  bottomPadding?: string; // 추가 패딩 (예: '1.5rem')
}

export const getSafeAreaStyle = (
  platform: Platform,
  config: SafeAreaConfig = {}
): CSSProperties => {
  const {
    top = false,
    bottom = false,
    topPadding = '0',
    bottomPadding = '0',
  } = config;

  const style: CSSProperties = {};

  if (platform === 'ios') {
    // iOS: safe-area-inset + 추가 패딩
    if (top) {
      style.paddingTop = topPadding === '0'
        ? 'env(safe-area-inset-top, 0px)'
        : `calc(env(safe-area-inset-top, 0px) + ${topPadding})`;
    }
    if (bottom) {
      style.paddingBottom = bottomPadding === '0'
        ? 'env(safe-area-inset-bottom, 0px)'
        : `calc(env(safe-area-inset-bottom, 0px) + ${bottomPadding})`;
    }
  } else if (platform === 'android') {
    // Android: 상단바(24px) + 추가 패딩
    // StatusBar overlays: true이므로 수동으로 상단 여백 확보
    if (top) {
      const statusBarHeight = '24px'; // Android 상태바 표준 높이
      style.paddingTop = topPadding === '0'
        ? statusBarHeight
        : `calc(${statusBarHeight} + ${topPadding})`;
    }
    // Android: 하단 네비게이션바(48px) + 추가 패딩
    if (bottom) {
      const navBarHeight = '48px'; // Android 네비게이션바 표준 높이
      style.paddingBottom = bottomPadding === '0'
        ? navBarHeight
        : `calc(${navBarHeight} + ${bottomPadding})`;
    }
  } else {
    // Web: 고정 패딩만
    if (top && topPadding !== '0') {
      style.paddingTop = topPadding;
    }
    if (bottom && bottomPadding !== '0') {
      style.paddingBottom = bottomPadding;
    }
  }

  return style;
};

/**
 * Hook: 플랫폼별 SafeArea 스타일 반환
 */
export const useSafeAreaStyle = (config: SafeAreaConfig = {}): CSSProperties => {
  const platform = usePlatform();
  return getSafeAreaStyle(platform, config);
};
