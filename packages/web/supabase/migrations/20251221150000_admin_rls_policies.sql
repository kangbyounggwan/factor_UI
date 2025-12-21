-- ============================================
-- 관리자용 RLS 정책 및 보안 강화
-- 1. 관리자는 모든 사용자 데이터 조회 가능
-- 2. 일반 사용자는 자신의 데이터만 조회 가능
-- 3. role 컬럼 변경 차단 (권한 상승 공격 방지)
-- ============================================

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
-- 1. 관리자 조회 정책
-- ============================================

-- profiles 테이블: 관리자는 모든 프로필 조회 가능
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_admin());

-- user_subscriptions 테이블: 관리자는 모든 구독 조회 가능
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.user_subscriptions;

CREATE POLICY "Admins can view all subscriptions"
  ON public.user_subscriptions
  FOR SELECT
  USING (public.is_admin());

-- ============================================
-- 2. role 컬럼 변경 차단 (보안 강화)
-- 사용자가 자신의 role을 변경할 수 없도록 함
-- ============================================

-- 기존 UPDATE 정책 삭제 후 재생성
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 새로운 UPDATE 정책: role 컬럼 변경 차단
-- OLD.role = NEW.role 체크를 위한 트리거 사용
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 관리자만 role 변경 가능
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================
-- 3. role 변경 방지 트리거 (RLS 대신 트리거로 처리)
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
-- 4. 코멘트 추가
-- ============================================

COMMENT ON FUNCTION public.is_admin() IS '현재 로그인한 사용자가 관리자인지 확인하는 헬퍼 함수';

COMMENT ON POLICY "Admins can view all profiles" ON public.profiles
  IS '관리자는 모든 사용자 프로필을 조회할 수 있음';

COMMENT ON POLICY "Admins can view all subscriptions" ON public.user_subscriptions
  IS '관리자는 모든 사용자 구독 정보를 조회할 수 있음';

COMMENT ON POLICY "Users can update own profile" ON public.profiles
  IS '사용자는 자신의 프로필을 수정할 수 있음 (role 변경은 트리거로 차단)';

COMMENT ON POLICY "Admins can update any profile" ON public.profiles
  IS '관리자는 모든 사용자 프로필을 수정할 수 있음 (role 포함)';

COMMENT ON FUNCTION public.prevent_role_change() IS 'role 변경을 관리자만 허용하는 트리거 함수';
