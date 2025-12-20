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
import { Sun, Moon, Globe, MessageSquare, Printer, Sparkles, Rocket, Crown, Building2 } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@shared/types/subscription";

// 플랜별 배지 스타일 설정 (프리미엄 색상 채움)
const planBadgeConfig: Record<SubscriptionPlan, {
  label: string;
  icon: typeof Sparkles;
  bgColor: string;
  textColor: string;
  hoverBgColor: string;
}> = {
  free: {
    label: 'Free',
    icon: Sparkles,
    bgColor: 'bg-gradient-to-r from-purple-500 to-violet-600',
    textColor: 'text-white',
    hoverBgColor: 'hover:from-purple-600 hover:to-violet-700',
  },
  starter: {
    label: 'Starter',
    icon: Rocket,
    bgColor: 'bg-gradient-to-r from-amber-500 to-orange-500',
    textColor: 'text-white',
    hoverBgColor: 'hover:from-amber-600 hover:to-orange-600',
  },
  pro: {
    label: 'Pro',
    icon: Crown,
    bgColor: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    textColor: 'text-white',
    hoverBgColor: 'hover:from-blue-600 hover:to-indigo-700',
  },
  enterprise: {
    label: 'Enterprise',
    icon: Building2,
    bgColor: 'bg-gradient-to-r from-emerald-500 to-teal-600',
    textColor: 'text-white',
    hoverBgColor: 'hover:from-emerald-600 hover:to-teal-700',
  },
};

interface AppHeaderProps {
  sidebarOpen?: boolean;
  userPlan?: SubscriptionPlan;
}

export const AppHeader = ({ sidebarOpen = false, userPlan }: AppHeaderProps) => {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

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

  return (
    <header
      className={cn(
        "sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300",
        sidebarOpen ? "ml-52" : "ml-0"
      )}
    >
      <div className="relative flex h-16 items-center justify-center px-4">
        {/* 중앙: 탭 스위치 */}
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
              onClick={() => navigate('/dashboard')}
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
          </div>
        </div>

        {/* 오른쪽: 언어/테마 그룹 + 플랜 배지 (absolute 배치로 중앙 영향 없음) */}
        <div className="absolute right-4 flex items-center gap-3">
          {/* 언어 + 테마 버튼 그룹 */}
          <div className="flex items-center bg-muted rounded-full p-1">
            {/* 언어 선택 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full hover:bg-background"
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
              className="h-9 w-9 rounded-full hover:bg-background"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>

          {/* 플랜 배지 - 로그인한 사용자만 표시 */}
          {userPlan && (
            <Button
              variant="ghost"
              onClick={() => navigate('/subscription')}
              className={cn(
                "h-11 px-4 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 shadow-md hover:text-white",
                currentPlanConfig.bgColor,
                currentPlanConfig.textColor,
                currentPlanConfig.hoverBgColor
              )}
            >
              <PlanIcon className="w-4 h-4" />
              {currentPlanConfig.label}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
