import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface WheelPickerProps {
  options: string[];
  value?: string;
  onChange: (value: string) => void;
  itemHeight?: number;
  className?: string;
}

export const WheelPicker: React.FC<WheelPickerProps> = ({
  options,
  value,
  onChange,
  itemHeight = 56,
  className = '',
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const stopTimer = useRef<number | null>(null);
  const isUserScrolling = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 컨테이너 높이와 패딩 계산
  const containerHeight = 280;
  const paddingHeight = (containerHeight - itemHeight) / 2;

  // value가 옵션에 없으면 보정
  const safeValue = useMemo(() => {
    if (!options || options.length === 0) return undefined;
    if (value != null && options.includes(value)) return value;
    return options[0];
  }, [options, value]);

  // 현재 선택된 인덱스 계산
  const targetIndex = useMemo(() => {
    if (!safeValue || options.length === 0) return 0;
    const idx = options.indexOf(safeValue);
    return idx >= 0 ? idx : 0;
  }, [options, safeValue]);

  // 스크롤 위치에서 현재 인덱스 계산
  const getIndexFromScrollTop = useCallback((scrollTop: number) => {
    // 컨테이너 중앙 위치 = scrollTop + containerHeight / 2
    // 아이템의 중앙 위치 = paddingHeight + index * itemHeight + itemHeight / 2
    // 두 값이 같을 때가 선택된 상태
    const centerOffset = scrollTop + containerHeight / 2 - paddingHeight - itemHeight / 2;
    const index = Math.round(centerOffset / itemHeight);
    return Math.max(0, Math.min(options.length - 1, index));
  }, [containerHeight, itemHeight, options.length, paddingHeight]);

  // 인덱스에서 스크롤 위치 계산
  const getScrollTopFromIndex = useCallback((idx: number) => {
    // 아이템 중앙을 컨테이너 중앙에 맞추기
    return paddingHeight + idx * itemHeight - (containerHeight - itemHeight) / 2;
  }, [containerHeight, itemHeight, paddingHeight]);

  // 인덱스로 스크롤
  const scrollToIndex = useCallback(
    (idx: number, smooth = true) => {
      const el = listRef.current;
      if (!el) return;
      const target = getScrollTopFromIndex(idx);
      el.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' });
    },
    [getScrollTopFromIndex]
  );

  // 최초/옵션/value 변경시 스크롤
  useEffect(() => {
    if (!isUserScrolling.current) {
      scrollToIndex(targetIndex, false);
      setCurrentIndex(targetIndex);
    }
  }, [targetIndex, scrollToIndex]);

  // 스크롤 중 최근접 인덱스를 추적하고, 멈춘 뒤 스냅 및 onChange
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;

    isUserScrolling.current = true;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const nearest = getIndexFromScrollTop(el.scrollTop);
      setCurrentIndex(nearest);

      // 스크롤 멈춤 감지
      if (stopTimer.current) window.clearTimeout(stopTimer.current);
      stopTimer.current = window.setTimeout(() => {
        const snapTop = getScrollTopFromIndex(nearest);

        // 스냅 위치로 정렬
        if (Math.abs(el.scrollTop - snapTop) > 1) {
          el.scrollTo({ top: snapTop, behavior: 'smooth' });
        }

        // onChange 호출
        const selectedValue = options[nearest];
        if (selectedValue && selectedValue !== value) {
          onChange(selectedValue);
        }

        isUserScrolling.current = false;
      }, 150);
    });
  }, [getIndexFromScrollTop, getScrollTopFromIndex, onChange, options, value]);

  // 클릭 핸들러
  const handleItemClick = useCallback((idx: number) => {
    scrollToIndex(idx, true);
    setCurrentIndex(idx);
    // 스크롤 애니메이션 후 onChange
    setTimeout(() => {
      onChange(options[idx]);
      isUserScrolling.current = false;
    }, 300);
  }, [onChange, options, scrollToIndex]);

  return (
    <div className={cn('relative w-full', className)}>
      {/* 선택선 */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-10"
        style={{
          top: '50%',
          transform: `translateY(-${itemHeight / 2}px)`,
          height: itemHeight,
          borderTop: '2px solid hsl(var(--primary) / 0.3)',
          borderBottom: '2px solid hsl(var(--primary) / 0.3)',
          backgroundColor: 'hsl(var(--primary) / 0.05)',
        }}
      />

      {/* 상하 페이드 그라디언트 */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* 리스트 */}
      <div
        ref={listRef}
        className="h-[280px] overflow-y-auto overscroll-contain px-2"
        style={{
          scrollBehavior: 'smooth',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
        }}
        onScroll={handleScroll}
      >
        {/* 상단 패딩 - 첫 항목이 중앙에 올 수 있도록 */}
        <div style={{ height: paddingHeight }} />

        {options.map((opt, i) => (
          <div
            key={`${opt}-${i}`}
            className={cn(
              'flex items-center justify-center transition-all duration-200 cursor-pointer',
              i === currentIndex
                ? 'font-semibold text-foreground text-lg'
                : 'text-muted-foreground text-base'
            )}
            style={{
              height: itemHeight,
              lineHeight: `${itemHeight}px`,
            }}
            aria-selected={i === currentIndex}
            role="option"
            onClick={() => handleItemClick(i)}
          >
            {opt}
          </div>
        ))}

        {/* 하단 패딩 - 마지막 항목이 중앙에 올 수 있도록 */}
        <div style={{ height: paddingHeight }} />
      </div>
    </div>
  );
};
