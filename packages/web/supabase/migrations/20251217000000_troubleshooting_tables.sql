-- =====================================================
-- AI Troubleshooting 대화 세션 및 메시지 테이블
-- 컨텍스트 윈도우를 고려한 설계
-- =====================================================

-- 1. 대화 세션 테이블
CREATE TABLE IF NOT EXISTS troubleshooting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 세션 제목 (첫 메시지 기반 자동 생성)
  title TEXT,

  -- 프린터 정보 (컨텍스트로 활용)
  printer_manufacturer TEXT,
  printer_series TEXT,
  printer_model_id TEXT,
  printer_model_name TEXT,  -- 표시용 모델명

  -- 세션 요약 (컨텍스트 압축용 - 나중에 AI가 생성)
  summary TEXT,
  summary_updated_at TIMESTAMPTZ,

  -- 세션 상태
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),
  resolved_issue TEXT,  -- 해결된 경우 문제 요약

  -- 통계
  message_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,  -- 세션 전체 토큰 수

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 대화 메시지 테이블
CREATE TABLE IF NOT EXISTS troubleshooting_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES troubleshooting_sessions(id) ON DELETE CASCADE,

  -- 메시지 정보
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- 토큰 관리 (컨텍스트 윈도우 계산용)
  token_count INTEGER DEFAULT 0,

  -- 이미지 관련
  has_images BOOLEAN DEFAULT FALSE,
  image_urls TEXT[],  -- Supabase Storage URLs
  image_analysis TEXT,  -- Vision API 분석 결과 (캐싱)

  -- 중요도 (나중에 컨텍스트 선택용)
  importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
  is_key_message BOOLEAN DEFAULT FALSE,  -- 핵심 정보 포함 여부

  -- 메타데이터
  metadata JSONB DEFAULT '{}',

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_troubleshooting_sessions_user_id
  ON troubleshooting_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_troubleshooting_sessions_status
  ON troubleshooting_sessions(status);

CREATE INDEX IF NOT EXISTS idx_troubleshooting_sessions_created_at
  ON troubleshooting_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_troubleshooting_messages_session_id
  ON troubleshooting_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_troubleshooting_messages_created_at
  ON troubleshooting_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_troubleshooting_messages_importance
  ON troubleshooting_messages(session_id, importance_score DESC);

-- 4. RLS (Row Level Security) 정책
ALTER TABLE troubleshooting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE troubleshooting_messages ENABLE ROW LEVEL SECURITY;

-- 세션: 본인 것만 접근 가능
CREATE POLICY "Users can view own sessions"
  ON troubleshooting_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON troubleshooting_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON troubleshooting_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON troubleshooting_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- 메시지: 본인 세션의 메시지만 접근 가능
CREATE POLICY "Users can view messages in own sessions"
  ON troubleshooting_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM troubleshooting_sessions
      WHERE id = troubleshooting_messages.session_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in own sessions"
  ON troubleshooting_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM troubleshooting_sessions
      WHERE id = troubleshooting_messages.session_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages in own sessions"
  ON troubleshooting_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM troubleshooting_sessions
      WHERE id = troubleshooting_messages.session_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in own sessions"
  ON troubleshooting_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM troubleshooting_sessions
      WHERE id = troubleshooting_messages.session_id
      AND user_id = auth.uid()
    )
  );

-- 5. 트리거: 메시지 추가 시 세션 통계 업데이트
CREATE OR REPLACE FUNCTION update_session_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE troubleshooting_sessions
  SET
    message_count = message_count + 1,
    total_tokens = total_tokens + COALESCE(NEW.token_count, 0),
    updated_at = NOW()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_stats
  AFTER INSERT ON troubleshooting_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_stats();

-- 6. 트리거: 세션 updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_session_updated_at
  BEFORE UPDATE ON troubleshooting_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_updated_at();

-- 7. 컨텍스트 윈도우용 함수: 최근 N개 메시지 + 중요 메시지 가져오기
CREATE OR REPLACE FUNCTION get_context_messages(
  p_session_id UUID,
  p_recent_count INTEGER DEFAULT 10,
  p_max_tokens INTEGER DEFAULT 4000
)
RETURNS TABLE (
  id UUID,
  role TEXT,
  content TEXT,
  token_count INTEGER,
  has_images BOOLEAN,
  image_analysis TEXT,
  importance_score FLOAT,
  is_key_message BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_total_tokens INTEGER := 0;
BEGIN
  -- 1. 최근 메시지 먼저 (최신순으로)
  RETURN QUERY
  WITH recent_messages AS (
    SELECT
      m.id, m.role, m.content, m.token_count,
      m.has_images, m.image_analysis,
      m.importance_score, m.is_key_message, m.created_at,
      1 as priority
    FROM troubleshooting_messages m
    WHERE m.session_id = p_session_id
    ORDER BY m.created_at DESC
    LIMIT p_recent_count
  ),
  -- 2. 핵심 메시지 (최근에 포함 안된 것)
  key_messages AS (
    SELECT
      m.id, m.role, m.content, m.token_count,
      m.has_images, m.image_analysis,
      m.importance_score, m.is_key_message, m.created_at,
      2 as priority
    FROM troubleshooting_messages m
    WHERE m.session_id = p_session_id
      AND m.is_key_message = TRUE
      AND m.id NOT IN (SELECT rm.id FROM recent_messages rm)
    ORDER BY m.importance_score DESC
    LIMIT 5
  ),
  -- 합치기
  all_messages AS (
    SELECT * FROM recent_messages
    UNION ALL
    SELECT * FROM key_messages
  )
  SELECT
    am.id, am.role, am.content, am.token_count,
    am.has_images, am.image_analysis,
    am.importance_score, am.is_key_message, am.created_at
  FROM all_messages am
  ORDER BY am.created_at ASC;  -- 시간순으로 정렬하여 반환
END;
$$ LANGUAGE plpgsql;

-- 8. 세션 요약 업데이트 함수 (나중에 AI 호출 후 사용)
CREATE OR REPLACE FUNCTION update_session_summary(
  p_session_id UUID,
  p_summary TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE troubleshooting_sessions
  SET
    summary = p_summary,
    summary_updated_at = NOW()
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE troubleshooting_sessions IS 'AI 트러블슈팅 대화 세션';
COMMENT ON TABLE troubleshooting_messages IS 'AI 트러블슈팅 대화 메시지';
COMMENT ON COLUMN troubleshooting_sessions.summary IS 'AI가 생성한 대화 요약 (컨텍스트 압축용)';
COMMENT ON COLUMN troubleshooting_messages.token_count IS 'LLM 토큰 수 (컨텍스트 윈도우 관리용)';
COMMENT ON COLUMN troubleshooting_messages.importance_score IS '메시지 중요도 0~1 (컨텍스트 선택용)';
COMMENT ON COLUMN troubleshooting_messages.is_key_message IS '핵심 정보 포함 여부 (항상 컨텍스트에 포함)';
