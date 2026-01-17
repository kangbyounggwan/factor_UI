# 결제 플로우 (Payment Flow)

## 개요

FACTOR는 **Paddle**을 결제 게이트웨이로 사용합니다.

## 기술 스택

- **결제 게이트웨이**: Paddle (Billing)
- **백엔드**: Supabase (PostgreSQL + Edge Functions)
- **프론트엔드**: React + TypeScript

## 환경변수

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

# Webhook Secret
PADDLE_WEBHOOK_SECRET=<webhook_secret>
```

## 결제 플로우 다이어그램

### 1. 신규 구독 결제

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

**상세 단계:**

1. **사용자가 플랜 선택** (`/subscription` 또는 `/user-settings`)
2. **Paddle Checkout 열기** (`paddleService.ts` → `openCheckout()`)
3. **사용자가 결제 완료** (Paddle UI에서)
4. **Paddle이 Webhook 전송** → `paddle-webhook` Edge Function
5. **Webhook 처리**:
   - `subscription.created` → `user_subscriptions` 테이블에 구독 생성
   - `transaction.completed` → `payment_history` 테이블에 결제 기록
6. **프론트엔드 갱신** → 구독 상태 표시

### 2. 구독 취소 (다운그레이드)

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

**상세 단계:**

1. **사용자가 "플랜 다운그레이드" 클릭**
2. **`user_subscriptions` 업데이트**:
   - `cancel_at_period_end = true`
   - `cancelled_at = NOW()`
3. **현재 결제 기간 종료까지 플랜 유지**
4. **`process-expired-subscriptions` Cron Job 실행** (매일 00:00 UTC)
5. **기간 종료된 구독을 Free로 전환**

### 3. 구독 갱신

```
Paddle 자동 갱신 → subscription.updated 웹훅 → DB 업데이트
```

## Paddle Service

**파일**: `packages/web/src/lib/paddleService.ts`

### 주요 함수

```typescript
// Paddle 초기화
export async function initializePaddleService(): Promise<boolean>

// 체크아웃 열기
export async function openPaddleCheckout(options: {
  priceId: string;
  userId: string;
  userEmail: string;
  successUrl?: string;
}): Promise<void>

// Price ID 가져오기
export function getPaddlePriceId(plan: string, billingCycle: 'monthly' | 'yearly'): string
```

### Price ID 매핑

| 플랜 | 주기 | Price ID | 환경변수 |
|------|------|----------|----------|
| Starter | Monthly | `pri_01kcyrxke87z2a51hrfd0vhe4f` | `VITE_PADDLE_PRICE_STARTER_MONTHLY` |
| Starter | Yearly | `pri_01kcys0seakfd2e6y7c3mvtm7z` | `VITE_PADDLE_PRICE_STARTER_YEARLY` |
| Pro | Monthly | `pri_01kbhasnwsznd6cp0xsffyvqbc` | `VITE_PADDLE_PRICE_PRO_MONTHLY` |
| Pro | Yearly | `pri_01kbhay65qjtkh4tbmep4egdmf` | `VITE_PADDLE_PRICE_PRO_YEARLY` |

## 결제 관련 페이지

| 경로 | 파일 | 설명 |
|------|------|------|
| `/subscription` | `pages/Subscription.tsx` | 플랜 비교 및 선택 |
| `/user-settings` | `pages/UserSettings.tsx` | 구독 관리 (탭) |
| `/payment/checkout` | `pages/PaymentCheckout.tsx` | 체크아웃 페이지 |
| `/payment/success` | `pages/PaymentSuccess.tsx` | 결제 성공 |
| `/payment/fail` | `pages/PaymentFail.tsx` | 결제 실패 |

## 테스트 (Sandbox 환경)

1. Paddle Sandbox 대시보드에서 상품/가격 생성
2. 환경변수를 Sandbox 설정으로 변경:
   ```env
   VITE_PADDLE_ENVIRONMENT=sandbox
   ```
3. 테스트 카드: `4242 4242 4242 4242`

---

*마지막 업데이트: 2026-01-17*
