-- Add Dislike System Migration
-- 추천/비추천 시스템 추가 (루리웹 스타일)

-- 게시물 비추천 테이블
CREATE TABLE IF NOT EXISTS community_post_dislikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- 댓글 비추천 테이블
CREATE TABLE IF NOT EXISTS community_comment_dislikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES community_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- 게시물에 비추천 카운트 컬럼 추가
ALTER TABLE community_posts
ADD COLUMN IF NOT EXISTS dislike_count INTEGER DEFAULT 0;

-- 댓글에 비추천 카운트 컬럼 추가
ALTER TABLE community_comments
ADD COLUMN IF NOT EXISTS dislike_count INTEGER DEFAULT 0;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_community_post_dislikes_post_id ON community_post_dislikes(post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_dislikes_user_id ON community_post_dislikes(user_id);
CREATE INDEX IF NOT EXISTS idx_community_comment_dislikes_comment_id ON community_comment_dislikes(comment_id);
CREATE INDEX IF NOT EXISTS idx_community_comment_dislikes_user_id ON community_comment_dislikes(user_id);

-- RLS 정책 설정
ALTER TABLE community_post_dislikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comment_dislikes ENABLE ROW LEVEL SECURITY;

-- 게시물 비추천 정책
CREATE POLICY "Anyone can view post dislikes" ON community_post_dislikes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage their dislikes" ON community_post_dislikes
  FOR ALL USING (auth.uid() = user_id);

-- 댓글 비추천 정책
CREATE POLICY "Anyone can view comment dislikes" ON community_comment_dislikes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage their comment dislikes" ON community_comment_dislikes
  FOR ALL USING (auth.uid() = user_id);
