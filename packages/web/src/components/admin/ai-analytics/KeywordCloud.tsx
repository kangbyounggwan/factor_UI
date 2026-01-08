import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface KeywordData {
  keyword: string;
  count: number;
  source_type?: string;
}

interface KeywordCloudProps {
  keywords: KeywordData[];
  maxFontSize?: number;
  minFontSize?: number;
  onKeywordClick?: (keyword: string) => void;
  className?: string;
}

// 색상 팔레트 (source_type별)
const sourceColors: Record<string, string[]> = {
  chat: ['#3b82f6', '#60a5fa', '#93c5fd'], // blue
  troubleshoot: ['#f59e0b', '#fbbf24', '#fcd34d'], // amber
  model_prompt: ['#8b5cf6', '#a78bfa', '#c4b5fd'], // violet
  gcode: ['#10b981', '#34d399', '#6ee7b7'], // emerald
  default: ['#6b7280', '#9ca3af', '#d1d5db'], // gray
};

export function KeywordCloud({
  keywords,
  maxFontSize = 48,
  minFontSize = 12,
  onKeywordClick,
  className,
}: KeywordCloudProps) {
  const processedKeywords = useMemo(() => {
    if (!keywords || keywords.length === 0) return [];

    const maxCount = Math.max(...keywords.map(k => k.count));
    const minCount = Math.min(...keywords.map(k => k.count));
    const range = maxCount - minCount || 1;

    return keywords.map((keyword, index) => {
      // 폰트 크기 계산 (로그 스케일)
      const normalized = (keyword.count - minCount) / range;
      const fontSize = minFontSize + (maxFontSize - minFontSize) * Math.sqrt(normalized);

      // 색상 선택
      const colors = sourceColors[keyword.source_type || 'default'] || sourceColors.default;
      const colorIndex = index % colors.length;

      // 불투명도 (빈도가 높을수록 진하게)
      const opacity = 0.6 + normalized * 0.4;

      return {
        ...keyword,
        fontSize: Math.round(fontSize),
        color: colors[colorIndex],
        opacity,
      };
    });
  }, [keywords, maxFontSize, minFontSize]);

  if (!keywords || keywords.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-64 text-muted-foreground", className)}>
        키워드 데이터가 없습니다
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-2 p-4 min-h-[200px]",
        className
      )}
    >
      {processedKeywords.map((keyword, index) => (
        <button
          key={`${keyword.keyword}-${index}`}
          onClick={() => onKeywordClick?.(keyword.keyword)}
          className={cn(
            "transition-all duration-200 hover:scale-110 cursor-pointer",
            "px-2 py-1 rounded-md hover:bg-accent/50",
            onKeywordClick && "hover:underline"
          )}
          style={{
            fontSize: `${keyword.fontSize}px`,
            color: keyword.color,
            opacity: keyword.opacity,
            fontWeight: keyword.fontSize > 30 ? 600 : 400,
          }}
          title={`${keyword.keyword}: ${keyword.count}회 (${keyword.source_type || 'unknown'})`}
        >
          {keyword.keyword}
        </button>
      ))}
    </div>
  );
}

// 소스 타입별 필터 버튼 컴포넌트
interface SourceFilterProps {
  selectedSource: string | null;
  onSourceChange: (source: string | null) => void;
}

export function KeywordSourceFilter({ selectedSource, onSourceChange }: SourceFilterProps) {
  const sources = [
    { value: null, label: '전체', color: '#6b7280' },
    { value: 'chat', label: '채팅', color: '#3b82f6' },
    { value: 'troubleshoot', label: '문제진단', color: '#f59e0b' },
    { value: 'model_prompt', label: '모델 프롬프트', color: '#8b5cf6' },
    { value: 'gcode', label: 'G-code', color: '#10b981' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => (
        <button
          key={source.value || 'all'}
          onClick={() => onSourceChange(source.value)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
            "border-2",
            selectedSource === source.value
              ? "text-white"
              : "bg-background hover:bg-accent"
          )}
          style={{
            borderColor: source.color,
            backgroundColor: selectedSource === source.value ? source.color : undefined,
            color: selectedSource === source.value ? 'white' : source.color,
          }}
        >
          {source.label}
        </button>
      ))}
    </div>
  );
}

export default KeywordCloud;
