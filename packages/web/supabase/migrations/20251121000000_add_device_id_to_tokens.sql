-- user_device_tokens 테이블에 device_id 및 관련 필드 추가
-- Phase 2.1 Push Notification 리팩토링

-- 1. device_id 컬럼 추가
ALTER TABLE user_device_tokens
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- 2. push_enabled 컬럼 추가 (디바이스별 푸시 알림 ON/OFF)
ALTER TABLE user_device_tokens
ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT true;

-- 3. last_seen_at 컬럼 추가 (last_used_at 대신)
ALTER TABLE user_device_tokens
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();

-- 4. 기존 레코드에 device_id 생성 (device_token 기반으로 고유 ID 생성)
UPDATE user_device_tokens
SET device_id = md5(device_token || user_id::text)
WHERE device_id IS NULL;

-- 5. device_id를 NOT NULL로 변경
ALTER TABLE user_device_tokens
ALTER COLUMN device_id SET NOT NULL;

-- 6. 기존 UNIQUE 제약 조건 삭제
ALTER TABLE user_device_tokens
DROP CONSTRAINT IF EXISTS user_device_tokens_user_id_device_token_key;

-- 7. 새로운 UNIQUE 제약 조건 추가 (user_id, device_id)
ALTER TABLE user_device_tokens
ADD CONSTRAINT user_device_tokens_user_id_device_id_key UNIQUE (user_id, device_id);

-- 8. device_id 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_device_id
  ON user_device_tokens(device_id);

-- 9. push_enabled 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_push_enabled
  ON user_device_tokens(push_enabled);

-- 10. 기존 is_active 인덱스 삭제 (중복)
DROP INDEX IF EXISTS idx_user_device_tokens_is_active;

-- 11. is_active 컬럼 제거 (push_enabled로 대체)
ALTER TABLE user_device_tokens
DROP COLUMN IF EXISTS is_active;

-- 12. last_used_at 컬럼 제거 (last_seen_at로 대체)
ALTER TABLE user_device_tokens
DROP COLUMN IF EXISTS last_used_at;

-- 13. 코멘트 업데이트
COMMENT ON COLUMN user_device_tokens.device_id IS '디바이스 고유 식별자 (Capacitor Preferences에서 생성/관리)';
COMMENT ON COLUMN user_device_tokens.push_enabled IS '디바이스별 푸시 알림 활성화 여부 (사용자가 디바이스별로 제어 가능)';
COMMENT ON COLUMN user_device_tokens.last_seen_at IS '디바이스가 마지막으로 활성화된 시간';
