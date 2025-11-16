import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import { ArrowLeft, RefreshCw, Crown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@shared/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSafeAreaStyle } from "@/hooks/usePlatform";

interface NotificationPreferences {
  push_enabled: boolean;
  print_complete: boolean;
  error_alerts: boolean;
  email_enabled: boolean;
  weekly_report: boolean;
}

const NotificationSettings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Safe Area 패딩
  const safeAreaStyle = useSafeAreaStyle({
    bottom: true,
    bottomPadding: '2rem',
  });

  const [preferences, setPreferences] = useState<NotificationPreferences>({
    push_enabled: true,
    print_complete: true,
    error_alerts: true,
    email_enabled: false,
    weekly_report: false,
  });

  // Load user preferences
  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setPreferences({
          push_enabled: data.push_notifications ?? true,
          print_complete: data.print_complete_notifications ?? true,
          error_alerts: data.error_notifications ?? true,
          email_enabled: data.email_notifications ?? false,
          weekly_report: data.weekly_report ?? false,
        });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof NotificationPreferences) => {
    if (!user) return;

    const newPreferences = {
      ...preferences,
      [key]: !preferences[key],
    };

    setPreferences(newPreferences);

    try {
      setSaving(true);

      // Map frontend keys to database column names
      const dbData = {
        user_id: user.id,
        push_notifications: newPreferences.push_enabled,
        print_complete_notifications: newPreferences.print_complete,
        error_notifications: newPreferences.error_alerts,
        email_notifications: newPreferences.email_enabled,
        weekly_report: newPreferences.weekly_report,
      };

      const { error } = await supabase
        .from('user_notification_settings')
        .upsert(dbData);

      if (error) throw error;

      toast({
        title: t("userSettings.profileUpdated"),
        description: t("userSettings.profileUpdatedDesc"),
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      // Revert on error
      setPreferences(preferences);
      toast({
        title: t("settings.error"),
        description: t("settings.updatePrinterError"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const notificationItems = [
    {
      key: 'push_enabled' as keyof NotificationPreferences,
      title: t("userSettings.pushNotifications"),
      description: t("userSettings.pushNotificationsDesc"),
      isPro: false,
    },
    {
      key: 'print_complete' as keyof NotificationPreferences,
      title: t("userSettings.printComplete"),
      description: t("userSettings.printCompleteDesc"),
      isPro: false,
    },
    {
      key: 'error_alerts' as keyof NotificationPreferences,
      title: t("userSettings.errorNotifications"),
      description: t("userSettings.errorNotificationsDesc"),
      isPro: false,
    },
    {
      key: 'email_enabled' as keyof NotificationPreferences,
      title: t("userSettings.emailNotifications"),
      description: t("userSettings.emailNotificationsDesc"),
      isPro: true,
    },
    {
      key: 'weekly_report' as keyof NotificationPreferences,
      title: t("userSettings.weeklyReport"),
      description: t("userSettings.weeklyReportDesc"),
      isPro: true,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" style={safeAreaStyle}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" style={safeAreaStyle}>
      {/* 헤더 */}
      <div className="px-6 py-4 flex items-center justify-between border-b safe-area-top">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
        >
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </button>
        {saving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>{t("common.saving")}</span>
          </div>
        )}
      </div>

      {/* 제목 */}
      <div className="px-6 py-8">
        <h1 className="text-3xl font-bold">
          {t("userSettings.notificationSettings")}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {t("userSettings.notificationDescription")}
        </p>
      </div>

      {/* 알림 목록 */}
      <div className="flex-1 px-6 pb-8">
        <div className="space-y-4">
          {notificationItems.map((item) => (
            <div
              key={item.key}
              className="bg-card rounded-xl border p-6 transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    {item.isPro && (
                      <Badge variant="default" className="text-xs px-2 py-0.5">
                        <Crown className="h-3 w-3 mr-1" />
                        Pro
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Switch
                  checked={preferences[item.key]}
                  onCheckedChange={() => handleToggle(item.key)}
                  disabled={saving || item.isPro}
                  className="flex-shrink-0"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
