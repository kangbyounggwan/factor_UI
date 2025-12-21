-- ============================================
-- subscription_plans 테이블 기능 컬럼 추가 및 데이터 업데이트
-- 새 기능: 이상 감지 간격, 지원 방식, Slack 채널, AI 모델 타입
-- ============================================

-- 새 컬럼 추가
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS anomaly_detection_interval INTEGER DEFAULT 60,  -- 이상 감지 간격 (분), 0 = 실시간
ADD COLUMN IF NOT EXISTS support_type VARCHAR(50) DEFAULT 'community',   -- community, email, dedicated
ADD COLUMN IF NOT EXISTS has_slack_channel BOOLEAN DEFAULT false,        -- 전용 Slack 채널
ADD COLUMN IF NOT EXISTS ai_model_type VARCHAR(20) DEFAULT 'basic';      -- basic, advanced

-- 컬럼 코멘트
COMMENT ON COLUMN public.subscription_plans.anomaly_detection_interval IS '이상 감지 간격 (분). 0 = 실시간, 10/30/60 등';
COMMENT ON COLUMN public.subscription_plans.support_type IS '지원 방식: community(커뮤니티), email(이메일 24시간 이내), dedicated(전담 매니저)';
COMMENT ON COLUMN public.subscription_plans.has_slack_channel IS '전용 Slack 채널 제공 여부';
COMMENT ON COLUMN public.subscription_plans.ai_model_type IS 'AI 모델 타입: basic(기본), advanced(고급)';

-- Free 플랜 업데이트 (다시 활성화 + 새 기능)
UPDATE public.subscription_plans
SET
    is_active = true,
    max_printers = 1,
    ai_generation_limit = 5,           -- 월 5개 AI 모델 생성
    anomaly_detection_interval = 60,   -- 60분 간격
    support_type = 'community',
    has_slack_channel = false,
    ai_model_type = 'basic',
    has_ai_assistant = false,
    has_analytics = false,
    has_api_access = false,
    sort_order = 0,
    updated_at = NOW()
WHERE plan_code = 'free';

-- Starter 플랜 업데이트
UPDATE public.subscription_plans
SET
    max_printers = 1,                  -- 최대 1대 프린터
    ai_generation_limit = 20,          -- 월 20개 AI 모델 생성
    price_monthly = 9900,
    price_yearly = 99900,
    anomaly_detection_interval = 30,   -- 30분 간격
    support_type = 'community',
    has_slack_channel = false,
    ai_model_type = 'advanced',
    has_ai_assistant = true,           -- 기본 AI 어시스턴트
    has_analytics = true,
    has_api_access = true,
    sort_order = 1,
    updated_at = NOW()
WHERE plan_code = 'starter';

-- Pro 플랜 업데이트
UPDATE public.subscription_plans
SET
    max_printers = 5,
    ai_generation_limit = 50,
    price_monthly = 22900,
    price_yearly = 229000,
    anomaly_detection_interval = 10,   -- 10분 간격
    support_type = 'email',            -- 이메일 (24시간 이내)
    has_slack_channel = false,
    ai_model_type = 'advanced',
    has_ai_assistant = false,          -- 고급 AI 어시스턴트 X (Enterprise만)
    has_analytics = true,
    has_api_access = true,
    sort_order = 2,
    updated_at = NOW()
WHERE plan_code = 'pro';

-- Enterprise 플랜 업데이트
UPDATE public.subscription_plans
SET
    max_printers = -1,                 -- 무제한
    ai_generation_limit = -1,          -- 무제한
    anomaly_detection_interval = 0,    -- 실시간
    support_type = 'dedicated',        -- 전담 고객 매니저
    has_slack_channel = true,          -- Slack 채널 O
    ai_model_type = 'advanced',
    has_ai_assistant = true,           -- 고급 AI 어시스턴트
    has_analytics = true,
    has_api_access = true,
    sort_order = 3,
    updated_at = NOW()
WHERE plan_code = 'enterprise';

-- ============================================
-- 트라이얼 기간 제거 - 바로 결제
-- user_subscriptions 테이블에서 trial 컬럼 제거
-- ============================================

-- trial 컬럼 제거 (있는 경우에만)
ALTER TABLE public.user_subscriptions
DROP COLUMN IF EXISTS trial_start,
DROP COLUMN IF EXISTS trial_end;

-- trialing 상태를 active로 변경 (기존 데이터 정리)
UPDATE public.user_subscriptions
SET status = 'active', updated_at = NOW()
WHERE status = 'trialing';

-- status 컬럼 코멘트 업데이트
COMMENT ON COLUMN public.user_subscriptions.status IS '구독 상태: active(활성), cancelled(취소됨), expired(만료), past_due(결제 실패). 트라이얼 없음';
