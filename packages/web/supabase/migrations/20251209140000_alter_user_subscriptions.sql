-- ============================================
-- user_subscriptions 테이블 수정
-- subscription_plans 테이블과 연동을 위한 컬럼 추가
-- ============================================

-- plan_id 컬럼 추가 (subscription_plans 테이블 참조)
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id);

-- billing_cycle 컬럼 추가 (결제 주기)
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(10) DEFAULT 'monthly'
CHECK (billing_cycle IN ('monthly', 'yearly'));

-- Paddle 관련 컬럼 추가
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS paddle_subscription_id VARCHAR(100);

ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS paddle_customer_id VARCHAR(100);

-- 취소 관련 컬럼 추가
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 체험판 관련 컬럼 추가
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ;
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id
ON public.user_subscriptions(plan_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_paddle_subscription
ON public.user_subscriptions(paddle_subscription_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_paddle_customer
ON public.user_subscriptions(paddle_customer_id);

-- 코멘트 (추가된 컬럼)
COMMENT ON COLUMN public.user_subscriptions.plan_id IS 'subscription_plans 테이블 참조 (FK). 플랜 상세 정보(제한, 기능 등)를 JOIN하여 조회';
COMMENT ON COLUMN public.user_subscriptions.billing_cycle IS '결제 주기 - monthly(월간), yearly(연간). Paddle 결제 시 자동 설정';
COMMENT ON COLUMN public.user_subscriptions.paddle_subscription_id IS 'Paddle 구독 ID. Paddle Webhook에서 설정. 구독 관리 API 호출에 사용';
COMMENT ON COLUMN public.user_subscriptions.paddle_customer_id IS 'Paddle 고객 ID. Paddle Webhook에서 설정. 고객 정보 조회에 사용';
COMMENT ON COLUMN public.user_subscriptions.cancelled_at IS '구독 취소 일시. cancel_at_period_end=true와 함께 설정. 취소 후에도 period_end까지는 플랜 유지';
COMMENT ON COLUMN public.user_subscriptions.trial_start IS '체험판 시작일. Paddle trialing 상태일 때 설정';
COMMENT ON COLUMN public.user_subscriptions.trial_end IS '체험판 종료일. 이 날짜 이후 정식 결제 진행';

-- ============================================
-- 기존 데이터 마이그레이션: plan_name으로 plan_id 설정
-- ============================================
UPDATE public.user_subscriptions us
SET plan_id = sp.id
FROM public.subscription_plans sp
WHERE us.plan_name = sp.plan_code
  AND us.plan_id IS NULL;

-- ============================================
-- 플랜 정보 조회 함수 (subscription_plans 연동)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_plan_info(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'subscription_id', us.id,
        'user_id', us.user_id,
        'plan_code', COALESCE(us.plan_name, 'free'),
        'plan_id', us.plan_id,
        'status', us.status,
        'billing_cycle', us.billing_cycle,
        'current_period_start', us.current_period_start,
        'current_period_end', us.current_period_end,
        'cancel_at_period_end', us.cancel_at_period_end,
        'cancelled_at', us.cancelled_at,
        'trial_start', us.trial_start,
        'trial_end', us.trial_end,
        'plan', jsonb_build_object(
            'display_name', sp.display_name,
            'display_name_ko', sp.display_name_ko,
            'max_printers', sp.max_printers,
            'ai_generation_limit', sp.ai_generation_limit,
            'storage_limit_gb', sp.storage_limit_gb,
            'has_analytics', sp.has_analytics,
            'has_api_access', sp.has_api_access,
            'has_ai_assistant', sp.has_ai_assistant,
            'has_erp_mes_integration', sp.has_erp_mes_integration,
            'has_priority_support', sp.has_priority_support,
            'has_dedicated_support', sp.has_dedicated_support
        )
    ) INTO v_result
    FROM public.user_subscriptions us
    LEFT JOIN public.subscription_plans sp ON us.plan_id = sp.id OR us.plan_name = sp.plan_code
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;

    -- 구독이 없으면 Free 플랜 기본값 반환
    IF v_result IS NULL THEN
        SELECT jsonb_build_object(
            'subscription_id', NULL,
            'user_id', p_user_id,
            'plan_code', 'free',
            'plan_id', sp.id,
            'status', 'active',
            'billing_cycle', NULL,
            'current_period_start', NULL,
            'current_period_end', NULL,
            'cancel_at_period_end', false,
            'cancelled_at', NULL,
            'trial_start', NULL,
            'trial_end', NULL,
            'plan', jsonb_build_object(
                'display_name', sp.display_name,
                'display_name_ko', sp.display_name_ko,
                'max_printers', sp.max_printers,
                'ai_generation_limit', sp.ai_generation_limit,
                'storage_limit_gb', sp.storage_limit_gb,
                'has_analytics', sp.has_analytics,
                'has_api_access', sp.has_api_access,
                'has_ai_assistant', sp.has_ai_assistant,
                'has_erp_mes_integration', sp.has_erp_mes_integration,
                'has_priority_support', sp.has_priority_support,
                'has_dedicated_support', sp.has_dedicated_support
            )
        ) INTO v_result
        FROM public.subscription_plans sp
        WHERE sp.plan_code = 'free';
    END IF;

    RETURN v_result;
END;
$$;

-- 함수 실행 권한
GRANT EXECUTE ON FUNCTION public.get_user_plan_info TO authenticated;
