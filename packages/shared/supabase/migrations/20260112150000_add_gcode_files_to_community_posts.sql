-- ============================================================================
-- Community Posts G-code Segment Data Migration
-- 기존 gcode_segment_data 테이블에 post_id 컬럼 추가
-- 커뮤니티 게시물도 동일한 세그먼트 저장 방식 사용
-- Created: 2026-01-12
-- ============================================================================

-- gcode_segment_data에 post_id 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'gcode_segment_data'
    AND column_name = 'post_id'
  ) THEN
    ALTER TABLE public.gcode_segment_data
    ADD COLUMN post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE;

    COMMENT ON COLUMN public.gcode_segment_data.post_id IS
      '커뮤니티 게시물 ID (게시물에 첨부된 G-code 세그먼트용)';
  END IF;
END $$;

-- gcode_segment_data에 gcode_embed_id 컬럼 추가 (게시물 내 여러 G-code 구분용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'gcode_segment_data'
    AND column_name = 'gcode_embed_id'
  ) THEN
    ALTER TABLE public.gcode_segment_data
    ADD COLUMN gcode_embed_id TEXT;

    COMMENT ON COLUMN public.gcode_segment_data.gcode_embed_id IS
      '게시물 내 G-code 임베드 고유 ID (예: gcode_1736693400000_abc123)';
  END IF;
END $$;

-- post_id 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_gcode_segment_data_post_id
  ON public.gcode_segment_data(post_id);

-- gcode_embed_id 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_gcode_segment_data_embed_id
  ON public.gcode_segment_data(gcode_embed_id);

-- 복합 인덱스 (post_id + gcode_embed_id)
CREATE INDEX IF NOT EXISTS idx_gcode_segment_data_post_embed
  ON public.gcode_segment_data(post_id, gcode_embed_id);

-- RLS 정책 업데이트: 게시물 작성자도 세그먼트 데이터 접근 가능
-- (기존 정책은 user_id 기준이므로 추가 정책 필요 없음)
