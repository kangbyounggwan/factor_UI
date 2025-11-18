import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ecmrkjwsjkthurwljhvp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbXJrandzamt0aHVyd2xqaHZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1MjUxODMsImV4cCI6MjA2NzEwMTE4M30.IB1Bx5h4YjhegQ6jACZ8FH7kzF3rwEwz-TztJQcQyWc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTokens() {
  const userId = 'be61c171-e84a-4652-949d-8db5f64b8b18';

  console.log(`\n🔍 Checking device tokens for user: ${userId}\n`);

  const { data, error } = await supabase
    .from('user_device_tokens')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📱 Found ${data?.length || 0} device token(s):\n`);

  if (data && data.length > 0) {
    data.forEach((token, index) => {
      console.log(`Token ${index + 1}:`);
      console.log(`  Device Token: ${token.device_token.substring(0, 50)}...`);
      console.log(`  Platform: ${token.platform}`);
      console.log(`  Active: ${token.is_active}`);
      console.log(`  Created: ${token.created_at}`);
      console.log(`  Last Used: ${token.last_used_at}\n`);
    });
  } else {
    console.log('⚠️  No device tokens found.');
    console.log('   The mobile app needs to register the FCM token first.\n');
    console.log('💡 How to register:');
    console.log('   1. Open the FACTOR mobile app');
    console.log('   2. Log in with your account');
    console.log('   3. The FCM token will be automatically registered\n');
  }
}

checkTokens();
