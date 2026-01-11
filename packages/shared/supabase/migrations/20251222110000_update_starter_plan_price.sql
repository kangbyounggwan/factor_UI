-- ============================================
-- Starter 플랜 가격 업데이트
-- 월 4,900원 / 연 49,000원
-- 월 $3.5 / 연 $35
-- ============================================

UPDATE public.subscription_plans
SET
    price_monthly = 4900,
    price_yearly = 49000,
    updated_at = NOW()
WHERE plan_code = 'starter';

-- 참고: USD 가격은 프론트엔드에서 처리
-- 월 $3.5, 연 $35
