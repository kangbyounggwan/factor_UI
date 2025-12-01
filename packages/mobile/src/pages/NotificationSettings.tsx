import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import {
  ArrowLeft,
  RefreshCw,
  Crown,
  Bell,
  BellOff,
  Printer,
  AlertTriangle,
  Mail,
  FileText,
  Sparkles,
  CreditCard,
  Megaphone,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@shared/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSafeAreaStyle } from "@/hooks/usePlatform";
import { pushNotificationService } from "@/services/pushNotificationService";
import { PushNotifications } from '@capacitor/push-notifications';
import { cn } from "@/lib/utils";

// DB 컬럼명과 일치하는 인터페이스
interface NotificationPreferences {
  push_notifications: boolean;
  print_complete_notifications: boolean;
  error_notifications: boolean;
  email_notifications: boolean;
  weekly_report: boolean;
  ai_complete_enabled: boolean;
  payment_enabled: boolean;
  marketing_enabled: boolean;
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
    push_notifications: true,
    print_complete_notifications: true,
    error_notifications: true,
    email_notifications: false,
    weekly_report: false,
    ai_complete_enabled: true,
    payment_enabled: true,
    marketing_enabled: false,
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
          push_notifications: data.push_notifications ?? true,
          print_complete_notifications: data.print_complete_notifications ?? true,
          error_notifications: data.error_notifications ?? true,
          email_notifications: data.email_notifications ?? false,
          weekly_report: data.weekly_report ?? false,
          ai_complete_enabled: data.ai_complete_enabled ?? true,
          payment_enabled: data.payment_enabled ?? true,
          marketing_enabled: data.marketing_enabled ?? false,
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

    // 푸시 알림이 꺼져있으면 하위 항목 토글 불가 (마스터 토글 제외)
    if (key !== 'push_notifications' && !preferences.push_notifications) {
      toast({
        title: t("userSettings.pushNotifications"),
        description: "푸시 알림을 먼저 활성화해주세요.",
        variant: "destructive",
      });
      return;
    }

    // 푸시 알림 토글 특별 처리
    if (key === 'push_notifications') {
      await handlePushNotificationToggle(!preferences.push_notifications);
      return;
    }

    const newPreferences = {
      ...preferences,
      [key]: !preferences[key],
    };

    setPreferences(newPreferences);

