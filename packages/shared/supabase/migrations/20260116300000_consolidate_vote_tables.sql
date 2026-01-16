-- ============================================================================
-- 투표 테이블 통합 마이그레이션
-- 6개 테이블 → 2개 테이블로 통합
--
-- 기존 테이블:
--   - community_post_likes, community_post_dislikes, community_post_helpful
--   - community_comment_likes, community_comment_dislikes, community_comment_helpful
--
-- 새 테이블:
--   - community_post_votes (vote_type: 'like' | 'dislike' | 'helpful')
--   - community_comment_votes (vote_type: 'like' | 'dislike' | 'helpful')
-- ============================================================================

-- 투표 타입 ENUM 생성
DO $$ BEGIN
  CREATE TYPE vote_type AS ENUM ('like', 'dislike', 'helpful');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 1. 게시물 투표 통합 테이블 생성
-- ============================================================================
CREATE TABLE IF NOT EXISTS community_post_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type vote_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- 같은 사용자가 같은 게시물에 같은 타입의 투표는 한 번만 가능
  UNIQUE(post_id, user_id, vote_type)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_community_post_votes_post_id ON community_post_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_votes_user_id ON community_post_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_community_post_votes_type ON community_post_votes(vote_type);

-- RLS 활성화
ALTER TABLE community_post_votes ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Anyone can view post votes" ON community_post_votes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage their post votes" ON community_post_votes
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 2. 댓글 투표 통합 테이블 생성
-- ============================================================================
CREATE TABLE IF NOT EXISTS community_comment_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES community_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type vote_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- 같은 사용자가 같은 댓글에 같은 타입의 투표는 한 번만 가능
  UNIQUE(comment_id, user_id, vote_type)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_community_comment_votes_comment_id ON community_comment_votes(comment_id);
CREATE INDEX IF NOT EXISTS idx_community_comment_votes_user_id ON community_comment_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_community_comment_votes_type ON community_comment_votes(vote_type);

-- RLS 활성화
ALTER TABLE community_comment_votes ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Anyone can view comment votes" ON community_comment_votes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage their comment votes" ON community_comment_votes
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 3. 기존 데이터 마이그레이션
-- ============================================================================

-- 게시물 좋아요 마이그레이션
INSERT INTO community_post_votes (post_id, user_id, vote_type, created_at)
SELECT post_id, user_id, 'like'::vote_type, created_at
FROM community_post_likes
ON CONFLICT (post_id, user_id, vote_type) DO NOTHING;

-- 게시물 비추천 마이그레이션
INSERT INTO community_post_votes (post_id, user_id, vote_type, created_at)
SELECT post_id, user_id, 'dislike'::vote_type, created_at
FROM community_post_dislikes
ON CONFLICT (post_id, user_id, vote_type) DO NOTHING;

-- 게시물 유용함 마이그레이션
INSERT INTO community_post_votes (post_id, user_id, vote_type, created_at)
SELECT post_id, user_id, 'helpful'::vote_type, created_at
FROM community_post_helpful
ON CONFLICT (post_id, user_id, vote_type) DO NOTHING;

-- 댓글 좋아요 마이그레이션
INSERT INTO community_comment_votes (comment_id, user_id, vote_type, created_at)
SELECT comment_id, user_id, 'like'::vote_type, created_at
FROM community_comment_likes
ON CONFLICT (comment_id, user_id, vote_type) DO NOTHING;

-- 댓글 비추천 마이그레이션
INSERT INTO community_comment_votes (comment_id, user_id, vote_type, created_at)
SELECT comment_id, user_id, 'dislike'::vote_type, created_at
FROM community_comment_dislikes
ON CONFLICT (comment_id, user_id, vote_type) DO NOTHING;

-- 댓글 유용함 마이그레이션
INSERT INTO community_comment_votes (comment_id, user_id, vote_type, created_at)
SELECT comment_id, user_id, 'helpful'::vote_type, created_at
FROM community_comment_helpful
ON CONFLICT (comment_id, user_id, vote_type) DO NOTHING;

-- ============================================================================
-- 4. 기존 테이블 삭제 (데이터 마이그레이션 완료 후)
-- ============================================================================
DROP TABLE IF EXISTS community_post_likes CASCADE;
DROP TABLE IF EXISTS community_post_dislikes CASCADE;
DROP TABLE IF EXISTS community_post_helpful CASCADE;
DROP TABLE IF EXISTS community_comment_likes CASCADE;
DROP TABLE IF EXISTS community_comment_dislikes CASCADE;
DROP TABLE IF EXISTS community_comment_helpful CASCADE;

-- ============================================================================
-- 완료 메시지
-- ============================================================================
-- 마이그레이션 완료:
-- - 6개 테이블 → 2개 테이블로 통합
-- - 기존 데이터 모두 마이그레이션 완료
-- - 기존 테이블 삭제 완료
