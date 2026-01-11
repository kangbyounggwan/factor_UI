-- ============================================================================
-- Migration: Add full_name (real name) to profiles
-- Created: 2026-01-12
-- Description: 프로필에 full_name(실명) 컬럼 추가
--              display_name: 표시 이름 (닉네임) - 이미 존재
--              full_name: 실명 (본명) - 새로 추가
-- ============================================================================

-- full_name 컬럼 추가 (실명)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 기존 display_name 값을 full_name으로 복사 (기존 사용자용 - 실명이 없으면 닉네임으로 초기화)
UPDATE public.profiles
SET full_name = display_name
WHERE full_name IS NULL AND display_name IS NOT NULL;

-- 컬럼 설명 추가
COMMENT ON COLUMN public.profiles.full_name IS '실명 (본명) - 비공개 정보';
COMMENT ON COLUMN public.profiles.display_name IS '표시 이름 (닉네임) - 커뮤니티 등에서 공개적으로 표시됨';
