import { supabase } from "../../integrations/supabase/client";

/**
 * 알림 타입
 */
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  related_id?: string;
  related_type?: string;
  metadata?: Record<string, any>;
  created_at: string;
  read_at?: string;
}

/**
 * 알림 생성 파라미터
 */
export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: 'ai_model_complete' | 'print_complete' | 'print_error' | 'payment_success' | 'payment_failed' | 'subscription_expiring' | 'subscription_renewed' | string;
  relatedId?: string;
  relatedType?: 'ai_model' | 'print_job' | 'payment' | 'subscription' | string;
  metadata?: Record<string, any>;
}

/**
 * 알림 생성
 * 백그라운드 작업 완료 시 사용자에게 알림을 전송합니다.
 */
export async function createNotification(params: CreateNotificationParams): Promise<{ success: boolean; error?: any; notification?: Notification }> {
  const {
    userId,
    title,
    message,
    type,
    relatedId,
    relatedType,
    metadata,
  } = params;

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      message,
      type,
      related_id: relatedId,
      related_type: relatedType,
      metadata,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    return { success: false, error };
  }

  return { success: true, notification: data };
}

/**
 * 사용자의 알림 목록 조회
 */
export async function getUserNotifications(
  userId: string,
  limit: number = 20
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data || [];
}

/**
 * 읽지 않은 알림 개수 조회
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    console.error('Error counting unread notifications:', error);
    return 0;
  }

  return count || 0;
}

/**
 * 알림 읽음 처리
 */
export async function markNotificationAsRead(notificationId: string): Promise<{ success: boolean; error?: any }> {
  const { error } = await supabase.rpc('mark_notification_as_read', {
    notification_id: notificationId,
  });

  if (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error };
  }

  return { success: true };
}

/**
 * 모든 알림 읽음 처리
 */
export async function markAllNotificationsAsRead(): Promise<{ success: boolean; error?: any }> {
  const { error } = await supabase.rpc('mark_all_notifications_as_read');

  if (error) {
    console.error('Error marking all notifications as read:', error);
    return { success: false, error };
  }

  return { success: true };
}

/**
 * 알림 삭제
 */
export async function deleteNotification(notificationId: string): Promise<{ success: boolean; error?: any }> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('Error deleting notification:', error);
    return { success: false, error };
  }

  return { success: true };
}

/**
 * 모든 알림 삭제
 */
export async function deleteAllNotifications(userId: string): Promise<{ success: boolean; error?: any }> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting all notifications:', error);
    return { success: false, error };
  }

  return { success: true };
}

/**
 * 테스트용 알림 생성
 * 개발 중 알림 시스템을 테스트하기 위한 함수
 */
export async function createTestNotification(params: {
  userId: string;
  title?: string;
  message?: string;
  type?: string;
}): Promise<{ success: boolean; error?: any; notification?: Notification }> {
  const {
    userId,
    title = '테스트 알림',
    message = '이것은 테스트 알림입니다.',
    type = 'test',
  } = params;

  return createNotification({
    userId,
    title,
    message,
    type,
    metadata: { test: true },
  });
}

/**
 * AI 모델 생성 완료 알림
 */
export async function notifyAIModelComplete(params: {
  userId: string;
  modelId: string;
  modelName: string;
}): Promise<{ success: boolean; error?: any }> {
  return createNotification({
    userId: params.userId,
    title: 'AI 모델 생성 완료',
    message: `'${params.modelName}' 모델이 성공적으로 생성되었습니다.`,
    type: 'ai_model_complete',
    relatedId: params.modelId,
    relatedType: 'ai_model',
  });
}

/**
 * 프린팅 완료 알림
 */
export async function notifyPrintComplete(params: {
  userId: string;
  printJobId: string;
  printJobName: string;
}): Promise<{ success: boolean; error?: any }> {
  return createNotification({
    userId: params.userId,
    title: '프린팅 완료',
    message: `'${params.printJobName}' 프린팅이 완료되었습니다.`,
    type: 'print_complete',
    relatedId: params.printJobId,
    relatedType: 'print_job',
  });
}

/**
 * 프린팅 오류 알림
 */
export async function notifyPrintError(params: {
  userId: string;
  printJobId: string;
  printJobName: string;
  errorMessage: string;
}): Promise<{ success: boolean; error?: any }> {
  return createNotification({
    userId: params.userId,
    title: '프린팅 오류',
    message: `'${params.printJobName}' 프린팅 중 오류가 발생했습니다: ${params.errorMessage}`,
    type: 'print_error',
    relatedId: params.printJobId,
    relatedType: 'print_job',
  });
}

/**
 * 결제 성공 알림
 */
export async function notifyPaymentSuccess(params: {
  userId: string;
  paymentId: string;
  planName: string;
  amount: number;
}): Promise<{ success: boolean; error?: any }> {
  return createNotification({
    userId: params.userId,
    title: '결제 성공',
    message: `${params.planName.toUpperCase()} 플랜 구독이 활성화되었습니다. (${params.amount.toLocaleString()}원)`,
    type: 'payment_success',
    relatedId: params.paymentId,
    relatedType: 'payment',
  });
}

/**
 * 구독 만료 예정 알림
 */
export async function notifySubscriptionExpiring(params: {
  userId: string;
  subscriptionId: string;
  planName: string;
  daysRemaining: number;
}): Promise<{ success: boolean; error?: any }> {
  return createNotification({
    userId: params.userId,
    title: '구독 만료 예정',
    message: `${params.planName.toUpperCase()} 플랜이 ${params.daysRemaining}일 후 만료됩니다.`,
    type: 'subscription_expiring',
    relatedId: params.subscriptionId,
    relatedType: 'subscription',
  });
}
