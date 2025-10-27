-- Migration: Add cura_engine_support column to manufacturing_printers
-- Description: 큐라 엔진 슬라이싱 지원 여부를 나타내는 컬럼 추가
-- Created: 2025-10-27

-- Add cura_engine_support column
ALTER TABLE public.manufacturing_printers
ADD COLUMN IF NOT EXISTS cura_engine_support BOOLEAN DEFAULT true;

-- Add comment
COMMENT ON COLUMN public.manufacturing_printers.cura_engine_support IS '큐라 엔진으로 슬라이싱 가능 여부 (true: 가능, false: 제한됨)';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_manufacturing_printers_cura_support
  ON public.manufacturing_printers(cura_engine_support);
