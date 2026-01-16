/**
 * Chat 모드 사이드바 콘텐츠
 * - 보고서 아카이브
 * - 최근 대화 목록
 */
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MessageSquare, Trash2, FileCode } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { ChatSession, ReportArchiveItem } from "./types";

interface ChatSidebarContentProps {
  user: User | null;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onLoadSession?: (session: ChatSession) => void;
  onDeleteSession?: (sessionId: string) => void;
  // 보고서 아카이브
  reports: ReportArchiveItem[];
  currentReportId: string | null;
  onSelectReport?: (report: ReportArchiveItem) => void;
  onDeleteReport?: (reportId: string) => void;
  onViewMoreReports?: () => void;
  archiveViewActive: boolean;
}

export function ChatSidebarContent({
  user,
  sessions,
  currentSessionId,
  onLoadSession,
  onDeleteSession,
  reports,
  currentReportId,
  onSelectReport,
  onDeleteReport,
  onViewMoreReports,
  archiveViewActive,
}: ChatSidebarContentProps) {
  const { t } = useTranslation();

  const handleDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteSession?.(sessionId);
  };

  return (
    <>
      {/* 보고서 아카이브 섹션 - 보고서가 있을 때만 표시 */}
      {reports.length > 0 && (
        <div className="shrink-0 mb-3">
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-sm font-semibold text-foreground">
              {t('aiChat.reportArchive', '보고서 아카이브')}
            </p>
            {onViewMoreReports && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={onViewMoreReports}
              >
                {archiveViewActive ? t('aiChat.close', '닫기') : t('aiChat.viewMore', '더보기')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {reports.slice(0, 3).map((report) => (
              <div
                key={report.id}
                onClick={() => onSelectReport?.(report)}
                className={cn(
                  "group relative flex-1 p-2 rounded-lg cursor-pointer transition-all border",
                  currentReportId === report.id
                    ? "bg-primary/10 border-primary/30"
                    : "bg-muted/50 border-border hover:bg-muted hover:border-border/80"
                )}
              >
                {/* 삭제 버튼 */}
                {onDeleteReport && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteReport(report.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                )}
                {/* 점수 아이콘 */}
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 mx-auto",
                  report.overallGrade === 'S' ? "bg-violet-500/20 text-violet-600 dark:text-violet-400" :
                  report.overallGrade === 'A' ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                  report.overallGrade === 'B' ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" :
                  report.overallGrade === 'C' ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" :
                  "bg-red-500/20 text-red-600 dark:text-red-400"
                )}>
                  <FileCode className="w-4 h-4" />
                </div>
                {/* 파일명 */}
                <p className="text-xs font-medium truncate text-center" title={report.fileName}>
                  {report.fileName.replace(/\.gcode$/i, '').slice(0, 8)}
                </p>
                {/* 점수 */}
                {report.overallScore !== undefined && (
                  <p className={cn(
                    "text-[10px] font-bold text-center mt-0.5",
                    report.overallGrade === 'S' ? "text-violet-600 dark:text-violet-400" :
                    report.overallGrade === 'A' ? "text-emerald-600 dark:text-emerald-400" :
                    report.overallGrade === 'B' ? "text-blue-600 dark:text-blue-400" :
                    report.overallGrade === 'C' ? "text-amber-600 dark:text-amber-400" :
                    "text-red-600 dark:text-red-400"
                  )}>
                    {report.overallGrade} · {report.overallScore}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 최근 대화 섹션 */}
      <p className="text-sm font-semibold text-foreground px-2 py-2 shrink-0">
        {t('aiChat.recentChats', '최근 대화')}
      </p>
      {sessions.length === 0 ? (
        <div className="px-2 py-4 space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            {t('aiChat.noHistory', '대화 기록이 없습니다')}
          </p>
          {/* 비로그인 시 대화 저장 안내 */}
          {!user && (
            <div className="bg-muted/80 border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">
                {t('aiChat.loginBenefit', '로그인하면 대화 기록을 저장하고 나중에 다시 볼 수 있습니다.')}
              </p>
            </div>
          )}
        </div>
      ) : (
        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onLoadSession?.(session)}
                className={cn(
                  "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                  currentSessionId === session.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-sm truncate">{session.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleDelete(session.id, e)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </>
  );
}

export default ChatSidebarContent;
