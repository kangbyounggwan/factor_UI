/**
 * Admin 모드 사이드바 콘텐츠
 * - 관리자 메뉴 네비게이션
 */
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Shield,
  User as UserIcon,
  Brain,
  ChevronDown,
  BarChart3,
  MessageSquare,
  Box,
  Activity,
  CreditCard,
  Printer,
} from "lucide-react";

export function AdminSidebarContent() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <>
      <p className="text-sm font-semibold text-foreground px-2 py-2">
        {t('admin.title', '관리자')}
      </p>
      <nav className="space-y-1">
        <Link
          to="/admin"
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            location.pathname === '/admin'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Shield className="h-4 w-4 shrink-0" />
          <span>{t('admin.dashboard', '관리자 대시보드')}</span>
        </Link>

        <Link
          to="/admin/users"
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            location.pathname === '/admin/users'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <UserIcon className="h-4 w-4 shrink-0" />
          <span>{t('admin.userStats', '사용자 통계')}</span>
        </Link>

        {/* AI 분석 메뉴 (서브메뉴 포함) */}
        <div className="space-y-1">
          <Link
            to="/admin/ai-analytics"
            className={cn(
              "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              location.pathname.startsWith('/admin/ai-analytics')
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-3">
              <Brain className="h-4 w-4 shrink-0" />
              <span>{t('admin.aiAnalytics', 'AI 분석')}</span>
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              location.pathname.startsWith('/admin/ai-analytics') ? "rotate-0" : "-rotate-90"
            )} />
          </Link>

          {/* AI 분석 서브메뉴 */}
          {location.pathname.startsWith('/admin/ai-analytics') && (
            <div className="ml-4 pl-3 border-l border-border space-y-1">
              <Link
                to="/admin/ai-analytics"
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  location.pathname === '/admin/ai-analytics'
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <BarChart3 className="h-4 w-4 shrink-0" />
                <span>{t('admin.aiDashboard', '분석 대시보드')}</span>
              </Link>

              <Link
                to="/admin/ai-analytics/chat"
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  location.pathname === '/admin/ai-analytics/chat'
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span>{t('admin.chatAnalytics', '채팅 분석')}</span>
              </Link>

              <Link
                to="/admin/ai-analytics/models"
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  location.pathname === '/admin/ai-analytics/models'
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Box className="h-4 w-4 shrink-0" />
                <span>{t('admin.modelAnalytics', '모델 생성 분석')}</span>
              </Link>

              <Link
                to="/admin/ai-analytics/usage"
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  location.pathname === '/admin/ai-analytics/usage'
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Activity className="h-4 w-4 shrink-0" />
                <span>{t('admin.usageAnalytics', '사용량 분석')}</span>
              </Link>
            </div>
          )}
        </div>

        <Link
          to="/admin/subscriptions"
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            location.pathname === '/admin/subscriptions'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <CreditCard className="h-4 w-4 shrink-0" />
          <span>{t('admin.subscriptions', '구독 현황')}</span>
        </Link>

        <Link
          to="/admin/printers"
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            location.pathname === '/admin/printers'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Printer className="h-4 w-4 shrink-0" />
          <span>{t('admin.printers', '프린터')}</span>
        </Link>
      </nav>
    </>
  );
}

export default AdminSidebarContent;
