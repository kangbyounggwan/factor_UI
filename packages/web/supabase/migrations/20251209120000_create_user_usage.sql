-- ============================================
-- user_usage 테이블 생성
-- 유저별 월간 사용량 추적 (유저당 1개 row)
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 사용자 (유니크)
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 기간 (월별 리셋용)
    period_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
    period_month INTEGER NOT NULL DEFAULT EXTRACT(MONTH FROM NOW()),

    -- AI 사용량 (월별 리셋)
    ai_model_generation INTEGER DEFAULT 0,      -- AI 3D 모델 생성 횟수
    ai_image_generation INTEGER DEFAULT 0,      -- AI 이미지 생성 횟수

    -- 프린터 (누적 - 현재 등록된 수)
    printer_count INTEGER DEFAULT 0,            -- 현재 등록된 프린터 수

    -- 스토리지 (누적 - 바이트 단위)
    storage_bytes BIGINT DEFAULT 0,             -- 스토리지 사용량 (바이트)

    -- API 호출 (월별 리셋)
    api_calls INTEGER DEFAULT 0,                -- API 호출 횟수

    -- 메타데이터
    last_used_at TIMESTAMPTZ,                   -- 마지막 사용 일시
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_usage_user ON public.user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_period ON public.user_usage(period_year, period_month);

-- RLS 활성화
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 사용량만 조회 가능
CREATE POLICY "Users can view their own usage"
ON public.user_usage FOR SELECT
USING (auth.uid() = user_id);

-- 사용자는 자신의 사용량 생성 가능
CREATE POLICY "Users can insert their own usage"
ON public.user_usage FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 사용량 수정 가능
CREATE POLICY "Users can update their own usage"
ON public.user_usage FOR UPDATE
USING (auth.uid() = user_id);

-- 코멘트 (테이블)
COMMENT ON TABLE public.user_usage IS '유저별 사용량 추적 테이블. 유저당 1개 row. subscription_plans의 한도와 비교하여 사용 가능 여부 판단';

-- 코멘트 (컬럼)
COMMENT ON COLUMN public.user_usage.id IS '사용량 레코드 고유 식별자 (UUID)';
COMMENT ON COLUMN public.user_usage.user_id IS '사용자 ID (auth.users 참조). 유저당 1개 row만 존재';
COMMENT ON COLUMN public.user_usage.period_year IS '현재 추적 기간의 연도. 월별 리셋 시 갱신';
COMMENT ON COLUMN public.user_usage.period_month IS '현재 추적 기간의 월. 월별 리셋 시 갱신';
COMMENT ON COLUMN public.user_usage.ai_model_generation IS 'AI 3D 모델 생성 횟수 (월별 리셋). 플랜 한도와 비교';
COMMENT ON COLUMN public.user_usage.ai_image_generation IS 'AI 이미지 생성 횟수 (월별 리셋)';
COMMENT ON COLUMN public.user_usage.printer_count IS '현재 등록된 프린터 수 (누적). 플랜 한도와 비교';
COMMENT ON COLUMN public.user_usage.storage_bytes IS '스토리지 사용량 (바이트, 누적). 플랜 한도와 비교';
COMMENT ON COLUMN public.user_usage.api_calls IS 'API 호출 횟수 (월별 리셋)';
COMMENT ON COLUMN public.user_usage.last_used_at IS '마지막 사용 일시';
COMMENT ON COLUMN public.user_usage.created_at IS '레코드 생성 일시';
COMMENT ON COLUMN public.user_usage.updated_at IS '레코드 수정 일시';

