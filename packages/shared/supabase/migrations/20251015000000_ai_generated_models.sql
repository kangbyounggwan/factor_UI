-- Migration: AI Generated Models
-- Description: AI 생성 3D 모델 및 출력 이력 관리를 위한 테이블 생성
-- Created: 2025-10-15

-- ============================================================================
-- 1. AI Generated Models Table (AI 생성 3D 모델 테이블)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_generated_models (
  -- 기본 정보
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  -- 생성 정보
  generation_type VARCHAR(50) NOT NULL,
  prompt TEXT,
  source_image_url TEXT,

  -- AI 설정
  ai_model VARCHAR(50),
  quality VARCHAR(20),
  style VARCHAR(50),

  -- 파일 정보
  model_name VARCHAR(255) NOT NULL,
  file_format VARCHAR(20) NOT NULL DEFAULT 'glb',
  storage_path TEXT NOT NULL,
  download_url TEXT,
  file_size BIGINT,
  thumbnail_url TEXT,

  -- 메타데이터
  model_dimensions JSONB,
  generation_metadata JSONB,

  -- 상태 및 태그
  status VARCHAR(50) DEFAULT 'completed',
  tags TEXT[],
  is_favorite BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,

  -- 프린터 연동 통계
  printed_count INTEGER DEFAULT 0,
  last_printed_at TIMESTAMPTZ,

  -- 시간 정보
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 제약 조건
  CONSTRAINT valid_generation_type CHECK (generation_type IN ('text_to_3d', 'image_to_3d', 'text_to_image')),
  CONSTRAINT valid_status CHECK (status IN ('processing', 'completed', 'failed', 'archived'))
);

