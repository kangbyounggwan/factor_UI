/**
 * 보고서 완료 카드 (Gemini 스타일)
 * G-code 분석이 완료되면 채팅에 카드 형태로 표시
 * 클릭하면 보고서 패널 열기/닫기
 */
import { useTranslation } from 'react-i18next';
import { FileCode2, ChevronRight, Check, Clock, Layers, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReportCompletionCardProps {
  reportId: string;
  fileName: string;
  completedAt: Date;
  overallScore?: number;
  overallGrade?: string;
  totalIssues?: number;
  layerCount?: number;
  printTime?: string;
  isOpen: boolean;
  isActive?: boolean; // 현재 활성화된 보고서인지 (다른 보고서가 열려있으면 false)
  onClick: () => void;
}

export function ReportCompletionCard({
  fileName,
  completedAt,
  overallScore,
  overallGrade,
  totalIssues,
  layerCount,
  printTime,
  isOpen,
  isActive = true, // 기본값 true (하위 호환성)
  onClick,
}: ReportCompletionCardProps) {
  const { t } = useTranslation();

  // 등급에 따른 색상
  const getGradeColor = (grade?: string) => {
    switch (grade) {
      case 'A':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
      case 'B':
        return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30';
      case 'C':
        return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30';
      case 'D':
        return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
      case 'F':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
      default:
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800';
    }
  };

  // 시간 포맷팅
  const formatTime = (date: Date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? '오후' : '오전';
    const hour12 = hours % 12 || 12;
    return `${month}월 ${day}일 ${ampm} ${hour12}:${minutes.toString().padStart(2, '0')}`;
  };

  // 비활성화 상태 (다른 보고서가 열려있음)
  const isInactive = !isActive && !isOpen;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full max-w-md text-left rounded-2xl border-2 p-4 transition-all duration-200 group',
        isInactive
          ? 'bg-gray-100 dark:bg-gray-800/50 opacity-60'
          : 'bg-white dark:bg-gray-900',
        isOpen
          ? 'border-blue-500 shadow-lg shadow-blue-500/20'
          : isInactive
            ? 'border-gray-300 dark:border-gray-600'
            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
      )}
    >
      {/* 상단: 아이콘 + 제목 + 상태 */}
      <div className="flex items-start gap-3">
        {/* 아이콘 */}
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          isOpen
            ? 'bg-blue-500'
            : isInactive
              ? 'bg-gray-300 dark:bg-gray-600'
              : 'bg-blue-100 dark:bg-blue-900/50 group-hover:bg-blue-500'
        )}>
          <FileCode2 className={cn(
            'w-5 h-5 transition-colors',
            isOpen
              ? 'text-white'
              : isInactive
                ? 'text-gray-500 dark:text-gray-400'
                : 'text-blue-600 dark:text-blue-400 group-hover:text-white'
          )} />
        </div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          {/* 제목 */}
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">
              {t('aiChat.gcodeAnalysisReport', 'G-code 보고서')}
            </h3>
            {overallGrade && (
              <span className={cn(
                'text-xs font-bold px-2 py-0.5 rounded-full',
                getGradeColor(overallGrade)
              )}>
                {overallGrade}
              </span>
            )}
          </div>

          {/* 파일명 */}
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {fileName}
          </p>

          {/* 메트릭 */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {overallScore !== undefined && (
              <span className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-green-500" />
                {t('aiChat.score', '점수')} {overallScore}
              </span>
            )}
            {totalIssues !== undefined && totalIssues > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                {t('aiChat.issues', '이슈')} {totalIssues}
              </span>
            )}
            {layerCount !== undefined && (
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                {layerCount} {t('aiChat.layers', '레이어')}
              </span>
            )}
            {printTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {printTime}
              </span>
            )}
          </div>
        </div>

        {/* 화살표 */}
        <ChevronRight className={cn(
          'w-5 h-5 text-muted-foreground shrink-0 transition-transform',
          isOpen && 'rotate-90'
        )} />
      </div>

      {/* 하단: 완료 시간 */}
      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
        <p className="text-xs text-muted-foreground">
          {formatTime(completedAt)}
        </p>
      </div>
    </button>
  );
}

export default ReportCompletionCard;
