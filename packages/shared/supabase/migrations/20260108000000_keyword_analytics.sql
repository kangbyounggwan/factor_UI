-- ============================================
-- 키워드 분석 테이블 및 관련 함수
-- 관리자 AI 분석 대시보드용
-- ============================================

-- 1. 키워드 분석 테이블
CREATE TABLE IF NOT EXISTS keyword_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('chat', 'troubleshoot', 'model_prompt', 'gcode')),
  count INTEGER DEFAULT 1,
  period_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(keyword, source_type, period_date)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_keyword_analytics_period ON keyword_analytics(period_date DESC);
CREATE INDEX IF NOT EXISTS idx_keyword_analytics_keyword ON keyword_analytics(keyword);
CREATE INDEX IF NOT EXISTS idx_keyword_analytics_source ON keyword_analytics(source_type);
CREATE INDEX IF NOT EXISTS idx_keyword_analytics_count ON keyword_analytics(count DESC);

-- RLS 활성화
ALTER TABLE keyword_analytics ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 관리자만 접근 가능
CREATE POLICY "Admins can view keyword analytics"
  ON keyword_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage keyword analytics"
  ON keyword_analytics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 2. AI 분석 통계 뷰 (관리자 대시보드용)
CREATE OR REPLACE VIEW admin_ai_stats AS
SELECT
  -- 채팅 통계
  (SELECT COUNT(*) FROM chat_sessions) as total_chat_sessions,
  (SELECT COUNT(*) FROM chat_messages) as total_chat_messages,
  (SELECT COUNT(*) FROM chat_sessions WHERE created_at > NOW() - INTERVAL '7 days') as chat_sessions_last_week,
  (SELECT COUNT(*) FROM chat_sessions WHERE created_at > NOW() - INTERVAL '30 days') as chat_sessions_last_month,

  -- 트러블슈팅 통계
  (SELECT COUNT(*) FROM troubleshooting_sessions) as total_troubleshoot_sessions,
  (SELECT COUNT(*) FROM troubleshooting_messages) as total_troubleshoot_messages,
  (SELECT COUNT(*) FROM troubleshooting_sessions WHERE status = 'resolved') as resolved_troubleshoot_sessions,

  -- AI 모델 생성 통계
  (SELECT COUNT(*) FROM ai_generated_models) as total_ai_models,
  (SELECT COUNT(*) FROM ai_generated_models WHERE generation_type = 'text_to_3d') as text_to_3d_count,
  (SELECT COUNT(*) FROM ai_generated_models WHERE generation_type = 'image_to_3d') as image_to_3d_count,
  (SELECT COUNT(*) FROM ai_generated_models WHERE generation_type = 'text_to_image') as text_to_image_count,
  (SELECT COUNT(*) FROM ai_generated_models WHERE created_at > NOW() - INTERVAL '7 days') as ai_models_last_week,

  -- G-code 분석 통계
  (SELECT COUNT(*) FROM gcode_analysis_reports) as total_gcode_reports,
  (SELECT AVG(overall_score) FROM gcode_analysis_reports WHERE overall_score IS NOT NULL) as avg_gcode_score,

  -- 사용량 통계
  (SELECT COALESCE(SUM(ai_model_generation), 0) FROM user_usage) as total_model_generations,
  (SELECT COALESCE(SUM(ai_image_generation), 0) FROM user_usage) as total_image_generations;

