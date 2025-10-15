-- Migration: Manufacturing Printers (Cura Printer Definitions)
-- Description: Cura 프린터 정의 및 제조사 프린터 데이터베이스
-- Created: 2025-10-15

-- ============================================================================
-- 1. Manufacturing Printers Table (제조사 프린터 정의 테이블)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.manufacturing_printers (
  -- 기본 정보
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 제조사 및 모델 정보
  manufacturer TEXT NOT NULL,
  series TEXT NOT NULL DEFAULT 'unknown',
  model TEXT NOT NULL,
  display_name TEXT NOT NULL,

  -- Cura 파일 정보
  filename TEXT NOT NULL UNIQUE,
  version INTEGER DEFAULT 2,
  inherits TEXT,
  visible BOOLEAN DEFAULT true,
  author TEXT,

  -- Supabase Storage 경로 (DEF 파일)
  def_file_url TEXT,
  def_file_path TEXT,

  -- 메타데이터 (JSONB로 유연하게 저장)
  metadata JSONB,

  -- 프린터 사양 (주요 스펙 추출)
  build_volume JSONB, -- {x: number, y: number, z: number} in mm
  extruder_count INTEGER DEFAULT 1,
  heated_bed BOOLEAN DEFAULT true,
  file_formats TEXT[], -- ['text/x-gcode', 'application/x-ufp']

  -- 기술 정보
  technology TEXT DEFAULT 'FDM', -- FDM, SLA, SLS, etc.
  nozzle_diameter NUMERIC(5, 2), -- mm
  layer_height_min NUMERIC(5, 3), -- mm
  layer_height_max NUMERIC(5, 3), -- mm

  -- 지원 기능
  supports_usb_connection BOOLEAN DEFAULT false,
  supports_network_connection BOOLEAN DEFAULT false,
  supports_material_flow_sensor BOOLEAN DEFAULT false,

  -- 검색 및 필터링
  tags TEXT[],
  category TEXT, -- 'consumer', 'professional', 'industrial'

  -- 인기도/통계
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- 시간 정보
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 제약 조건
  CONSTRAINT valid_technology CHECK (technology IN ('FDM', 'SLA', 'SLS', 'DLP', 'Binder Jetting', 'Material Jetting', 'Other'))
);

-- ============================================================================
-- 2. Indexes (검색 성능 최적화)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_manufacturing_printers_manufacturer
  ON public.manufacturing_printers(manufacturer);

CREATE INDEX IF NOT EXISTS idx_manufacturing_printers_series
  ON public.manufacturing_printers(series);

CREATE INDEX IF NOT EXISTS idx_manufacturing_printers_model
  ON public.manufacturing_printers(model);

CREATE INDEX IF NOT EXISTS idx_manufacturing_printers_filename
  ON public.manufacturing_printers(filename);

CREATE INDEX IF NOT EXISTS idx_manufacturing_printers_visible
  ON public.manufacturing_printers(visible) WHERE visible = true;

CREATE INDEX IF NOT EXISTS idx_manufacturing_printers_technology
  ON public.manufacturing_printers(technology);

CREATE INDEX IF NOT EXISTS idx_manufacturing_printers_category
  ON public.manufacturing_printers(category);

CREATE INDEX IF NOT EXISTS idx_manufacturing_printers_tags
  ON public.manufacturing_printers USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_manufacturing_printers_metadata
  ON public.manufacturing_printers USING GIN(metadata);

CREATE INDEX IF NOT EXISTS idx_manufacturing_printers_usage_count
  ON public.manufacturing_printers(usage_count DESC);

-- Full-text search index for manufacturer, model, display_name
CREATE INDEX IF NOT EXISTS idx_manufacturing_printers_search
  ON public.manufacturing_printers
  USING GIN(to_tsvector('english',
    COALESCE(manufacturer, '') || ' ' ||
    COALESCE(model, '') || ' ' ||
    COALESCE(display_name, '')
  ));

-- ============================================================================
-- 3. Comments (테이블 및 컬럼 설명)
-- ============================================================================

