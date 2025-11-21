-- handle_new_user 트리거 제거
-- 소셜 로그인 시 자동 프로필 생성을 방지하고 ProfileSetup 페이지에서 직접 생성하도록 함
-- 이메일 회원가입은 AuthContext에서 프로필을 생성함

-- 트리거 제거
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 함수는 유지 (필요시 수동 호출 가능)
-- DROP FUNCTION IF EXISTS handle_new_user();

COMMENT ON FUNCTION handle_new_user() IS '새 사용자 프로필 생성 함수 (트리거에서 제거됨, 필요시 수동 호출)';
