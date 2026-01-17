# Paddle Webhook 처리

## 개요

Paddle에서 결제 이벤트 발생 시 Edge Function으로 웹훅을 전송합니다.

## Edge Function

**경로**: `packages/web/supabase/functions/paddle-webhook/index.ts`

### 배포

```bash
cd packages/web
npx supabase functions deploy paddle-webhook --no-verify-jwt
```

### Webhook URL 설정

Paddle Dashboard → Developer Tools → Notifications → Webhooks:
- URL: `https://<project-ref>.supabase.co/functions/v1/paddle-webhook`
- Events: 아래 이벤트 목록 참조

## 처리하는 이벤트

| 이벤트 | 처리 내용 |
|--------|----------|
| `subscription.created` | `user_subscriptions`에 새 구독 생성 |
| `subscription.activated` | 구독 활성화 (created와 동일 처리) |
| `subscription.updated` | 구독 정보 업데이트 (플랜 변경 등) |
| `subscription.canceled` | `cancel_at_period_end = true` 설정 |
| `subscription.past_due` | `status = 'past_due'` 설정 |
| `transaction.completed` | `payment_history`에 결제 기록 추가 |
| `transaction.paid` | completed와 동일 처리 |
| `transaction.payment_failed` | 결제 실패 기록 추가 |

## Price ID → Plan Name 매핑

```typescript
const PADDLE_PRICE_TO_PLAN: Record<string, string> = {
  "pri_01kcyrxke87z2a51hrfd0vhe4f": "starter",  // Starter Monthly
  "pri_01kcys0seakfd2e6y7c3mvtm7z": "starter",  // Starter Yearly
  "pri_01kbhasnwsznd6cp0xsffyvqbc": "pro",      // Pro Monthly
  "pri_01kbhay65qjtkh4tbmep4egdmf": "pro",      // Pro Yearly
};
```

## 구독 생성 처리 (subscription.created)

```typescript
// Webhook 페이로드에서 추출
const subscriptionId = data.id;
const customerId = data.customer_id;
const priceId = data.items?.[0]?.price?.id;
const userEmail = data.customer?.email || data.custom_data?.user_email;

// DB 업데이트
await supabase.from('user_subscriptions').upsert({
  user_id: userId,
  plan_name: PADDLE_PRICE_TO_PLAN[priceId] || 'starter',
  status: 'active',
  billing_cycle: priceId.includes('yearly') ? 'yearly' : 'monthly',
  paddle_subscription_id: subscriptionId,
  paddle_customer_id: customerId,
  current_period_start: data.current_billing_period?.starts_at,
  current_period_end: data.current_billing_period?.ends_at,
  cancel_at_period_end: false,
});
```

## 결제 기록 처리 (transaction.completed)

```typescript
await supabase.from('payment_history').insert({
  user_id: userId,
  plan_name: planName,
  amount: data.details?.totals?.total,
  currency: data.currency_code,
  status: 'success',
  transaction_id: data.id,
  payment_method: data.payments?.[0]?.method_details?.type,
  paid_at: data.billed_at,
});
```

## 만료 구독 처리 Cron Job

**경로**: `packages/web/supabase/functions/process-expired-subscriptions/index.ts`

### 처리 조건

```sql
WHERE plan_name != 'free'
  AND current_period_end < NOW()
  AND (cancel_at_period_end = true OR status = 'cancelled')
```

### 처리 내용

```typescript
await supabase.from('user_subscriptions').update({
  status: 'expired',
  plan_name: 'free',
  plan_id: freePlanId,
  current_period_end: NOW() + 100년,  // Free는 만료 없음
  cancel_at_period_end: false,
  paddle_subscription_id: null,
  paddle_customer_id: null,
}).eq('id', subscription.id);
```

### Cron 설정 (Supabase Dashboard)

- **Schedule**: `0 0 * * *` (매일 00:00 UTC)
- **Function**: `process-expired-subscriptions`

### 수동 실행

```bash
curl -X POST https://<project>.supabase.co/functions/v1/process-expired-subscriptions \
  -H "Authorization: Bearer <anon_key>"
```

## 보안

### Webhook Signature 검증

```typescript
import { validateWebhookSignature } from '@paddle/paddle-node-sdk';

const isValid = validateWebhookSignature(
  request.body,
  request.headers['paddle-signature'],
  process.env.PADDLE_WEBHOOK_SECRET
);

if (!isValid) {
  return new Response('Invalid signature', { status: 401 });
}
```

### 환경변수

```env
# Supabase Edge Function Secrets
PADDLE_WEBHOOK_SECRET=pdl_ntfset_...
```

## 로그 확인

Supabase Dashboard → Edge Functions → `paddle-webhook` → Logs

## 디버깅

### Webhook 이벤트 재시도

Paddle Dashboard → Developer Tools → Notifications → Events → 이벤트 선택 → Retry

### 로컬 테스트

```bash
# Supabase CLI로 로컬 함수 실행
supabase functions serve paddle-webhook --env-file .env

# 테스트 요청 전송
curl -X POST http://localhost:54321/functions/v1/paddle-webhook \
  -H "Content-Type: application/json" \
  -d '{"event_type": "subscription.created", ...}'
```

---

*마지막 업데이트: 2026-01-17*
