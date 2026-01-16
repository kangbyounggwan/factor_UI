-- ============================================================================
-- Migration: Add author_display_type to community_posts
-- Created: 2026-01-15
-- Description: 커뮤니티 게시물에 작성자 표시 방식 컬럼 추가
--              - nickname: 닉네임으로 표시 (기본값)
--              - realname: 실명으로 표시
--              - anonymous: 익명으로 표시
-- ============================================================================

-- author_display_type 컬럼 추가
ALTER TABLE public.community_posts
ADD COLUMN IF NOT EXISTS author_display_type TEXT DEFAULT 'nickname';

-- CHECK 제약조건 추가 (유효한 값만 허용)
ALTER TABLE public.community_posts
ADD CONSTRAINT community_posts_author_display_type_check
CHECK (author_display_type IN ('nickname', 'realname', 'anonymous'));

-- 기존 게시물에 기본값 적용
UPDATE public.community_posts
SET author_display_type = 'nickname'
WHERE author_display_type IS NULL;

-- NOT NULL 제약조건 추가 (기본값 설정 후)
ALTER TABLE public.community_posts
ALTER COLUMN author_display_type SET NOT NULL;

-- 컬럼 설명 추가
COMMENT ON COLUMN public.community_posts.author_display_type IS '작성자 표시 방식: nickname(닉네임), realname(실명), anonymous(익명)';

-- 인덱스 추가 (익명 게시물 필터링에 유용)
CREATE INDEX IF NOT EXISTS idx_community_posts_author_display_type
ON public.community_posts(author_display_type);
