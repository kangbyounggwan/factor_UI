-- ============================================
-- 사용량 함수 업데이트
-- trialing 상태 제거 (더 이상 사용하지 않음)
-- cancelled 상태도 current_period_end까지 플랜 혜택 유지
-- ============================================

-- check_usage_limit 함수 업데이트
CREATE OR REPLACE FUNCTION public.check_usage_limit(
    p_user_id UUID,
    p_usage_type VARCHAR(30)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan_code VARCHAR(20);
    v_limit INTEGER;
    v_current INTEGER;
    v_can_use BOOLEAN;
BEGIN
    -- 사용자의 현재 플랜 조회
    -- active: 활성 구독
    -- cancelled: 취소됨 (current_period_end까지 유효)
    SELECT COALESCE(us.plan_name, 'free') INTO v_plan_code
    FROM public.user_subscriptions us
    WHERE us.user_id = p_user_id
      AND us.status IN ('active', 'cancelled')
      AND us.current_period_end > NOW()  -- 기간이 아직 유효한 경우만
    ORDER BY
      CASE us.status WHEN 'active' THEN 1 WHEN 'cancelled' THEN 2 ELSE 3 END
    LIMIT 1;

    IF v_plan_code IS NULL THEN
        v_plan_code := 'free';
    END IF;

    -- 플랜별 한도 조회
    CASE p_usage_type
        WHEN 'ai_model_generation' THEN
            SELECT sp.ai_generation_limit INTO v_limit
            FROM public.subscription_plans sp
            WHERE sp.plan_code = v_plan_code;
        WHEN 'printer_count' THEN
            SELECT sp.max_printers INTO v_limit
            FROM public.subscription_plans sp
            WHERE sp.plan_code = v_plan_code;
        WHEN 'storage_bytes' THEN
            SELECT sp.storage_limit_gb * 1073741824 INTO v_limit  -- GB to bytes
            FROM public.subscription_plans sp
            WHERE sp.plan_code = v_plan_code;
        ELSE
            v_limit := -1; -- 기타는 무제한
    END CASE;

    -- 현재 사용량 조회
    v_current := public.get_current_usage(p_user_id, p_usage_type);

    -- 사용 가능 여부 판단 (-1 = 무제한)
    IF v_limit = -1 THEN
        v_can_use := true;
    ELSE
        v_can_use := v_current < v_limit;
    END IF;

    RETURN jsonb_build_object(
        'plan_code', v_plan_code,
        'usage_type', p_usage_type,
        'current_usage', v_current,
        'limit', v_limit,
        'remaining', CASE WHEN v_limit = -1 THEN -1 ELSE GREATEST(0, v_limit - v_current) END,
        'can_use', v_can_use
    );
END;
$$;

-- 함수 실행 권한 재부여
GRANT EXECUTE ON FUNCTION public.check_usage_limit TO authenticated;
