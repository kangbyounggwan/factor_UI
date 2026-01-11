-- user_notification_settings 테이블에 누락된 컬럼 추가
-- ai_complete_enabled, payment_enabled, marketing_enabled

-- AI 생성 완료 알림 설정
ALTER TABLE public.user_notification_settings
ADD COLUMN IF NOT EXISTS ai_complete_enabled BOOLEAN DEFAULT true;

-- 결제 관련 알림 설정
ALTER TABLE public.user_notification_settings
ADD COLUMN IF NOT EXISTS payment_enabled BOOLEAN DEFAULT true;

-- 마케팅 알림 설정 (기본값 false - 사용자 동의 필요)
ALTER TABLE public.user_notification_settings
ADD COLUMN IF NOT EXISTS marketing_enabled BOOLEAN DEFAULT false;

-- 코멘트 추가
COMMENT ON COLUMN public.user_notification_settings.ai_complete_enabled IS 'AI 모델 생성 완료 알림 수신 여부';
COMMENT ON COLUMN public.user_notification_settings.payment_enabled IS '결제 관련 알림 수신 여부';
COMMENT ON COLUMN public.user_notification_settings.marketing_enabled IS '마케팅/프로모션 알림 수신 여부 (기본값 false)';
