-- ============================================
-- AI 채팅 테이블 생성
-- chat_sessions: 채팅 세션 (대화 목록)
-- chat_messages: 채팅 메시지
-- ============================================

-- ============================================
-- chat_sessions 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT '새 대화',
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- chat_messages 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 코멘트 추가
-- ============================================
COMMENT ON TABLE public.chat_sessions IS 'AI 채팅 세션 (대화 목록)';
COMMENT ON COLUMN public.chat_sessions.id IS '세션 고유 ID';
COMMENT ON COLUMN public.chat_sessions.user_id IS '사용자 ID';
COMMENT ON COLUMN public.chat_sessions.title IS '세션 제목 (첫 메시지 기반)';
COMMENT ON COLUMN public.chat_sessions.message_count IS '메시지 개수';
COMMENT ON COLUMN public.chat_sessions.created_at IS '생성 시간';
COMMENT ON COLUMN public.chat_sessions.updated_at IS '수정 시간';
COMMENT ON COLUMN public.chat_sessions.last_message_at IS '마지막 메시지 시간';

COMMENT ON TABLE public.chat_messages IS 'AI 채팅 메시지';
COMMENT ON COLUMN public.chat_messages.id IS '메시지 고유 ID';
COMMENT ON COLUMN public.chat_messages.session_id IS '세션 ID';
COMMENT ON COLUMN public.chat_messages.user_id IS '사용자 ID';
COMMENT ON COLUMN public.chat_messages.type IS '메시지 타입: user(사용자), assistant(AI)';
COMMENT ON COLUMN public.chat_messages.content IS '메시지 내용';
COMMENT ON COLUMN public.chat_messages.created_at IS '생성 시간';
