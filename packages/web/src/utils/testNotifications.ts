/**
 * Test utility functions for notification system
 * Use these functions in the browser console to test notifications
 */

import { supabase } from "@shared/integrations/supabase/client";
import {
  createTestNotification,
  notifyAIModelComplete,
  notifyPrintComplete,
  notifyPrintError,
  notifyPaymentSuccess,
  notifySubscriptionExpiring
} from "@shared/services/supabaseService/notifications";

/**
 * Get current user ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Create a simple test notification
 * Usage: await testSimpleNotification()
 */
export async function testSimpleNotification() {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return;
  }

  const result = await createTestNotification({
    userId,
    title: '테스트 알림',
    message: '이것은 테스트 알림입니다. 실시간으로 업데이트되는지 확인하세요!',
    type: 'test'
  });

  console.log('Test notification created:', result);
  return result;
}

/**
 * Create an AI model complete notification
 * Usage: await testAIModelNotification()
 */
export async function testAIModelNotification() {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return;
  }

  const result = await notifyAIModelComplete({
    userId,
    modelId: 'test-model-id-123',
    modelName: '테스트 AI 모델'
  });

  console.log('AI model notification created:', result);
  return result;
}

/**
 * Create a print complete notification
 * Usage: await testPrintCompleteNotification()
 */
export async function testPrintCompleteNotification() {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return;
  }

  const result = await notifyPrintComplete({
    userId,
    printJobId: 'test-print-job-456',
    printJobName: '테스트 프린팅 작업'
  });

  console.log('Print complete notification created:', result);
  return result;
}

/**
 * Create a print error notification
 * Usage: await testPrintErrorNotification()
 */
export async function testPrintErrorNotification() {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return;
  }

  const result = await notifyPrintError({
    userId,
    printJobId: 'test-print-job-789',
    printJobName: '실패한 프린팅 작업',
    errorMessage: '노즐 온도가 목표 온도에 도달하지 못했습니다'
  });

  console.log('Print error notification created:', result);
  return result;
}

/**
 * Create a payment success notification
 * Usage: await testPaymentNotification()
 */
export async function testPaymentNotification() {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return;
  }

  const result = await notifyPaymentSuccess({
    userId,
    paymentId: 'test-payment-001',
    planName: 'pro',
    amount: 29000
  });

  console.log('Payment success notification created:', result);
  return result;
}

/**
 * Create a subscription expiring notification
 * Usage: await testSubscriptionExpiringNotification()
 */
export async function testSubscriptionExpiringNotification() {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return;
  }

  const result = await notifySubscriptionExpiring({
    userId,
    subscriptionId: 'test-sub-001',
    planName: 'pro',
    daysRemaining: 7
  });

  console.log('Subscription expiring notification created:', result);
  return result;
}

/**
 * Create multiple test notifications at once
 * Usage: await testAllNotifications()
 */
export async function testAllNotifications() {
  console.log('Creating all test notifications...');

  await testSimpleNotification();
  await new Promise(resolve => setTimeout(resolve, 500));

  await testAIModelNotification();
  await new Promise(resolve => setTimeout(resolve, 500));

  await testPrintCompleteNotification();
  await new Promise(resolve => setTimeout(resolve, 500));

  await testPrintErrorNotification();
  await new Promise(resolve => setTimeout(resolve, 500));

  await testPaymentNotification();
  await new Promise(resolve => setTimeout(resolve, 500));

  await testSubscriptionExpiringNotification();

  console.log('All test notifications created!');
}

/**
 * Delete all notifications for current user
 * Usage: await clearAllNotifications()
 */
export async function clearAllNotifications() {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return;
  }

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error clearing notifications:', error);
    return { success: false, error };
  }

  console.log('All notifications cleared!');
  return { success: true };
}

// Make functions available in browser console
if (typeof window !== 'undefined') {
  (window as any).testNotifications = {
    simple: testSimpleNotification,
    aiModel: testAIModelNotification,
    printComplete: testPrintCompleteNotification,
    printError: testPrintErrorNotification,
    payment: testPaymentNotification,
    subscriptionExpiring: testSubscriptionExpiringNotification,
    all: testAllNotifications,
    clear: clearAllNotifications,
  };

  console.log('Test notification functions available at: window.testNotifications');
  console.log('Usage examples:');
  console.log('  await window.testNotifications.simple()');
  console.log('  await window.testNotifications.all()');
  console.log('  await window.testNotifications.clear()');
}
