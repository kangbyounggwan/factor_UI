# Notification System Documentation

## Overview

The notification system provides real-time notifications to users for background tasks and important events. It uses Supabase's real-time functionality to deliver instant notifications without polling.

## Features

- ✅ Real-time notification delivery via Supabase subscriptions
- ✅ Unread count badge on notification bell icon
- ✅ Dropdown menu showing recent notifications
- ✅ Mark individual notifications as read
- ✅ Visual indicators for unread notifications (blue dot)
- ✅ Different notification types (AI model complete, print complete, payment success, etc.)
- ✅ Multi-language support (Korean/English)
- ✅ Automatic cleanup of old notifications (30+ days)
- ✅ Row-level security (users only see their own notifications)

## Database Schema

### Table: `notifications`

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  read BOOLEAN DEFAULT false,
  related_id UUID,
  related_type VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);
```

### Notification Types

- `ai_model_complete` - AI model generation completed
- `print_complete` - 3D printing job completed
- `print_error` - Printing error occurred
- `payment_success` - Payment processed successfully
- `payment_failed` - Payment failed
- `subscription_expiring` - Subscription expiring soon (7 days)
- `subscription_renewed` - Subscription renewed automatically

### Helper Functions

1. **`mark_notification_as_read(notification_id UUID)`**
   - Marks a single notification as read
   - Sets `read = true` and `read_at = now()`
   - Only affects notifications belonging to the current user

2. **`mark_all_notifications_as_read()`**
   - Marks all unread notifications as read for the current user
   - Useful for "Mark all as read" functionality

3. **`delete_old_notifications()`**
   - Deletes notifications older than 30 days
   - Should be run periodically via a cron job

## Setup Instructions

### 1. Apply Database Migration

Open Supabase Dashboard → SQL Editor and run:

```bash
supabase/migrations/20250127000003_create_notifications_table.sql
```

This creates:
- `notifications` table
- RLS policies
- Helper functions
- Indexes for performance

### 2. Verify Real-time is Enabled

In Supabase Dashboard → Database → Replication:

Make sure `notifications` table has replication enabled for real-time subscriptions to work.

### 3. Test the System

After logging in, open browser console and run:

```javascript
// Create a test notification
await window.testNotifications.simple()

// Create all types of test notifications
await window.testNotifications.all()

// Clear all notifications
await window.testNotifications.clear()
```

You should see the notification bell badge update and the notification appear in the dropdown.

## Usage in Code

### Import the Service

```typescript
import {
  createNotification,
  notifyAIModelComplete,
  notifyPrintComplete,
  notifyPrintError,
  notifyPaymentSuccess,
  notifySubscriptionExpiring
} from '@shared/services/supabaseService/notifications';
```

### Create Custom Notification

```typescript
await createNotification({
  userId: user.id,
  title: 'Custom Notification',
  message: 'This is a custom notification message',
  type: 'custom_type',
  relatedId: 'resource-id',
  relatedType: 'resource_type',
  metadata: { key: 'value' }
});
```

### Use Pre-built Notification Functions

#### AI Model Complete

```typescript
await notifyAIModelComplete({
  userId: user.id,
  modelId: 'model-uuid',
  modelName: '3D Model Name'
});
```

#### Print Job Complete

```typescript
await notifyPrintComplete({
  userId: user.id,
  printJobId: 'job-uuid',
  printJobName: 'Print Job Name'
});
```

#### Print Error

```typescript
await notifyPrintError({
  userId: user.id,
  printJobId: 'job-uuid',
  printJobName: 'Print Job Name',
  errorMessage: 'Nozzle temperature too low'
});
```

#### Payment Success

```typescript
await notifyPaymentSuccess({
  userId: user.id,
  paymentId: 'payment-uuid',
  planName: 'pro',
  amount: 29000
});
```

#### Subscription Expiring

```typescript
await notifySubscriptionExpiring({
  userId: user.id,
  subscriptionId: 'sub-uuid',
  planName: 'pro',
  daysRemaining: 7
});
```

## Integration Points

### 1. AI Model Generation

When AI model generation completes in your background worker:

```typescript
// After model generation completes
await notifyAIModelComplete({
  userId: modelOwnerId,
  modelId: generatedModel.id,
  modelName: generatedModel.name
});
```

### 2. 3D Print Jobs

When print job status changes:

```typescript
// On print completion
await notifyPrintComplete({
  userId: printJob.userId,
  printJobId: printJob.id,
  printJobName: printJob.name
});

