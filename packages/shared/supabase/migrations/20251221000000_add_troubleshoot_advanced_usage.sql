-- ============================================
-- 고급 문제진단 (Troubleshoot Advanced) 일별 사용량 추적
-- 무료 사용자: 1일 5회 사용 가능
-- ============================================

-- user_usage 테이블에 고급 문제진단 필드 추가
ALTER TABLE public.user_usage
ADD COLUMN IF NOT EXISTS troubleshoot_advanced_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS troubleshoot_advanced_date DATE DEFAULT CURRENT_DATE;

-- 코멘트 추가
COMMENT ON COLUMN public.user_usage.troubleshoot_advanced_today IS '오늘 사용한 고급 문제진단 횟수 (일별 리셋)';
COMMENT ON COLUMN public.user_usage.troubleshoot_advanced_date IS '고급 문제진단 사용 날짜 (일별 리셋 체크용)';

-- ============================================
-- 고급 문제진단 사용량 체크 함수
-- 반환: { today_usage: number, can_use: boolean }
-- ============================================
CREATE OR REPLACE FUNCTION public.check_troubleshoot_advanced_usage(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today DATE;
    v_today_usage INTEGER;
    v_stored_date DATE;
    v_limit INTEGER := 5; -- 무료 사용자 일일 한도
BEGIN
    v_today := CURRENT_DATE;

    -- 사용자 레코드 조회
    SELECT
        troubleshoot_advanced_today,
        troubleshoot_advanced_date
    INTO v_today_usage, v_stored_date
    FROM public.user_usage
    WHERE user_id = p_user_id;

    -- 레코드가 없으면 0
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'today_usage', 0,
            'can_use', true,
            'remaining', v_limit
        );
    END IF;

    -- 날짜가 변경되었으면 리셋 (오늘 사용량 0)
    IF v_stored_date IS NULL OR v_stored_date != v_today THEN
        RETURN jsonb_build_object(
            'today_usage', 0,
            'can_use', true,
            'remaining', v_limit
        );
    END IF;

    -- 현재 사용량 반환
    RETURN jsonb_build_object(
        'today_usage', COALESCE(v_today_usage, 0),
        'can_use', COALESCE(v_today_usage, 0) < v_limit,
        'remaining', GREATEST(0, v_limit - COALESCE(v_today_usage, 0))
    );
END;
$$;

