-- ============================================
-- subscription_plans 테이블 생성
-- 플랜별 제한 및 기능 정의를 DB에서 관리
-- ============================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 플랜 식별
    plan_code VARCHAR(20) UNIQUE NOT NULL,          -- free, pro, enterprise
    display_name VARCHAR(50) NOT NULL,              -- Free, Pro, Enterprise
    display_name_ko VARCHAR(50),                    -- 무료, 프로, 엔터프라이즈
    description TEXT,                               -- 플랜 설명

    -- 가격 정보
    price_monthly INTEGER DEFAULT 0,                -- 월간 가격 (원)
    price_yearly INTEGER DEFAULT 0,                 -- 연간 가격 (원)
    paddle_price_id_monthly VARCHAR(100),           -- Paddle 월간 결제 Price ID
    paddle_price_id_yearly VARCHAR(100),            -- Paddle 연간 결제 Price ID

    -- 수량 제한 (-1 = 무제한)
    max_printers INTEGER DEFAULT 1,                 -- 최대 프린터 등록 수
    ai_generation_limit INTEGER DEFAULT 20,         -- 월간 AI 모델 생성 한도
    storage_limit_gb INTEGER DEFAULT 1,             -- 스토리지 한도 (GB)
    webcam_reconnect_interval INTEGER,              -- 웹캠 재연결 간격 (분, NULL = 무제한)

    -- 기능 플래그
    has_analytics BOOLEAN DEFAULT false,            -- 분석 기능
    has_push_notifications BOOLEAN DEFAULT true,    -- 푸시 알림
    has_api_access BOOLEAN DEFAULT false,           -- API 접근
    has_ai_assistant BOOLEAN DEFAULT false,         -- AI 어시스턴트
    has_erp_mes_integration BOOLEAN DEFAULT false,  -- ERP/MES 연동
    has_community_support BOOLEAN DEFAULT true,     -- 커뮤니티 지원
    has_priority_support BOOLEAN DEFAULT false,     -- 우선 지원
    has_dedicated_support BOOLEAN DEFAULT false,    -- 전담 지원

    -- 관리
    sort_order INTEGER DEFAULT 0,                   -- 표시 순서
    is_active BOOLEAN DEFAULT true,                 -- 활성화 여부
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_subscription_plans_code ON public.subscription_plans(plan_code);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(is_active);

-- RLS 활성화
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 플랜 정보 조회 가능
CREATE POLICY "Anyone can view active plans"
ON public.subscription_plans FOR SELECT
USING (is_active = true);

-- 코멘트 (테이블)
COMMENT ON TABLE public.subscription_plans IS '구독 플랜 정의 테이블 - 플랜별 제한 및 기능을 DB에서 관리. Paddle 결제 연동 및 프론트엔드 플랜 표시에 사용';

-- 코멘트 (컬럼) - 플랜 식별
COMMENT ON COLUMN public.subscription_plans.id IS '플랜 고유 식별자 (UUID)';
COMMENT ON COLUMN public.subscription_plans.plan_code IS '플랜 코드 - free(무료), pro(프로), enterprise(엔터프라이즈). user_subscriptions.plan_name과 매핑';
COMMENT ON COLUMN public.subscription_plans.display_name IS '영문 표시 이름 (Free, Pro, Enterprise)';
COMMENT ON COLUMN public.subscription_plans.display_name_ko IS '한국어 표시 이름 (무료, 프로, 엔터프라이즈)';
COMMENT ON COLUMN public.subscription_plans.description IS '플랜 설명 (UI 표시용)';

-- 코멘트 (컬럼) - 가격 정보
COMMENT ON COLUMN public.subscription_plans.price_monthly IS '월간 가격 (원). 0 = 무료';
COMMENT ON COLUMN public.subscription_plans.price_yearly IS '연간 가격 (원). 월간 대비 할인 적용';
COMMENT ON COLUMN public.subscription_plans.paddle_price_id_monthly IS 'Paddle 월간 결제 Price ID. Paddle Checkout에서 사용';
COMMENT ON COLUMN public.subscription_plans.paddle_price_id_yearly IS 'Paddle 연간 결제 Price ID. Paddle Checkout에서 사용';

