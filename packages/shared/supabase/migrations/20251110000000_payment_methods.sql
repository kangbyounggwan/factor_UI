-- payment_methods 테이블 생성
-- 사용자의 결제 수단 정보를 저장합니다.
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_company TEXT,
  card_number TEXT NOT NULL, -- 마스킹된 카드번호 (예: **** **** **** 2295)
  card_expiry TEXT NOT NULL, -- 만료일 (예: 6/2030)
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  toss_billing_key TEXT, -- 토스페이먼츠 빌링키
  toss_customer_key TEXT, -- 토스페이먼츠 고객키
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_default ON public.payment_methods(is_default);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_active ON public.payment_methods(is_active);

-- RLS 정책 활성화
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- payment_methods RLS 정책
CREATE POLICY "Users can view their own payment methods"
  ON public.payment_methods
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment methods"
  ON public.payment_methods
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment methods"
  ON public.payment_methods
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment methods"
  ON public.payment_methods
  FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 코멘트 추가
COMMENT ON TABLE public.payment_methods IS '사용자 결제 수단 정보';
COMMENT ON COLUMN public.payment_methods.id IS '결제 수단 고유 ID';
COMMENT ON COLUMN public.payment_methods.user_id IS '사용자 ID';
COMMENT ON COLUMN public.payment_methods.card_company IS '카드사';
COMMENT ON COLUMN public.payment_methods.card_number IS '마스킹된 카드 번호';
COMMENT ON COLUMN public.payment_methods.card_expiry IS '카드 만료일';
COMMENT ON COLUMN public.payment_methods.is_default IS '기본 결제 수단 여부';
COMMENT ON COLUMN public.payment_methods.is_active IS '활성 상태';
COMMENT ON COLUMN public.payment_methods.toss_billing_key IS '토스페이먼츠 빌링키';
COMMENT ON COLUMN public.payment_methods.toss_customer_key IS '토스페이먼츠 고객키';
