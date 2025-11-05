import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@shared/contexts/AuthContext";
import { supabase } from "@shared/integrations/supabase/client";
import { useEffect, useState } from "react";

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  message_en?: string;
  type: string;
  read: boolean;
  created_at: string;
  metadata?: any;
}

const Notifications = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // 현재 언어에 따라 메시지 선택
  const getLocalizedMessage = (notification: Notification) => {
    const currentLang = i18n.language;
    if (currentLang === 'en' && notification.message_en) {
      return notification.message_en;
    }
    return notification.message;
  };

  useEffect(() => {
    const loadNotifications = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // 최근 5일간의 알림 가져오기
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', fiveDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error loading notifications:', error);
          return;
        }

        setNotifications(data || []);
      } catch (error) {
        console.error('Error loading notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase.rpc('mark_notification_as_read', {
        notification_id: notificationId,
      });

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      // 읽은 알림 상태 업데이트
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const groupedByDate: Record<string, Notification[]> = {};
  notifications.forEach((notification) => {
    const dateKey = new Date(notification.created_at).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(notification);
  });

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-background border-b safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">{t("notifications.title", "알림")}</h1>
          <div className="w-9" /> {/* 균형을 위한 빈 공간 */}
        </div>
      </div>

      {/* 알림 목록 */}
      <div className="px-4 py-6 space-y-4 pb-safe">
        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-sm text-muted-foreground">{t("common.loading", "로딩 중...")}</p>
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {t("notifications.noNotifications", "알림이 없습니다")}
              </h3>
              <p className="text-muted-foreground text-center">
                {t("notifications.noNotificationsDesc", "새로운 알림이 도착하면 여기에 표시됩니다")}
              </p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedByDate).map(([date, dateNotifications], dateIndex) => (
            <div key={date} className="space-y-2">
              {/* 날짜 헤더 */}
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                {date}
              </div>
              {/* 해당 날짜의 알림들 */}
              {dateNotifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`cursor-pointer transition-colors ${
                    notification.read ? 'opacity-60' : ''
                  }`}
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead(notification.id);
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            className={`text-sm font-medium ${
                              notification.read
                                ? 'text-muted-foreground'
                                : 'text-foreground'
                            }`}
                          >
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getLocalizedMessage(notification)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(notification.created_at).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