    try {
      setSaving(true);

      const { error } = await supabase
        .from('user_notification_settings')
        .upsert({
          user_id: user.id,
          ...newPreferences,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: t("userSettings.profileUpdated"),
        description: t("userSettings.profileUpdatedDesc"),
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
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

  /**
   * 푸시 알림 마스터 토글 처리
   */
  const handlePushNotificationToggle = async (enable: boolean) => {
    if (!user) return;

    try {
      setSaving(true);

      if (enable) {
        console.log('[NotificationSettings] Enabling push notifications...');

        const permissionStatus = await PushNotifications.checkPermissions();
        console.log('[NotificationSettings] Current permission:', permissionStatus);

        if (permissionStatus.receive === 'denied') {
          toast({
            title: t("userSettings.pushNotifications"),
            description: "알림 권한이 거부되었습니다. 설정에서 알림을 허용해주세요.",
            variant: "destructive",
          });
          return;
        }

        if (permissionStatus.receive !== 'granted') {
          const permission = await PushNotifications.requestPermissions();
          console.log('[NotificationSettings] Permission requested:', permission);

          if (permission.receive !== 'granted') {
            toast({
              title: t("userSettings.pushNotifications"),
              description: "알림 권한이 필요합니다.",
              variant: "destructive",
            });
            return;
          }
        }

        await pushNotificationService.initialize(user.id);
        console.log('[NotificationSettings] Push notification service initialized');

        const { error } = await supabase
          .from('user_notification_settings')
          .upsert({
            user_id: user.id,
            push_notifications: true,
            print_complete_notifications: preferences.print_complete_notifications,
            error_notifications: preferences.error_notifications,
            email_notifications: preferences.email_notifications,
            weekly_report: preferences.weekly_report,
            ai_complete_enabled: preferences.ai_complete_enabled,
            payment_enabled: preferences.payment_enabled,
            marketing_enabled: preferences.marketing_enabled,
          }, {
            onConflict: 'user_id'
          });

        if (error) throw error;

        setPreferences({ ...preferences, push_notifications: true });

        toast({
          title: t("userSettings.pushNotifications"),
          description: "푸시 알림이 활성화되었습니다.",
        });
      } else {
        console.log('[NotificationSettings] Disabling push notifications...');

        try {
          await pushNotificationService.deactivateCurrentToken(user.id);
        } catch (tokenError) {
          console.warn('[NotificationSettings] Token deactivation failed (continuing):', tokenError);
        }

        const { error } = await supabase
          .from('user_notification_settings')
          .upsert({
            user_id: user.id,
            push_notifications: false,
            print_complete_notifications: preferences.print_complete_notifications,
            error_notifications: preferences.error_notifications,
            email_notifications: preferences.email_notifications,
            weekly_report: preferences.weekly_report,
            ai_complete_enabled: preferences.ai_complete_enabled,
            payment_enabled: preferences.payment_enabled,
            marketing_enabled: preferences.marketing_enabled,
          }, {
            onConflict: 'user_id'
          });

        if (error) throw error;

        setPreferences({ ...preferences, push_notifications: false });

        toast({
          title: t("userSettings.pushNotifications"),
          description: "푸시 알림이 비활성화되었습니다.",
        });
      }
    } catch (error) {
      console.error('[NotificationSettings] Error toggling push notifications:', error);
      toast({
        title: t("settings.error"),
        description: "푸시 알림 설정 변경에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // 알림 항목 그룹 정의
  const printingNotifications = [
    {
      key: 'print_complete_notifications' as keyof NotificationPreferences,
      title: t("userSettings.printComplete"),
      description: t("userSettings.printCompleteDesc"),
      icon: Printer,
      isPro: false,
    },
    {
      key: 'error_notifications' as keyof NotificationPreferences,
      title: t("userSettings.errorNotifications"),
      description: t("userSettings.errorNotificationsDesc"),
      icon: AlertTriangle,
      isPro: false,
    },
  ];

  const aiNotifications = [
    {
      key: 'ai_complete_enabled' as keyof NotificationPreferences,
      title: "AI 생성 완료",
      description: "AI 3D 모델 생성이 완료되면 알림을 받습니다",
      icon: Sparkles,
      isPro: false,
    },
  ];

  const accountNotifications = [
    {
      key: 'payment_enabled' as keyof NotificationPreferences,
      title: "결제 알림",
      description: "결제 완료, 구독 갱신 등 결제 관련 알림",
      icon: CreditCard,
      isPro: false,
    },
    {
      key: 'marketing_enabled' as keyof NotificationPreferences,
      title: "마케팅 알림",
      description: "새로운 기능, 이벤트, 프로모션 소식",
      icon: Megaphone,
      isPro: false,
    },
  ];

  const emailNotifications = [
    {
      key: 'email_notifications' as keyof NotificationPreferences,
      title: t("userSettings.emailNotifications"),
      description: t("userSettings.emailNotificationsDesc"),
      icon: Mail,
      isPro: true,
    },
    {
      key: 'weekly_report' as keyof NotificationPreferences,
      title: t("userSettings.weeklyReport"),
      description: t("userSettings.weeklyReportDesc"),
      icon: FileText,
      isPro: true,
    },
  ];

  const renderNotificationItem = (item: {
    key: keyof NotificationPreferences;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    isPro: boolean;
  }) => {
    const Icon = item.icon;
    const isDisabled = saving || item.isPro || (!preferences.push_notifications && item.key !== 'push_notifications');
    const isChecked = preferences[item.key];

    return (
      <div
        key={item.key}
        className={cn(
          "flex items-center justify-between py-4",
          !preferences.push_notifications && item.key !== 'push_notifications' && "opacity-50"
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            "p-2 rounded-lg",
            isChecked && preferences.push_notifications ? "bg-primary/10" : "bg-muted"
          )}>
            <Icon className={cn(
              "h-4 w-4",
              isChecked && preferences.push_notifications ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{item.title}</span>
              {item.isPro && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  <Crown className="h-2.5 w-2.5 mr-0.5" />
                  Pro
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {item.description}
            </p>
          </div>
        </div>
        <Switch
          checked={isChecked}
          onCheckedChange={() => handleToggle(item.key)}
          disabled={isDisabled}
          className="flex-shrink-0 ml-3"
        />
      </div>
    );
  };

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
      <div className="px-4 py-3 flex items-center justify-between border-b safe-area-top">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-base font-semibold">
          {t("userSettings.notificationSettings")}
        </h1>
        <div className="w-9">
          {saving && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {/* 마스터 토글 - 푸시 알림 전체 활성화/비활성화 */}
        <div className="px-4 py-6">
          <div className={cn(
            "rounded-2xl border-2 p-5 transition-all",
            preferences.push_notifications
              ? "bg-primary/5 border-primary/30"
              : "bg-muted/50 border-border"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-xl",
                  preferences.push_notifications ? "bg-primary/20" : "bg-muted"
                )}>
                  {preferences.push_notifications ? (
                    <Bell className="h-6 w-6 text-primary" />
                  ) : (
                    <BellOff className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {t("userSettings.pushNotifications")}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {preferences.push_notifications
                      ? "모든 알림을 받고 있습니다"
                      : "알림이 꺼져 있습니다"}
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.push_notifications}
                onCheckedChange={() => handleToggle('push_notifications')}
                disabled={saving}
                className="scale-125"
              />
            </div>
          </div>

          {!preferences.push_notifications && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              푸시 알림을 켜면 아래 세부 알림을 설정할 수 있습니다
            </p>
          )}
        </div>

        {/* 세부 알림 설정 */}
        <div className="px-4 pb-6 space-y-6">
          {/* 3D 프린팅 알림 */}
          <div className="bg-card rounded-xl border p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">
              3D 프린팅
            </h3>
            <div className="divide-y">
              {printingNotifications.map(renderNotificationItem)}
            </div>
          </div>

          {/* AI 알림 */}
          <div className="bg-card rounded-xl border p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">
              AI Studio
            </h3>
            <div className="divide-y">
              {aiNotifications.map(renderNotificationItem)}
            </div>
          </div>

          {/* 계정 알림 */}
          <div className="bg-card rounded-xl border p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">
              계정
            </h3>
            <div className="divide-y">
              {accountNotifications.map(renderNotificationItem)}
            </div>
          </div>

          {/* 이메일 알림 (Pro) */}
          <div className="bg-card rounded-xl border p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-muted-foreground">
                이메일 알림
              </h3>
              <Badge variant="secondary" className="text-[10px]">
                <Crown className="h-2.5 w-2.5 mr-1" />
                Pro 전용
              </Badge>
            </div>
            <div className="divide-y">
              {emailNotifications.map(renderNotificationItem)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
