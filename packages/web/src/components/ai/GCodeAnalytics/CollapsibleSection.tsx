/**
 * 접을 수 있는 섹션 컴포넌트
 * G-code 분석 보고서에서 섹션을 접거나 펼칠 수 있게 함
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  highlight?: boolean;
  badge?: string;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  isExpanded,
  onToggle,
  highlight,
  badge,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      highlight
        ? "border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900"
        : "border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50"
    )}>
      <button
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 text-left transition-colors",
          highlight
            ? "bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
            : "hover:bg-slate-50 dark:hover:bg-slate-800"
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <span className={highlight ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}>{icon}</span>
          <span className={cn(
            "font-heading font-semibold text-sm",
            highlight ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300"
          )}>{title}</span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 transition-transform text-slate-400",
          isExpanded && "rotate-180"
        )} />
      </button>
      {isExpanded && (
        <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-700">
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsibleSection;
