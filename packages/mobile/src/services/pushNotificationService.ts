import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@shared/integrations/supabase/client';

/**
 * 푸시 알림 서비스
 * FCM 토큰 관리 및 푸시 알림 처리
 */
class PushNotificationService {
  private isInitialized = false;
  private currentToken: string | null = null;

  /**
   * 푸시 알림 서비스 초기화
   */
  async initialize(userId: string, force: boolean = false): Promise<void> {
    console.log('[PushService] initialize() called for user:', userId, 'force:', force);

    if (this.isInitialized && !force) {
      console.log('[PushService] Already initialized, re-registering FCM...');
      // 이미 초기화되어 있어도 FCM 재등록은 시도
      try {
        await PushNotifications.register();
        console.log('[PushService] FCM re-registered');
      } catch (error) {
        console.error('[PushService] Error re-registering FCM:', error);
      }
      return;
    }

    try {
      console.log('[PushService] Requesting permissions...');
      // 푸시 알림 권한 요청
      const permission = await PushNotifications.requestPermissions();
      console.log('[PushService] Permission result:', permission);

      if (permission.receive === 'granted') {
        console.log('[PushService] Permission granted, registering with FCM...');

        // FCM 등록
        await PushNotifications.register();
        console.log('[PushService] FCM register() called');

        // 이벤트 리스너 등록 (중복 방지 - 이미 등록되어 있으면 스킵)
        if (!this.isInitialized || force) {
          this.setupListeners(userId);
          console.log('[PushService] Event listeners setup complete');
        }

        this.isInitialized = true;
        console.log('[PushService] Initialization complete');
      } else {
        console.warn('[PushService] Permission denied:', permission);
      }
    } catch (error) {
      console.error('[PushService] Error during initialization:', error);
      throw error;
    }
  }

