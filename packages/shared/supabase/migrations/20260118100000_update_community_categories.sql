-- Update community categories: Remove tip/review, Add failure
-- 커뮤니티 카테고리 변경: 팁/리뷰 제거, 실패 추가

-- 기존 tip, review 카테고리 게시물을 free로 이동
UPDATE community_posts
SET category = 'free'
WHERE category IN ('tip', 'review');

-- 기존 CHECK constraint 삭제 후 새로운 constraint 추가
ALTER TABLE community_posts
DROP CONSTRAINT IF EXISTS community_posts_category_check;

ALTER TABLE community_posts
ADD CONSTRAINT community_posts_category_check
CHECK (category IN ('announcement', 'showcase', 'question', 'failure', 'free', 'troubleshooting'));

-- failure 카테고리 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_community_posts_failure
ON community_posts(created_at DESC)
WHERE category = 'failure';
