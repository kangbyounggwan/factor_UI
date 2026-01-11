-- Migration: Cascade Delete AI Models on Source Image Deletion
-- Description: 소스 이미지 삭제 시 연결된 AI 모델 자동 삭제 트리거
-- Created: 2025-10-15

-- ============================================================================
-- 1. Storage 삭제 트리거 함수
-- ============================================================================

-- Storage에서 파일이 삭제될 때 연결된 AI 모델도 삭제하는 함수
CREATE OR REPLACE FUNCTION public.delete_models_on_source_image_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- 삭제된 파일의 경로로 연결된 모델 찾아서 삭제
  DELETE FROM public.ai_generated_models
  WHERE source_image_url = OLD.name
     OR source_image_url LIKE '%' || OLD.name;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. Storage 삭제 트리거 생성
-- ============================================================================

-- storage.objects 테이블에 트리거 추가 (이미지 삭제 시)
DROP TRIGGER IF EXISTS trigger_delete_models_on_image_delete ON storage.objects;
CREATE TRIGGER trigger_delete_models_on_image_delete
  AFTER DELETE ON storage.objects
  FOR EACH ROW
  WHEN (OLD.bucket_id = 'ai-models')
  EXECUTE FUNCTION public.delete_models_on_source_image_delete();

-- ============================================================================
-- 3. 연결된 모델 개수 확인 함수
-- ============================================================================

-- 특정 이미지 경로와 연결된 모델 개수를 반환하는 함수
CREATE OR REPLACE FUNCTION public.count_linked_models(image_path TEXT)
RETURNS INTEGER AS $$
DECLARE
  model_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO model_count
  FROM public.ai_generated_models
  WHERE source_image_url = image_path
     OR source_image_url LIKE '%' || image_path;

  RETURN model_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. 이미지와 연결된 모든 모델 조회 함수
-- ============================================================================

-- 특정 이미지 경로와 연결된 모델 목록을 반환하는 함수
CREATE OR REPLACE FUNCTION public.get_linked_models(image_path TEXT)
RETURNS TABLE (
  id UUID,
  model_name VARCHAR(255),
  generation_type VARCHAR(50),
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.model_name,
    m.generation_type,
    m.created_at
  FROM public.ai_generated_models m
  WHERE m.source_image_url = image_path
     OR m.source_image_url LIKE '%' || image_path
  ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Migration Complete
-- ============================================================================