  /**
   * 이벤트 리스너 설정
   */
  private setupListeners(userId: string): void {
    // FCM 토큰 수신 (Capacitor 기본)
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[PushService] FCM token received (Capacitor):', token.value);
      this.currentToken = token.value; // 토큰 저장
      await this.saveFCMToken(userId, token.value);
    });

    // FCM 토큰 수신 (AppDelegate에서 직접 전달)
    window.addEventListener('pushNotificationRegistered', async (event: any) => {
      const token = event.detail?.value;
      if (token) {
        console.log('[PushService] FCM token received (AppDelegate):', token);
        this.currentToken = token;
        await this.saveFCMToken(userId, token);
      }
    });

    // FCM 등록 실패
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('FCM registration error:', error);
    });

    // 푸시 알림 수신 (앱이 foreground일 때)
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push notification received:', notification);

      // Foreground에서 알림 표시
      this.showLocalNotification(notification);
    });

    // 푸시 알림 클릭/액션
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('Push notification action performed:', action);

      // 알림 클릭 시 처리
      this.handleNotificationAction(action);
    });
  }

  /**
   * FCM 토큰을 Supabase에 저장 + user_notification_settings 자동 생성
   */
  private async saveFCMToken(userId: string, fcmToken: string): Promise<void> {
    try {
      // 현재 플랫폼 자동 감지 (ios 또는 android)
      const platform = Capacitor.getPlatform();

      console.log('[PushService] Saving FCM token for user:', userId);
      console.log('[PushService] Platform:', platform);
      console.log('[PushService] FCM token length:', fcmToken.length);

      // 1. user_device_tokens에 토큰 저장
      const { data, error } = await supabase
        .from('user_device_tokens')
        .upsert({
          user_id: userId,
          device_token: fcmToken,
          platform: platform,  // 동적으로 플랫폼 설정 (ios/android)
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,device_token',
        })
        .select();

      if (error) {
        console.error('[PushService] Error saving FCM token:', error.message);
      } else {
        console.log('[PushService] FCM token saved successfully:', data);
      }

      // 2. user_notification_settings 생성/업데이트 (push_notifications: true)
      // 컬럼명은 DB 스키마에 맞춤: push_notifications, email_notifications,
      // print_complete_notifications, error_notifications, ai_complete_enabled, payment_enabled, marketing_enabled
      const { error: notifError } = await supabase
        .from('user_notification_settings')
        .upsert({
          user_id: userId,
          push_notifications: true,
          email_notifications: true,
          print_complete_notifications: true,
          error_notifications: true,
          ai_complete_enabled: true,
          payment_enabled: true,
          marketing_enabled: false,
          weekly_report: false,
          notification_sound: true,
          notification_frequency: 'immediate',
          quiet_hours_enabled: false,
        }, {
          onConflict: 'user_id',
        });

      if (notifError) {
        console.error('[PushService] Error saving notification settings:', notifError.message);
      } else {
        console.log('[PushService] Notification settings saved successfully');
      }
    } catch (error) {
      console.error('[PushService] Exception in saveFCMToken:', error);
    }
  }

  /**
   * Foreground에서 로컬 알림 표시
   */
  private showLocalNotification(notification: PushNotificationSchema): void {
    // 로컬 알림으로 표시 (선택사항)
    // Capacitor Local Notifications 플러그인 필요
    console.log('Showing notification:', notification.title, notification.body);
  }

  /**
   * 알림 액션 처리
   */
  private handleNotificationAction(action: ActionPerformed): void {
    const notification = action.notification;
    const data = notification.data;

    console.log('Notification action:', action.actionId);
    console.log('Notification data:', data);

    // 알림 타입에 따른 라우팅
    if (data.type) {
      switch (data.type) {
        case 'ai_model_complete':
          // AI 모델 상세 페이지로 이동
          if (data.related_id) {
            window.location.href = `/ai/${data.related_id}`;
          }
          break;

        case 'print_complete':
        case 'print_error':
          // 프린팅 상세 페이지로 이동
          if (data.related_id) {
            window.location.href = `/print/${data.related_id}`;
          }
          break;

        case 'payment_success':
        case 'subscription_expiring':
        case 'subscription_renewed':
          // 구독 관리 페이지로 이동
          window.location.href = '/settings/subscription';
          break;

        default:
          // 알림 목록으로 이동
          window.location.href = '/notifications';
          break;
      }
    }
  }

  /**
   * 현재 FCM 토큰 가져오기
   */
  async getCurrentToken(): Promise<string | null> {
    try {
      // 이미 등록된 토큰이 있는지 확인
      const deliveredNotifications = await PushNotifications.getDeliveredNotifications();
      console.log('Delivered notifications:', deliveredNotifications);

      // 토큰은 registration 리스너를 통해서만 받을 수 있음
      return null;
    } catch (error) {
      console.error('Error getting current token:', error);
      return null;
    }
  }

  /**
   * 푸시 알림 서비스 해제
   */
  async cleanup(userId: string): Promise<void> {
    try {
      // 모든 리스너 제거
      await PushNotifications.removeAllListeners();

      this.isInitialized = false;
      console.log('Push notification service cleaned up');
    } catch (error) {
      console.error('Error cleaning up push notifications:', error);
    }
  }

  /**
   * 특정 사용자의 FCM 토큰 삭제
   */
  async deleteUserToken(userId: string, deviceToken: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_device_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('device_token', deviceToken);

      if (error) {
        console.error('Error deleting FCM token:', error);
      } else {
        console.log('FCM token deleted successfully');
      }
    } catch (error) {
      console.error('Error in deleteUserToken:', error);
    }
  }

  /**
   * 로그아웃 시 현재 디바이스의 FCM 토큰 비활성화
   */
  async deactivateCurrentToken(userId: string): Promise<void> {
    try {
      if (!this.currentToken) {
        console.warn('[PushService] No current token to deactivate - disabling all tokens for this user');

        // 토큰이 없으면 해당 유저의 모든 토큰을 비활성화
        const { error } = await supabase
          .from('user_device_tokens')
          .update({ is_active: false })
          .eq('user_id', userId);

        if (error) {
          console.error('[PushService] Error deactivating all tokens:', error);
        } else {
          console.log('[PushService] All user tokens deactivated successfully');
        }

        // 초기화 플래그 리셋 (다음에 다시 켤 수 있도록)
        this.isInitialized = false;
        return;
      }

      const { error } = await supabase
        .from('user_device_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('device_token', this.currentToken);

      if (error) {
        console.error('[PushService] Error deactivating FCM token:', error);
      } else {
        console.log('[PushService] FCM token deactivated successfully');
        this.currentToken = null;

        // 초기화 플래그 리셋 (다음에 다시 켤 수 있도록)
        this.isInitialized = false;
      }
    } catch (error) {
      console.error('[PushService] Error in deactivateCurrentToken:', error);
    }
  }

  /**
   * 재로그인 시 현재 디바이스의 FCM 토큰 재활성화
   */
  async reactivateCurrentToken(userId: string): Promise<void> {
    try {
      if (!this.currentToken) {
        // 토큰이 없으면 새로 등록
        await this.initialize(userId);
        return;
      }

      const { error } = await supabase
        .from('user_device_tokens')
        .update({
          is_active: true,
          last_used_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('device_token', this.currentToken);

      if (error) {
        console.error('Error reactivating FCM token:', error);
      } else {
        console.log('FCM token reactivated successfully');
      }
    } catch (error) {
      console.error('Error in reactivateCurrentToken:', error);
    }
  }
}

// 싱글톤 인스턴스
export const pushNotificationService = new PushNotificationService();
