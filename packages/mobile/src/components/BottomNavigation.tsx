import { useNavigate, useLocation } from "react-router-dom";
import { Home, Sparkles, Settings, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useSafeAreaStyle } from "@/hooks/usePlatform";

/**
 * 플랫폼별 SafeArea를 자동으로 처리하는 하단 네비게이션 바
 * - iOS: safe-area-inset-bottom만 적용
 * - Android/Web: 추가 패딩 없음
 */
export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // 하단 SafeArea만 적용 (추가 패딩 없음)
  const safeAreaStyle = useSafeAreaStyle({
    bottom: true,
    bottomPadding: '0',
  });

  const navItems = [
    {
      path: "/dashboard",
      icon: Home,
      label: t("nav.dashboard", "Dashboard"),
    },
    {
      path: "/create",
      icon: Sparkles,
      label: t("nav.aiStudio", "AI Studio"),
    },
    {
      path: "/settings",
      icon: Settings,
      label: t("nav.settings", "Settings"),
    },
    {
      path: "/user-settings",
      icon: User,
      label: t("nav.profile", "Profile"),
    },
  ];

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border"
      style={safeAreaStyle}
    >
      {/* 고정 높이 영역 - SafeArea 패딩은 nav 요소에 적용됨 */}
      <div className="flex items-center justify-around px-2" style={{ height: '4rem' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.5px]")} />
              <span className={cn(
                "text-xs",
                active ? "font-semibold" : "font-normal"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
