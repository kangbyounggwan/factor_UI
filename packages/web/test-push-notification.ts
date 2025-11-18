/**
 * FCM 푸시 알림 테스트 스크립트
 *
 * 사용법:
 * 1. Supabase 환경 변수 설정 (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
 * 2. npx tsx test-push-notification.ts <user-id>
 *
 * 예시:
 * npx tsx test-push-notification.ts 12345678-1234-1234-1234-123456789abc
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ecmrkjwsjkthurwljhvp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbXJrandzamt0aHVyd2xqaHZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3MjE5MjgsImV4cCI6MjA0NjI5NzkyOH0.nYQxN0Swo0bpvgJvLuUf9TqaJXHd9zFzrAnIZFPxEEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function sendTestPushNotification(userId: string) {
  console.log(`\n🔔 Sending test push notification to user: ${userId}\n`);

  try {
    // 1. 사용자 FCM 토큰 확인
    console.log('📱 Checking user device tokens...');
    const { data: tokens, error: tokenError } = await supabase
      .from('user_device_tokens')
      .select('device_token, platform, is_active')
      .eq('user_id', userId);

    if (tokenError) {
      console.error('❌ Error fetching tokens:', tokenError);
      return;
    }

    if (!tokens || tokens.length === 0) {
      console.log('⚠️  No device tokens found for this user');
      console.log('   Make sure the user has logged in on the mobile app at least once');
      return;
    }

    console.log(`✅ Found ${tokens.length} device token(s):`);
    tokens.forEach((token, index) => {
      console.log(`   ${index + 1}. Platform: ${token.platform}, Active: ${token.is_active}`);
    });

    // 2. 테스트 푸시 알림 전송
    console.log('\n📤 Sending FCM push notification via Edge Function...');
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userId: userId,
        title: '🧪 테스트 푸시 알림',
        body: 'FCM 푸시 알림이 정상적으로 작동합니다!',
        type: 'test',
        data: {
          testId: `test-${Date.now()}`,
          source: 'test-script',
        },
        priority: 'high',
        messageEn: 'FCM push notification is working correctly!',
      },
    });

    if (error) {
      console.error('❌ Error sending push notification:', error);
      return;
    }

    // 3. 결과 출력
    console.log('\n✅ Push notification sent successfully!\n');
    console.log('📊 Results:');
    console.log(`   Notification ID: ${data.notificationId}`);
    console.log(`   Total devices: ${data.totalDevices}`);
    console.log(`   Success count: ${data.successCount}`);
    console.log(`   Failure count: ${data.failureCount}`);

    if (data.results && data.results.length > 0) {
      console.log('\n📋 Device Results:');
      data.results.forEach((result: any, index: number) => {
        const status = result.success ? '✅ Sent' : `❌ Failed: ${result.error}`;
        console.log(`   ${index + 1}. ${status}`);
      });
    }

    // 4. DB에 저장된 알림 확인
    console.log('\n📥 Checking notification in database...');
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', data.notificationId)
      .single();

    if (notifError) {
      console.error('❌ Error fetching notification:', notifError);
      return;
    }

    console.log('✅ Notification saved in DB:');
    console.log(`   Title: ${notification.title}`);
    console.log(`   Message: ${notification.message}`);
    console.log(`   Type: ${notification.type}`);
    console.log(`   Read: ${notification.is_read}`);
    console.log(`   Created: ${notification.created_at}`);

    console.log('\n✅ Test completed! Check your mobile device for the push notification.\n');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }
}

// CLI 인자에서 user ID 가져오기
const userId = process.argv[2];

if (!userId) {
  console.error(`
❌ Error: User ID is required

Usage:
  npx tsx test-push-notification.ts <user-id>

Example:
  npx tsx test-push-notification.ts 12345678-1234-1234-1234-123456789abc

To find your user ID:
  1. Open Supabase Dashboard
  2. Go to Authentication → Users
  3. Copy the user ID from the list
  `);
  process.exit(1);
}

sendTestPushNotification(userId);
