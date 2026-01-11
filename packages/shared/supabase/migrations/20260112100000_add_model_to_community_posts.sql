-- ============================================================================
-- Migration: Add model_id to community_posts
-- Created: 2026-01-12
-- Description: 커뮤니티 게시물에 AI 모델 첨부 기능 추가
-- ============================================================================

-- model_id 컬럼 추가 (AI 생성 모델 참조)
ALTER TABLE public.community_posts
ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES public.ai_generated_models(id) ON DELETE SET NULL;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_community_posts_model_id ON community_posts(model_id);

-- 컬럼 설명 추가
COMMENT ON COLUMN public.community_posts.model_id IS '첨부된 AI 생성 모델 ID';
