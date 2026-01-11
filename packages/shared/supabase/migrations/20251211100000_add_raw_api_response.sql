-- ============================================================================
-- Migration: Add raw_api_response column to gcode_analysis_reports table
-- Description: Store the complete API response for future data analysis
-- Created: 2025-12-11
-- ============================================================================

-- raw_api_response JSONB 컬럼 추가
-- 전체 API 응답 원본 저장 (final_summary, issues_found, patch_plan, timeline,
-- token_usage, comprehensive_summary, printing_info)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gcode_analysis_reports'
    AND column_name = 'raw_api_response'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.gcode_analysis_reports ADD COLUMN raw_api_response JSONB;
    COMMENT ON COLUMN public.gcode_analysis_reports.raw_api_response IS 'Complete API response from G-code analysis (final_summary, issues_found, patch_plan, timeline, token_usage, comprehensive_summary, printing_info)';
  END IF;
END $$;

-- ============================================================================
-- raw_api_response JSONB 예시 구조:
-- {
--   "final_summary": {
--     "overall_quality_score": 85,
--     "critical_issues": 0,
--     "total_issues_found": 3,
--     "summary": "...",
--     "recommendation": "...",
--     "expected_improvement": "..."
--   },
--   "issues_found": [...],
--   "patch_plan": [...],
--   "timeline": [...],
--   "token_usage": {...},
--   "comprehensive_summary": {
--     "file_name": "...",
--     "total_lines": 1224830,
--     "temperature": {...},
--     "feed_rate": {...},
--     "extrusion": {...},
--     "layer": {...},
--     "support": {...},
--     "fan": {...},
--     "print_time": {...}
--   },
--   "printing_info": {...}
-- }
-- ============================================================================
