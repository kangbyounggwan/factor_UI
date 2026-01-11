-- user_subscriptions 테이블 생성
-- 사용자의 구독 정보를 저장합니다.
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_name TEXT NOT NULL DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'canceled', 'expired', 'trial')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  toss_payment_key TEXT,
  toss_order_id TEXT,
  toss_billing_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- payment_history 테이블 생성
-- 결제 내역을 저장합니다.
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KRW',
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'refunded', 'pending', 'canceled')),
  payment_method TEXT,
  card_company TEXT,
  card_number TEXT,
  payment_key TEXT,
  order_id TEXT,
  transaction_id TEXT,
  receipt_url TEXT,
  refund_reason TEXT,
  refunded_amount DECIMAL(10, 2),
  paid_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_name ON public.user_subscriptions(plan_name);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON public.payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription_id ON public.payment_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON public.payment_history(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_created_at ON public.payment_history(created_at DESC);

-- RLS 정책 활성화
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- user_subscriptions RLS 정책
CREATE POLICY "Users can view their own subscription"
  ON public.user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
  ON public.user_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert subscriptions"
  ON public.user_subscriptions
  FOR INSERT
  WITH CHECK (true);

-- payment_history RLS 정책
CREATE POLICY "Users can view their own payment history"
  ON public.payment_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert payment history"
  ON public.payment_history
  FOR INSERT
  WITH CHECK (true);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON public.user_subscriptions;

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 코멘트 추가
COMMENT ON TABLE public.user_subscriptions IS '사용자 구독 정보';
COMMENT ON COLUMN public.user_subscriptions.id IS '구독 고유 ID';
COMMENT ON COLUMN public.user_subscriptions.user_id IS '사용자 ID (고유)';
COMMENT ON COLUMN public.user_subscriptions.plan_name IS '플랜명 (basic, pro, enterprise)';
COMMENT ON COLUMN public.user_subscriptions.status IS '구독 상태 (active, canceled, expired, trial)';
COMMENT ON COLUMN public.user_subscriptions.current_period_start IS '현재 구독 기간 시작';
COMMENT ON COLUMN public.user_subscriptions.current_period_end IS '현재 구독 기간 종료';
COMMENT ON COLUMN public.user_subscriptions.cancel_at_period_end IS '기간 종료 시 취소 여부';
COMMENT ON COLUMN public.user_subscriptions.toss_payment_key IS '토스페이먼츠 결제 키';
COMMENT ON COLUMN public.user_subscriptions.toss_order_id IS '토스페이먼츠 주문 ID';
COMMENT ON COLUMN public.user_subscriptions.toss_billing_key IS '토스페이먼츠 정기결제 키';

COMMENT ON TABLE public.payment_history IS '결제 내역';
COMMENT ON COLUMN public.payment_history.id IS '결제 내역 고유 ID';
COMMENT ON COLUMN public.payment_history.user_id IS '사용자 ID';
COMMENT ON COLUMN public.payment_history.subscription_id IS '구독 ID';
COMMENT ON COLUMN public.payment_history.plan_name IS '플랜명';
COMMENT ON COLUMN public.payment_history.amount IS '결제 금액';
COMMENT ON COLUMN public.payment_history.currency IS '통화 (KRW, USD 등)';
COMMENT ON COLUMN public.payment_history.status IS '결제 상태 (success, failed, refunded, pending, canceled)';
COMMENT ON COLUMN public.payment_history.payment_method IS '결제 수단';
COMMENT ON COLUMN public.payment_history.card_company IS '카드사';
COMMENT ON COLUMN public.payment_history.card_number IS '카드 번호 (마스킹)';
COMMENT ON COLUMN public.payment_history.payment_key IS '결제 키';
COMMENT ON COLUMN public.payment_history.order_id IS '주문 ID';
COMMENT ON COLUMN public.payment_history.paid_at IS '결제 완료 시간';
