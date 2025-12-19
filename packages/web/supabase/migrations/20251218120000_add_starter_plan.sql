-- ============================================
-- 스타터 플랜 추가 및 플랜 정보 업데이트
-- 플랜 구성: Starter, Pro, Enterprise (Free 제거)
-- ============================================

-- 스타터 플랜 추가
INSERT INTO public.subscription_plans (
    plan_code, display_name, display_name_ko, description,
    price_monthly, price_yearly,
    paddle_price_id_monthly, paddle_price_id_yearly,
    max_printers, ai_generation_limit, storage_limit_gb, webcam_reconnect_interval,
    has_analytics, has_push_notifications, has_api_access, has_ai_assistant,
    has_erp_mes_integration, has_community_support, has_priority_support, has_dedicated_support,
    sort_order
) VALUES
(
    'starter', 'Starter', '스타터', '개인 및 소규모 프로젝트를 위한 플랜',
    9900, 99000,  -- $9/month, $90/year (원화 기준 9,900원, 99,000원)
    NULL, NULL,   -- Paddle Price ID 추후 설정
    2, -1, 5, NULL,  -- 2대 프린터, AI 무제한, 5GB 스토리지
    true, true, false, true,  -- 분석 O, 푸시 O, API X, 기본 AI 어시스턴트 O
    false, true, false, false,
    1  -- 첫 번째 순서
)
ON CONFLICT (plan_code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    display_name_ko = EXCLUDED.display_name_ko,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    max_printers = EXCLUDED.max_printers,
    ai_generation_limit = EXCLUDED.ai_generation_limit,
    storage_limit_gb = EXCLUDED.storage_limit_gb,
    has_analytics = EXCLUDED.has_analytics,
    has_ai_assistant = EXCLUDED.has_ai_assistant,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- Pro 플랜 업데이트 (순서 변경)
UPDATE public.subscription_plans
SET
    sort_order = 2,
    updated_at = NOW()
WHERE plan_code = 'pro';

-- Enterprise 플랜 업데이트 (순서 변경, 고급 AI 어시스턴트)
UPDATE public.subscription_plans
SET
    sort_order = 3,
    description = '대규모 조직을 위한 엔터프라이즈 플랜',
    updated_at = NOW()
WHERE plan_code = 'enterprise';

-- Free 플랜 비활성화 (구독 페이지에서 제거, 기존 사용자는 유지)
UPDATE public.subscription_plans
SET
    is_active = false,
    sort_order = 99,
    updated_at = NOW()
WHERE plan_code = 'free';
