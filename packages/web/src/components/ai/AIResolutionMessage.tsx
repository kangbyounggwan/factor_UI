/**
 * AI 해결하기 응답 메시지 컴포넌트
 * - Git 스타일 diff UI로 코드 수정 표시
 * - 이슈 업데이트 감지 및 표시
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  FileCode,
  GitCompare,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { IssueResolveResponse, CodeFix, UpdatedIssue } from '@/lib/api/gcode';

interface AIResolutionMessageProps {
  resolution: IssueResolveResponse;
  originalIssue?: {
    id?: string;
    line?: number;
    type?: string;
    severity?: string;
    title?: string;
    description?: string;
  };
  className?: string;
}

// 심각도 스타일
const severityStyles = {
  critical: {
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
    icon: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-500/10',
  },
  high: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 border-red-200 dark:border-red-500/30',
    icon: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-500/10',
  },
  medium: {
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 border-orange-200 dark:border-orange-500/30',
    icon: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-500/10',
  },
  low: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
    icon: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
  },
  none: {
    badge: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300 border-green-200 dark:border-green-500/30',
    icon: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-500/10',
  },
  info: {
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
    icon: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
  },
};

// Git 스타일 Diff 컴포넌트
function CodeDiffView({ codeFix, index, total }: { codeFix: CodeFix; index?: number; total?: number }) {
  const [copied, setCopied] = useState<'original' | 'fixed' | null>(null);

  if (!codeFix.has_fix || !codeFix.original || !codeFix.fixed) {
    return null;
  }

  // "라인번호: 코드" 형식에서 코드만 추출
  const parseCode = (codeStr: string) => {
    const lines = codeStr.split('\n');
    return lines.map(line => {
      const match = line.match(/^(\d+):\s*(.*)$/);
      if (match) {
        return { lineNum: match[1], code: match[2] };
      }
      return { lineNum: '', code: line };
    });
  };

  const originalLines = parseCode(codeFix.original);
  const fixedLines = parseCode(codeFix.fixed);

  const copyToClipboard = async (text: string, type: 'original' | 'fixed') => {
    try {
      // 라인 번호 제거하고 코드만 복사
      const codeOnly = text.split('\n').map(line => {
        const match = line.match(/^(\d+):\s*(.*)$/);
        return match ? match[2] : line;
      }).join('\n');

      await navigator.clipboard.writeText(codeOnly);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-950 font-mono text-xs">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 dark:bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-slate-400" />
          <span className="text-slate-300 font-medium">
            Line {codeFix.line_number}
            {total && total > 1 && (
              <span className="text-slate-500 ml-2">({index}/{total})</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-red-500/20 text-red-400 border-red-500/30">
            -{originalLines.length}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-green-500/20 text-green-400 border-green-500/30">
            +{fixedLines.length}
          </Badge>
        </div>
      </div>

      {/* 원본 코드 (삭제) */}
      <div className="relative group">
        <div className="absolute right-2 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-slate-200"
            onClick={() => copyToClipboard(codeFix.original || '', 'original')}
          >
            {copied === 'original' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </Button>
        </div>
        {originalLines.map((line, i) => (
          <div
            key={`orig-${i}`}
            className="flex items-start bg-red-950/40 border-l-2 border-red-500"
          >
            <span className="w-10 flex-shrink-0 px-2 py-0.5 text-right text-red-400/60 select-none border-r border-red-500/20">
              {line.lineNum}
            </span>
            <span className="w-6 flex-shrink-0 text-center py-0.5 text-red-400 font-bold select-none">
              -
            </span>
            <code className="flex-1 py-0.5 pr-2 text-red-300 whitespace-pre-wrap break-all">
              {line.code}
            </code>
          </div>
        ))}
      </div>

      {/* 수정된 코드 (추가) */}
      <div className="relative group">
        <div className="absolute right-2 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-slate-200"
            onClick={() => copyToClipboard(codeFix.fixed || '', 'fixed')}
          >
            {copied === 'fixed' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </Button>
        </div>
        {fixedLines.map((line, i) => (
          <div
            key={`fixed-${i}`}
            className="flex items-start bg-green-950/40 border-l-2 border-green-500"
          >
            <span className="w-10 flex-shrink-0 px-2 py-0.5 text-right text-green-400/60 select-none border-r border-green-500/20">
              {line.lineNum}
            </span>
            <span className="w-6 flex-shrink-0 text-center py-0.5 text-green-400 font-bold select-none">
              +
            </span>
            <code className="flex-1 py-0.5 pr-2 text-green-300 whitespace-pre-wrap break-all">
              {line.code}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}

// 이슈 업데이트 비교 컴포넌트
function IssueUpdateBadge({
  originalIssue,
  updatedIssue
}: {
  originalIssue?: { severity?: string; title?: string };
  updatedIssue?: UpdatedIssue;
}) {
  const { t } = useTranslation();

  if (!updatedIssue) return null;

  // 오탐 여부
  if (updatedIssue.is_false_positive) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30">
        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
        <div>
          <span className="font-medium text-green-700 dark:text-green-300">
            {t('aiResolution.falsePositive', '오탐 확인됨')}
          </span>
          {updatedIssue.false_positive_reason && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
              {updatedIssue.false_positive_reason}
            </p>
          )}
        </div>
      </div>
    );
  }

  // 심각도 변경 여부
  const severityChanged = originalIssue?.severity &&
    updatedIssue.severity &&
    originalIssue.severity !== updatedIssue.severity;

  if (severityChanged) {
    const oldStyle = severityStyles[originalIssue.severity as keyof typeof severityStyles] || severityStyles.info;
    const newStyle = severityStyles[updatedIssue.severity as keyof typeof severityStyles] || severityStyles.info;

    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {t('aiResolution.severityUpdated', '심각도 재평가:')}
          </span>
          <Badge className={cn('text-xs', oldStyle.badge)}>
            {originalIssue.severity?.toUpperCase()}
          </Badge>
          <ArrowRight className="w-4 h-4 text-blue-500" />
          <Badge className={cn('text-xs', newStyle.badge)}>
            {updatedIssue.severity?.toUpperCase()}
          </Badge>
        </div>
      </div>
    );
  }

  return null;
}

