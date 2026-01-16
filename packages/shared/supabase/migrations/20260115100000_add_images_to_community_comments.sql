-- Add images column to community_comments table
-- 댓글에 이미지 첨부 기능 추가

ALTER TABLE community_comments
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
