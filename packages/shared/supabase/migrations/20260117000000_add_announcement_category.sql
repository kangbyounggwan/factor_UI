-- Add announcement category to community_posts
-- 커뮤니티 게시물에 공지사항 카테고리 추가

-- 기존 CHECK constraint 삭제 후 새로운 constraint 추가
ALTER TABLE community_posts
DROP CONSTRAINT IF EXISTS community_posts_category_check;

ALTER TABLE community_posts
ADD CONSTRAINT community_posts_category_check
CHECK (category IN ('announcement', 'showcase', 'question', 'tip', 'review', 'free', 'troubleshooting'));

-- 공지사항 카테고리 인덱스 추가 (announcement 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_community_posts_announcement
ON community_posts(created_at DESC)
WHERE category = 'announcement';