-- 인덱스 생성 (검색 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_ai_models_user_id ON public.ai_generated_models(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_models_created_at ON public.ai_generated_models(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_models_generation_type ON public.ai_generated_models(generation_type);
CREATE INDEX IF NOT EXISTS idx_ai_models_status ON public.ai_generated_models(status);
CREATE INDEX IF NOT EXISTS idx_ai_models_tags ON public.ai_generated_models USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_ai_models_is_favorite ON public.ai_generated_models(is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_ai_models_is_public ON public.ai_generated_models(is_public) WHERE is_public = true;

-- 코멘트 추가
COMMENT ON TABLE public.ai_generated_models IS 'AI로 생성된 3D 모델 저장 및 관리';
COMMENT ON COLUMN public.ai_generated_models.generation_type IS '생성 타입: text_to_3d, image_to_3d, text_to_image';
COMMENT ON COLUMN public.ai_generated_models.prompt IS '텍스트 프롬프트 (text_to_3d, text_to_image용)';
COMMENT ON COLUMN public.ai_generated_models.source_image_url IS '원본 이미지 URL (image_to_3d용)';
COMMENT ON COLUMN public.ai_generated_models.storage_path IS 'Supabase Storage 경로';
COMMENT ON COLUMN public.ai_generated_models.model_dimensions IS '모델 크기 (mm): {x: number, y: number, z: number}';
COMMENT ON COLUMN public.ai_generated_models.generation_metadata IS 'AI 서버 응답 메타데이터 (전체 응답 저장)';
COMMENT ON COLUMN public.ai_generated_models.tags IS '검색용 태그 배열';
COMMENT ON COLUMN public.ai_generated_models.is_public IS '공개 갤러리 표시 여부';

-- ============================================================================
-- 2. Row Level Security (RLS) 정책
-- ============================================================================

ALTER TABLE public.ai_generated_models ENABLE ROW LEVEL SECURITY;

-- 사용자 본인 데이터 또는 공개 모델 조회 가능
CREATE POLICY "Users can view own models or public models"
ON public.ai_generated_models
FOR SELECT
USING (
  auth.uid() = user_id OR is_public = true
);

-- 사용자 본인 데이터만 삽입 가능
CREATE POLICY "Users can insert own models"
ON public.ai_generated_models
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 사용자 본인 데이터만 수정 가능
CREATE POLICY "Users can update own models"
ON public.ai_generated_models
FOR UPDATE
USING (auth.uid() = user_id);

-- 사용자 본인 데이터만 삭제 가능
CREATE POLICY "Users can delete own models"
ON public.ai_generated_models
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 3. Triggers (자동 업데이트)
-- ============================================================================

-- updated_at 자동 업데이트 함수 (없으면 생성)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거
CREATE TRIGGER set_ai_models_updated_at
  BEFORE UPDATE ON public.ai_generated_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4. Model Print History Table (모델 출력 이력 테이블)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.model_print_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES public.ai_generated_models(id) ON DELETE CASCADE,
  printer_id UUID REFERENCES public.printers(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,

  -- 출력 정보
  print_status VARCHAR(50) DEFAULT 'queued',
  print_settings JSONB,
  gcode_file_id UUID REFERENCES public.gcode_files(id) ON DELETE SET NULL,

  -- 통계
  print_time INTERVAL,
  filament_used NUMERIC(10, 2),

  -- 에러 정보
  error_message TEXT,

  -- 시간
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_print_status CHECK (
    print_status IN ('queued', 'printing', 'completed', 'failed', 'cancelled')
  )
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_print_history_model_id ON public.model_print_history(model_id);
CREATE INDEX IF NOT EXISTS idx_print_history_user_id ON public.model_print_history(user_id);
CREATE INDEX IF NOT EXISTS idx_print_history_printer_id ON public.model_print_history(printer_id);
CREATE INDEX IF NOT EXISTS idx_print_history_created_at ON public.model_print_history(created_at DESC);

-- 코멘트
COMMENT ON TABLE public.model_print_history IS 'AI 생성 모델의 3D 프린터 출력 이력';
COMMENT ON COLUMN public.model_print_history.print_settings IS '슬라이싱 설정 (JSON): layer_height, infill, support 등';
COMMENT ON COLUMN public.model_print_history.print_time IS '실제 출력 소요 시간';
COMMENT ON COLUMN public.model_print_history.filament_used IS '사용된 필라멘트 길이 (미터)';

-- RLS 활성화
ALTER TABLE public.model_print_history ENABLE ROW LEVEL SECURITY;

-- 사용자 본인 출력 이력만 조회 가능
CREATE POLICY "Users can view own print history"
ON public.model_print_history
FOR SELECT
USING (auth.uid() = user_id);

-- 사용자 본인 출력 이력만 삽입 가능
CREATE POLICY "Users can insert own print history"
ON public.model_print_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 사용자 본인 출력 이력만 수정 가능
CREATE POLICY "Users can update own print history"
ON public.model_print_history
FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================================================
-- 5. Functions (유틸리티 함수)
-- ============================================================================

-- 모델의 출력 횟수 증가 함수
CREATE OR REPLACE FUNCTION public.increment_print_count(model_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.ai_generated_models
  SET
    printed_count = printed_count + 1,
    last_printed_at = NOW()
  WHERE id = model_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용자의 모델 통계 조회 함수
CREATE OR REPLACE FUNCTION public.get_user_model_stats(p_user_id UUID)
RETURNS TABLE (
  total_models BIGINT,
  total_storage_bytes BIGINT,
  favorite_count BIGINT,
  public_count BIGINT,
  total_prints BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_models,
    COALESCE(SUM(file_size), 0)::BIGINT as total_storage_bytes,
    COUNT(*) FILTER (WHERE is_favorite = true)::BIGINT as favorite_count,
    COUNT(*) FILTER (WHERE is_public = true)::BIGINT as public_count,
    COALESCE(SUM(printed_count), 0)::BIGINT as total_prints
  FROM public.ai_generated_models
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Storage Bucket (Supabase Storage 버킷 생성)
-- ============================================================================

-- 참고: 이 부분은 Supabase Dashboard에서 수동으로 생성하거나
-- Supabase CLI로 별도 실행해야 할 수 있습니다.
--
-- 버킷 생성 SQL (필요 시):
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'ai-models',
--   'ai-models',
--   false,
--   52428800, -- 50MB
--   ARRAY['model/gltf-binary', 'model/gltf+json', 'model/stl', 'model/obj', 'image/png', 'image/jpeg']
-- );

-- Storage RLS 정책 (참고용)
-- CREATE POLICY "Users can upload own models"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'ai-models' AND
--   (storage.foldername(name))[1] = auth.uid()::text
-- );
--
-- CREATE POLICY "Users can view own models"
-- ON storage.objects FOR SELECT
-- USING (
--   bucket_id = 'ai-models' AND
--   (storage.foldername(name))[1] = auth.uid()::text
-- );
--
-- CREATE POLICY "Users can delete own models"
-- ON storage.objects FOR DELETE
-- USING (
--   bucket_id = 'ai-models' AND
--   (storage.foldername(name))[1] = auth.uid()::text
-- );

-- ============================================================================
-- Migration Complete
-- ============================================================================
