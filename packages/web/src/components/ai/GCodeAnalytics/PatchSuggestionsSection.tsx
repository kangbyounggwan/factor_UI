/**
 * 패치 제안 섹션 컴포넌트
 * G-code 분석 보고서에서 수정 제안을 표시
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FileCode, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PatchSuggestion } from './GCodeAnalysisReport';

export interface PatchSuggestionsSectionProps {
  patches: PatchSuggestion[];
}

// 액션별 스타일 정의
const actionColors: Record<string, string> = {
  remove: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',
  modify: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
  insert: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
  insert_after: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
};

export function PatchSuggestionsSection({ patches }: PatchSuggestionsSectionProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const displayedPatches = showAll ? patches : patches.slice(0, 3);

  const getActionLabel = (action: string) => {
    return t(`gcodeAnalytics.patchAction.${action}`);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      {/* 헤더 */}
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
            <FileCode className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-heading font-bold text-slate-900 dark:text-white">
            {t('gcodeAnalytics.patchSuggestions')}
          </h3>
          <span className="text-sm font-score font-black bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-3 py-1 rounded-full">
            {t('gcodeAnalytics.patchCount', { count: patches.length })}
          </span>
        </div>
        {patches.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-sm font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
          >
            {showAll ? t('gcodeAnalytics.collapse') : t('gcodeAnalytics.showAll', { count: patches.length })}
          </Button>
        )}
      </div>

      {/* 패치 목록 */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {displayedPatches.map((patch, index) => {
          const actionColor = actionColors[patch.action] || actionColors.modify;
          return (
            <div key={index} className="p-6 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
              {/* 라인 번호 및 액션 */}
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Line
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">
                    {patch.line || patch.line_index || 'N/A'}
                  </span>
                </span>
                <span className={cn("text-xs px-2.5 py-1 rounded border font-bold uppercase tracking-wider", actionColor)}>
                  {getActionLabel(patch.action)}
                </span>
              </div>

              {/* 코드 변경 표시 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Code */}
                {(patch.action === 'remove' || patch.action === 'modify') && patch.original && (
                  <div className="group/code">
                    <span className="text-xs font-heading font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                      {t('gcodeAnalytics.original')}
                    </span>
                    <div className="relative bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                      <code className="block p-3 pl-4 font-mono text-xs md:text-sm text-red-300 overflow-x-auto">
                        - {patch.original}
                      </code>
                    </div>
                  </div>
                )}

                {/* Modified Code */}
                {(patch.action === 'insert' || patch.action === 'insert_after' || patch.action === 'modify') && patch.modified && (
                  <div className="group/code">
                    <span className="text-xs font-heading font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                      {t('gcodeAnalytics.modified')}
                    </span>
                    <div className="relative bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                      <code className="block p-3 pl-4 font-mono text-xs md:text-sm text-emerald-300 overflow-x-auto">
                        + {patch.modified}
                      </code>
                    </div>
                  </div>
                )}
              </div>

              {/* 이유 설명 */}
              <div className="mt-4 flex items-start gap-2 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/20">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-sm font-body text-slate-600 dark:text-slate-400 leading-relaxed">
                  {patch.reason}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PatchSuggestionsSection;
