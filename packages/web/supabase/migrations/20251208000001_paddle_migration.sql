-- =====================================================
-- Paddle 결제 시스템 마이그레이션
-- 기존 Toss 결제에서 Paddle로 전환
-- =====================================================

-- 1. paddle_customers 테이블 생성
CREATE TABLE IF NOT EXISTS paddle_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_customer_id TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  locale TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. paddle_subscriptions 테이블 생성
CREATE TABLE IF NOT EXISTS paddle_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_subscription_id TEXT UNIQUE NOT NULL,
  paddle_customer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, canceled, past_due, paused, trialing
  plan_name TEXT NOT NULL DEFAULT 'pro',
  price_id TEXT,
  currency TEXT DEFAULT 'USD',
  unit_price INTEGER, -- cents
  billing_cycle_interval TEXT, -- month, year
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. paddle_transactions 테이블 생성 (결제 내역)
CREATE TABLE IF NOT EXISTS paddle_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_transaction_id TEXT UNIQUE NOT NULL,
  paddle_subscription_id TEXT,
  paddle_customer_id TEXT,
  status TEXT NOT NULL, -- completed, refunded, failed
  amount INTEGER NOT NULL, -- cents
  currency TEXT DEFAULT 'USD',
  payment_method TEXT,
  receipt_url TEXT,
  invoice_number TEXT,
  billed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. user_subscriptions 테이블에 Paddle 컬럼 추가 (기존 테이블 확장)
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'toss'; -- 'toss' or 'paddle'

-- 5. payment_history 테이블 확인 및 생성 (없는 경우)
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID,
  plan_name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL, -- success, failed, refunded
  payment_method TEXT,
  transaction_id TEXT UNIQUE,
  receipt_url TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RLS 정책 설정
-- paddle_customers
ALTER TABLE paddle_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own paddle customer" ON paddle_customers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage paddle customers" ON paddle_customers
  FOR ALL USING (auth.role() = 'service_role');

-- paddle_subscriptions
ALTER TABLE paddle_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own paddle subscriptions" ON paddle_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage paddle subscriptions" ON paddle_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- paddle_transactions
ALTER TABLE paddle_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own paddle transactions" ON paddle_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage paddle transactions" ON paddle_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- payment_history
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payment history" ON payment_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage payment history" ON payment_history
  FOR ALL USING (auth.role() = 'service_role');

-- 7. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_paddle_customers_user_id ON paddle_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_paddle_customers_paddle_id ON paddle_customers(paddle_customer_id);

CREATE INDEX IF NOT EXISTS idx_paddle_subscriptions_user_id ON paddle_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_paddle_subscriptions_paddle_id ON paddle_subscriptions(paddle_subscription_id);
CREATE INDEX IF NOT EXISTS idx_paddle_subscriptions_status ON paddle_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_paddle_transactions_user_id ON paddle_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_paddle_transactions_paddle_id ON paddle_transactions(paddle_transaction_id);
CREATE INDEX IF NOT EXISTS idx_paddle_transactions_subscription ON paddle_transactions(paddle_subscription_id);

CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_transaction_id ON payment_history(transaction_id);

-- 8. Updated_at 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_paddle_customers_updated_at ON paddle_customers;
CREATE TRIGGER update_paddle_customers_updated_at
  BEFORE UPDATE ON paddle_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_paddle_subscriptions_updated_at ON paddle_subscriptions;
CREATE TRIGGER update_paddle_subscriptions_updated_at
  BEFORE UPDATE ON paddle_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. 테이블 코멘트
COMMENT ON TABLE paddle_customers IS 'Paddle 고객 정보';
COMMENT ON TABLE paddle_subscriptions IS 'Paddle 구독 정보';
COMMENT ON TABLE paddle_transactions IS 'Paddle 결제 내역';
