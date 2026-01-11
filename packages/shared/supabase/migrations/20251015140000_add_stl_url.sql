-- Migration: Add STL URL support to AI Generated Models
-- Description: GLB와 STL 파일을 모두 저장할 수 있도록 필드 추가
-- Created: 2025-10-15

-- ============================================================================
-- 1. Add STL URL column to ai_generated_models table
-- ============================================================================

ALTER TABLE public.ai_generated_models
ADD COLUMN IF NOT EXISTS stl_storage_path TEXT,
ADD COLUMN IF NOT EXISTS stl_download_url TEXT;

-- ============================================================================
-- 2. Update comments
-- ============================================================================

COMMENT ON COLUMN public.ai_generated_models.storage_path IS 'GLB 파일의 Supabase Storage 경로';
COMMENT ON COLUMN public.ai_generated_models.download_url IS 'GLB 파일 다운로드 URL';
COMMENT ON COLUMN public.ai_generated_models.stl_storage_path IS 'STL 파일의 Supabase Storage 경로';
COMMENT ON COLUMN public.ai_generated_models.stl_download_url IS 'STL 파일 다운로드 URL';

-- ============================================================================
-- Migration Complete
-- ============================================================================
