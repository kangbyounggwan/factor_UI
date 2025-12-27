# FACTOR 결제 프로세스 문서

## 목차
1. [개요](#개요)
2. [결제 플로우](#결제-플로우)
3. [Paddle 연동](#paddle-연동)
4. [데이터베이스 스키마](#데이터베이스-스키마)
5. [Edge Functions](#edge-functions)
6. [프론트엔드 컴포넌트](#프론트엔드-컴포넌트)
7. [플랜 구성](#플랜-구성)
8. [트러블슈팅](#트러블슈팅)

---

## 개요

FACTOR는 **Paddle**을 결제 게이트웨이로 사용하며, **Supabase**를 백엔드로 사용합니다.

### 기술 스택
- **결제 게이트웨이**: Paddle (Billing)
- **백엔드**: Supabase (PostgreSQL + Edge Functions)
- **프론트엔드**: React + TypeScript

### 환경변수 (`.env`)
```env
# Paddle Configuration
VITE_PADDLE_ENVIRONMENT=production          # 'sandbox' 또는 'production'
VITE_PADDLE_SELLER_ID=<seller_id>
VITE_PADDLE_CLIENT_TOKEN=<client_token>

# Paddle Price IDs
VITE_PADDLE_PRICE_STARTER_MONTHLY=pri_01kcyrxke87z2a51hrfd0vhe4f
VITE_PADDLE_PRICE_STARTER_YEARLY=pri_01kcys0seakfd2e6y7c3mvtm7z
VITE_PADDLE_PRICE_PRO_MONTHLY=pri_01kbhasnwsznd6cp0xsffyvqbc
VITE_PADDLE_PRICE_PRO_YEARLY=pri_01kbhay65qjtkh4tbmep4egdmf

# Supabase Edge Function Secret
PADDLE_WEBHOOK_SECRET=<webhook_secret>
```

---

## 결제 플로우

### 1. 신규 구독 결제 플로우

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   프론트엔드     │────▶│     Paddle      │────▶│   Webhook       │
│  (Checkout)     │     │   결제 처리      │     │  (Edge Func)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │   Supabase DB   │
                                                │ user_subscriptions│
                                                │ payment_history  │
                                                └─────────────────┘
```

#### 상세 단계:

1. **사용자가 플랜 선택** (`/subscription` 또는 `/user-settings`)
2. **Paddle Checkout 열기** (`paddleService.ts` → `openCheckout()`)
3. **사용자가 결제 완료** (Paddle UI에서)
4. **Paddle이 Webhook 전송** → `paddle-webhook` Edge Function
5. **Webhook 처리**:
   - `subscription.created` → `user_subscriptions` 테이블에 구독 생성
   - `transaction.completed` → `payment_history` 테이블에 결제 기록
6. **프론트엔드 갱신** → 구독 상태 표시

### 2. 구독 취소 (다운그레이드) 플로우

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   프론트엔드     │────▶│   Supabase DB   │     │  Cron Job       │
│ "다운그레이드"   │     │ cancel_at_period│────▶│ (매일 00:00)    │
│   버튼 클릭     │     │    _end=true    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  기간 종료 후    │
                                                │  Free로 전환     │
                                                └─────────────────┘
```

#### 상세 단계:

1. **사용자가 "플랜 다운그레이드" 클릭**
2. **`user_subscriptions` 업데이트**:
   - `cancel_at_period_end = true`
   - `cancelled_at = NOW()`
3. **현재 결제 기간 종료까지 플랜 유지**
4. **`process-expired-subscriptions` Cron Job 실행** (매일 00:00 UTC)
5. **기간 종료된 구독을 Free로 전환**

### 3. 구독 갱신 플로우

```
Paddle 자동 갱신 → subscription.updated 웹훅 → DB 업데이트
```

---

## Paddle 연동

### Paddle Service (`packages/shared/src/services/paddleService.ts`)

```typescript
// Paddle 초기화
export async function initializePaddle(): Promise<Paddle | null>

// 체크아웃 열기
export async function openCheckout(options: {
  priceId: string;
  userId: string;
  userEmail: string;
  successUrl?: string;
}): Promise<void>

// 구독 취소
export async function cancelSubscription(subscriptionId: string): Promise<boolean>
```

### Price ID 매핑

| 플랜 | 주기 | Price ID |
|------|------|----------|
| Starter | Monthly | `pri_01kcyrxke87z2a51hrfd0vhe4f` |
| Starter | Yearly | `pri_01kcys0seakfd2e6y7c3mvtm7z` |
| Pro | Monthly | `pri_01kbhasnwsznd6cp0xsffyvqbc` |
| Pro | Yearly | `pri_01kbhay65qjtkh4tbmep4egdmf` |

---

## 데이터베이스 스키마

### `user_subscriptions` 테이블

```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_id UUID REFERENCES subscription_plans(id),
  plan_name VARCHAR(50) NOT NULL DEFAULT 'free',  -- 'free', 'starter', 'pro', 'enterprise'
  status VARCHAR(20) NOT NULL DEFAULT 'active',    -- 'active', 'trialing', 'cancelled', 'expired'
  billing_cycle VARCHAR(20) DEFAULT 'monthly',     -- 'monthly', 'yearly'
  provider VARCHAR(20) DEFAULT 'paddle',

  -- 기간 정보
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,

  -- 취소 정보
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMP WITH TIME ZONE,

  -- Paddle 연동
  paddle_subscription_id VARCHAR(255),
  paddle_customer_id VARCHAR(255),

  -- 트라이얼
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `payment_history` 테이블

```sql
CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id),
  plan_name VARCHAR(50),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) NOT NULL,           -- 'success', 'failed', 'refunded'
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255) UNIQUE,    -- Paddle transaction ID
  receipt_url TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `subscription_plans` 테이블

```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code VARCHAR(50) UNIQUE NOT NULL,  -- 'free', 'starter', 'pro', 'enterprise'
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10, 2),
  price_yearly DECIMAL(10, 2),
  features JSONB,
  limits JSONB,                           -- { max_printers, max_ai_requests, etc. }
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Edge Functions

### 1. `paddle-webhook` (웹훅 처리)

**경로**: `packages/web/supabase/functions/paddle-webhook/index.ts`

**역할**: Paddle에서 오는 웹훅 이벤트를 처리

#### 처리하는 이벤트:

| 이벤트 | 처리 내용 |
|--------|----------|
| `subscription.created` | `user_subscriptions`에 새 구독 생성 |
| `subscription.activated` | 구독 활성화 (created와 동일 처리) |
| `subscription.updated` | 구독 정보 업데이트 |
| `subscription.canceled` | `cancel_at_period_end = true` 설정 |
| `subscription.past_due` | 결제 실패 상태 업데이트 |
| `transaction.completed` | `payment_history`에 결제 기록 추가 |
| `transaction.paid` | completed와 동일 처리 |
| `transaction.payment_failed` | 결제 실패 기록 추가 |

#### Price ID → Plan Name 매핑:

```typescript
const PADDLE_PRICE_TO_PLAN: Record<string, string> = {
  "pri_01kcyrxke87z2a51hrfd0vhe4f": "starter",  // Starter Monthly
  "pri_01kcys0seakfd2e6y7c3mvtm7z": "starter",  // Starter Yearly
  "pri_01kbhasnwsznd6cp0xsffyvqbc": "pro",      // Pro Monthly
  "pri_01kbhay65qjtkh4tbmep4egdmf": "pro",      // Pro Yearly
};
```

#### 배포:
```bash
cd packages/web
npx supabase functions deploy paddle-webhook --no-verify-jwt
```

### 2. `process-expired-subscriptions` (만료 구독 처리)

**경로**: `packages/web/supabase/functions/process-expired-subscriptions/index.ts`

**역할**: 만료된 구독을 Free 플랜으로 전환

#### 처리 조건:
- `plan_name != 'free'`
- `current_period_end < NOW()`
- `cancel_at_period_end = true` OR `status = 'cancelled'`

#### 처리 내용:
```typescript
{
  status: "expired",
  plan_name: "free",
  plan_id: freePlanId,
  current_period_end: NOW() + 100년,  // Free는 만료 없음
  cancel_at_period_end: false,
  paddle_subscription_id: null,
  paddle_customer_id: null,
}
```

#### Cron 설정 (Supabase Dashboard):
- **Schedule**: `0 0 * * *` (매일 00:00 UTC)
- **Function**: `process-expired-subscriptions`

#### 수동 실행:
```bash
curl -X POST https://<project>.supabase.co/functions/v1/process-expired-subscriptions \
  -H "Authorization: Bearer <anon_key>"
```

---

## 프론트엔드 컴포넌트

### 결제 관련 페이지

| 경로 | 파일 | 설명 |
|------|------|------|
| `/subscription` | `pages/Subscription.tsx` | 플랜 비교 및 선택 |
| `/user-settings` | `pages/UserSettings.tsx` | 구독 관리 (탭) |
| `/payment/checkout` | `pages/PaymentCheckout.tsx` | 체크아웃 페이지 |
| `/payment/success` | `pages/PaymentSuccess.tsx` | 결제 성공 |
| `/payment/fail` | `pages/PaymentFail.tsx` | 결제 실패 |

### 주요 컴포넌트

| 컴포넌트 | 경로 | 설명 |
|----------|------|------|
| `SubscriptionTab` | `components/UserSettings/SubscriptionTab.tsx` | 구독 정보 표시 |
| `PlanSelectionModal` | (UserSettings 내부) | 플랜 선택 모달 |

### 구독 상태 조회 Hook

```typescript
// 구독 정보 조회
const { data: subscription } = await supabase
  .from('user_subscriptions')
  .select('*')
  .eq('user_id', userId)
  .single();

// 플랜 기능 확인
const planName = subscription?.plan_name || 'free';
const features = PLAN_FEATURES[planName];
```

---

## 플랜 구성

### 플랜별 기능 (`PLAN_FEATURES`)

| 기능 | Free | Starter | Pro | Enterprise |
|------|------|---------|-----|------------|
| 프린터 연결 | 1대 | 3대 | 10대 | 무제한 |
| AI 모델 | 기본 | 고급 | 고급 | 고급 |
| 감지 간격 | 60분 | 15분 | 5분 | 1분 |
| 3D 모델링 | 5개/월 | 50개/월 | 무제한 | 무제한 |
| API 접근 | 제한 | 전체 | 전체 | 전체 |

### 가격 (2024년 기준)

| 플랜 | 월간 | 연간 |
|------|------|------|
| Free | ₩0 | ₩0 |
| Starter | ₩9,900 | ₩99,000 |
| Pro | ₩29,900 | ₩299,000 |
| Enterprise | 문의 | 문의 |

---

## 트러블슈팅

### 1. 플랜이 잘못 표시되는 경우

**원인**: Price ID가 `PADDLE_PRICE_TO_PLAN`에 매핑되지 않음

**해결**:
1. Paddle 대시보드에서 Price ID 확인
2. `paddle-webhook/index.ts`의 `PADDLE_PRICE_TO_PLAN`에 추가
3. Edge Function 재배포

### 2. 결제 내역이 표시되지 않는 경우

**원인**: `subscriptionData.price === 0`일 때 결제 내역을 로드하지 않음 (수정됨)

**확인**:
```sql
SELECT * FROM payment_history WHERE user_id = '<user_id>';
```

### 3. 다운그레이드 시 즉시 Free로 변경되는 경우

**원인**: `user_subscriptions` 삭제 대신 `cancel_at_period_end` 설정 필요

**올바른 동작**:
1. `cancel_at_period_end = true` 설정
2. 기간 종료까지 플랜 유지
3. Cron Job이 기간 종료 후 Free로 전환

### 4. Webhook이 실패하는 경우

**확인 방법**:
1. Supabase Dashboard → Edge Functions → `paddle-webhook` → Logs
2. Paddle Dashboard → Developer Tools → Notifications → Events

**일반적인 원인**:
- Webhook Secret 불일치
- Price ID 매핑 누락
- 사용자 이메일로 user_id 조회 실패

### 5. 테스트 방법 (Sandbox)

1. Paddle Sandbox 대시보드에서 상품/가격 생성
2. 환경변수에 Sandbox 설정
3. 테스트 카드: `4242 4242 4242 4242`

---

## 관련 파일 목록

```
packages/
├── shared/
│   └── src/
│       └── services/
│           └── paddleService.ts          # Paddle SDK 연동
│
└── web/
    ├── src/
    │   ├── pages/
    │   │   ├── Subscription.tsx          # 플랜 선택 페이지
    │   │   ├── UserSettings.tsx          # 구독 관리
    │   │   ├── PaymentCheckout.tsx       # 체크아웃
    │   │   ├── PaymentSuccess.tsx        # 결제 성공
    │   │   └── PaymentFail.tsx           # 결제 실패
    │   │
    │   └── components/
    │       └── UserSettings/
    │           └── SubscriptionTab.tsx   # 구독 탭 컴포넌트
    │
    └── supabase/
        ├── functions/
        │   ├── paddle-webhook/
        │   │   └── index.ts              # 웹훅 처리
        │   │
        │   └── process-expired-subscriptions/
        │       └── index.ts              # 만료 구독 처리
        │
        └── migrations/
            ├── 20251209110000_create_subscription_plans.sql
            ├── 20251209120000_create_user_usage.sql
            └── ...
```

---

*마지막 업데이트: 2024-12-27*
