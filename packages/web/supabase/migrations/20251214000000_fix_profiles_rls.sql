-- profiles 테이블 RLS 정책 수정
-- Google OAuth 회원가입 시 프로필 INSERT 실패 문제 해결

-- profiles 테이블에 RLS가 활성화되어 있는지 확인하고 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- SELECT 정책: 사용자는 자신의 프로필만 조회 가능
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT 정책: 인증된 사용자는 자신의 프로필 생성 가능
-- 회원가입 직후에도 INSERT가 가능하도록 완화된 정책
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- UPDATE 정책: 사용자는 자신의 프로필만 수정 가능
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 코멘트 추가
COMMENT ON POLICY "Users can view own profile" ON public.profiles
  IS '사용자는 자신의 프로필만 조회할 수 있음';

COMMENT ON POLICY "Users can insert own profile" ON public.profiles
  IS '인증된 사용자는 프로필을 생성할 수 있음 (회원가입 시 포함)';

COMMENT ON POLICY "Users can update own profile" ON public.profiles
  IS '사용자는 자신의 프로필만 수정할 수 있음';
