-- 공유된 채팅 테이블
CREATE TABLE IF NOT EXISTS shared_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id VARCHAR(12) UNIQUE NOT NULL, -- 짧은 공유 ID (URL용)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  messages JSONB NOT NULL, -- 선택된 메시지들 [{role, content, timestamp, images?, files?}]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- 만료일 (NULL이면 영구)
  view_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true
);

-- 인덱스
CREATE INDEX idx_shared_chats_share_id ON shared_chats(share_id);
CREATE INDEX idx_shared_chats_user_id ON shared_chats(user_id);
CREATE INDEX idx_shared_chats_created_at ON shared_chats(created_at DESC);

-- RLS 활성화
ALTER TABLE shared_chats ENABLE ROW LEVEL SECURITY;

-- 정책: 누구나 공개된 공유 채팅 조회 가능
CREATE POLICY "Anyone can view public shared chats"
  ON shared_chats FOR SELECT
  USING (is_public = true);

-- 정책: 본인의 공유 채팅 관리
CREATE POLICY "Users can manage own shared chats"
  ON shared_chats FOR ALL
  USING (auth.uid() = user_id);

-- 조회수 증가 함수
CREATE OR REPLACE FUNCTION increment_share_view_count(p_share_id VARCHAR)
RETURNS void AS $$
BEGIN
  UPDATE shared_chats
  SET view_count = view_count + 1
  WHERE share_id = p_share_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