-- ============================================
-- 월별 리셋 체크 및 사용량 증가 함수
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_usage(
    p_user_id UUID,
    p_usage_type VARCHAR(30),
    p_delta INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_year INTEGER;
    v_month INTEGER;
    v_current_year INTEGER;
    v_current_month INTEGER;
    v_new_count INTEGER;
BEGIN
    -- 현재 연월
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
    v_month := EXTRACT(MONTH FROM NOW())::INTEGER;

    -- 기존 레코드 확인 및 월 체크
    SELECT period_year, period_month INTO v_current_year, v_current_month
    FROM public.user_usage
    WHERE user_id = p_user_id;

    -- 레코드가 없으면 생성
    IF NOT FOUND THEN
        INSERT INTO public.user_usage (user_id, period_year, period_month)
        VALUES (p_user_id, v_year, v_month);
        v_current_year := v_year;
        v_current_month := v_month;
    END IF;

    -- 월이 변경되었으면 월별 리셋 (AI, API만 - 프린터/스토리지는 누적)
    IF v_current_year != v_year OR v_current_month != v_month THEN
        UPDATE public.user_usage
        SET
            period_year = v_year,
            period_month = v_month,
            ai_model_generation = 0,
            ai_image_generation = 0,
            api_calls = 0,
            updated_at = NOW()
        WHERE user_id = p_user_id;
    END IF;

    -- 사용량 증가
    CASE p_usage_type
        WHEN 'ai_model_generation' THEN
            UPDATE public.user_usage
            SET ai_model_generation = ai_model_generation + p_delta,
                last_used_at = NOW(),
                updated_at = NOW()
            WHERE user_id = p_user_id
            RETURNING ai_model_generation INTO v_new_count;

        WHEN 'ai_image_generation' THEN
            UPDATE public.user_usage
            SET ai_image_generation = ai_image_generation + p_delta,
                last_used_at = NOW(),
                updated_at = NOW()
            WHERE user_id = p_user_id
            RETURNING ai_image_generation INTO v_new_count;

        WHEN 'printer_count' THEN
            UPDATE public.user_usage
            SET printer_count = printer_count + p_delta,
                last_used_at = NOW(),
                updated_at = NOW()
            WHERE user_id = p_user_id
            RETURNING printer_count INTO v_new_count;

        WHEN 'api_calls' THEN
            UPDATE public.user_usage
            SET api_calls = api_calls + p_delta,
                last_used_at = NOW(),
                updated_at = NOW()
            WHERE user_id = p_user_id
            RETURNING api_calls INTO v_new_count;

        ELSE
            v_new_count := 0;
    END CASE;

    RETURN COALESCE(v_new_count, 0);
END;
$$;

-- ============================================
-- 스토리지 사용량 증가 함수 (바이트 단위)
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_storage(
    p_user_id UUID,
    p_bytes BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_year INTEGER;
    v_month INTEGER;
    v_new_bytes BIGINT;
BEGIN
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
    v_month := EXTRACT(MONTH FROM NOW())::INTEGER;

    -- UPSERT
    INSERT INTO public.user_usage (user_id, period_year, period_month, storage_bytes, last_used_at)
    VALUES (p_user_id, v_year, v_month, GREATEST(0, p_bytes), NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        storage_bytes = GREATEST(0, public.user_usage.storage_bytes + p_bytes),
        last_used_at = NOW(),
        updated_at = NOW()
    RETURNING storage_bytes INTO v_new_bytes;

    RETURN v_new_bytes;
END;
$$;

-- ============================================
-- 현재 사용량 조회 함수
-- ============================================
CREATE OR REPLACE FUNCTION public.get_current_usage(
    p_user_id UUID,
    p_usage_type VARCHAR(30)
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_year INTEGER;
    v_month INTEGER;
    v_count INTEGER;
    v_current_year INTEGER;
    v_current_month INTEGER;
BEGIN
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
    v_month := EXTRACT(MONTH FROM NOW())::INTEGER;

    -- 레코드 조회
    SELECT
        period_year, period_month,
        CASE p_usage_type
            WHEN 'ai_model_generation' THEN ai_model_generation
            WHEN 'ai_image_generation' THEN ai_image_generation
            WHEN 'printer_count' THEN printer_count
            WHEN 'api_calls' THEN api_calls
            ELSE 0
        END
    INTO v_current_year, v_current_month, v_count
    FROM public.user_usage
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- 월이 변경되었고 월별 리셋 대상이면 0 반환
    IF (v_current_year != v_year OR v_current_month != v_month)
       AND p_usage_type IN ('ai_model_generation', 'ai_image_generation', 'api_calls') THEN
        RETURN 0;
    END IF;

    RETURN COALESCE(v_count, 0);
END;
$$;

-- ============================================
-- 전체 사용량 조회 함수 (월별 리셋 자동 적용)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_usage(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_year INTEGER;
    v_month INTEGER;
    v_result JSONB;
    v_record RECORD;
BEGIN
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
    v_month := EXTRACT(MONTH FROM NOW())::INTEGER;

    SELECT * INTO v_record
    FROM public.user_usage
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'ai_model_generation', 0,
            'ai_image_generation', 0,
            'printer_count', 0,
            'storage_bytes', 0,
            'api_calls', 0,
            'period_year', v_year,
            'period_month', v_month
        );
    END IF;

    -- 월이 변경되었으면 월별 항목은 0으로
    IF v_record.period_year != v_year OR v_record.period_month != v_month THEN
        RETURN jsonb_build_object(
            'ai_model_generation', 0,
            'ai_image_generation', 0,
            'printer_count', v_record.printer_count,
            'storage_bytes', v_record.storage_bytes,
            'api_calls', 0,
            'period_year', v_year,
            'period_month', v_month
        );
    END IF;

    RETURN jsonb_build_object(
        'ai_model_generation', v_record.ai_model_generation,
        'ai_image_generation', v_record.ai_image_generation,
        'printer_count', v_record.printer_count,
        'storage_bytes', v_record.storage_bytes,
        'api_calls', v_record.api_calls,
        'period_year', v_record.period_year,
        'period_month', v_record.period_month
    );
END;
$$;

-- ============================================
-- 사용량 한도 체크 함수 (플랜과 연동)
-- ============================================
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
    SELECT COALESCE(us.plan_name, 'free') INTO v_plan_code
    FROM public.user_subscriptions us
    WHERE us.user_id = p_user_id
      AND us.status IN ('active', 'trialing')
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

-- 함수 실행 권한
GRANT EXECUTE ON FUNCTION public.increment_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_storage TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_usage_limit TO authenticated;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_user_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_usage_updated_at ON public.user_usage;
CREATE TRIGGER trigger_user_usage_updated_at
    BEFORE UPDATE ON public.user_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_user_usage_updated_at();
