-- 푸시 알림용 사용자 디바이스 토큰 테이블
CREATE TABLE IF NOT EXISTS user_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  device_name TEXT,
  device_model TEXT,
  app_version TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now(),

  -- 동일한 사용자와 디바이스 토큰 조합은 유일해야 함
  UNIQUE(user_id, device_token)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_id ON user_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_device_token ON user_device_tokens(device_token);
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_is_active ON user_device_tokens(is_active);

-- RLS 활성화
ALTER TABLE user_device_tokens ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 디바이스 토큰만 조회 가능
CREATE POLICY "Users can view their own device tokens"
  ON user_device_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 정책: 사용자는 자신의 디바이스 토큰 추가 가능
CREATE POLICY "Users can insert their own device tokens"
  ON user_device_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS 정책: 사용자는 자신의 디바이스 토큰 업데이트 가능
CREATE POLICY "Users can update their own device tokens"
  ON user_device_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS 정책: 사용자는 자신의 디바이스 토큰 삭제 가능
CREATE POLICY "Users can delete their own device tokens"
  ON user_device_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_user_device_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_device_tokens_updated_at
  BEFORE UPDATE ON user_device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_user_device_tokens_updated_at();

-- 비활성 토큰 자동 정리 함수 (선택사항)
-- 90일 이상 사용하지 않은 토큰은 비활성화
CREATE OR REPLACE FUNCTION cleanup_inactive_device_tokens()
RETURNS void AS $$
BEGIN
  UPDATE user_device_tokens
  SET is_active = false
  WHERE last_used_at < now() - INTERVAL '90 days'
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 주석 추가
COMMENT ON TABLE user_device_tokens IS '푸시 알림을 위한 사용자 디바이스 FCM 토큰';
COMMENT ON COLUMN user_device_tokens.device_token IS 'Firebase Cloud Messaging (FCM) 디바이스 토큰';
COMMENT ON COLUMN user_device_tokens.platform IS '디바이스 플랫폼 (android, ios, web)';
COMMENT ON COLUMN user_device_tokens.is_active IS '토큰 활성화 상태 (false인 경우 푸시 알림 전송 안 함)';
COMMENT ON COLUMN user_device_tokens.last_used_at IS '토큰이 마지막으로 사용된 시간 (앱 실행 시 업데이트)';