-- 3. 도구별 사용량 집계 함수
CREATE OR REPLACE FUNCTION get_tool_usage_stats(p_days INTEGER DEFAULT 30)
RETURNS TABLE(
  tool_type TEXT,
  session_count BIGINT,
  message_count BIGINT,
  avg_messages_per_session NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.tool_type::TEXT,
    COUNT(DISTINCT cs.id) as session_count,
    COUNT(cm.id) as message_count,
    ROUND(COUNT(cm.id)::NUMERIC / NULLIF(COUNT(DISTINCT cs.id), 0), 2) as avg_messages_per_session
  FROM chat_sessions cs
  LEFT JOIN chat_messages cm ON cm.session_id = cs.id
  WHERE cs.created_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY cs.tool_type
  ORDER BY session_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 일별 AI 사용량 추이 함수
CREATE OR REPLACE FUNCTION get_daily_ai_usage(p_days INTEGER DEFAULT 30)
RETURNS TABLE(
  date DATE,
  chat_sessions BIGINT,
  chat_messages BIGINT,
  troubleshoot_sessions BIGINT,
  model_generations BIGINT,
  gcode_analyses BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - (p_days - 1),
      CURRENT_DATE,
      '1 day'::INTERVAL
    )::DATE as date
  )
  SELECT
    ds.date,
    COALESCE((SELECT COUNT(*) FROM chat_sessions WHERE DATE(created_at) = ds.date), 0) as chat_sessions,
    COALESCE((SELECT COUNT(*) FROM chat_messages WHERE DATE(created_at) = ds.date), 0) as chat_messages,
    COALESCE((SELECT COUNT(*) FROM troubleshooting_sessions WHERE DATE(created_at) = ds.date), 0) as troubleshoot_sessions,
    COALESCE((SELECT COUNT(*) FROM ai_generated_models WHERE DATE(created_at) = ds.date), 0) as model_generations,
    COALESCE((SELECT COUNT(*) FROM gcode_analysis_reports WHERE DATE(created_at) = ds.date), 0) as gcode_analyses
  FROM date_series ds
  ORDER BY ds.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 키워드 추출 및 저장 함수 (채팅 메시지용)
