-- ============================================
-- Trial 구독 정리 마이그레이션
-- trial/trialing 상태를 모두 제거하고 active/expired로 변경
-- ============================================

-- 1. Free 플랜 ID 가져오기
DO $$
DECLARE
    free_plan_id UUID;
BEGIN
    SELECT id INTO free_plan_id FROM public.subscription_plans WHERE plan_code = 'free';

    -- 2. trial/trialing 상태를 active로 변경 (만료되지 않은 경우)
    UPDATE public.user_subscriptions
    SET
        status = 'active',
        plan_id = free_plan_id,
        current_period_end = NOW() + INTERVAL '100 years', -- Free 플랜은 100년 후 만료
        updated_at = NOW()
    WHERE status IN ('trial', 'trialing')
    AND current_period_end >= NOW();

    -- 3. trial/trialing 상태를 expired로 변경 (이미 만료된 경우)
    UPDATE public.user_subscriptions
    SET
        status = 'expired',
        plan_name = 'free',
        plan_id = free_plan_id,
        current_period_start = NOW(),
        current_period_end = NOW() + INTERVAL '100 years', -- Free 플랜으로 전환
        updated_at = NOW()
    WHERE status IN ('trial', 'trialing')
    AND current_period_end < NOW();
END $$;

-- 4. status 컬럼 제약조건 업데이트 (trial/trialing 제거)
ALTER TABLE public.user_subscriptions
DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;

ALTER TABLE public.user_subscriptions
ADD CONSTRAINT user_subscriptions_status_check
CHECK (status IN ('active', 'cancelled', 'expired', 'past_due'));

-- 5. 코멘트 업데이트
COMMENT ON COLUMN public.user_subscriptions.status IS '구독 상태: active(활성), cancelled(취소됨), expired(만료), past_due(결제 실패). 트라이얼 없음';

-- 확인 로그
DO $$
DECLARE
    trial_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO trial_count
    FROM public.user_subscriptions
    WHERE status IN ('trial', 'trialing');

    RAISE NOTICE 'Remaining trial subscriptions: %', trial_count;
END $$;
