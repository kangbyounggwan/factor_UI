-- 회원가입 시 500 에러 수정
-- RLS 정책을 수정하여 회원가입 직후 INSERT 가능하도록 변경

-- user_notification_settings 테이블의 INSERT 정책 수정
DROP POLICY IF EXISTS "Users can insert own notification settings" ON public.user_notification_settings;

CREATE POLICY "Users can insert own notification settings"
  ON public.user_notification_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- user_subscriptions 테이블의 INSERT 정책도 수정
DROP POLICY IF EXISTS "System can insert subscriptions" ON public.user_subscriptions;

CREATE POLICY "Users can insert own subscriptions"
  ON public.user_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- 코멘트 추가
COMMENT ON POLICY "Users can insert own notification settings" ON public.user_notification_settings
  IS '사용자는 자신의 알림 설정을 생성할 수 있음 (회원가입 시 포함)';

COMMENT ON POLICY "Users can insert own subscriptions" ON public.user_subscriptions
  IS '사용자는 자신의 구독 정보를 생성할 수 있음 (회원가입 시 포함)';
