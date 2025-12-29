/**
 * SharedBottomNavigation
 * 공유 페이지에서 모바일 화면용 하단 네비게이션
 */

import { Link, useLocation } from "react-router-dom";
import { Home, MessageCircle, Settings, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function SharedBottomNavigation() {
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    {
      path: "/dashboard",
      icon: Home,
      label: t("nav.dashboard", "대시보드"),
    },
    {
      path: "/ai-chat",
      icon: MessageCircle,
      label: t("nav.aiChat", "AI 도구"),
    },
    {
      path: "/settings",
      icon: Settings,
      label: t("nav.settings", "설정"),
    },
    {
      path: "/user-settings",
      icon: User,
      label: t("nav.profile", "프로필"),
    },
  ];

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around px-2 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
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
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
