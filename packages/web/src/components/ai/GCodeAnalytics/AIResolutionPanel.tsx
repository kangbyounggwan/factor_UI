/**
 * AI 해결 결과 패널 컴포넌트
 * G-code 분석에서 발견된 이슈에 대한 AI 해결 방안을 표시
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  Info,
  Target,
  FileCode,
  X,
  Zap,
  Edit3,
} from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import {
  stripLineNumber,
  extractLineNumber,
} from '@shared/utils/ai/gcodeAnalytics';
import type { IssueResolveResponse } from '@/lib/api/gcode';
import type { SeverityLevel } from './GCodeAnalysisReport';

// Severity 라벨 훅 (번역 포함)
type SeverityLevelWithNone = SeverityLevel | 'none';

function useSeverityLabels(): Record<SeverityLevelWithNone, string> {
  const { t } = useTranslation();
  return {
    none: t('gcodeAnalytics.severityNone', '없음'),
    info: t('gcodeAnalytics.severityInfo', '정보'),
    low: t('gcodeAnalytics.severityLow', '낮음'),
    medium: t('gcodeAnalytics.severityMedium', '중간'),
    high: t('gcodeAnalytics.severityHigh', '높음'),
    critical: t('gcodeAnalytics.severityCritical', '치명적'),
  };
}

export interface CodeFix {
  line_number: number | null;
  original: string | null;
  fixed: string | null;
  has_fix?: boolean;
}

export interface AIResolutionPanelProps {
  resolution: IssueResolveResponse;
  onClose: () => void;
  onViewCode?: () => void;
  onViewCodeFix?: (fix: CodeFix) => void;
}

export function AIResolutionPanel({
  resolution,
  onClose,
  onViewCode,
  onViewCodeFix
}: AIResolutionPanelProps) {
  const { t } = useTranslation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['explanation']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const { explanation, solution, tips } = resolution.resolution;

  // 디버그: solution 구조 확인
  console.log('[AIResolutionPanel] solution:', solution);
  console.log('[AIResolutionPanel] solution.code_fix:', solution?.code_fix);
  console.log('[AIResolutionPanel] solution.code_fixes:', solution?.code_fixes);

  // 디버그: code_fixes 배열 각 항목 상세 출력
  if (solution?.code_fixes) {
    console.log('[AIResolutionPanel] code_fixes length:', solution.code_fixes.length);
    solution.code_fixes.forEach((fix, idx) => {
      console.log(`[AIResolutionPanel] code_fixes[${idx}]:`, {
        line_number: fix.line_number,
        has_fix: fix.has_fix,
        original: fix.original ? `"${fix.original.substring(0, 50)}..."` : null,
        fixed: fix.fixed ? `"${fix.fixed.substring(0, 50)}..."` : null,
        original_type: typeof fix.original,
        fixed_type: typeof fix.fixed,
        passesFilter: !!(fix.original && fix.fixed)
      });
    });
    const filtered = solution.code_fixes.filter(fix => fix.original && fix.fixed);
    console.log('[AIResolutionPanel] filtered code_fixes count:', filtered.length);
  }

  // 공통 유틸리티 사용
  const severityLabels = useSeverityLabels();

  // 오탐 여부에 따라 헤더 색상/텍스트 변경
  const isNormal = explanation.is_false_positive;

  return (
    <div className={cn(
      "mt-4 border rounded-xl overflow-hidden",
      isNormal
        ? "bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200 dark:border-emerald-800/50"
        : "bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 border-violet-200 dark:border-violet-800/50"
    )}>
      {/* 헤더 */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 text-white",
        isNormal
          ? "bg-gradient-to-r from-emerald-600 to-green-600"
          : "bg-gradient-to-r from-violet-600 to-indigo-600"
      )}>
        <div className="flex items-center gap-2">
          {isNormal ? <CheckCircle2 className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
          <span className="font-heading font-bold text-sm">
            {isNormal
              ? t('gcodeAnalytics.analysisResultNormal', '분석 결과: 정상')
              : t('gcodeAnalytics.aiResolution', 'AI 해결 방안')
            }
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-3">
        {/* 분석 요약 */}
        <CollapsibleSection
          title={t('gcodeAnalytics.analysisSummary', '분석 요약')}
          icon={<Target className="h-4 w-4" />}
          isExpanded={expandedSections.has('explanation')}
          onToggle={() => toggleSection('explanation')}
        >
          <div className="space-y-2 text-sm">
            <p className="text-slate-600 dark:text-slate-400">{explanation.summary}</p>
            <p>
              <strong className="text-slate-700 dark:text-slate-300">{t('gcodeAnalytics.cause', '원인')}:</strong>{' '}
              <span className="text-slate-600 dark:text-slate-400">{explanation.cause}</span>
            </p>
            {!isNormal && explanation.severity !== 'none' && (
              <p>
                <strong className="text-slate-700 dark:text-slate-300">{t('gcodeAnalytics.severity', '심각도')}:</strong>{' '}
                <span className={cn(
                  "font-medium",
                  explanation.severity === 'critical' && "text-rose-600 dark:text-rose-400",
                  explanation.severity === 'high' && "text-red-600 dark:text-red-400",
                  explanation.severity === 'medium' && "text-orange-600 dark:text-orange-400",
                  explanation.severity === 'low' && "text-amber-600 dark:text-amber-400",
                )}>
                  {severityLabels[explanation.severity] || explanation.severity}
                </span>
              </p>
            )}
          </div>
        </CollapsibleSection>

        {/* 해결 방안 (조치가 필요한 경우에만) */}
        {solution.action_needed && (
          <CollapsibleSection
            title={t('gcodeAnalytics.solutionTitle', '해결 방안')}
            icon={<CheckCircle2 className="h-4 w-4" />}
            isExpanded={expandedSections.has('solution')}
            onToggle={() => toggleSection('solution')}
            highlight
          >
            <div className="space-y-2 text-sm">
              {solution.steps?.length > 0 && (
                <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400">
                  {solution.steps.map((step, i) => <li key={`solution-step-${i}-${step.slice(0, 20)}`}>{step}</li>)}
                </ol>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* 코드 수정 (있는 경우) */}
        {(solution.code_fix?.has_fix || (solution.code_fixes && solution.code_fixes.length > 0)) && (
          <CollapsibleSection
            title={t('gcodeAnalytics.codeFix', '코드 수정')}
            icon={<FileCode className="h-4 w-4" />}
            isExpanded={expandedSections.has('code_fix')}
            onToggle={() => toggleSection('code_fix')}
            badge={solution.code_fixes && solution.code_fixes.length > 1 ? `${solution.code_fixes.length}건` : undefined}
          >
            <div className="space-y-4 text-sm">
              {/* 그룹화된 코드 수정 (code_fixes 배열) */}
              {solution.code_fixes && solution.code_fixes.length > 0 ? (
                solution.code_fixes.filter(fix => fix.original && fix.fixed).map((fix, fixIdx, filteredArr) => (
                  <div key={fixIdx} className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    {/* 라인 번호 헤더 - 클릭하여 에디터로 이동 */}
                    {fix.line_number && (
                      <div
                        className={cn(
                          "px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2",
                          onViewCodeFix && "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors group"
                        )}
                        onClick={() => onViewCodeFix?.(fix)}
                        role={onViewCodeFix ? "button" : undefined}
                        tabIndex={onViewCodeFix ? 0 : undefined}
                        onKeyDown={(e) => {
                          if (onViewCodeFix && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            onViewCodeFix(fix);
                          }
                        }}
                      >
                        <span className={cn(
                          "text-xs font-mono bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300",
                          onViewCodeFix && "group-hover:bg-blue-100 dark:group-hover:bg-blue-800 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors"
                        )}>
                          LN {fix.line_number.toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {t('gcodeAnalytics.fixNumber', '수정 {{n}}', { n: fixIdx + 1 })} / {filteredArr.length}
                        </span>
                        {onViewCodeFix && (
                          <span className="ml-auto text-xs text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Edit3 className="h-3 w-3" />
                            {t('gcodeAnalytics.editInViewer', '에디터에서 수정')}
                          </span>
                        )}
                      </div>
                    )}
                    {/* 원본 코드 */}
                    <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                      <div className="px-3 py-1.5 bg-red-100 dark:bg-red-900/40 border-b border-red-200 dark:border-red-800">
                        <span className="text-xs text-red-600 dark:text-red-400 font-semibold">{t('gcodeAnalytics.original', '원본')}</span>
                      </div>
                      <div className="p-3 overflow-x-auto">
                        {fix.original!.split('\n').map((line, idx) => (
                          <div key={idx} className="flex font-mono text-xs leading-relaxed">
                            <span className="w-16 flex-shrink-0 text-red-400 dark:text-red-500 select-none pr-2 text-right border-r border-red-200 dark:border-red-700 mr-3">
                              {extractLineNumber(line)}
                            </span>
                            <span className="text-red-700 dark:text-red-300 whitespace-pre">
                              {stripLineNumber(line)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* 수정 코드 */}
                    <div className="bg-emerald-50 dark:bg-emerald-900/20">
                      <div className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/40 border-b border-emerald-200 dark:border-emerald-800">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{t('gcodeAnalytics.fixed', '수정')}</span>
                      </div>
                      <div className="p-3 overflow-x-auto">
                        {fix.fixed!.split('\n').map((line, idx) => (
                          <div key={idx} className="flex font-mono text-xs leading-relaxed">
                            <span className="w-16 flex-shrink-0 text-emerald-400 dark:text-emerald-500 select-none pr-2 text-right border-r border-emerald-200 dark:border-emerald-700 mr-3">
                              {extractLineNumber(line)}
                            </span>
                            <span className="text-emerald-700 dark:text-emerald-300 whitespace-pre">
                              {stripLineNumber(line)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                /* 단일 코드 수정 (code_fix) - 하위 호환성 */
                solution.code_fix?.original && solution.code_fix?.fixed && (
                  <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    {/* 원본 코드 */}
                    <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                      <div className="px-3 py-1.5 bg-red-100 dark:bg-red-900/40 border-b border-red-200 dark:border-red-800">
                        <span className="text-xs text-red-600 dark:text-red-400 font-semibold">{t('gcodeAnalytics.original', '원본')}</span>
                      </div>
                      <div className="p-3 overflow-x-auto">
                        {solution.code_fix.original.split('\n').map((line, idx) => (
                          <div key={idx} className="flex font-mono text-xs leading-relaxed">
                            <span className="w-16 flex-shrink-0 text-red-400 dark:text-red-500 select-none pr-2 text-right border-r border-red-200 dark:border-red-700 mr-3">
                              {extractLineNumber(line)}
                            </span>
                            <span className="text-red-700 dark:text-red-300 whitespace-pre">
                              {stripLineNumber(line)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* 수정 코드 */}
                    <div className="bg-emerald-50 dark:bg-emerald-900/20">
                      <div className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/40 border-b border-emerald-200 dark:border-emerald-800">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{t('gcodeAnalytics.fixed', '수정')}</span>
                      </div>
                      <div className="p-3 overflow-x-auto">
                        {solution.code_fix.fixed.split('\n').map((line, idx) => (
                          <div key={idx} className="flex font-mono text-xs leading-relaxed">
                            <span className="w-16 flex-shrink-0 text-emerald-400 dark:text-emerald-500 select-none pr-2 text-right border-r border-emerald-200 dark:border-emerald-700 mr-3">
                              {extractLineNumber(line)}
                            </span>
                            <span className="text-emerald-700 dark:text-emerald-300 whitespace-pre">
                              {stripLineNumber(line)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              )}
              {onViewCode && (
                <Button size="sm" variant="outline" className="mt-2 gap-2" onClick={onViewCode}>
                  <Edit3 className="h-3 w-3" />
                  {t('gcodeAnalytics.editInViewer', '에디터에서 수정')}
                </Button>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* 팁 */}
        {tips?.length > 0 && (
          <CollapsibleSection
            title={t('gcodeAnalytics.tips', '팁')}
            icon={<Info className="h-4 w-4" />}
            isExpanded={expandedSections.has('tips')}
            onToggle={() => toggleSection('tips')}
          >
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400">
              {tips.map((tip, i) => (
                <li key={i} className="[&>p]:inline [&>p]:m-0 [&_strong]:font-semibold [&_strong]:text-slate-700 [&_strong]:dark:text-slate-300 [&_code]:bg-slate-100 [&_code]:dark:bg-slate-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <>{children}</> }}>
                    {tip}
                  </ReactMarkdown>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}

export default AIResolutionPanel;
