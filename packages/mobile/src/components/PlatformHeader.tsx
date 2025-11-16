import { ReactNode } from 'react';
import { useSafeAreaStyle } from '@/hooks/usePlatform';
import { cn } from '@/lib/utils';

interface PlatformHeaderProps {
  children: ReactNode;
  className?: string;
  sticky?: boolean;
}

/**
 * 플랫폼별 SafeArea를 자동으로 처리하는 헤더 컴포넌트
 * - iOS: safe-area-inset-top + 1rem 패딩
 * - Android/Web: 1rem 패딩만
 */
export const PlatformHeader = ({ children, className, sticky = true }: PlatformHeaderProps) => {
  const safeAreaStyle = useSafeAreaStyle({
    top: true,
    topPadding: '1rem',
  });

  // 디버깅: 적용된 스타일 확인
  console.log('[PlatformHeader] SafeArea Style:', safeAreaStyle);

  return (
    <div
      className={cn(
        sticky && 'sticky top-0 z-10',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b px-4 pb-3',
        className
      )}
      style={safeAreaStyle}
    >
      {children}
    </div>
  );
};