-- 코멘트 (컬럼) - 수량 제한
COMMENT ON COLUMN public.subscription_plans.max_printers IS '최대 프린터 등록 수. -1 = 무제한 (Enterprise)';
COMMENT ON COLUMN public.subscription_plans.ai_generation_limit IS '월간 AI 3D 모델 생성 한도. -1 = 무제한 (Enterprise). user_usage 테이블과 연동하여 체크';
COMMENT ON COLUMN public.subscription_plans.storage_limit_gb IS '스토리지 한도 (GB). -1 = 무제한';
COMMENT ON COLUMN public.subscription_plans.webcam_reconnect_interval IS '웹캠 스트리밍 재연결 간격 (분). NULL = 무제한 (끊김 없는 스트리밍)';

-- 코멘트 (컬럼) - 기능 플래그
COMMENT ON COLUMN public.subscription_plans.has_analytics IS '분석/통계 기능 사용 가능 여부 (Pro 이상)';
COMMENT ON COLUMN public.subscription_plans.has_push_notifications IS '푸시 알림 기능 사용 가능 여부 (모든 플랜)';
COMMENT ON COLUMN public.subscription_plans.has_api_access IS 'REST API 접근 가능 여부 (Pro 이상)';
COMMENT ON COLUMN public.subscription_plans.has_ai_assistant IS 'AI 어시스턴트 기능 사용 가능 여부 (Enterprise)';
COMMENT ON COLUMN public.subscription_plans.has_erp_mes_integration IS 'ERP/MES 시스템 연동 가능 여부 (Enterprise)';
COMMENT ON COLUMN public.subscription_plans.has_community_support IS '커뮤니티 지원 가능 여부 (모든 플랜)';
COMMENT ON COLUMN public.subscription_plans.has_priority_support IS '우선 지원 가능 여부 (Pro 이상)';
COMMENT ON COLUMN public.subscription_plans.has_dedicated_support IS '전담 지원 가능 여부 (Enterprise)';

-- 코멘트 (컬럼) - 관리
COMMENT ON COLUMN public.subscription_plans.sort_order IS '플랜 표시 순서 (오름차순). 가격 페이지 정렬에 사용';
COMMENT ON COLUMN public.subscription_plans.is_active IS '플랜 활성화 여부. false면 신규 가입 불가 (기존 구독자는 유지)';
COMMENT ON COLUMN public.subscription_plans.created_at IS '레코드 생성 일시';
COMMENT ON COLUMN public.subscription_plans.updated_at IS '레코드 수정 일시 (트리거로 자동 갱신)';

-- 기본 플랜 데이터 삽입
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
    'free', 'Free', '무료', '개인 사용자를 위한 기본 플랜',
    0, 0,
    NULL, NULL,
    1, 20, 1, NULL,
    false, true, false, false,
    false, true, false, false,
    1
),
(
    'pro', 'Pro', '프로', '전문가 및 소규모 팀을 위한 플랜',
    9900, 99000,
    'pri_01kbhaxnk4c12kp5j00yftnqv4', 'pri_01kbhay65qjtkh4tbmep4egdmf',
    5, 50, 10, NULL,
    true, true, true, false,
    false, true, true, false,
    2
),
(
    'enterprise', 'Enterprise', '엔터프라이즈', '대규모 팀 및 기업을 위한 플랜',
    49900, 499000,
    NULL, NULL,
    -1, -1, -1, NULL,
    true, true, true, true,
    true, true, true, true,
    3
)
ON CONFLICT (plan_code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    display_name_ko = EXCLUDED.display_name_ko,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    paddle_price_id_monthly = EXCLUDED.paddle_price_id_monthly,
    paddle_price_id_yearly = EXCLUDED.paddle_price_id_yearly,
    max_printers = EXCLUDED.max_printers,
    ai_generation_limit = EXCLUDED.ai_generation_limit,
    storage_limit_gb = EXCLUDED.storage_limit_gb,
    webcam_reconnect_interval = EXCLUDED.webcam_reconnect_interval,
    has_analytics = EXCLUDED.has_analytics,
    has_push_notifications = EXCLUDED.has_push_notifications,
    has_api_access = EXCLUDED.has_api_access,
    has_ai_assistant = EXCLUDED.has_ai_assistant,
    has_erp_mes_integration = EXCLUDED.has_erp_mes_integration,
    has_community_support = EXCLUDED.has_community_support,
    has_priority_support = EXCLUDED.has_priority_support,
    has_dedicated_support = EXCLUDED.has_dedicated_support,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_subscription_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER trigger_subscription_plans_updated_at
    BEFORE UPDATE ON public.subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_plans_updated_at();
