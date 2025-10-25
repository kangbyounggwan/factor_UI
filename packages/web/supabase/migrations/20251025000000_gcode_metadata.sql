-- 기존 gcode_files 테이블에 AI 모델 및 상세 메타데이터 컬럼 추가

-- AI 모델 연결
ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES ai_generated_models(id) ON DELETE CASCADE;

ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS printer_id TEXT;  -- manufacturing_printers ID

-- 프린터 정보
ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS manufacturer TEXT;

ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS series TEXT;

ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS printer_model_name TEXT;

-- 상세 메타데이터
ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS print_time_formatted TEXT;

ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS filament_used_m NUMERIC;

ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS filament_weight_g NUMERIC;

ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS filament_cost NUMERIC;

ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS layer_count INTEGER;

ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS layer_height NUMERIC;

-- 바운딩 박스
ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS bounding_box JSONB;

-- 온도 설정
ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS nozzle_temp NUMERIC;

ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS bed_temp NUMERIC;

ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS printer_name TEXT;

-- updated_at 컬럼 추가
ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_gcode_files_model_id ON public.gcode_files(model_id);
CREATE INDEX IF NOT EXISTS idx_gcode_files_printer_id ON public.gcode_files(printer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gcode_files_unique ON public.gcode_files(model_id, printer_id)
WHERE model_id IS NOT NULL AND printer_id IS NOT NULL;

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_gcode_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_gcode_files_updated_at_trigger ON public.gcode_files;

CREATE TRIGGER update_gcode_files_updated_at_trigger
  BEFORE UPDATE ON public.gcode_files
  FOR EACH ROW
  EXECUTE FUNCTION update_gcode_files_updated_at();
