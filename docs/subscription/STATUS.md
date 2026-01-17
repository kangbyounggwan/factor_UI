# 구독 상태 (Subscription Status) 정의

## 개요

`user_subscriptions.status` 컬럼에 저장되는 구독 상태 값에 대한 정의입니다.

## 허용된 Status 값

DB CHECK 제약조건과 TypeScript 타입 모두에서 동일하게 사용됩니다.

| Status | 설명 | UI 표시 |
|--------|------|---------|
| `active` | 정상 활성 구독 | 플랜 뱃지 표시 (Free, Pro 등) |
| `cancelled` | 취소됨 (기간 종료 시 만료 예정) | "취소 예정" 표시 |
| `expired` | 만료됨 | Free로 자동 전환 |
| `past_due` | 결제 실패 (재시도 중) | "결제 실패" 경고 표시 |

## 상태 전이 다이어그램

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    ▼                                      │
┌─────────┐    ┌─────────┐    ┌───────────┐    ┌─────────┐│
│ (신규)  │───▶│ active  │───▶│ cancelled │───▶│ expired ││
└─────────┘    └─────────┘    └───────────┘    └─────────┘│
                    │                               │      │
                    │         ┌──────────┐         │      │
                    └────────▶│ past_due │─────────┘      │
                              └──────────┘                 │
                                   │                       │
                                   └───────────────────────┘
                                   (결제 성공 시 active로 복귀)
```

## 상태별 상세 설명

### `active` (활성)

- **의미**: 정상적으로 서비스 이용 가능한 상태
- **조건**:
  - 결제가 완료됨
  - `current_period_end` > 현재 시간
  - `cancel_at_period_end` = false
- **저장 시점**:
  - 신규 가입 시 (ProfileSetup, AuthContext)
  - 결제 완료 시 (Paddle Webhook)
  - 만료 후 재결제 시

### `cancelled` (취소됨)

- **의미**: 사용자가 구독 취소함, 현재 기간까지는 사용 가능
- **조건**:
  - `cancel_at_period_end` = true
  - `current_period_end` > 현재 시간
- **저장 시점**:
  - 사용자가 "플랜 다운그레이드" 클릭 시
  - Paddle `subscription.canceled` 웹훅 수신 시

### `expired` (만료됨)

- **의미**: 구독 기간이 종료되어 서비스 사용 불가
- **조건**:
  - `current_period_end` < 현재 시간
  - 재결제 없음
- **저장 시점**:
  - Cron Job `process-expired-subscriptions` 실행 시
  - 만료 후 자동으로 Free 플랜으로 전환됨

### `past_due` (결제 실패)

- **의미**: 자동 결제가 실패하여 재시도 중
- **조건**:
  - Paddle에서 결제 재시도 중
  - 일정 기간 후 `expired`로 전환
- **저장 시점**:
  - Paddle `subscription.past_due` 웹훅 수신 시

## 코드에서의 사용

### TypeScript 타입 정의

**파일**: `packages/shared/src/types/subscription.ts`

```typescript
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  PAST_DUE: 'past_due',
} as const;

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS];
```

### DB CHECK 제약조건

**파일**: `packages/shared/supabase/migrations/20251221120000_cleanup_trial_subscriptions.sql`

```sql
ALTER TABLE public.user_subscriptions
ADD CONSTRAINT user_subscriptions_status_check
CHECK (status IN ('active', 'cancelled', 'expired', 'past_due'));
```

### 구독 조회 함수

**파일**: `packages/shared/src/services/supabaseService/subscription.ts`

```typescript
// active 상태인 구독만 조회
export async function getUserSubscription(userId: string) {
  const { data } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')  // active만 유효한 구독으로 인정
    .maybeSingle();
  return data;
}
```

### 구독 생성/업데이트 함수

```typescript
// 신규 가입 시 (ProfileSetup, AuthContext)
status: 'active'

// 결제 완료 시 (Webhook)
status: 'active'

// 구독 취소 시
status: 'cancelled'
cancel_at_period_end: true

// 만료 처리 시 (Cron Job)
status: 'expired'
plan_name: 'free'
```

## 저장 위치별 Status 값

| 위치 | 함수/로직 | 저장하는 Status |
|------|----------|----------------|
| `AuthContext.tsx:484` | `ensureUserSettings()` | `'active'` |
| `ProfileSetup.tsx (web/mobile)` | 프로필 설정 완료 | `'active'` |
| `subscription.ts:73,95` | `upsertUserSubscription()` | `'active'` |
| `subscription.ts:170` | `upsertSubscription()` | `'active' \| 'cancelled' \| 'expired' \| 'past_due'` |
| Paddle Webhook | `subscription.created` | `'active'` |
| Paddle Webhook | `subscription.canceled` | `'cancelled'` |
| Paddle Webhook | `subscription.past_due` | `'past_due'` |
| Cron Job | `process-expired-subscriptions` | `'expired'` |

## 제거된 Status 값

다음 값들은 더 이상 사용되지 않습니다:

| 제거된 값 | 이유 |
|----------|------|
| `trial` | 트라이얼 기능 제거됨, `active`로 대체 |
| `trialing` | 트라이얼 기능 제거됨, `active`로 대체 |
| `canceled` | 오타, `cancelled`로 통일 |

## 관련 마이그레이션

1. **20251027020000_subscriptions.sql**: 초기 테이블 생성 (trial 포함)
2. **20251221120000_cleanup_trial_subscriptions.sql**: trial 제거, status 정리

---

*마지막 업데이트: 2026-01-17*
