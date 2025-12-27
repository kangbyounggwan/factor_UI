/**
 * 이벤트 배너 컴포넌트
 * 사이트 접속 시 프로모션 배너 표시
 */
import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 이미지 직접 import (Vite에서 확실히 번들링)
import eventBanner1 from "@/assets/banners/event-banner-1.jpg";
import eventBanner2 from "@/assets/banners/event-banner-2.jpg";

const BANNER_DISMISSED_DATE_KEY = "factor_event_banner_dismissed_date";

// 이벤트 종료일 (2026.01.31)
const EVENT_END_DATE = new Date("2026-01-31T23:59:59");

// 배너 이미지들
const bannerImages = [
  {
    src: eventBanner1,
    alt: "회원 참여 이벤트 - 커피 쿠폰 무료 증정",
  },
  {
    src: eventBanner2,
    alt: "이벤트 참여 방법 안내",
  },
];

interface EventBannerProps {
  className?: string;
}

export function EventBanner({ className }: EventBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [errorImages, setErrorImages] = useState<Set<number>>(new Set());

  useEffect(() => {
    // 이벤트 종료 확인
    if (new Date() > EVENT_END_DATE) {
      return;
    }

    // "오늘 하루 보지 않기" 확인
    const dismissedDate = localStorage.getItem(BANNER_DISMISSED_DATE_KEY);
    if (dismissedDate) {
      const dismissed = new Date(dismissedDate);
      const now = new Date();
      // 같은 날이면 표시하지 않음
      if (
        dismissed.getFullYear() === now.getFullYear() &&
        dismissed.getMonth() === now.getMonth() &&
        dismissed.getDate() === now.getDate()
      ) {
        return;
      }
    }

    // 약간의 지연 후 표시 (페이지 로드 후)
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // X 버튼: 단순히 닫기 (다시 접속하면 다시 보임)
  const handleClose = () => {
    setIsVisible(false);
  };

  // 오늘 하루 보지 않기: 오늘 하루 동안 숨김
  const handleDismissToday = () => {
    setIsVisible(false);
    localStorage.setItem(BANNER_DISMISSED_DATE_KEY, new Date().toISOString());
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? bannerImages.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === bannerImages.length - 1 ? 0 : prev + 1));
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300",
        className
      )}
    >
      <div className="relative max-w-lg w-full mx-4 animate-in zoom-in-95 duration-300">
        {/* 닫기 버튼 - 단순 닫기 */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-12 right-0 text-white hover:bg-white/20 z-10"
          onClick={handleClose}
        >
          <X className="h-6 w-6" />
        </Button>

        {/* 이미지 슬라이더 */}
        <div className="relative rounded-lg overflow-hidden shadow-2xl bg-background">
          {/* 이미지 */}
          <div className="relative aspect-[3/4] max-h-[80vh] overflow-hidden">
            {errorImages.has(currentIndex) ? (
              <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
                <span>이미지를 불러올 수 없습니다</span>
              </div>
            ) : (
              <>
                <img
                  src={bannerImages[currentIndex].src}
                  alt={bannerImages[currentIndex].alt}
                  className={cn(
                    "w-full h-full object-contain transition-opacity duration-300",
                    loadedImages.has(currentIndex) ? "opacity-100" : "opacity-0"
                  )}
                  onLoad={() => {
                    setLoadedImages(prev => new Set(prev).add(currentIndex));
                  }}
                  onError={(e) => {
                    console.error(`Failed to load banner image: ${bannerImages[currentIndex].src}`, e);
                    setErrorImages(prev => new Set(prev).add(currentIndex));
                  }}
                />
                {!loadedImages.has(currentIndex) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </>
            )}
          </div>

          {/* 이전/다음 버튼 */}
          {bannerImages.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full"
                onClick={goToNext}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>

              {/* 인디케이터 */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {bannerImages.map((_, index) => (
                  <button
                    key={index}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      currentIndex === index
                        ? "bg-white w-4"
                        : "bg-white/50 hover:bg-white/80"
                    )}
                    onClick={() => setCurrentIndex(index)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* 하단 버튼 - 오늘 하루 보지 않기만 */}
        <div className="flex justify-center mt-4">
          <Button
            variant="ghost"
            className="text-white/70 hover:text-white hover:bg-white/10 text-sm"
            onClick={handleDismissToday}
          >
            오늘 하루 보지 않기
          </Button>
        </div>
      </div>
    </div>
  );
}

export default EventBanner;
