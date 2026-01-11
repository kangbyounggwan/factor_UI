-- 공유된 분석 보고서 테이블
CREATE TABLE IF NOT EXISTS shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id VARCHAR(12) UNIQUE NOT NULL, -- 짧은 공유 ID (URL용)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID REFERENCES gcode_analysis_reports(id) ON DELETE CASCADE,
  title VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- 만료일 (NULL이면 영구)
  view_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true
);

-- 인덱스
CREATE INDEX idx_shared_reports_share_id ON shared_reports(share_id);
CREATE INDEX idx_shared_reports_user_id ON shared_reports(user_id);
CREATE INDEX idx_shared_reports_report_id ON shared_reports(report_id);
CREATE INDEX idx_shared_reports_created_at ON shared_reports(created_at DESC);

-- RLS 활성화
ALTER TABLE shared_reports ENABLE ROW LEVEL SECURITY;

-- 정책: 누구나 공개된 공유 보고서 조회 가능
CREATE POLICY "Anyone can view public shared reports"
  ON shared_reports FOR SELECT
  USING (is_public = true);

-- 정책: 본인의 공유 보고서 관리
CREATE POLICY "Users can manage own shared reports"
  ON shared_reports FOR ALL
  USING (auth.uid() = user_id);

-- 조회수 증가 함수
CREATE OR REPLACE FUNCTION increment_report_share_view_count(p_share_id VARCHAR)
RETURNS void AS $$
BEGIN
  UPDATE shared_reports
  SET view_count = view_count + 1
  WHERE share_id = p_share_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 공유 보고서의 원본 데이터 조회 권한 (RLS 우회용)
-- gcode_analysis_reports에 공개 조회 정책 추가
CREATE POLICY "Anyone can view shared reports data"
  ON gcode_analysis_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shared_reports sr
      WHERE sr.report_id = gcode_analysis_reports.id
      AND sr.is_public = true
    )
  );
