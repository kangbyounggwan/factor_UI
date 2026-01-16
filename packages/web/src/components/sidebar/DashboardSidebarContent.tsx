/**
 * Dashboard 모드 사이드바 콘텐츠
 * - 프린터 빠른 선택
 * - 알림/경고
 * - 커뮤니티 통계
 */
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Printer,
  Bell,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  TrendingUp,
  FileText,
  MessageSquare,
  Users,
  ThumbsUp,
  Clock,
} from "lucide-react";
import type { PrinterQuickItem, PrinterAlert, CommunitySidebarStats } from "./types";

interface DashboardSidebarContentProps {
  printers: PrinterQuickItem[];
  onSelectPrinter?: (printer: PrinterQuickItem) => void;
  alerts: PrinterAlert[];
  onDismissAlert?: (alertId: string) => void;
  communityStats?: CommunitySidebarStats | null;
}

export function DashboardSidebarContent({
  printers,
  onSelectPrinter,
  alerts,
  onDismissAlert,
  communityStats,
}: DashboardSidebarContentProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      {/* 프린터 빠른 선택 */}
      <div className="px-2">
        <div className="flex items-center justify-between px-2 py-2">
          <p className="text-sm font-semibold text-foreground">
            {t('dashboard.printerQuickSelect', '프린터')}
          </p>
        </div>
        {printers.length > 0 ? (
          <div className="space-y-2">
            {printers.slice(0, 4).map((printer) => (
              <div
                key={printer.id}
                onClick={() => onSelectPrinter?.(printer)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all",
                  "bg-background border border-border/60 shadow-sm hover:border-border hover:shadow-md"
                )}
              >
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0",
                  printer.isOnline ? "bg-green-500" : "bg-gray-400"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{printer.name}</p>
                  {printer.model && (
                    <p className="text-xs text-muted-foreground truncate">{printer.model}</p>
                  )}
                </div>
                {printer.progress !== undefined && printer.progress > 0 && (
                  <div className="text-xs font-medium text-blue-500">
                    {printer.progress}%
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Printer className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">
              {t('dashboard.noRegisteredPrinters', '아직 등록된 프린터가 없습니다.')}
            </p>
          </div>
        )}
      </div>

      {/* 알림/경고 */}
      <div className="px-2">
        <div className="flex items-center justify-between px-2 py-2">
          <p className="text-sm font-semibold text-foreground">
            {t('dashboard.alerts', '알림')}
          </p>
          {alerts.length > 0 && (
            <span className="text-xs text-muted-foreground">{alerts.length}</span>
          )}
        </div>
        {alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert) => {
              const AlertIcon = alert.type === 'error' ? AlertCircle
                : alert.type === 'warning' ? AlertTriangle
                : alert.type === 'success' ? CheckCircle
                : Info;
              const alertColor = alert.type === 'error' ? 'text-red-500'
                : alert.type === 'warning' ? 'text-amber-500'
                : alert.type === 'success' ? 'text-green-500'
                : 'text-blue-500';

              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50 group"
                >
                  <AlertIcon className={cn("h-4 w-4 shrink-0 mt-0.5", alertColor)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{alert.printerName}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{alert.message}</p>
                  </div>
                  {onDismissAlert && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismissAlert(alert.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">
              {t('dashboard.noAlerts', '새로운 알림이 없습니다')}
            </p>
          </div>
        )}
      </div>

      {/* 커뮤니티 통계 */}
      {communityStats && (
        <div className="px-2">
          <div className="flex items-center gap-2 px-2 py-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">
              {t('community.stats', '커뮤니티 현황')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 px-1">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border/60">
              <FileText className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{t('community.totalPosts', '총 게시물')}</p>
                <p className="font-semibold text-sm">{communityStats.totalPosts.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border/60">
              <MessageSquare className="w-4 h-4 text-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{t('community.totalComments', '총 댓글')}</p>
                <p className="font-semibold text-sm">{communityStats.totalComments.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border/60">
              <Users className="w-4 h-4 text-purple-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{t('community.totalMembers', '가입자')}</p>
                <p className="font-semibold text-sm">{communityStats.totalUsers.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border/60">
              <ThumbsUp className="w-4 h-4 text-red-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{t('community.totalLikes', '총 좋아요')}</p>
                <p className="font-semibold text-sm">{communityStats.totalLikes.toLocaleString()}</p>
              </div>
            </div>
          </div>
          {communityStats.todayPosts > 0 && (
            <div className="mt-2 mx-1 flex items-center gap-2 text-xs text-muted-foreground px-2">
              <Clock className="w-3.5 h-3.5" />
              {t('community.todayPosts', '오늘 {{count}}개의 새 글', { count: communityStats.todayPosts })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DashboardSidebarContent;
