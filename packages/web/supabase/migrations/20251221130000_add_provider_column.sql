-- ============================================
-- user_subscriptions 테이블에 provider 컬럼 추가
-- 토스페이먼츠 관련 컬럼 제거 (Paddle로 통합)
-- ============================================

-- 1. provider 컬럼 추가 (기본값 'paddle')
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'paddle'
CHECK (provider IN ('paddle', 'manual'));

-- 2. 토스페이먼츠 관련 컬럼 제거
ALTER TABLE public.user_subscriptions
DROP COLUMN IF EXISTS toss_payment_key;

ALTER TABLE public.user_subscriptions
DROP COLUMN IF EXISTS toss_order_id;

ALTER TABLE public.user_subscriptions
DROP COLUMN IF EXISTS toss_billing_key;

-- 3. 기존 데이터 provider 설정
-- Paddle 구독 ID가 있으면 'paddle', 없으면 'manual'
UPDATE public.user_subscriptions
SET provider = CASE
    WHEN paddle_subscription_id IS NOT NULL THEN 'paddle'
    ELSE 'manual'
END
WHERE provider IS NULL;

-- 4. 코멘트 추가
COMMENT ON COLUMN public.user_subscriptions.provider IS '결제 제공자: paddle(Paddle 결제), manual(관리자 수동 설정)';

-- 5. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider
ON public.user_subscriptions(provider);
