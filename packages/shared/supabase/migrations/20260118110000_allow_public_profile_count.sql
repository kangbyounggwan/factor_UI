-- Allow anonymous users to count profiles for community stats
-- 비로그인 사용자도 커뮤니티 통계를 위해 profiles count 조회 가능하도록 설정

-- 기존 SELECT 정책 삭제
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- 새로운 SELECT 정책: 누구나 프로필 조회 가능 (공개 정보)
-- 이메일 등 민감 정보는 프로필에 포함되지 않으므로 안전
CREATE POLICY "Anyone can view profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

COMMENT ON POLICY "Anyone can view profiles" ON public.profiles
  IS '누구나 프로필 정보를 조회할 수 있음 (커뮤니티 기능용)';
