import { useState, useEffect, CSSProperties } from 'react';
import { Capacitor } from '@capacitor/core';

export type Platform = 'ios' | 'android' | 'web';

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
    // Android: 고정 패딩만 (시스템바는 자동 처리됨)
    if (top && topPadding !== '0') {
      style.paddingTop = topPadding;
    }
    if (bottom && bottomPadding !== '0') {
      style.paddingBottom = bottomPadding;
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
  const style = getSafeAreaStyle(platform, config);

  // 디버깅: 플랫폼과 생성된 스타일 확인
  console.log('[useSafeAreaStyle] Platform:', platform, 'Config:', config, 'Style:', style);

  return style;
};