// On print error
await notifyPrintError({
  userId: printJob.userId,
  printJobId: printJob.id,
  printJobName: printJob.name,
  errorMessage: error.message
});
```

### 3. Payment Processing

Already integrated in `PaymentSuccess.tsx`:

```typescript
// After successful payment
await notifyPaymentSuccess({
  userId: user.id,
  paymentId: payment.id,
  planName: subscription.planName,
  amount: payment.amount
});
```

### 4. Subscription Management

In a cron job that checks for expiring subscriptions:

```typescript
// Find subscriptions expiring in 7 days
const expiringSubscriptions = await getExpiringSoonSubscriptions(7);

for (const sub of expiringSubscriptions) {
  await notifySubscriptionExpiring({
    userId: sub.userId,
    subscriptionId: sub.id,
    planName: sub.planName,
    daysRemaining: 7
  });
}
```

## UI Components

### Notification Bell (Header.tsx)

The notification bell displays in the header next to the user profile:

- Red badge shows unread count
- Displays "9+" if more than 9 unread
- Clicking opens dropdown with recent 20 notifications
- Real-time updates when new notifications arrive

### Notification Dropdown

- Shows notification title, message, and time
- Blue dot indicator for unread notifications
- Click notification to mark as read
- Scrollable list for many notifications
- Empty state when no notifications

## Real-time Subscription

The Header component automatically subscribes to new notifications:

```typescript
useEffect(() => {
  if (user) {
    const notificationSubscription = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications((prev) => [payload.new, ...prev]);
        setUnreadNotifications((prev) => prev + 1);
      })
      .subscribe();

    return () => notificationSubscription.unsubscribe();
  }
}, [user]);
```

This subscription:
- Listens for new rows inserted into `notifications` table
- Filters to only current user's notifications
- Automatically updates UI when notification is received
- Cleans up subscription when component unmounts

## Performance Considerations

### Indexes

The migration creates these indexes for fast queries:

```sql
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;
```

### Limits

- Dropdown shows last 20 notifications
- Notifications auto-delete after 30 days
- Real-time subscription filters by user_id (efficient)

### Best Practices

1. **Don't spam notifications** - Only send for important events
2. **Use appropriate types** - Helps with filtering and analytics
3. **Include metadata** - Store additional context for debugging
4. **Set related_id/type** - Enables navigation to related resources
5. **Clean up old data** - Run `delete_old_notifications()` regularly

## Troubleshooting

### Notifications not appearing in real-time?

1. Check Supabase Dashboard → Database → Replication
2. Ensure `notifications` table has replication enabled
3. Check browser console for WebSocket errors
4. Verify user is logged in and has valid session

### "Permission denied" errors?

1. Check RLS policies are enabled on `notifications` table
2. Verify user is authenticated
3. Check that `user_id` in notification matches current user

### Old notifications piling up?

Set up a cron job to run periodically:

```sql
SELECT delete_old_notifications();
```

## Internationalization

All notification text supports Korean and English:

```typescript
// In ko.ts
notifications: {
  title: "알림",
  noNotifications: "알림이 없습니다",
  types: {
    ai_model_complete: "AI 모델 생성 완료",
    print_complete: "프린팅 완료",
    // ...
  }
}

// In en.ts
notifications: {
  title: "Notifications",
  noNotifications: "No notifications",
  types: {
    ai_model_complete: "AI Model Complete",
    print_complete: "Print Complete",
    // ...
  }
}
```

Use in components:

```typescript
const { t } = useTranslation();
<span>{t('notifications.noNotifications')}</span>
```

## Future Enhancements

Potential improvements for the notification system:

1. **Push notifications** - Browser push API for background notifications
2. **Email notifications** - Send emails for critical notifications
3. **Notification preferences** - Let users choose which types to receive
4. **Notification sound** - Play sound when notification arrives
5. **Batch notifications** - Group similar notifications
6. **Notification history page** - View all notifications with filtering
7. **Action buttons** - Add quick actions to notifications
8. **Rich notifications** - Include images, progress bars, etc.

## Security

The notification system uses Row Level Security (RLS):

- Users can only view their own notifications
- Users can only update (mark as read) their own notifications
- Users can only delete their own notifications
- Service role can insert notifications (for background jobs)

RLS Policies:

```sql
-- View own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Update own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Delete own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Service can insert notifications
CREATE POLICY "Service can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);
```

## Testing

Use the built-in test utilities:

```javascript
// Browser console (development only)

// Create single test notification
await window.testNotifications.simple()

// Create AI model notification
await window.testNotifications.aiModel()

// Create print complete notification
await window.testNotifications.printComplete()

// Create print error notification
await window.testNotifications.printError()

// Create payment notification
await window.testNotifications.payment()

// Create subscription expiring notification
await window.testNotifications.subscriptionExpiring()

// Create all test notifications at once
await window.testNotifications.all()

// Clear all notifications
await window.testNotifications.clear()
```

Test utilities are automatically loaded in development mode via `App.tsx`.
