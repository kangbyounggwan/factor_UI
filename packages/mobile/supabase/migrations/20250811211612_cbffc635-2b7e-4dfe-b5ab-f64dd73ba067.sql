-- 사용자 역할을 위한 enum 타입 생성
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 사용자 역할 테이블 생성
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- 엣지 디바이스 테이블 생성
CREATE TABLE public.edge_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_uuid UUID NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'printer',
  status TEXT NOT NULL DEFAULT 'inactive',
  ip_address TEXT,
  port INTEGER DEFAULT 80,
  api_key TEXT,
  firmware TEXT DEFAULT 'marlin',
  last_seen TIMESTAMP WITH TIME ZONE,
  registered_by UUID NOT NULL,
  registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- RLS 활성화
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_devices ENABLE ROW LEVEL SECURITY;

-- 역할 체크 함수 생성 (보안 definer로 RLS 재귀 방지)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- user_roles 테이블 RLS 정책
CREATE POLICY "Admin can manage all user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- edge_devices 테이블 RLS 정책
CREATE POLICY "Admin can manage all edge devices"
ON public.edge_devices
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view edge devices"
ON public.edge_devices
FOR SELECT
TO authenticated
USING (true);

-- 업데이트 트리거 생성
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_edge_devices_updated_at
BEFORE UPDATE ON public.edge_devices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();