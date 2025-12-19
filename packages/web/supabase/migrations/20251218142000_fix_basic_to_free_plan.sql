-- ============================================
-- 'basic' 플랜을 'free'로 통일
-- 레거시 'basic' 플랜 데이터 정리
-- ============================================

-- 1. 기존 'basic' 플랜을 'free'로 변경
UPDATE public.user_subscriptions
SET plan_name = 'free', updated_at = NOW()
WHERE plan_name = 'basic';

-- 2. 기본값을 'free'로 변경
ALTER TABLE public.user_subscriptions
ALTER COLUMN plan_name SET DEFAULT 'free';

-- 3. 코멘트 업데이트
COMMENT ON COLUMN public.user_subscriptions.plan_name IS '플랜명 (free, starter, pro, enterprise)';
