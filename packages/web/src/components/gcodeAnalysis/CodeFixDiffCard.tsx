/**
 * 코드 수정 Diff 카드 컴포넌트 (GitHub 스타일)
 * - AI 해결 결과의 코드 수정을 GitHub diff 형식으로 표시
 * - 각 수정마다 개별 카드로 표시
 * - 클릭 시 에디터 탭으로 이동
 */
import { useState } from "react";
import { FileCode2, Edit3, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

// 코드 수정 정보 타입
export interface CodeFixInfo {
  line_number?: number;
  original?: string | null;
  fixed?: string | null;
  has_fix?: boolean;
}

interface CodeFixDiffCardProps {
  codeFixes: CodeFixInfo[];
  gcodeContext?: string;
  gcodeContent?: string; // 전체 G-code 파일 내용
  extractGcodeContext?: (content: string, lineNumber: number, contextSize: number) => string;
  onFixClick?: (fix: CodeFixInfo, context: string) => void;
  maxVisible?: number;
}

export const CodeFixDiffCard = ({
  codeFixes,
  gcodeContext,
  gcodeContent,
  extractGcodeContext,
  onFixClick,
  maxVisible = 5,
}: CodeFixDiffCardProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!codeFixes || codeFixes.length === 0) {
    return null;
  }

  // 표시할 항목 수 결정
  const visibleFixes = isExpanded ? codeFixes : codeFixes.slice(0, maxVisible);
  const hasMore = codeFixes.length > maxVisible;

  const handleFixClick = (fix: CodeFixInfo) => {
    if (fix.line_number) {
      // 전체 G-code가 있으면 해당 라인에 맞는 컨텍스트 추출
      let contextToUse = gcodeContext;
      if (gcodeContent && extractGcodeContext) {
        contextToUse = extractGcodeContext(gcodeContent, fix.line_number, 30);
      }

      if (contextToUse && onFixClick) {
        onFixClick(fix, contextToUse);
      } else {
        toast({
          title: t('aiChat.noGcodeData', 'G-code 데이터 없음'),
          description: t('aiChat.noGcodeDataDesc', '코드 수정을 위한 G-code 컨텍스트가 없습니다.'),
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: t('aiChat.noGcodeData', 'G-code 데이터 없음'),
        description: t('aiChat.noGcodeDataDesc', '코드 수정을 위한 G-code 컨텍스트가 없습니다.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="pl-8 mt-4 space-y-3">
      {visibleFixes.map((fix, idx) => (
        <div
          key={idx}
          onClick={() => handleFixClick(fix)}
          className="group cursor-pointer rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 transition-all"
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                @@ Line {fix.line_number} @@
              </span>
            </div>
            <Edit3 className="h-3.5 w-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {/* Diff 내용 */}
          <div>
            {/* 삭제 라인 (빨간색) */}
            <div className="flex font-mono text-xs">
              <div className="w-16 flex-shrink-0 text-right px-3 py-1.5 bg-red-100 dark:bg-red-950/50 text-red-400 dark:text-red-500 select-none border-r border-red-200 dark:border-red-900">
                {fix.line_number}
              </div>
              <div className="w-6 flex-shrink-0 text-center py-1.5 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 font-bold select-none">
                -
              </div>
              <div className="flex-1 py-1.5 px-3 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 overflow-x-auto whitespace-nowrap">
                {fix.original?.split('\n')[0]?.replace(/^\d+:\s*/, '') || ''}
              </div>
            </div>
            {/* 추가 라인 (녹색) */}
            <div className="flex font-mono text-xs">
              <div className="w-16 flex-shrink-0 text-right px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-400 dark:text-emerald-500 select-none border-r border-emerald-200 dark:border-emerald-900">
                {fix.line_number}
              </div>
              <div className="w-6 flex-shrink-0 text-center py-1.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-bold select-none">
                +
              </div>
              <div className="flex-1 py-1.5 px-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 overflow-x-auto whitespace-nowrap">
                {fix.fixed?.split('\n')[0]?.replace(/^\d+:\s*/, '') || ''}
              </div>
            </div>
          </div>
        </div>
      ))}
      {/* 더보기/접기 버튼 */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              {t('aiChat.showLess', '접기')}
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              +{codeFixes.length - maxVisible} {t('aiChat.moreFixes', '개 더 보기')}
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default CodeFixDiffCard;
