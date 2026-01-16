-- ============================================================================
-- Migration: Reset display_name to NULL for nickname setup
-- Created: 2026-01-16
-- Description: 기존 사용자의 display_name을 NULL로 초기화하여
--              커뮤니티 글쓰기 시 닉네임 설정 모달이 표시되도록 함
--              full_name에 실명이 없으면 기존 display_name 값을 복사
-- ============================================================================

-- 1. full_name이 NULL인 경우, display_name 값을 full_name으로 복사 (실명 보존)
UPDATE public.profiles
SET full_name = display_name
WHERE full_name IS NULL AND display_name IS NOT NULL;

-- 2. display_name을 NULL로 초기화 (닉네임 재설정 유도)
UPDATE public.profiles
SET display_name = NULL
WHERE display_name IS NOT NULL;

-- 완료 로그
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO affected_count FROM public.profiles WHERE display_name IS NULL;
  RAISE NOTICE 'Reset display_name to NULL for % profiles', affected_count;
END $$;