CREATE OR REPLACE FUNCTION extract_keywords_from_messages(p_days INTEGER DEFAULT 1)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- 채팅 메시지에서 키워드 추출
  INSERT INTO keyword_analytics (keyword, source_type, count, period_date)
  SELECT
    word as keyword,
    'chat' as source_type,
    COUNT(*) as count,
    CURRENT_DATE as period_date
  FROM (
    SELECT unnest(
      regexp_split_to_array(
        lower(regexp_replace(content, '[^\uAC00-\uD7A3a-z0-9\s]', '', 'g')),
        '\s+'
      )
    ) as word
    FROM chat_messages
    WHERE type = 'user'
      AND created_at > NOW() - (p_days || ' days')::INTERVAL
  ) words
  WHERE length(word) > 1
  GROUP BY word
  HAVING COUNT(*) >= 2
  ON CONFLICT (keyword, source_type, period_date)
  DO UPDATE SET
    count = keyword_analytics.count + EXCLUDED.count,
    updated_at = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- 트러블슈팅 메시지에서 키워드 추출
  INSERT INTO keyword_analytics (keyword, source_type, count, period_date)
  SELECT
    word as keyword,
    'troubleshoot' as source_type,
    COUNT(*) as count,
    CURRENT_DATE as period_date
  FROM (
    SELECT unnest(
      regexp_split_to_array(
        lower(regexp_replace(content, '[^\uAC00-\uD7A3a-z0-9\s]', '', 'g')),
        '\s+'
      )
    ) as word
    FROM troubleshooting_messages
    WHERE role = 'user'
      AND created_at > NOW() - (p_days || ' days')::INTERVAL
  ) words
  WHERE length(word) > 1
  GROUP BY word
  HAVING COUNT(*) >= 2
  ON CONFLICT (keyword, source_type, period_date)
  DO UPDATE SET
    count = keyword_analytics.count + EXCLUDED.count,
    updated_at = NOW();

  -- AI 모델 프롬프트에서 키워드 추출
  INSERT INTO keyword_analytics (keyword, source_type, count, period_date)
  SELECT
    word as keyword,
    'model_prompt' as source_type,
    COUNT(*) as count,
    CURRENT_DATE as period_date
  FROM (
    SELECT unnest(
      regexp_split_to_array(
        lower(regexp_replace(prompt, '[^\uAC00-\uD7A3a-z0-9\s]', '', 'g')),
        '\s+'
      )
    ) as word
    FROM ai_generated_models
    WHERE prompt IS NOT NULL
      AND created_at > NOW() - (p_days || ' days')::INTERVAL
  ) words
  WHERE length(word) > 1
  GROUP BY word
  HAVING COUNT(*) >= 2
  ON CONFLICT (keyword, source_type, period_date)
  DO UPDATE SET
    count = keyword_analytics.count + EXCLUDED.count,
    updated_at = NOW();

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 키워드 조회 함수 (클라우드 워드용)
CREATE OR REPLACE FUNCTION get_keyword_cloud(
  p_source_type TEXT DEFAULT NULL,
  p_days INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
  keyword TEXT,
  count BIGINT,
  source_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ka.keyword,
    SUM(ka.count)::BIGINT as count,
    ka.source_type::TEXT
  FROM keyword_analytics ka
  WHERE ka.period_date > CURRENT_DATE - p_days
    AND (p_source_type IS NULL OR ka.source_type = p_source_type)
    AND ka.keyword NOT IN ('the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
                           'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
                           'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for',
                           'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
                           'before', 'after', 'above', 'below', 'between', 'under', 'again',
                           'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
                           'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
                           'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
                           'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
                           '이', '그', '저', '것', '수', '등', '때', '중', '및', '내', '더', '잘')
  GROUP BY ka.keyword, ka.source_type
  ORDER BY count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 모델 생성 통계 함수
CREATE OR REPLACE FUNCTION get_model_generation_stats(p_days INTEGER DEFAULT 30)
RETURNS TABLE(
  generation_type TEXT,
  total_count BIGINT,
  success_count BIGINT,
  failed_count BIGINT,
  avg_file_size BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    agm.generation_type::TEXT,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE status = 'completed') as success_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    COALESCE(AVG(file_size) FILTER (WHERE status = 'completed'), 0)::BIGINT as avg_file_size
  FROM ai_generated_models agm
  WHERE agm.created_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY agm.generation_type
  ORDER BY total_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 사용자별 AI 사용량 TOP N 함수
CREATE OR REPLACE FUNCTION get_top_ai_users(p_limit INTEGER DEFAULT 10)
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  display_name TEXT,
  total_chat_sessions BIGINT,
  total_models_generated BIGINT,
  total_gcode_analyses BIGINT,
  total_activity BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.user_id,
    p.email,
    p.display_name,
    COALESCE(cs.session_count, 0) as total_chat_sessions,
    COALESCE(agm.model_count, 0) as total_models_generated,
    COALESCE(gar.report_count, 0) as total_gcode_analyses,
    COALESCE(cs.session_count, 0) + COALESCE(agm.model_count, 0) + COALESCE(gar.report_count, 0) as total_activity
  FROM profiles p
  LEFT JOIN (
    SELECT user_id, COUNT(*) as session_count
    FROM chat_sessions
    GROUP BY user_id
  ) cs ON cs.user_id = p.user_id
  LEFT JOIN (
    SELECT user_id, COUNT(*) as model_count
    FROM ai_generated_models
    GROUP BY user_id
  ) agm ON agm.user_id = p.user_id
  LEFT JOIN (
    SELECT user_id, COUNT(*) as report_count
    FROM gcode_analysis_reports
    GROUP BY user_id
  ) gar ON gar.user_id = p.user_id
  ORDER BY total_activity DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 인기 프롬프트 조회 함수
CREATE OR REPLACE FUNCTION get_popular_prompts(
  p_generation_type TEXT DEFAULT NULL,
  p_days INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  prompt TEXT,
  generation_type TEXT,
  usage_count BIGINT,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    agm.prompt,
    agm.generation_type::TEXT,
    COUNT(*) as usage_count,
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'completed'))::NUMERIC / NULLIF(COUNT(*), 0) * 100,
      1
    ) as success_rate
  FROM ai_generated_models agm
  WHERE agm.prompt IS NOT NULL
    AND agm.created_at > NOW() - (p_days || ' days')::INTERVAL
    AND (p_generation_type IS NULL OR agm.generation_type = p_generation_type)
  GROUP BY agm.prompt, agm.generation_type
  HAVING COUNT(*) >= 2
  ORDER BY usage_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. updated_at 트리거
CREATE OR REPLACE FUNCTION update_keyword_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_keyword_analytics_updated_at
  BEFORE UPDATE ON keyword_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_keyword_analytics_updated_at();

-- 완료 메시지
COMMENT ON TABLE keyword_analytics IS '키워드 분석 테이블 - 관리자 AI 분석 대시보드용';
COMMENT ON FUNCTION get_keyword_cloud IS '클라우드 워드용 키워드 조회';
COMMENT ON FUNCTION get_daily_ai_usage IS '일별 AI 사용량 추이';
COMMENT ON FUNCTION get_tool_usage_stats IS '도구별 사용량 통계';
COMMENT ON FUNCTION get_model_generation_stats IS '모델 생성 통계';
COMMENT ON FUNCTION get_top_ai_users IS '상위 AI 사용자 목록';
