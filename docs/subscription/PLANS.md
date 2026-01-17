# 구독 플랜 (Subscription Plans)

## 개요

FACTOR에서 제공하는 구독 플랜 구성입니다.

## 플랜 종류

| 플랜 코드 | 표시 이름 | 월간 가격 | 연간 가격 |
|----------|----------|----------|----------|
| `free` | Free | ₩0 | ₩0 |
| `starter` | Starter | ₩9,900 | ₩99,000 |
| `pro` | Pro | ₩29,900 | ₩299,000 |
| `enterprise` | Enterprise | 문의 | 문의 |

## 플랜별 기능 제한

| 기능 | Free | Starter | Pro | Enterprise |
|------|------|---------|-----|------------|
| **프린터 연결** | 1대 | 3대 | 5대 | 무제한 |
| **AI 모델** | 기본 | 고급 | 고급 | 고급 |
| **이상 감지 간격** | 60분+ | 60분+ | 10분+ | 실시간 |
| **3D 모델링** | 5개/월 | 20개/월 | 50개/월 | 무제한 |
| **API 접근** | 일부 제한 | 일부 제한 | 전체 | 전체 |
| **지원** | 커뮤니티 | 이메일 | 우선 지원 | 전용 담당자 |

## TypeScript 상수

**파일**: `packages/shared/src/types/subscription.ts`

```typescript
export const PLAN_CODES = {
  FREE: 'free',
  STARTER: 'starter',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type SubscriptionPlan = typeof PLAN_CODES[keyof typeof PLAN_CODES];
```

## 결제 주기

```typescript
export const BILLING_CYCLE = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

export type BillingCycle = typeof BILLING_CYCLE[keyof typeof BILLING_CYCLE];
```

## Paddle Price ID 매핑

| 플랜 | 주기 | Price ID | 환경변수 |
|------|------|----------|----------|
| Starter | Monthly | `pri_01kcyrxke87z2a51hrfd0vhe4f` | `VITE_PADDLE_PRICE_STARTER_MONTHLY` |
| Starter | Yearly | `pri_01kcys0seakfd2e6y7c3mvtm7z` | `VITE_PADDLE_PRICE_STARTER_YEARLY` |
| Pro | Monthly | `pri_01kbhasnwsznd6cp0xsffyvqbc` | `VITE_PADDLE_PRICE_PRO_MONTHLY` |
| Pro | Yearly | `pri_01kbhay65qjtkh4tbmep4egdmf` | `VITE_PADDLE_PRICE_PRO_YEARLY` |

## DB 테이블: subscription_plans

플랜 기능은 `subscription_plans` 테이블에서 관리됩니다.

```sql
SELECT
  plan_code,
  display_name,
  price_monthly,
  price_yearly,
  max_printers,
  ai_generation_limit,
  anomaly_detection_interval
FROM subscription_plans
WHERE is_active = true
ORDER BY sort_order;
```

### 주요 컬럼

| 컬럼 | 설명 | 예시 값 |
|------|------|---------|
| `plan_code` | 플랜 식별자 | `'free'`, `'pro'` |
| `max_printers` | 최대 프린터 수 (-1 = 무제한) | `1`, `5`, `-1` |
| `ai_generation_limit` | 월간 AI 생성 한도 (-1 = 무제한) | `5`, `50`, `-1` |
| `anomaly_detection_interval` | 이상 감지 간격 (분, 0 = 실시간) | `60`, `10`, `0` |
| `support_type` | 지원 유형 | `'community'`, `'email'`, `'dedicated'` |

## 플랜 변경 규칙

### 업그레이드 (Free → Pro)

1. Paddle Checkout 열기
2. 결제 완료
3. Webhook에서 `user_subscriptions` 업데이트
4. 즉시 새 플랜 적용

### 다운그레이드 (Pro → Free)

1. "플랜 다운그레이드" 클릭
2. `cancel_at_period_end = true` 설정
3. 현재 결제 기간 종료까지 Pro 유지
4. 기간 종료 후 Cron Job이 Free로 전환

### 플랜 변경 (Pro → Starter)

1. Paddle에서 구독 변경 처리
2. 다음 결제일부터 새 플랜 적용
3. 즉시 변경 필요 시 Paddle API 사용

## 사용량 제한 체크

**파일**: `packages/shared/src/services/supabaseService/usage.ts`

```typescript
// 사용량 체크 예시
const canAddPrinter = await checkUsageLimit(userId, 'printer_count');
const canGenerateAI = await checkUsageLimit(userId, 'ai_model_generation');
```

## 관련 파일

```
packages/shared/src/
├── types/subscription.ts        # 플랜 타입 정의
├── services/supabaseService/
│   ├── subscription.ts          # 구독 조회/업데이트
│   └── usage.ts                 # 사용량 체크
└── hooks/
    └── useUserPlan.ts           # 플랜 조회 훅

packages/web/src/
├── pages/Subscription.tsx       # 플랜 선택 페이지
└── components/UserSettings/
    └── SubscriptionTab.tsx      # 플랜 정보 표시
```

---

*마지막 업데이트: 2026-01-17*
