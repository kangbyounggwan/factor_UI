import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
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
  async initialize(userId: string): Promise<void> {
    console.log('[PushService] initialize() called for user:', userId);
    if (this.isInitialized) {
      console.log('[PushService] Already initialized, skipping');
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

        // 이벤트 리스너 등록
        this.setupListeners(userId);
        console.log('[PushService] Event listeners setup complete');

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
    // FCM 토큰 수신
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('FCM token received:', token.value);
      this.currentToken = token.value; // 토큰 저장
      await this.saveFCMToken(userId, token.value);
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
   * FCM 토큰을 Supabase에 저장
   */
  private async saveFCMToken(userId: string, fcmToken: string): Promise<void> {
    try {
      console.log('Saving FCM token for user:', userId);
      console.log('FCM token length:', fcmToken.length);

      const { data, error } = await supabase
        .from('user_device_tokens')
        .upsert({
          user_id: userId,
          device_token: fcmToken,
          platform: 'android',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,device_token',
        })
        .select();

      if (error) {
        console.error('Error saving FCM token - Code:', error.code);
        console.error('Error saving FCM token - Message:', error.message);
        console.error('Error saving FCM token - Details:', error.details);
        console.error('Error saving FCM token - Hint:', error.hint);
        console.error('Full error object:', JSON.stringify(error, null, 2));
      } else {
        console.log('FCM token saved successfully:', data);
      }
    } catch (error) {
      console.error('Exception in saveFCMToken:', error);
      console.error('Exception details:', JSON.stringify(error, null, 2));
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
        console.warn('No current token to deactivate');
        return;
      }

      const { error } = await supabase
        .from('user_device_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('device_token', this.currentToken);

      if (error) {
        console.error('Error deactivating FCM token:', error);
      } else {
        console.log('FCM token deactivated successfully');
        this.currentToken = null;
      }
    } catch (error) {
      console.error('Error in deactivateCurrentToken:', error);
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
