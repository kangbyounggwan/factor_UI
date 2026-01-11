/**
 * AI 채팅 페이지용 심플 헤더 컴포넌트
 * - AI 도구 / 프린터 탭 스위치
 * - 언어, 테마, 플랜 배지
 */
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sun, Moon, Globe, MessageSquare, Printer, Sparkles, Rocket, Crown, Building2, Shield, Activity, Users } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@shared/types/subscription";
import { useAuth } from "@shared/contexts/AuthContext";
import { useUserPlan } from "@shared/hooks/useUserPlan";
import { useUserRole } from "@shared/hooks/useUserRole";

// 플랜별 배지 스타일 설정 (밝고 투명한 색상)
const planBadgeConfig: Record<SubscriptionPlan, {
  label: string;
  icon: typeof Sparkles;
  bgColor: string;
  textColor: string;
  hoverBgColor: string;
  borderColor: string;
}> = {
  free: {
    label: 'Free',
    icon: Sparkles,
    bgColor: 'bg-purple-500/15',
    textColor: 'text-purple-600 dark:text-purple-400',
    hoverBgColor: 'hover:bg-purple-500/25',
    borderColor: 'border border-purple-500/30',
  },
  starter: {
    label: 'Starter',
    icon: Rocket,
    bgColor: 'bg-amber-500/15',
    textColor: 'text-amber-600 dark:text-amber-400',
    hoverBgColor: 'hover:bg-amber-500/25',
    borderColor: 'border border-amber-500/30',
  },
  pro: {
    label: 'Pro',
    icon: Crown,
    bgColor: 'bg-blue-500/15',
    textColor: 'text-blue-600 dark:text-blue-400',
    hoverBgColor: 'hover:bg-blue-500/25',
    borderColor: 'border border-blue-500/30',
  },
  enterprise: {
    label: 'Enterprise',
    icon: Building2,
    bgColor: 'bg-emerald-500/15',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    hoverBgColor: 'hover:bg-emerald-500/25',
    borderColor: 'border border-emerald-500/30',
  },
};

interface AppHeaderProps {
  sidebarOpen?: boolean;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  showTabSwitch?: boolean;
  onLoginRequired?: () => void; // 로그인이 필요할 때 호출되는 콜백
}

export const AppHeader = ({ leftContent, rightContent, showTabSwitch = true, onLoginRequired }: AppHeaderProps) => {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan: userPlan } = useUserPlan(user?.id);
  const { isAdmin } = useUserRole();
  const isMobile = useIsMobile();

  const currentLanguage = i18n.language || 'ko';

  // 플랜 설정 (기본값: free)
  const safePlan = userPlan && planBadgeConfig[userPlan] ? userPlan : 'free';
  const currentPlanConfig = planBadgeConfig[safePlan];
  const PlanIcon = currentPlanConfig.icon;

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // 현재 활성 탭
  const isAITools = location.pathname.includes('/ai-chat') || location.pathname.includes('/create');
  const isPrinter = location.pathname.includes('/dashboard') || location.pathname.includes('/printer');
  const isCommunity = location.pathname.includes('/community');
  const isAdminPage = location.pathname.includes('/admin');

  return (
    <header
      className={cn(
        "sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      )}
    >
      <div className="relative flex h-14 sm:h-16 items-center justify-center px-4">
        {/* 왼쪽: 모바일에서는 로고, 데스크탑에서는 커스텀 콘텐츠 */}
        <div className="absolute left-4 flex items-center">
          {isMobile ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 bg-primary rounded-lg">
                <Activity className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold font-orbitron text-primary tracking-wide">
                FACTOR
              </span>
            </div>
          ) : (
            leftContent
          )}
        </div>

        {/* 중앙: 탭 스위치 */}
        {showTabSwitch && (
          <div className="hidden sm:flex items-center">
            <div className="flex items-center bg-muted rounded-full p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/ai-chat')}
                className={cn(
                  "rounded-full px-5 h-9 text-sm font-medium transition-colors",
                  isAITools
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {t('nav.aiTools', 'AI 도구')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!user && onLoginRequired) {
                    onLoginRequired();
                  } else {
                    navigate('/dashboard');
                  }
                }}
                className={cn(
                  "rounded-full px-5 h-9 text-sm font-medium transition-colors",
                  isPrinter
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Printer className="w-4 h-4 mr-2" />
                {t('nav.printers', '프린터')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/community')}
                className={cn(
                  "rounded-full px-5 h-9 text-sm font-medium transition-colors",
                  isCommunity
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Users className="w-4 h-4 mr-2" />
                {t('nav.community', '커뮤니티')}
              </Button>
              {/* 관리자 탭 - 관리자만 표시 */}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className={cn(
                    "rounded-full px-5 h-9 text-sm font-medium transition-colors",
                    isAdminPage
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {t('nav.admin', '관리자')}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 오른쪽: 언어/테마 그룹 + 플랜 배지 + 커스텀 콘텐츠 */}
        <div className="absolute right-4 flex items-center gap-2 sm:gap-3">
          {/* 커스텀 오른쪽 콘텐츠 */}
          {rightContent}
          {/* 언어 + 테마 버튼 그룹 */}
          <div className="flex items-center bg-muted rounded-full p-0.5 sm:p-1">
            {/* 언어 선택 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-full hover:bg-background"
                >
                  <Globe className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => changeLanguage('ko')}>
                  한국어 {currentLanguage === 'ko' && '✓'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('en')}>
                  English {currentLanguage === 'en' && '✓'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 테마 토글 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full hover:bg-background"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>

          {/* 플랜 배지 - 로그인한 사용자만 표시, 모바일에서는 아이콘만 */}
          {user && (
            <Button
              variant="ghost"
              onClick={() => navigate('/subscription')}
              className={cn(
                "h-8 sm:h-9 rounded-full text-sm font-medium transition-all flex items-center gap-1.5",
                isMobile ? "w-8 p-0 justify-center" : "px-3",
                currentPlanConfig.bgColor,
                currentPlanConfig.textColor,
                currentPlanConfig.hoverBgColor,
                currentPlanConfig.borderColor
              )}
            >
              <PlanIcon className="w-4 h-4" />
              {!isMobile && currentPlanConfig.label}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
