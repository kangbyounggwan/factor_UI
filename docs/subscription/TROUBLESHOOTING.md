# 결제/구독 문제 해결 가이드

## 일반적인 문제

### 1. 플랜 뱃지가 잘못 표시됨

**증상**: Pro 플랜인데 사이드바에 "Free"로 표시됨

**원인**:
1. DB의 `status` 값이 `'active'`가 아님
2. `useUserPlan` 훅이 해당 페이지에서 호출되지 않음
3. `AppSidebar`에 `userPlan` props가 전달되지 않음

**해결 방법**:

1. DB 상태 확인:
```sql
SELECT user_id, plan_name, status FROM user_subscriptions WHERE user_id = '<user_id>';
```

2. `status`가 `'active'`가 아니면 수정:
```sql
UPDATE user_subscriptions SET status = 'active' WHERE user_id = '<user_id>';
```

3. 페이지에서 `useUserPlan` 훅 사용 확인:
```typescript
const { plan: userPlan } = useUserPlan(user?.id);

<AppSidebar
  userPlan={userPlan}  // 반드시 전달!
  ...
/>
```

### 2. 결제 후 플랜이 업데이트 안 됨

**원인**:
1. Webhook 실패
2. Price ID가 매핑 테이블에 없음
3. 사용자 이메일로 user_id 조회 실패

**확인 방법**:

1. Supabase Dashboard → Edge Functions → `paddle-webhook` → Logs 확인
2. Paddle Dashboard → Developer Tools → Notifications → Events 확인

**해결 방법**:

1. `PADDLE_PRICE_TO_PLAN` 매핑 확인/추가
2. 수동으로 DB 업데이트:
```sql
UPDATE user_subscriptions
SET plan_name = 'pro', status = 'active'
WHERE user_id = '<user_id>';
```

### 3. 결제 내역이 표시 안 됨

**원인**: `payment_history` 테이블에 레코드가 없음

**확인**:
```sql
SELECT * FROM payment_history WHERE user_id = '<user_id>' ORDER BY created_at DESC;
```

**해결**: Webhook 로그 확인 후 수동 삽입 또는 Paddle에서 이벤트 재시도

### 4. 다운그레이드 시 즉시 Free로 변경됨

**원인**: `cancel_at_period_end` 대신 `plan_name`을 직접 변경함

**올바른 동작**:
1. `cancel_at_period_end = true` 설정
2. 기간 종료까지 플랜 유지
3. Cron Job이 기간 종료 후 Free로 전환

**확인**:
```sql
SELECT plan_name, status, cancel_at_period_end, current_period_end
FROM user_subscriptions WHERE user_id = '<user_id>';
```

### 5. 구독이 만료되지 않음

**원인**: Cron Job이 실행되지 않거나 설정이 잘못됨

**확인**:
1. Supabase Dashboard → Database → Extensions → pg_cron 활성화 확인
2. Cron Jobs 목록 확인

**수동 실행**:
```bash
curl -X POST https://<project>.supabase.co/functions/v1/process-expired-subscriptions \
  -H "Authorization: Bearer <service_role_key>"
```

## DB 상태 값 불일치

### 허용되지 않는 status 값 사용 시

**에러**: `violates check constraint "user_subscriptions_status_check"`

**원인**: DB CHECK 제약조건에 없는 status 값 사용

**허용된 값**: `'active'`, `'cancelled'`, `'expired'`, `'past_due'`

**해결**:
```sql
-- 잘못된 status 값 확인
SELECT DISTINCT status FROM user_subscriptions;

-- 수정
UPDATE user_subscriptions
SET status = 'active'
WHERE status NOT IN ('active', 'cancelled', 'expired', 'past_due');
```

## Webhook 디버깅

### Webhook이 실패하는 경우

**일반적인 원인**:
1. Webhook Secret 불일치
2. Price ID 매핑 누락
3. 사용자 이메일로 user_id 조회 실패
4. DB 권한 문제

**확인 단계**:

1. Supabase Dashboard → Edge Functions → Logs에서 에러 메시지 확인
2. Paddle Dashboard → Notifications → Events에서 실패 이유 확인

### Signature 검증 실패

**원인**: `PADDLE_WEBHOOK_SECRET` 환경변수가 잘못됨

**해결**:
1. Paddle Dashboard → Developer Tools → Notifications → Webhook에서 Secret 복사
2. Supabase Dashboard → Edge Functions → Secrets에 설정

## 환경 설정 문제

### Paddle 초기화 실패

**원인**: 환경변수 누락 또는 잘못됨

**확인**:
```typescript
console.log('Paddle Environment:', import.meta.env.VITE_PADDLE_ENVIRONMENT);
console.log('Paddle Client Token:', import.meta.env.VITE_PADDLE_CLIENT_TOKEN?.slice(0, 10) + '...');
```

### Sandbox vs Production 혼동

**주의**: Sandbox와 Production의 Price ID가 다릅니다!

**확인**:
```env
# Sandbox 환경
VITE_PADDLE_ENVIRONMENT=sandbox

# Production 환경
VITE_PADDLE_ENVIRONMENT=production
```

## 유용한 SQL 쿼리

### 모든 사용자 구독 상태 확인

```sql
SELECT
  au.email,
  us.plan_name,
  us.status,
  us.current_period_end,
  us.cancel_at_period_end
FROM user_subscriptions us
JOIN auth.users au ON us.user_id = au.id
ORDER BY us.updated_at DESC;
```

### 특정 사용자 결제 내역

```sql
SELECT
  ph.plan_name,
  ph.amount,
  ph.currency,
  ph.status,
  ph.paid_at
FROM payment_history ph
JOIN auth.users au ON ph.user_id = au.id
WHERE au.email = 'user@example.com'
ORDER BY ph.created_at DESC;
```

### 만료 예정 구독 확인

```sql
SELECT
  au.email,
  us.plan_name,
  us.current_period_end
FROM user_subscriptions us
JOIN auth.users au ON us.user_id = au.id
WHERE us.cancel_at_period_end = true
  AND us.current_period_end > NOW()
ORDER BY us.current_period_end;
```

---

*마지막 업데이트: 2026-01-17*
