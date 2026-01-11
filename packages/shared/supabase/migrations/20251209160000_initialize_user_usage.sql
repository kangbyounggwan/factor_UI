-- ============================================
-- 기존 유저 사용량 데이터 초기화
-- 유저당 1개 row로 모든 사용량 통합
-- ============================================

-- 1. 모든 기존 유저에 대해 user_usage row 생성 및 데이터 집계
INSERT INTO public.user_usage (
    user_id,
    period_year,
    period_month,
    ai_model_generation,
    ai_image_generation,
    printer_count,
    storage_bytes,
    api_calls,
    last_used_at
)
SELECT
    u.id as user_id,
    EXTRACT(YEAR FROM NOW())::INTEGER as period_year,
    EXTRACT(MONTH FROM NOW())::INTEGER as period_month,
    -- AI 모델 생성 (이번 달)
    COALESCE((
        SELECT COUNT(*)
        FROM public.ai_generated_models am
        WHERE am.user_id = u.id
          AND EXTRACT(YEAR FROM am.created_at) = EXTRACT(YEAR FROM NOW())
          AND EXTRACT(MONTH FROM am.created_at) = EXTRACT(MONTH FROM NOW())
          AND am.status IN ('completed', 'processing')
    ), 0)::INTEGER as ai_model_generation,
    -- AI 이미지 생성 (이번 달) - 현재는 0으로 초기화
    0 as ai_image_generation,
    -- 프린터 수 (현재 등록된)
    COALESCE((
        SELECT COUNT(*)
        FROM public.printers p
        WHERE p.user_id = u.id
    ), 0)::INTEGER as printer_count,
    -- 스토리지 (AI 모델 + GCode 합계)
    COALESCE((
        SELECT COALESCE(SUM(file_size), 0)
        FROM (
            SELECT file_size FROM public.ai_generated_models WHERE user_id = u.id AND file_size IS NOT NULL
            UNION ALL
            SELECT file_size FROM public.gcode_files WHERE user_id = u.id AND file_size IS NOT NULL
        ) files
    ), 0)::BIGINT as storage_bytes,
    -- API 호출 (이번 달) - 현재는 0으로 초기화
    0 as api_calls,
    -- 마지막 사용 일시
    GREATEST(
        (SELECT MAX(created_at) FROM public.ai_generated_models WHERE user_id = u.id),
        (SELECT MAX(created_at) FROM public.printers WHERE user_id = u.id),
        (SELECT MAX(created_at) FROM public.gcode_files WHERE user_id = u.id)
    ) as last_used_at
FROM auth.users u
WHERE EXISTS (
    -- 활동이 있는 유저만 (모델, 프린터, 또는 프로필이 있는)
    SELECT 1 FROM public.profiles WHERE user_id = u.id
    UNION
    SELECT 1 FROM public.ai_generated_models WHERE user_id = u.id
    UNION
    SELECT 1 FROM public.printers WHERE user_id = u.id
)
ON CONFLICT (user_id) DO UPDATE SET
    ai_model_generation = EXCLUDED.ai_model_generation,
    printer_count = EXCLUDED.printer_count,
    storage_bytes = EXCLUDED.storage_bytes,
    last_used_at = EXCLUDED.last_used_at,
    updated_at = NOW();

-- 코멘트
COMMENT ON TABLE public.user_usage IS '유저별 사용량 추적 테이블. 20251209160000 마이그레이션에서 기존 데이터로 초기화됨. 유저당 1개 row';
