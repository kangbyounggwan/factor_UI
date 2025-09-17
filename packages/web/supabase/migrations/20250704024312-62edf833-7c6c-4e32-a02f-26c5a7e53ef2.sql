-- 프린터 그룹 테이블 생성
CREATE TABLE public.printer_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 프린터 테이블 생성 (기존 샘플 데이터를 대체)
CREATE TABLE public.printers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  group_id UUID REFERENCES public.printer_groups(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 80,
  api_key TEXT,
  firmware TEXT NOT NULL DEFAULT 'marlin',
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_connected TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS 정책 활성화
ALTER TABLE public.printer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

-- printer_groups 정책
CREATE POLICY "Users can view their own printer groups" 
ON public.printer_groups 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own printer groups" 
ON public.printer_groups 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own printer groups" 
ON public.printer_groups 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own printer groups" 
ON public.printer_groups 
FOR DELETE 
USING (auth.uid() = user_id);

-- printers 정책
CREATE POLICY "Users can view their own printers" 
ON public.printers 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own printers" 
ON public.printers 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own printers" 
ON public.printers 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own printers" 
ON public.printers 
FOR DELETE 
USING (auth.uid() = user_id);

-- 타임스탬프 자동 업데이트 트리거
CREATE TRIGGER update_printer_groups_updated_at
BEFORE UPDATE ON public.printer_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_printers_updated_at
BEFORE UPDATE ON public.printers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();