/**
 * Settings 모드 사이드바 콘텐츠
 * - 설정 메뉴 네비게이션
 */
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { User as UserIcon, Shield, CreditCard, Bell, Key } from "lucide-react";
import type { SettingsTab } from "./types";

interface SettingsSidebarContentProps {
  activeSettingsTab: SettingsTab;
  onSettingsTabChange?: (tab: SettingsTab) => void;
}

export function SettingsSidebarContent({
  activeSettingsTab,
  onSettingsTabChange,
}: SettingsSidebarContentProps) {
  const { t } = useTranslation();

  return (
    <>
      <p className="text-sm font-semibold text-foreground px-2 py-2">
        {t('userSettings.title', '사용자 설정')}
      </p>
      <nav className="space-y-1">
        <button
          onClick={() => onSettingsTabChange?.('profile')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            activeSettingsTab === 'profile'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <UserIcon className="h-4 w-4 shrink-0" />
          <span>{t("userSettings.profile", "프로필")}</span>
        </button>

        <button
          onClick={() => onSettingsTabChange?.('account')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            activeSettingsTab === 'account'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Shield className="h-4 w-4 shrink-0" />
          <span>{t("userSettings.account", "계정")}</span>
        </button>

        <button
          onClick={() => onSettingsTabChange?.('subscription')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            activeSettingsTab === 'subscription'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <CreditCard className="h-4 w-4 shrink-0" />
          <span>{t("userSettings.subscription", "구독")}</span>
        </button>

        <button
          onClick={() => onSettingsTabChange?.('notifications')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            activeSettingsTab === 'notifications'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Bell className="h-4 w-4 shrink-0" />
          <span>{t("userSettings.notifications", "알림")}</span>
        </button>

        <button
          onClick={() => onSettingsTabChange?.('api-keys')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            activeSettingsTab === 'api-keys'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Key className="h-4 w-4 shrink-0" />
          <span>{t("userSettings.apiKeys", "API 키")}</span>
        </button>
      </nav>
    </>
  );
}

export default SettingsSidebarContent;
