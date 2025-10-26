-- 사용자 알림 설정 테이블 생성
-- 각 사용자의 알림 수신 환경설정을 저장

CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 기본 알림 설정 (모든 플랜 사용 가능)
  push_notifications BOOLEAN DEFAULT true,
  print_complete_notifications BOOLEAN DEFAULT true,
  error_notifications BOOLEAN DEFAULT true,

  -- Pro 플랜 전용 기능 (Basic 플랜은 UI에서 비활성화)
  email_notifications BOOLEAN DEFAULT false,
  weekly_report BOOLEAN DEFAULT false,

  -- 추가 설정 (선택사항)
  notification_sound BOOLEAN DEFAULT true,
  notification_frequency TEXT DEFAULT 'immediate' CHECK (notification_frequency IN ('immediate', 'hourly', 'daily')),

  -- 방해금지 시간 설정
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 사용자당 하나의 설정만 허용
  UNIQUE(user_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_notification_settings_user_id
  ON public.user_notification_settings(user_id);

-- Row Level Security 활성화
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Users can view own notification settings" ON public.user_notification_settings;
DROP POLICY IF EXISTS "Users can insert own notification settings" ON public.user_notification_settings;
DROP POLICY IF EXISTS "Users can update own notification settings" ON public.user_notification_settings;
DROP POLICY IF EXISTS "Users can delete own notification settings" ON public.user_notification_settings;

-- RLS 정책: 사용자는 자신의 알림 설정만 조회 가능
CREATE POLICY "Users can view own notification settings"
  ON public.user_notification_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 정책: 사용자는 자신의 알림 설정만 삽입 가능
CREATE POLICY "Users can insert own notification settings"
  ON public.user_notification_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS 정책: 사용자는 자신의 알림 설정만 수정 가능
CREATE POLICY "Users can update own notification settings"
  ON public.user_notification_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS 정책: 사용자는 자신의 알림 설정만 삭제 가능
CREATE POLICY "Users can delete own notification settings"
  ON public.user_notification_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_user_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_user_notification_settings_updated_at_trigger
  ON public.user_notification_settings;

CREATE TRIGGER update_user_notification_settings_updated_at_trigger
  BEFORE UPDATE ON public.user_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_notification_settings_updated_at();

-- 기본 설정 생성 함수 (회원가입 시 자동 호출용)
CREATE OR REPLACE FUNCTION create_default_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 회원가입 시 자동으로 기본 알림 설정 생성
DROP TRIGGER IF EXISTS create_default_notification_settings_on_signup
  ON auth.users;

CREATE TRIGGER create_default_notification_settings_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_settings();

-- 코멘트 추가
COMMENT ON TABLE public.user_notification_settings IS '사용자별 알림 수신 환경설정';
COMMENT ON COLUMN public.user_notification_settings.push_notifications IS '브라우저 푸시 알림 수신 여부';
COMMENT ON COLUMN public.user_notification_settings.print_complete_notifications IS '출력 완료 알림 수신 여부';
COMMENT ON COLUMN public.user_notification_settings.error_notifications IS '프린터 오류 알림 수신 여부';
COMMENT ON COLUMN public.user_notification_settings.email_notifications IS '이메일 알림 수신 여부 (Pro 전용)';
COMMENT ON COLUMN public.user_notification_settings.weekly_report IS '주간 리포트 수신 여부 (Pro 전용)';
COMMENT ON COLUMN public.user_notification_settings.notification_sound IS '알림 사운드 재생 여부';
COMMENT ON COLUMN public.user_notification_settings.notification_frequency IS '알림 빈도 (immediate: 즉시, hourly: 1시간마다, daily: 하루 1회)';
COMMENT ON COLUMN public.user_notification_settings.quiet_hours_enabled IS '방해금지 시간 활성화 여부';
COMMENT ON COLUMN public.user_notification_settings.quiet_hours_start IS '방해금지 시작 시간';
COMMENT ON COLUMN public.user_notification_settings.quiet_hours_end IS '방해금지 종료 시간';

-- 기존 사용자들을 위한 기본 알림 설정 생성
-- 이미 존재하는 사용자에게 기본값으로 알림 설정을 추가
INSERT INTO public.user_notification_settings (
  user_id,
  push_notifications,
  print_complete_notifications,
  error_notifications,
  email_notifications,
  weekly_report,
  notification_sound,
  notification_frequency,
  quiet_hours_enabled
)
SELECT
  id,
  true,   -- push_notifications
  true,   -- print_complete_notifications
  true,   -- error_notifications
  false,  -- email_notifications (Pro 전용)
  false,  -- weekly_report (Pro 전용)
  true,   -- notification_sound
  'immediate',  -- notification_frequency
  false   -- quiet_hours_enabled
FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM public.user_notification_settings
)
ON CONFLICT (user_id) DO NOTHING;
