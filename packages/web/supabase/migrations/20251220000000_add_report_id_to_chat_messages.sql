-- ============================================
-- chat_messages 테이블에 reportId 컬럼 추가
-- G-code 분석 보고서와 메시지 연결
-- ============================================

-- reportId 컬럼 추가 (gcode_analysis_reports 테이블 참조)
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS "reportId" UUID REFERENCES public.gcode_analysis_reports(id) ON DELETE SET NULL;

-- 인덱스 추가 (보고서 ID로 메시지 조회)
CREATE INDEX IF NOT EXISTS idx_chat_messages_reportId ON public.chat_messages("reportId");

-- 코멘트 추가
COMMENT ON COLUMN public.chat_messages."reportId" IS 'G-code 분석 보고서 ID (gcode_analysis_reports 참조)';
