-- ============================================================================
-- G-code 이슈별 수정 내역 저장 테이블
-- Migration: 20251211200000_gcode_issue_edits.sql
-- Description: 각 이슈에 대해 사용자가 수정한 G-code 라인 내역 저장
-- Created: 2025-12-11
-- ============================================================================

-- ============================================================================
-- gcode_issue_edits (이슈별 수정 내역)
-- 분석 보고서의 각 이슈에 대해 사용자가 수정한 내역을 저장
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.gcode_issue_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- =====================================
  -- 연결 정보
  -- =====================================
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.gcode_analysis_reports(id) ON DELETE CASCADE,

  -- 이슈 식별 (report의 detailed_issues 배열 내 인덱스)
  issue_index INTEGER NOT NULL,

  -- 이슈 정보 (스냅샷)
  issue_type TEXT NOT NULL,                    -- e.g., 'cold_extrusion'
  issue_line INTEGER,                          -- 원래 이슈가 발생한 라인 번호 (1-based)
  issue_line_index INTEGER,                    -- 원래 이슈가 발생한 라인 인덱스 (0-based)

  -- =====================================
  -- 수정 내역 (배열로 여러 라인 수정 가능)
  -- =====================================
  -- [{
  --   lineIndex: number,      // 수정된 라인 인덱스 (0-based)
  --   lineNumber: number,     // 수정된 라인 번호 (1-based)
  --   action: 'edit' | 'delete',
  --   originalContent: string,
  --   modifiedContent: string | null,  // delete인 경우 null
  --   editedAt: timestamp
  -- }]
  edits JSONB DEFAULT '[]',

  -- =====================================
  -- 상태
  -- =====================================
  -- pending: 수정 대기 (저장만 됨)
  -- applied: G-code 파일에 적용됨
  -- reverted: 되돌림
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'reverted')),

  -- 적용 시간
  applied_at TIMESTAMPTZ,

  -- =====================================
  -- 메모 (사용자가 남긴 수정 이유 등)
  -- =====================================
  note TEXT,

  -- =====================================
  -- 타임스탬프
  -- =====================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- UNIQUE CONSTRAINT (같은 보고서의 같은 이슈에 대해 하나의 수정 내역만)
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_gcode_issue_edits_unique
  ON public.gcode_issue_edits(report_id, issue_index);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_gcode_issue_edits_user_id
  ON public.gcode_issue_edits(user_id);
CREATE INDEX IF NOT EXISTS idx_gcode_issue_edits_report_id
  ON public.gcode_issue_edits(report_id);
CREATE INDEX IF NOT EXISTS idx_gcode_issue_edits_status
  ON public.gcode_issue_edits(status);
CREATE INDEX IF NOT EXISTS idx_gcode_issue_edits_created_at
  ON public.gcode_issue_edits(created_at DESC);

-- ============================================================================
-- RLS (Row Level Security) Policies
-- ============================================================================
ALTER TABLE public.gcode_issue_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own issue edits"
  ON public.gcode_issue_edits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own issue edits"
  ON public.gcode_issue_edits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own issue edits"
  ON public.gcode_issue_edits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own issue edits"
  ON public.gcode_issue_edits FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGER for updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_gcode_issue_edits_updated_at ON public.gcode_issue_edits;
CREATE TRIGGER update_gcode_issue_edits_updated_at
  BEFORE UPDATE ON public.gcode_issue_edits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.gcode_issue_edits IS 'G-code 분석 이슈별 사용자 수정 내역 - 이슈 카드별로 수정한 라인 기록';
COMMENT ON COLUMN public.gcode_issue_edits.issue_index IS '분석 보고서의 detailed_issues 배열 내 인덱스 (0-based)';
COMMENT ON COLUMN public.gcode_issue_edits.edits IS '수정 내역 배열: [{lineIndex, lineNumber, action, originalContent, modifiedContent, editedAt}]';
COMMENT ON COLUMN public.gcode_issue_edits.status IS '상태: pending(저장만), applied(파일적용), reverted(되돌림)';