export function AIResolutionMessage({ resolution, originalIssue, className }: AIResolutionMessageProps) {
  const { t } = useTranslation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['explanation', 'solution']));

  const { explanation, solution, tips } = resolution.resolution;
  const updatedIssue = resolution.updated_issue;

  // 코드 픽스 목록 (그룹이면 code_fixes, 단일이면 code_fix)
  const codeFixes = useMemo(() => {
    if (solution.code_fixes && solution.code_fixes.length > 0) {
      return solution.code_fixes.filter(fix => fix.has_fix);
    }
    if (solution.code_fix?.has_fix) {
      return [solution.code_fix];
    }
    return [];
  }, [solution]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const severityStyle = severityStyles[explanation.severity as keyof typeof severityStyles] || severityStyles.info;

  // 심각도 아이콘
  const SeverityIcon = () => {
    switch (explanation.severity) {
      case 'critical':
        return <XCircle className={cn('w-5 h-5', severityStyle.icon)} />;
      case 'high':
        return <AlertCircle className={cn('w-5 h-5', severityStyle.icon)} />;
      case 'medium':
        return <AlertTriangle className={cn('w-5 h-5', severityStyle.icon)} />;
      case 'low':
        return <Info className={cn('w-5 h-5', severityStyle.icon)} />;
      case 'none':
        return <CheckCircle2 className={cn('w-5 h-5', severityStyle.icon)} />;
      default:
        return <Info className={cn('w-5 h-5', severityStyle.icon)} />;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 헤더 - 이슈 제목 및 심각도 */}
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-lg', severityStyle.bg)}>
          <Sparkles className="w-5 h-5 text-purple-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              {t('aiResolution.title', 'AI 분석 결과')}
            </h3>
            <Badge className={cn('text-xs', severityStyle.badge)}>
              <SeverityIcon />
              <span className="ml-1">{explanation.severity.toUpperCase()}</span>
            </Badge>
            {explanation.is_false_positive && (
              <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {t('aiResolution.noIssue', '문제 없음')}
              </Badge>
            )}
          </div>
          {updatedIssue?.title && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {updatedIssue.title}
            </p>
          )}
        </div>
      </div>

      {/* 이슈 업데이트 알림 */}
      <IssueUpdateBadge originalIssue={originalIssue} updatedIssue={updatedIssue} />

      {/* 문제 해설 섹션 */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          onClick={() => toggleSection('explanation')}
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {t('aiResolution.explanation', '문제 분석')}
            </span>
          </div>
          {expandedSections.has('explanation') ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {expandedSections.has('explanation') && (
          <div className="px-4 py-3 space-y-3 bg-white dark:bg-slate-900">
            {/* 요약 */}
            <div>
              <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                {t('aiResolution.summary', '요약')}
              </h4>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {explanation.summary}
              </p>
            </div>

            {/* 원인 분석 */}
            <div>
              <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                {t('aiResolution.cause', '원인')}
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {explanation.cause}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 해결 방안 섹션 */}
      {solution.action_needed && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={() => toggleSection('solution')}
          >
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-green-500" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {t('aiResolution.solution', '해결 방법')}
              </span>
              {codeFixes.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {codeFixes.length} {t('aiResolution.fixes', '수정')}
                </Badge>
              )}
            </div>
            {expandedSections.has('solution') ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {expandedSections.has('solution') && (
            <div className="px-4 py-3 space-y-4 bg-white dark:bg-slate-900">
              {/* 해결 단계 */}
              {solution.steps && solution.steps.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    {t('aiResolution.steps', '단계별 해결')}
                  </h4>
                  <ol className="list-decimal list-inside space-y-1.5">
                    {solution.steps.map((step, i) => (
                      <li key={i} className="text-sm text-slate-700 dark:text-slate-300">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* 코드 수정 (Git Diff UI) */}
              {codeFixes.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    {t('aiResolution.codeFix', '코드 수정')}
                  </h4>
                  <div className="space-y-3">
                    {codeFixes.map((fix, i) => (
                      <CodeDiffView
                        key={i}
                        codeFix={fix}
                        index={i + 1}
                        total={codeFixes.length}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 팁 섹션 */}
      {tips && tips.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
            onClick={() => toggleSection('tips')}
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-amber-700 dark:text-amber-300">
                {t('aiResolution.tips', '추가 팁')}
              </span>
            </div>
            {expandedSections.has('tips') ? (
              <ChevronDown className="w-4 h-4 text-amber-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-amber-500" />
            )}
          </button>

          {expandedSections.has('tips') && (
            <div className="px-4 py-3 border-t border-amber-200 dark:border-amber-500/30">
              <ul className="space-y-1.5">
                {tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                    <span className="text-amber-500 mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 조치 불필요 메시지 */}
      {!solution.action_needed && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          <p className="text-sm text-green-700 dark:text-green-300">
            {t('aiResolution.noActionNeeded', '별도의 조치가 필요하지 않습니다.')}
          </p>
        </div>
      )}
    </div>
  );
}

export default AIResolutionMessage;
