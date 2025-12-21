-- ============================================
-- Premium Model Trial 및 Troubleshoot Advanced - DB 기반 한도 관리
-- subscription_plans에 일일 한도 컬럼 추가
-- 기존 함수 업데이트하여 DB에서 한도 조회
-- ============================================

-- 1. subscription_plans에 일일 한도 컬럼 추가
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS premium_model_daily_limit INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS troubleshoot_daily_limit INTEGER DEFAULT 5;

COMMENT ON COLUMN public.subscription_plans.premium_model_daily_limit IS '일일 유료 모델 체험 한도. -1 = 무제한 (유료 플랜). Free 플랜은 3회';
COMMENT ON COLUMN public.subscription_plans.troubleshoot_daily_limit IS '일일 고급 문제진단 한도. -1 = 무제한 (유료 플랜). Free 플랜은 5회';

-- 기존 플랜 데이터 업데이트 - Premium Model Trial
UPDATE public.subscription_plans SET premium_model_daily_limit = 3 WHERE plan_code = 'free';
UPDATE public.subscription_plans SET premium_model_daily_limit = -1 WHERE plan_code = 'starter';
UPDATE public.subscription_plans SET premium_model_daily_limit = -1 WHERE plan_code = 'pro';
UPDATE public.subscription_plans SET premium_model_daily_limit = -1 WHERE plan_code = 'enterprise';

-- 기존 플랜 데이터 업데이트 - Troubleshoot Advanced
UPDATE public.subscription_plans SET troubleshoot_daily_limit = 5 WHERE plan_code = 'free';
UPDATE public.subscription_plans SET troubleshoot_daily_limit = -1 WHERE plan_code = 'starter';
UPDATE public.subscription_plans SET troubleshoot_daily_limit = -1 WHERE plan_code = 'pro';
UPDATE public.subscription_plans SET troubleshoot_daily_limit = -1 WHERE plan_code = 'enterprise';

-- ============================================
-- 유료 모델 체험 사용량 체크 함수 (업데이트)
-- DB에서 플랜별 한도 조회
-- 기존 컬럼명 사용: premium_model_trial_today, premium_model_trial_date
-- ============================================
CREATE OR REPLACE FUNCTION public.check_premium_model_trial_usage(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan_code VARCHAR(20);
    v_limit INTEGER;
    v_today_usage INTEGER;
    v_stored_date DATE;
    v_today DATE;
BEGIN
    v_today := CURRENT_DATE;

    -- 사용자의 현재 플랜 조회
    SELECT COALESCE(us.plan_name, 'free') INTO v_plan_code
    FROM public.user_subscriptions us
    WHERE us.user_id = p_user_id
      AND us.status IN ('active', 'trialing')
    LIMIT 1;

    IF v_plan_code IS NULL THEN
        v_plan_code := 'free';
    END IF;

    -- 플랜별 일일 한도 조회 (DB에서)
    SELECT sp.premium_model_daily_limit INTO v_limit
    FROM public.subscription_plans sp
    WHERE sp.plan_code = v_plan_code;

    IF v_limit IS NULL THEN
        v_limit := 3; -- 기본값
    END IF;

    -- 유료 플랜은 무제한 (-1)
    IF v_limit = -1 THEN
        RETURN jsonb_build_object(
            'plan_code', v_plan_code,
            'today_usage', 0,
            'daily_limit', -1,
            'remaining', -1,
            'can_use', true,
            'is_free_plan', false
        );
    END IF;

    -- 현재 사용량 조회 (기존 컬럼명 사용)
    SELECT premium_model_trial_today, premium_model_trial_date
    INTO v_today_usage, v_stored_date
    FROM public.user_usage
    WHERE user_id = p_user_id;

    -- 레코드가 없거나 날짜가 변경되었으면 리셋
    IF NOT FOUND OR v_stored_date IS NULL OR v_stored_date != v_today THEN
        v_today_usage := 0;
    END IF;

    RETURN jsonb_build_object(
        'plan_code', v_plan_code,
        'today_usage', COALESCE(v_today_usage, 0),
        'daily_limit', v_limit,
        'remaining', GREATEST(0, v_limit - COALESCE(v_today_usage, 0)),
        'can_use', COALESCE(v_today_usage, 0) < v_limit,
        'is_free_plan', v_plan_code = 'free'
    );
END;
$$;

-- ============================================
-- 고급 문제진단 사용량 체크 함수 (업데이트)
-- DB에서 플랜별 한도 조회
-- 기존 컬럼명 사용: troubleshoot_advanced_today, troubleshoot_advanced_date
-- ============================================
CREATE OR REPLACE FUNCTION public.check_troubleshoot_advanced_usage(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan_code VARCHAR(20);
    v_limit INTEGER;
    v_today_usage INTEGER;
    v_stored_date DATE;
    v_today DATE;
BEGIN
    v_today := CURRENT_DATE;

    -- 사용자의 현재 플랜 조회
    SELECT COALESCE(us.plan_name, 'free') INTO v_plan_code
    FROM public.user_subscriptions us
    WHERE us.user_id = p_user_id
      AND us.status IN ('active', 'trialing')
    LIMIT 1;

    IF v_plan_code IS NULL THEN
        v_plan_code := 'free';
    END IF;

    -- 플랜별 일일 한도 조회 (DB에서)
    SELECT sp.troubleshoot_daily_limit INTO v_limit
    FROM public.subscription_plans sp
    WHERE sp.plan_code = v_plan_code;

    IF v_limit IS NULL THEN
        v_limit := 5; -- 기본값
    END IF;

    -- 유료 플랜은 무제한 (-1)
    IF v_limit = -1 THEN
        RETURN jsonb_build_object(
            'plan_code', v_plan_code,
            'today_usage', 0,
            'daily_limit', -1,
            'remaining', -1,
            'can_use', true,
            'is_free_plan', false
        );
    END IF;

    -- 현재 사용량 조회 (기존 컬럼명 사용)
    SELECT troubleshoot_advanced_today, troubleshoot_advanced_date
    INTO v_today_usage, v_stored_date
    FROM public.user_usage
    WHERE user_id = p_user_id;

    -- 레코드가 없거나 날짜가 변경되었으면 리셋
    IF NOT FOUND OR v_stored_date IS NULL OR v_stored_date != v_today THEN
        v_today_usage := 0;
    END IF;

    RETURN jsonb_build_object(
        'plan_code', v_plan_code,
        'today_usage', COALESCE(v_today_usage, 0),
        'daily_limit', v_limit,
        'remaining', GREATEST(0, v_limit - COALESCE(v_today_usage, 0)),
        'can_use', COALESCE(v_today_usage, 0) < v_limit,
        'is_free_plan', v_plan_code = 'free'
    );
END;
$$;

-- 참고: increment_* 함수는 기존 반환 타입(INTEGER)을 유지
-- 반환 타입 변경이 필요 없으므로 CREATE OR REPLACE만 사용
