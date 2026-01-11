-- ============================================================================
-- 공유 보고서의 세그먼트 데이터 익명 접근 허용
-- Migration: 20251224000000_shared_report_segment_access.sql
-- Description: 공유된 보고서의 3D 뷰어 데이터에 익명 사용자 접근 허용
-- Created: 2025-12-24
-- ============================================================================

-- ============================================================================
-- 1. gcode_segment_data 테이블에 공유 보고서용 SELECT 정책 추가
-- ============================================================================

-- 기존 "Users can view own segment data" 정책 삭제 (아래에서 통합)
DROP POLICY IF EXISTS "Users can view own segment data" ON public.gcode_segment_data;

-- 공유된 보고서의 세그먼트 데이터는 익명 사용자도 조회 가능
CREATE POLICY "Public can view shared report segment data"
  ON public.gcode_segment_data FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_reports sr
      WHERE sr.report_id = gcode_segment_data.report_id
        AND sr.is_public = true
        AND (sr.expires_at IS NULL OR sr.expires_at > NOW())
    )
  );

-- 인증된 사용자: 본인 데이터 + 공유된 보고서의 세그먼트 데이터 조회 가능
CREATE POLICY "Authenticated can view own and shared segment data"
  ON public.gcode_segment_data FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.shared_reports sr
      WHERE sr.report_id = gcode_segment_data.report_id
        AND sr.is_public = true
        AND (sr.expires_at IS NULL OR sr.expires_at > NOW())
    )
  );

-- ============================================================================
-- 2. Storage (gcode-segments) 정책은 Supabase Dashboard에서 수동 설정 필요
-- ============================================================================
--
-- Supabase Dashboard > Storage > gcode-segments > Policies 에서 추가:
--
-- [익명 사용자 읽기 정책]
-- Policy name: Public can read shared segment files
-- Allowed operation: SELECT
-- Target roles: anon
-- Policy definition:
--   bucket_id = 'gcode-segments' AND
--   EXISTS (
--     SELECT 1 FROM public.gcode_segment_data gsd
--     JOIN public.shared_reports sr ON sr.report_id = gsd.report_id
--     WHERE gsd.layers_storage_path = name
--       AND sr.is_public = true
--       AND (sr.expires_at IS NULL OR sr.expires_at > NOW())
--   )
--
-- [인증된 사용자 읽기 정책 수정]
-- 기존 "Users can read own segment files" 정책을 수정하여:
--   bucket_id = 'gcode-segments' AND
--   (
--     (storage.foldername(name))[1] = auth.uid()::text
--     OR EXISTS (
--       SELECT 1 FROM public.gcode_segment_data gsd
--       JOIN public.shared_reports sr ON sr.report_id = gsd.report_id
--       WHERE gsd.layers_storage_path = name
--         AND sr.is_public = true
--         AND (sr.expires_at IS NULL OR sr.expires_at > NOW())
--     )
--   )
-- ============================================================================
