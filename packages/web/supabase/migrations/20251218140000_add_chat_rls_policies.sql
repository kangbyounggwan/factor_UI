-- ============================================
-- AI 채팅 테이블 RLS 정책 추가
-- chat_sessions, chat_messages 테이블에 RLS 설정
-- ============================================

-- chat_sessions RLS 활성화
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- chat_messages RLS 활성화
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- chat_sessions 정책
-- ============================================

-- 사용자는 자신의 세션만 조회 가능
CREATE POLICY "Users can view own sessions"
ON public.chat_sessions FOR SELECT
USING (auth.uid() = user_id);

-- 사용자는 자신의 세션만 생성 가능
CREATE POLICY "Users can create own sessions"
ON public.chat_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 세션만 수정 가능
CREATE POLICY "Users can update own sessions"
ON public.chat_sessions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 세션만 삭제 가능
CREATE POLICY "Users can delete own sessions"
ON public.chat_sessions FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- chat_messages 정책
-- ============================================

-- 사용자는 자신의 메시지만 조회 가능
CREATE POLICY "Users can view own messages"
ON public.chat_messages FOR SELECT
USING (auth.uid() = user_id);

-- 사용자는 자신의 메시지만 생성 가능
CREATE POLICY "Users can create own messages"
ON public.chat_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 메시지만 삭제 가능
CREATE POLICY "Users can delete own messages"
ON public.chat_messages FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 인덱스 추가 (성능 최적화)
-- ============================================

-- chat_sessions 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message_at ON public.chat_sessions(last_message_at DESC);

-- chat_messages 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);
