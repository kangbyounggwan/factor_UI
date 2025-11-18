import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ecmrkjwsjkthurwljhvp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbXJrandzamt0aHVyd2xqaHZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1MjUxODMsImV4cCI6MjA2NzEwMTE4M30.IB1Bx5h4YjhegQ6jACZ8FH7kzF3rwEwz-TztJQcQyWc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const userId = 'be61c171-e84a-4652-949d-8db5f64b8b18';

  console.log('🔔 Testing push notification...\n');

  // 1. Check FCM tokens
  const { data: tokens, error: tokenError } = await supabase
    .from('user_device_tokens')
    .select('device_token, platform, is_active')
    .eq('user_id', userId);

  if (tokenError) {
    console.error('❌ Error fetching tokens:', tokenError);
    return;
  }

  console.log(`✅ Found ${tokens?.length || 0} device token(s)\n`);

  // 2. Send push notification
  const { data, error } = await supabase.functions.invoke('send-push-notification', {
    body: {
      userId: userId,
      title: '🧪 테스트 푸시 알림',
      body: 'FCM 푸시 알림이 정상적으로 작동합니다!',
      type: 'test',
    },
  });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Success!');
  console.log('Response:', data);
}

test();
