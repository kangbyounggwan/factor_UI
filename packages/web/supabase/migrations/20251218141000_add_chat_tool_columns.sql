-- ============================================
-- AI 채팅 테이블 도구 관련 컬럼 추가
-- 프린터 문제 진단, G-code 분석, 3D 모델링 등 도구 정보 저장
-- ============================================

-- ============================================
-- chat_sessions 테이블 확장
-- ============================================

-- 세션에서 사용된 도구 타입
-- 'general': 일반 대화
-- 'troubleshoot': 프린터 문제 진단
-- 'gcode': G-code 분석
-- 'modeling': 3D 모델링
ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS tool_type VARCHAR(30) DEFAULT 'general';

-- 세션 메타데이터 (추가 정보 저장용)
ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ============================================
-- chat_messages 테이블 확장
-- ============================================

-- 메시지에 첨부된 이미지 URL들 (프린터 문제 진단용)
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS images TEXT[];

-- 메시지에 첨부된 파일 정보 (G-code 파일 등)
-- 예: [{"name": "test.gcode", "type": "gcode", "size": 12345}]
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS files JSONB;

-- 메시지 메타데이터 (AI 분석 결과, 도구별 추가 정보 등)
-- 예: {"tool": "troubleshoot", "detected_issues": [...], "solutions": [...]}
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ============================================
-- 인덱스 추가
-- ============================================

-- 도구 타입별 세션 조회
CREATE INDEX IF NOT EXISTS idx_chat_sessions_tool_type ON public.chat_sessions(tool_type);

-- ============================================
-- 코멘트 추가
-- ============================================

COMMENT ON COLUMN public.chat_sessions.tool_type IS '세션에서 사용된 도구 타입: general(일반), troubleshoot(프린터 진단), gcode(G-code 분석), modeling(3D 모델링)';
COMMENT ON COLUMN public.chat_sessions.metadata IS '세션 메타데이터 (JSON)';
COMMENT ON COLUMN public.chat_messages.images IS '메시지에 첨부된 이미지 URL 배열 (프린터 문제 진단용)';
COMMENT ON COLUMN public.chat_messages.files IS '메시지에 첨부된 파일 정보 (JSON 배열): [{name, type, size}]';
COMMENT ON COLUMN public.chat_messages.metadata IS '메시지 메타데이터: AI 분석 결과, 도구별 추가 정보 등';