-- ============================================
-- 고급 문제진단 사용량 증가 함수
-- 반환: 증가 후 오늘 사용량
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_troubleshoot_advanced_usage(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today DATE;
    v_new_count INTEGER;
    v_year INTEGER;
    v_month INTEGER;
BEGIN
    v_today := CURRENT_DATE;
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
    v_month := EXTRACT(MONTH FROM NOW())::INTEGER;

    -- UPSERT: 레코드가 없으면 생성, 있으면 업데이트
    INSERT INTO public.user_usage (
        user_id,
        period_year,
        period_month,
        troubleshoot_advanced_today,
        troubleshoot_advanced_date,
        last_used_at
    )
    VALUES (
        p_user_id,
        v_year,
        v_month,
        1,
        v_today,
        NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        -- 날짜가 변경되었으면 1로 리셋, 아니면 증가
        troubleshoot_advanced_today = CASE
            WHEN public.user_usage.troubleshoot_advanced_date IS NULL
                 OR public.user_usage.troubleshoot_advanced_date != v_today
            THEN 1
            ELSE public.user_usage.troubleshoot_advanced_today + 1
        END,
        troubleshoot_advanced_date = v_today,
        last_used_at = NOW(),
        updated_at = NOW()
    RETURNING troubleshoot_advanced_today INTO v_new_count;

    RETURN v_new_count;
END;
$$;

-- 함수 실행 권한
GRANT EXECUTE ON FUNCTION public.check_troubleshoot_advanced_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_troubleshoot_advanced_usage TO authenticated;

-- ============================================
-- 유료 모델 체험 (Premium Model Trial) 일별 사용량 추적
-- 무료 사용자: 1일 3회 사용 가능 (Gemini 3.0 Flash)
-- ============================================

-- user_usage 테이블에 유료 모델 체험 필드 추가
ALTER TABLE public.user_usage
ADD COLUMN IF NOT EXISTS premium_model_trial_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS premium_model_trial_date DATE DEFAULT CURRENT_DATE;

-- 코멘트 추가
COMMENT ON COLUMN public.user_usage.premium_model_trial_today IS '오늘 사용한 유료 모델 체험 횟수 (일별 리셋)';
COMMENT ON COLUMN public.user_usage.premium_model_trial_date IS '유료 모델 체험 사용 날짜 (일별 리셋 체크용)';

-- ============================================
-- 유료 모델 체험 사용량 체크 함수
-- 반환: { today_usage: number, can_use: boolean, remaining: number }
-- ============================================
CREATE OR REPLACE FUNCTION public.check_premium_model_trial_usage(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today DATE;
    v_today_usage INTEGER;
    v_stored_date DATE;
    v_limit INTEGER := 3; -- 무료 사용자 일일 한도
BEGIN
    v_today := CURRENT_DATE;

    -- 사용자 레코드 조회
    SELECT
        premium_model_trial_today,
        premium_model_trial_date
    INTO v_today_usage, v_stored_date
    FROM public.user_usage
    WHERE user_id = p_user_id;

    -- 레코드가 없으면 0
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'today_usage', 0,
            'can_use', true,
            'remaining', v_limit
        );
    END IF;

    -- 날짜가 변경되었으면 리셋 (오늘 사용량 0)
    IF v_stored_date IS NULL OR v_stored_date != v_today THEN
        RETURN jsonb_build_object(
            'today_usage', 0,
            'can_use', true,
            'remaining', v_limit
        );
    END IF;

    -- 현재 사용량 반환
    RETURN jsonb_build_object(
        'today_usage', COALESCE(v_today_usage, 0),
        'can_use', COALESCE(v_today_usage, 0) < v_limit,
        'remaining', GREATEST(0, v_limit - COALESCE(v_today_usage, 0))
    );
END;
$$;

-- ============================================
-- 유료 모델 체험 사용량 증가 함수
-- 반환: 증가 후 오늘 사용량
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_premium_model_trial_usage(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today DATE;
    v_new_count INTEGER;
    v_year INTEGER;
    v_month INTEGER;
BEGIN
    v_today := CURRENT_DATE;
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
    v_month := EXTRACT(MONTH FROM NOW())::INTEGER;

    -- UPSERT: 레코드가 없으면 생성, 있으면 업데이트
    INSERT INTO public.user_usage (
        user_id,
        period_year,
        period_month,
        premium_model_trial_today,
        premium_model_trial_date,
        last_used_at
    )
    VALUES (
        p_user_id,
        v_year,
        v_month,
        1,
        v_today,
        NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        -- 날짜가 변경되었으면 1로 리셋, 아니면 증가
        premium_model_trial_today = CASE
            WHEN public.user_usage.premium_model_trial_date IS NULL
                 OR public.user_usage.premium_model_trial_date != v_today
            THEN 1
            ELSE public.user_usage.premium_model_trial_today + 1
        END,
        premium_model_trial_date = v_today,
        last_used_at = NOW(),
        updated_at = NOW()
    RETURNING premium_model_trial_today INTO v_new_count;

    RETURN v_new_count;
END;
$$;

-- 함수 실행 권한
GRANT EXECUTE ON FUNCTION public.check_premium_model_trial_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_premium_model_trial_usage TO authenticated;

-- usage_logs 테이블에 타입 추가 (코멘트 업데이트)
COMMENT ON COLUMN public.usage_logs.usage_type IS '사용량 유형 - ai_model_generation(AI 모델 생성), ai_image_generation(AI 이미지), printer_registration(프린터 등록), printer_deletion(프린터 삭제), storage_upload(업로드), storage_delete(삭제), api_call(API 호출), troubleshoot_advanced(고급 문제진단), premium_model_trial(유료 모델 체험)';
