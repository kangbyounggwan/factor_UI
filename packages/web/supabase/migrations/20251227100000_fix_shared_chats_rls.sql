-- ============================================
-- shared_chats 테이블 RLS 정책 수정
-- 로그인한 사용자가 공유 채팅을 생성할 수 있도록 허용
-- ============================================

-- 기존 정책 삭제 (있으면)
DROP POLICY IF EXISTS "Users can manage own shared chats" ON shared_chats;
DROP POLICY IF EXISTS "Anyone can view public shared chats" ON shared_chats;
DROP POLICY IF EXISTS "Authenticated users can create shared chats" ON shared_chats;

-- 정책 1: 누구나 공개된 공유 채팅 조회 가능
CREATE POLICY "Anyone can view public shared chats"
  ON shared_chats FOR SELECT
  USING (is_public = true);

-- 정책 2: 로그인한 사용자는 공유 채팅 생성 가능
CREATE POLICY "Authenticated users can create shared chats"
  ON shared_chats FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 정책 3: 본인의 공유 채팅만 수정/삭제 가능
CREATE POLICY "Users can update own shared chats"
  ON shared_chats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shared chats"
  ON shared_chats FOR DELETE
  USING (auth.uid() = user_id);
