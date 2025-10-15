-- Migration: STL Files Management
-- Description: STL 파일 업로드 및 썸네일 관리를 위한 테이블 생성
-- Created: 2025-10-15

-- ============================================================================
-- 1. STL Files Table (STL 파일 테이블)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stl_files (
  -- 기본 정보
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  -- 파일 정보
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_url TEXT,
  thumbnail_path TEXT,
  thumbnail_url TEXT,

  -- STL 메타데이터
  triangle_count INTEGER,
  bounding_box JSONB, -- {x: number, y: number, z: number} in mm

  -- 프린팅 관련
  print_time_estimate INTEGER, -- 초 단위
  filament_estimate REAL, -- 그램 단위
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'ready', 'printing', 'completed', 'failed')),

  -- 태그 및 메타
  tags TEXT[],
  description TEXT,
  is_public BOOLEAN DEFAULT false,

  -- 시간 정보
  upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 외래키 (선택적으로 AI 모델과 연결)
  ai_model_id UUID REFERENCES public.ai_generated_models(id) ON DELETE SET NULL
);

-- 인덱스 생성 (검색 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_stl_files_user_id ON public.stl_files(user_id);
CREATE INDEX IF NOT EXISTS idx_stl_files_upload_date ON public.stl_files(upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_stl_files_status ON public.stl_files(status);
CREATE INDEX IF NOT EXISTS idx_stl_files_tags ON public.stl_files USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_stl_files_is_public ON public.stl_files(is_public) WHERE is_public = true;

-- 코멘트 추가
COMMENT ON TABLE public.stl_files IS 'STL 파일 저장 및 관리 (썸네일 포함)';
COMMENT ON COLUMN public.stl_files.file_path IS 'Supabase Storage 경로';
COMMENT ON COLUMN public.stl_files.thumbnail_path IS '썸네일 이미지 Storage 경로';
COMMENT ON COLUMN public.stl_files.bounding_box IS '모델 바운딩 박스 크기 (mm): {x: number, y: number, z: number}';
COMMENT ON COLUMN public.stl_files.triangle_count IS 'STL 파일의 삼각형 개수';

-- ============================================================================
-- 2. Row Level Security (RLS) 정책
-- ============================================================================

ALTER TABLE public.stl_files ENABLE ROW LEVEL SECURITY;

-- 사용자 본인 파일 또는 공개 파일 조회 가능
CREATE POLICY "Users can view own files or public files"
ON public.stl_files
FOR SELECT
USING (
  auth.uid() = user_id OR is_public = true
);

-- 사용자 본인 파일만 삽입 가능
CREATE POLICY "Users can insert own files"
ON public.stl_files
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 사용자 본인 파일만 수정 가능
CREATE POLICY "Users can update own files"
ON public.stl_files
FOR UPDATE
USING (auth.uid() = user_id);

-- 사용자 본인 파일만 삭제 가능
CREATE POLICY "Users can delete own files"
ON public.stl_files
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 3. Triggers (자동 업데이트)
-- ============================================================================

-- updated_at 트리거
CREATE TRIGGER set_stl_files_updated_at
  BEFORE UPDATE ON public.stl_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4. Storage Bucket (Supabase Storage 버킷 생성)
-- ============================================================================

-- STL 파일 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stl-files',
  'stl-files',
  false,
  104857600, -- 100MB
  ARRAY['model/stl', 'application/octet-stream', 'application/sla']
)
ON CONFLICT (id) DO NOTHING;

-- 썸네일 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stl-thumbnails',
  'stl-thumbnails',
  true, -- 썸네일은 공개
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. Storage Policies (스토리지 정책)
-- ============================================================================

-- STL 파일 정책
CREATE POLICY "Users can upload own STL files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'stl-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own STL files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'stl-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own STL files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'stl-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own STL files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'stl-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 썸네일 정책 (공개)
CREATE POLICY "Anyone can view STL thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'stl-thumbnails');

CREATE POLICY "Users can upload own thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'stl-thumbnails' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own thumbnails"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'stl-thumbnails' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own thumbnails"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'stl-thumbnails' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- Migration Complete
-- ============================================================================
