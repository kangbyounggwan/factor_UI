-- ============================================================================
-- G-code 3D 뷰어 세그먼트 데이터 저장 테이블
-- Migration: 20251218150000_gcode_segments_storage.sql
-- Description: G-code 분석 시 생성되는 3D 시각화 데이터 저장
-- Created: 2025-12-18
-- ============================================================================

-- ============================================================================
-- 1. gcode_segment_data (3D 뷰어용 세그먼트 데이터)
-- 분석 보고서와 1:1 연결, 큰 바이너리 데이터는 Storage에 저장
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.gcode_segment_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- =====================================
  -- 연결 정보
  -- =====================================
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.gcode_analysis_reports(id) ON DELETE CASCADE,
  gcode_file_id UUID REFERENCES public.gcode_files(id) ON DELETE SET NULL,

  -- 분석 ID (백엔드 API에서 반환)
  analysis_id TEXT,

  -- =====================================
  -- 메타데이터 (JSON)
  -- =====================================
  metadata JSONB NOT NULL DEFAULT '{}',
  -- {
  --   boundingBox: { minX, maxX, minY, maxY, minZ, maxZ },
  --   layerCount: number,
  --   totalFilament: number,
  --   printTime: number,
  --   layerHeight: number,
  --   firstLayerHeight: number,
  --   estimatedTime: string,
  --   filamentType: string | null,
  --   slicer: string,
  --   slicerVersion: string | null
  -- }

  -- =====================================
  -- 온도 데이터 (JSON 배열)
  -- =====================================
  temperatures JSONB DEFAULT '[]',
  -- [{ layer: number, nozzleTemp: number | null, bedTemp: number | null }]

  -- =====================================
  -- 레이어 데이터 저장 방식 선택
  -- =====================================
  -- 옵션 1: Storage에 저장 (대용량 데이터용)
  layers_storage_path TEXT,  -- Storage 경로 (예: gcode-segments/{user_id}/{id}.json)

  -- 옵션 2: 압축된 JSONB로 직접 저장 (소용량 데이터용)
  -- layers_data JSONB, -- 직접 저장 시 사용 (성능 이슈 가능)

  -- =====================================
  -- 레이어 통계 (빠른 조회용)
  -- =====================================
  layer_count INTEGER DEFAULT 0,
  total_extrusion_points INTEGER DEFAULT 0,
  total_travel_points INTEGER DEFAULT 0,
  has_wipe_data BOOLEAN DEFAULT FALSE,
  has_support_data BOOLEAN DEFAULT FALSE,

  -- =====================================
  -- 상태
  -- =====================================
  status TEXT DEFAULT 'ready' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT,

  -- =====================================
  -- 타임스탬프
  -- =====================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_gcode_segment_data_user_id ON public.gcode_segment_data(user_id);
CREATE INDEX IF NOT EXISTS idx_gcode_segment_data_report_id ON public.gcode_segment_data(report_id);
CREATE INDEX IF NOT EXISTS idx_gcode_segment_data_analysis_id ON public.gcode_segment_data(analysis_id);
CREATE INDEX IF NOT EXISTS idx_gcode_segment_data_created_at ON public.gcode_segment_data(created_at DESC);

-- ============================================================================
-- RLS (Row Level Security) Policies
-- ============================================================================
ALTER TABLE public.gcode_segment_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own segment data"
  ON public.gcode_segment_data FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own segment data"
  ON public.gcode_segment_data FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own segment data"
  ON public.gcode_segment_data FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own segment data"
  ON public.gcode_segment_data FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS for updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_gcode_segment_data_updated_at ON public.gcode_segment_data;
CREATE TRIGGER update_gcode_segment_data_updated_at
  BEFORE UPDATE ON public.gcode_segment_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Storage Bucket for segment data (대용량 레이어 데이터용)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('gcode-segments', 'gcode-segments', false, 52428800)  -- 50MB limit
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload own segment files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'gcode-segments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own segment files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'gcode-segments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own segment files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'gcode-segments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- Add segment_data_id column to gcode_analysis_reports
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'gcode_analysis_reports'
    AND column_name = 'segment_data_id'
  ) THEN
    ALTER TABLE public.gcode_analysis_reports
    ADD COLUMN segment_data_id UUID REFERENCES public.gcode_segment_data(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.gcode_segment_data IS 'G-code 3D 뷰어용 세그먼트 데이터 - 레이어별 압출/이동 경로 저장';
COMMENT ON COLUMN public.gcode_segment_data.metadata IS '메타데이터 JSON: boundingBox, layerCount, totalFilament 등';
COMMENT ON COLUMN public.gcode_segment_data.temperatures IS '레이어별 온도 데이터 배열';
COMMENT ON COLUMN public.gcode_segment_data.layers_storage_path IS 'Storage에 저장된 레이어 데이터 경로';
