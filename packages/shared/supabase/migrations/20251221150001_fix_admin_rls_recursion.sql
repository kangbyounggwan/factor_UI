-- ============================================
-- 무한 재귀 오류 수정
-- 기존 잘못된 정책을 제거하고 올바른 정책으로 교체
-- ============================================

-- 기존 정책 제거 (무한 재귀 유발)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- 기존 is_admin 함수 제거 (있는 경우)
DROP FUNCTION IF EXISTS public.is_admin();

-- ============================================
-- 헬퍼 함수: 현재 사용자가 관리자인지 확인
-- SECURITY DEFINER로 RLS 우회하여 무한 재귀 방지
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
$$;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================
-- 관리자 조회 정책 (SELECT)
-- ============================================

-- profiles 테이블: 기존 정책 유지 + 관리자용 정책 추가
-- 일반 사용자: 자신의 프로필만 조회
-- 관리자: 모든 프로필 조회

CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_admin());

-- user_subscriptions 테이블: 관리자는 모든 구독 조회 가능
CREATE POLICY "Admins can view all subscriptions"
  ON public.user_subscriptions
  FOR SELECT
  USING (public.is_admin());

-- ============================================
-- UPDATE 정책
-- ============================================

-- 사용자는 자신의 프로필만 수정 가능
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 관리자는 모든 프로필 수정 가능
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================
-- role 변경 방지 트리거
-- ============================================

CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 관리자가 아닌 사용자가 role을 변경하려는 경우 차단
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only administrators can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_change_trigger ON public.profiles;

CREATE TRIGGER prevent_role_change_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_change();

-- ============================================
-- 코멘트
-- ============================================

COMMENT ON FUNCTION public.is_admin() IS '현재 로그인한 사용자가 관리자인지 확인 (SECURITY DEFINER로 RLS 우회)';
COMMENT ON FUNCTION public.prevent_role_change() IS 'role 변경을 관리자만 허용하는 트리거 함수';