COMMENT ON TABLE public.manufacturing_printers IS 'Cura 프린터 정의 및 제조사 프린터 데이터베이스';
COMMENT ON COLUMN public.manufacturing_printers.manufacturer IS '제조사 이름';
COMMENT ON COLUMN public.manufacturing_printers.series IS '프린터 시리즈';
COMMENT ON COLUMN public.manufacturing_printers.model IS '프린터 모델명';
COMMENT ON COLUMN public.manufacturing_printers.display_name IS '표시용 이름';
COMMENT ON COLUMN public.manufacturing_printers.filename IS 'Cura DEF 파일명 (고유)';
COMMENT ON COLUMN public.manufacturing_printers.inherits IS '상속받는 프린터 정의';
COMMENT ON COLUMN public.manufacturing_printers.def_file_url IS 'Supabase Storage에 저장된 DEF 파일 URL';
COMMENT ON COLUMN public.manufacturing_printers.metadata IS 'Cura 메타데이터 (JSONB)';
COMMENT ON COLUMN public.manufacturing_printers.build_volume IS '출력 가능 부피 {x, y, z} mm';
COMMENT ON COLUMN public.manufacturing_printers.extruder_count IS '익스트루더(압출기) 개수';
COMMENT ON COLUMN public.manufacturing_printers.technology IS '3D 프린팅 기술 타입';

-- ============================================================================
-- 4. Row Level Security (RLS)
-- ============================================================================

-- 모든 사용자가 읽기 가능 (공개 데이터)
ALTER TABLE public.manufacturing_printers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view manufacturing printers"
ON public.manufacturing_printers
FOR SELECT
USING (true);

-- 관리자만 삽입/수정/삭제 가능 (나중에 관리자 역할 추가 시)
-- 현재는 인증된 사용자만 수정 가능
CREATE POLICY "Authenticated users can insert manufacturing printers"
ON public.manufacturing_printers
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update manufacturing printers"
ON public.manufacturing_printers
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete manufacturing printers"
ON public.manufacturing_printers
FOR DELETE
USING (auth.role() = 'authenticated');

-- ============================================================================
-- 5. Triggers (자동 업데이트)
-- ============================================================================

-- updated_at 자동 업데이트
CREATE TRIGGER set_manufacturing_printers_updated_at
  BEFORE UPDATE ON public.manufacturing_printers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 6. Functions (유틸리티 함수)
-- ============================================================================

-- 프린터 검색 함수 (Full-text search)
CREATE OR REPLACE FUNCTION public.search_manufacturing_printers(search_query TEXT)
RETURNS TABLE (
  id UUID,
  manufacturer TEXT,
  model TEXT,
  display_name TEXT,
  filename TEXT,
  technology TEXT,
  build_volume JSONB,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mp.id,
    mp.manufacturer,
    mp.model,
    mp.display_name,
    mp.filename,
    mp.technology,
    mp.build_volume,
    ts_rank(
      to_tsvector('english',
        COALESCE(mp.manufacturer, '') || ' ' ||
        COALESCE(mp.model, '') || ' ' ||
        COALESCE(mp.display_name, '')
      ),
      plainto_tsquery('english', search_query)
    ) as rank
  FROM public.manufacturing_printers mp
  WHERE
    mp.visible = true
    AND to_tsvector('english',
      COALESCE(mp.manufacturer, '') || ' ' ||
      COALESCE(mp.model, '') || ' ' ||
      COALESCE(mp.display_name, '')
    ) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 제조사별 프린터 수 조회
CREATE OR REPLACE FUNCTION public.get_manufacturer_stats()
RETURNS TABLE (
  manufacturer TEXT,
  printer_count BIGINT,
  avg_extruders NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mp.manufacturer,
    COUNT(*)::BIGINT as printer_count,
    AVG(mp.extruder_count)::NUMERIC(5,2) as avg_extruders
  FROM public.manufacturing_printers mp
  WHERE mp.visible = true
  GROUP BY mp.manufacturer
  ORDER BY printer_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 프린터 사용 횟수 증가
CREATE OR REPLACE FUNCTION public.increment_printer_usage(p_printer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.manufacturing_printers
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = p_printer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Storage Bucket (Supabase Storage 버킷)
-- ============================================================================

-- DEF 파일 저장용 버킷 (Supabase Dashboard에서 생성 필요)
-- 버킷 이름: 'printer-definitions'
-- 공개: true (누구나 읽기 가능)
-- 파일 크기 제한: 1MB
-- 허용 MIME 타입: application/json, text/plain

-- Storage 정책 (참고용)
-- CREATE POLICY "Anyone can view printer definition files"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'printer-definitions');
--
-- CREATE POLICY "Authenticated users can upload printer definition files"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'printer-definitions' AND
--   auth.role() = 'authenticated'
-- );

-- ============================================================================
-- Migration Complete
-- ============================================================================
