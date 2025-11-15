# Notification System Setup Guide

## Step 1: Apply Database Migration

1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy and paste the contents of `supabase/migrations/20250127000003_create_notifications_table.sql`
6. Click **Run** to execute the migration

## Step 2: Verify Table Creation

After running the migration, verify that:
- The `notifications` table was created
- RLS policies are enabled
- The helper functions exist:
  - `mark_notification_as_read(notification_id UUID)`
  - `mark_all_notifications_as_read()`
  - `delete_old_notifications()`

## Step 3: Test Real-time Notifications

Use the test utility function to create sample notifications:

```typescript
import { createTestNotification } from '@shared/services/supabaseService/notifications';

// Create a test notification
await createTestNotification({
  userId: 'user-uuid-here',
  title: 'AI Model Complete',
  message: 'Your 3D model has been successfully generated!',
  type: 'ai_model_complete',
  relatedId: 'model-uuid',
  relatedType: 'ai_model'
});
```

## Step 4: Integration Points

The notification system is ready to be integrated with:

### AI Model Generation
When AI model generation completes:
```typescript
await supabase.from('notifications').insert({
  user_id: userId,
  title: 'AI 모델 생성 완료',
  message: '3D 모델이 성공적으로 생성되었습니다.',
  type: 'ai_model_complete',
  related_id: modelId,
  related_type: 'ai_model'
});
```

### Print Job Completion
When 3D print job completes:
```typescript
await supabase.from('notifications').insert({
  user_id: userId,
  title: '프린팅 완료',
  message: '3D 프린팅이 완료되었습니다.',
  type: 'print_complete',
  related_id: printJobId,
  related_type: 'print_job'
});
```

### Payment Success
Already integrated in PaymentSuccess.tsx, but you can add:
```typescript
await supabase.from('notifications').insert({
  user_id: userId,
  title: '결제 성공',
  message: `${planName} 플랜 구독이 활성화되었습니다.`,
  type: 'payment_success',
  related_id: paymentId,
  related_type: 'payment'
});
```

## Notification Types

Available notification types:
- `ai_model_complete` - AI model generation completed
- `print_complete` - 3D printing completed
- `print_error` - Printing error occurred
- `payment_success` - Payment successful
- `payment_failed` - Payment failed
- `subscription_expiring` - Subscription expiring soon
- `subscription_renewed` - Subscription renewed

## Real-time Updates

The Header component automatically subscribes to new notifications when a user is logged in. New notifications will:
- Appear in the notification dropdown
- Increment the unread badge count
- Show a blue dot indicator for unread items

No additional setup is needed for real-time updates to work.
