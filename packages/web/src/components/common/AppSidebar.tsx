/**
 * 앱 사이드바 컴포넌트
 * AI Chat, Dashboard, Settings 등에서 재사용 가능한 사이드바
 *
 * 사용 방법:
 * <AppSidebar {...baseProps}>
 *   <ChatSidebarContent {...chatProps} />
 * </AppSidebar>
 */
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Menu,
  PenSquare,
  LogIn,
  LogOut,
  Activity,
  Settings,
  Sparkles,
  Rocket,
  Crown,
  Building2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import type { SubscriptionPlan } from "@shared/types/subscription";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ReactNode } from "react";

// 타입 re-export for backward compatibility
export type {
  ChatSession,
  SettingsTab,
  PrinterDetailTab,
  ReportArchiveItem,
  PrinterQuickItem,
  PrinterAlertType,
  PrinterAlert,
  CommunitySidebarStats,
} from "@/components/sidebar/types";

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  user: User | null;
  userPlan?: SubscriptionPlan;
  onLoginClick?: () => void;
  onSignOut?: () => void;
  // 헤더 영역 액션 버튼 (예: 새 채팅 버튼)
  headerAction?: ReactNode;
  // 사이드바 콘텐츠 영역 - 페이지별로 다른 컴포넌트 전달
  children?: ReactNode;
  // 로고 클릭 시 동작 커스터마이징
  onLogoClick?: () => void;
  // 구독 플랜 카드 숨기기
  hidePlanCard?: boolean;
}

// 플랜별 표시 설정
const planConfig: Record<SubscriptionPlan, { label: string; icon: typeof Sparkles; colors: string }> = {
  free: {
    label: 'Free',
    icon: Sparkles,
    colors: 'from-blue-500/10 via-purple-500/10 to-pink-500/10 border-purple-500/20 hover:border-purple-500/40',
  },
  starter: {
    label: 'Starter',
    icon: Rocket,
    colors: 'from-sky-500/10 via-blue-500/10 to-indigo-500/10 border-blue-500/30 hover:border-blue-500/50',
  },
  pro: {
    label: 'Pro',
    icon: Crown,
    colors: 'from-amber-500/10 via-orange-500/10 to-yellow-500/10 border-amber-500/30 hover:border-amber-500/50',
  },
  enterprise: {
    label: 'Enterprise',
    icon: Building2,
    colors: 'from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border-emerald-500/30 hover:border-emerald-500/50',
  },
};


export function AppSidebar({
  isOpen,
  onToggle,
  user,
  userPlan = 'free',
  onLoginClick,
  onSignOut,
  headerAction,
  children,
  onLogoClick,
  hidePlanCard = false,
}: AppSidebarProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  // userPlan이 undefined이거나 planConfig에 없는 경우 'free'로 fallback
  const safePlan = userPlan && planConfig[userPlan] ? userPlan : 'free';
  const currentPlanConfig = planConfig[safePlan];
  const PlanIcon = currentPlanConfig.icon;

  const handleLogoClick = () => {
    if (onLogoClick) {
      onLogoClick();
    } else {
      window.location.href = '/ai-chat';
    }
  };

  return (
    <>
      {/* 사이드바 */}
      <div
        className={cn(
          "h-full bg-muted/50 border-r-2 border-border flex flex-col transition-all duration-300 shrink-0 shadow-sm",
          isOpen ? "w-80" : "w-0 overflow-hidden"
        )}
      >
        {/* 사이드바 헤더 - 메인 헤더와 높이 맞춤 */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-border/50">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={onToggle}
          >
            <Menu className="w-5 h-5" />
          </Button>
          {headerAction}
        </div>

        {/* 콘텐츠 영역 - children으로 전달받은 컴포넌트 렌더링 */}
        <div className="flex-1 overflow-auto p-3 flex flex-col min-h-0">
          {children}
        </div>

        {/* 하단 영역 */}
        <div className="p-3 pt-0 shrink-0 space-y-3">
          {/* 구독 플랜 배너 */}
          {!hidePlanCard && (
            <Link
              to="/subscribe"
              className={cn(
                "block w-full p-3 rounded-xl bg-gradient-to-r border transition-all",
                currentPlanConfig.colors
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-background/80 flex items-center justify-center">
                  <PlanIcon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{currentPlanConfig.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {safePlan === 'free'
                      ? t('subscription.upgradePrompt', '업그레이드하여 더 많은 기능을 사용하세요')
                      : t('subscription.currentPlan', '현재 플랜')}
                  </p>
                </div>
              </div>
            </Link>
          )}

          {/* 비로그인 시 로그인 버튼 */}
          {!user && onLoginClick && (
            <Button
              variant="default"
              className="w-full h-12 rounded-2xl shadow-lg gap-3 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white font-medium transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
              onClick={onLoginClick}
            >
              <LogIn className="w-5 h-5" />
              <span>{t('aiChat.loginToStart', '로그인하고 시작하기')}</span>
            </Button>
          )}

          {/* 로그인 사용자용 프로필 */}
          {user && (
            <div className="flex items-center gap-2 h-14 rounded-2xl shadow-md bg-background border px-3">
              {/* 프로필 (아바타 + 이름) */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* 아바타 */}
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={user.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                {/* 사용자 이름 */}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">
                    {user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User'}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </span>
                </div>
              </div>
              {/* 구분선 */}
              <div className="w-px h-8 bg-border" />
              {/* 설정 아이콘 */}
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full hover:bg-muted transition-all shrink-0"
                asChild
              >
                <Link to="/user-settings">
                  <Settings className="w-5 h-5 text-muted-foreground" />
                </Link>
              </Button>
              {/* 로그아웃 아이콘 */}
              {onSignOut && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full hover:bg-destructive/10 transition-all shrink-0"
                  onClick={onSignOut}
                >
                  <LogOut className="w-5 h-5 text-destructive" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 토글 버튼 + 로고 - 사이드바 상태에 따라 위치 변경, 모바일에서는 숨김 (AppHeader에서 표시) */}
      {!isMobile && (
        <div className={cn(
          "absolute h-14 z-30 flex items-center gap-3 transition-all duration-300",
          isOpen ? "left-[21rem]" : "left-4"
        )}>
          {!isOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-background shadow-md border"
              onClick={onToggle}
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}
          {/* FACTOR 로고 - 클릭 시 커스텀 동작 또는 AI Chat으로 이동 */}
          <button
            onClick={handleLogoClick}
            className="flex items-center space-x-2.5 cursor-pointer"
          >
            <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-3xl font-bold font-orbitron text-primary tracking-wide">
              FACTOR
            </span>
          </button>
        </div>
      )}
    </>
  );
}

export default AppSidebar;

// 하위 호환성을 위한 별칭 (deprecated)
export { AppSidebar as AIChatSidebar };

// 새 채팅 버튼 컴포넌트 - headerAction으로 전달할 때 사용
export function NewChatButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 rounded-full"
      onClick={onClick}
    >
      <PenSquare className="w-5 h-5" />
    </Button>
  );
}
