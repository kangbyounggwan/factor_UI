# 구독 데이터베이스 스키마

## 테이블 개요

| 테이블 | 설명 |
|--------|------|
| `subscription_plans` | 플랜 정의 (기능, 가격, 제한) |
| `user_subscriptions` | 사용자별 구독 정보 |
| `user_usage` | 사용자별 사용량 추적 |
| `payment_history` | 결제 내역 |
| `payment_methods` | 저장된 결제 수단 |

---

## subscription_plans

플랜 정의 테이블입니다. 관리자가 설정하며 일반 사용자는 읽기만 가능합니다.

```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code VARCHAR(50) UNIQUE NOT NULL,    -- 'free', 'starter', 'pro', 'enterprise'
  display_name VARCHAR(100) NOT NULL,
  display_name_ko VARCHAR(100),
  description TEXT,

  -- 가격
  price_monthly DECIMAL(10, 2) DEFAULT 0,
  price_yearly DECIMAL(10, 2) DEFAULT 0,

  -- Paddle Price IDs
  paddle_price_id_monthly VARCHAR(255),
  paddle_price_id_yearly VARCHAR(255),

  -- 기능 제한 (-1 = 무제한)
  max_printers INTEGER DEFAULT 1,
  ai_generation_limit INTEGER DEFAULT 5,
  premium_model_daily_limit INTEGER DEFAULT 0,
  troubleshoot_daily_limit INTEGER DEFAULT 5,
  storage_limit_gb INTEGER DEFAULT 1,
  webcam_reconnect_interval INTEGER,         -- NULL = 무제한
  anomaly_detection_interval INTEGER DEFAULT 60,  -- 분, 0 = 실시간

  -- 기능 플래그
  ai_model_type VARCHAR(20) DEFAULT 'basic', -- 'basic', 'advanced'
  support_type VARCHAR(20) DEFAULT 'community', -- 'community', 'email', 'dedicated'
  has_slack_channel BOOLEAN DEFAULT false,
  has_analytics BOOLEAN DEFAULT false,
  has_push_notifications BOOLEAN DEFAULT true,
  has_api_access BOOLEAN DEFAULT false,
  has_ai_assistant BOOLEAN DEFAULT true,
  has_erp_mes_integration BOOLEAN DEFAULT false,

  -- 메타
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## user_subscriptions

사용자별 구독 정보입니다. 사용자당 1개의 행만 존재합니다.

```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- 플랜 정보
  plan_id UUID REFERENCES subscription_plans(id),
  plan_name VARCHAR(50) NOT NULL DEFAULT 'free',

  -- 상태 (중요!)
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),

  -- 결제 주기
  billing_cycle VARCHAR(20) DEFAULT 'monthly',  -- 'monthly', 'yearly'
  provider VARCHAR(20) DEFAULT 'paddle',

  -- 기간 정보
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,

  -- 취소 정보
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,

  -- Paddle 연동
  paddle_subscription_id VARCHAR(255),
  paddle_customer_id VARCHAR(255),

  -- 트라이얼 (현재 사용 안 함)
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,

  -- 메타
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_plan_name ON user_subscriptions(plan_name);
```

### Status CHECK 제약조건

```sql
CHECK (status IN ('active', 'cancelled', 'expired', 'past_due'))
```

> **주의**: `trial`, `trialing` 값은 더 이상 허용되지 않습니다.

---

## user_usage

사용자별 사용량 추적입니다. 월별 또는 일별로 리셋됩니다.

```sql
CREATE TABLE user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 기간 (월별 리셋용)
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,

  -- 월별 사용량
  ai_model_generation INTEGER DEFAULT 0,
  ai_image_generation INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,

  -- 누적 사용량
  printer_count INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,

  -- 일별 사용량 (무료 사용자용)
  troubleshoot_advanced_today INTEGER DEFAULT 0,
  troubleshoot_advanced_date DATE,
  premium_model_trial_today INTEGER DEFAULT 0,
  premium_model_trial_date DATE,

  -- 메타
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, period_year, period_month)
);
```

---

## payment_history

결제 내역입니다.

```sql
CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,

  -- 결제 정보
  plan_name VARCHAR(50),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'KRW',

  -- 상태
  status VARCHAR(20) NOT NULL
    CHECK (status IN ('success', 'failed', 'refunded', 'pending', 'canceled')),

  -- 결제 수단
  payment_method VARCHAR(50),
  card_company VARCHAR(50),
  card_number VARCHAR(20),     -- 마스킹됨 (예: **** 1234)

  -- 결제 ID
  payment_key VARCHAR(255),
  order_id VARCHAR(255),
  transaction_id VARCHAR(255) UNIQUE,

  -- 영수증
  receipt_url TEXT,

  -- 환불 정보
  refund_reason TEXT,
  refunded_amount DECIMAL(10, 2),
  refunded_at TIMESTAMPTZ,

  -- 시간
  paid_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX idx_payment_history_status ON payment_history(status);
CREATE INDEX idx_payment_history_created_at ON payment_history(created_at DESC);
```

---

## payment_methods

저장된 결제 수단입니다.

```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 카드 정보 (마스킹됨)
  card_company VARCHAR(50),
  card_number VARCHAR(20),     -- **** 1234
  card_expiry VARCHAR(10),     -- MM/YY

  -- Paddle 연동
  paddle_payment_method_id VARCHAR(255),

  -- 설정
  is_default BOOLEAN DEFAULT false,

  -- 메타
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## RLS 정책

### user_subscriptions

```sql
-- 자신의 구독만 조회 가능
CREATE POLICY "Users can view their own subscription"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- 자신의 구독만 수정 가능
CREATE POLICY "Users can update their own subscription"
  ON user_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- 시스템(서비스 롤)만 생성 가능
CREATE POLICY "System can insert subscriptions"
  ON user_subscriptions FOR INSERT
  WITH CHECK (true);
```

### payment_history

```sql
-- 자신의 결제 내역만 조회 가능
CREATE POLICY "Users can view their own payment history"
  ON payment_history FOR SELECT
  USING (auth.uid() = user_id);
```

---

## 관련 마이그레이션 파일

```
packages/shared/supabase/migrations/
├── 20251027020000_subscriptions.sql              # 초기 테이블 생성
├── 20251209110000_create_subscription_plans.sql  # 플랜 테이블
├── 20251209120000_create_user_usage.sql          # 사용량 테이블
├── 20251209140000_alter_user_subscriptions.sql   # 컬럼 추가
├── 20251218142000_fix_basic_to_free_plan.sql     # basic→free 변경
├── 20251221100000_update_subscription_plans_features.sql
├── 20251221120000_cleanup_trial_subscriptions.sql # trial 제거
├── 20251221130000_add_provider_column.sql
└── 20251222100000_add_premium_model_trial_columns.sql
```

---

*마지막 업데이트: 2026-01-17*
