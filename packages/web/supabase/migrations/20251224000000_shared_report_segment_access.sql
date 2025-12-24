-- ============================================================================
-- 공유 보고서의 세그먼트 데이터 익명 접근 허용
-- Migration: 20251224000000_shared_report_segment_access.sql
-- Description: 공유된 보고서의 3D 뷰어 데이터에 익명 사용자 접근 허용
-- Created: 2025-12-24
-- ============================================================================

-- ============================================================================
-- 1. gcode_segment_data 테이블에 공유 보고서용 SELECT 정책 추가
-- ============================================================================

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

-- 인증된 사용자도 공유된 보고서의 세그먼트 데이터 조회 가능 (타인 보고서)
CREATE POLICY "Authenticated can view shared report segment data"
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

-- 기존 "Users can view own segment data" 정책 삭제 (위에서 통합)
DROP POLICY IF EXISTS "Users can view own segment data" ON public.gcode_segment_data;

-- ============================================================================
-- 2. Storage (gcode-segments) 공유 보고서용 읽기 정책 추가
-- ============================================================================

-- 익명 사용자가 공유된 보고서의 세그먼트 파일 다운로드 허용
CREATE POLICY "Public can read shared segment files"
  ON storage.objects FOR SELECT
  TO anon
  USING (
    bucket_id = 'gcode-segments' AND
    EXISTS (
      SELECT 1 FROM public.gcode_segment_data gsd
      JOIN public.shared_reports sr ON sr.report_id = gsd.report_id
      WHERE gsd.layers_storage_path = name
        AND sr.is_public = true
        AND (sr.expires_at IS NULL OR sr.expires_at > NOW())
    )
  );

-- 인증된 사용자도 공유된 보고서의 세그먼트 파일 다운로드 허용
-- 기존 정책과 병합 (자신의 파일 + 공유된 파일)
DROP POLICY IF EXISTS "Users can read own segment files" ON storage.objects;

CREATE POLICY "Users can read own and shared segment files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'gcode-segments' AND
    (
      -- 자신의 파일
      (storage.foldername(name))[1] = auth.uid()::text
      OR
      -- 공유된 보고서의 파일
      EXISTS (
        SELECT 1 FROM public.gcode_segment_data gsd
        JOIN public.shared_reports sr ON sr.report_id = gsd.report_id
        WHERE gsd.layers_storage_path = name
          AND sr.is_public = true
          AND (sr.expires_at IS NULL OR sr.expires_at > NOW())
      )
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON POLICY "Public can view shared report segment data" ON public.gcode_segment_data
  IS '공유된 보고서의 세그먼트 데이터 익명 조회 허용';
COMMENT ON POLICY "Public can read shared segment files" ON storage.objects
  IS '공유된 보고서의 세그먼트 파일 익명 다운로드 허용';
