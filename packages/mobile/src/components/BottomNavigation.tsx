import { useNavigate, useLocation } from "react-router-dom";
import { Home, Sparkles, Settings, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-bottom-only">
      <div className="flex items-center justify-around h-16 px-2">
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
