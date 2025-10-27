-- auth.users 테이블의 트리거 제거
-- 회원가입 시 발생하는 500 에러 해결
-- 기본 설정 생성은 애플리케이션 레벨(AuthContext)에서 처리

-- 트리거 제거
DROP TRIGGER IF EXISTS create_default_notification_settings_on_signup ON auth.users;

-- 함수는 유지 (수동 호출 가능하도록)
-- DROP FUNCTION IF EXISTS create_default_notification_settings();

-- 코멘트 추가
COMMENT ON FUNCTION create_default_notification_settings() IS '기본 알림 설정 생성 함수 (애플리케이션 레벨에서 호출)';
