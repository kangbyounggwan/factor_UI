import { type ReactNode, type ElementType } from "react";
import { cn } from "@/lib/utils";

interface AIPageHeaderProps {
  icon: ElementType;
  title: string;
  subtitle?: string;
  rightContent?: ReactNode;
  className?: string;
}

/**
 * AI 작업 공간 페이지 공통 헤더 컴포넌트
 * - 아이콘 + 제목 + 부제목 + 우측 컨텐츠
 */
export function AIPageHeader({
  icon: Icon,
  title,
  subtitle,
  rightContent,
  className,
}: AIPageHeaderProps) {
  return (
    <div className={cn("border-b bg-background/80 backdrop-blur-md px-6 py-4 flex-shrink-0 z-10 sticky top-0", className)}>
      <div className="flex items-center justify-between max-w-[1920px] mx-auto">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-muted ring-1 ring-border">
            <Icon className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {rightContent && (
          <div className="flex items-center gap-3">
            {rightContent}
          </div>
        )}
      </div>
    </div>
  );
}

export default AIPageHeader;
