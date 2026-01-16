-- ============================================================================
-- 사용자 장비 프리셋 컬럼 추가
-- 트러블슈팅 작성 시 자주 사용하는 프린터/필라멘트 정보를 저장
-- ============================================================================

-- profiles 테이블에 equipment_presets JSONB 컬럼 추가
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS equipment_presets JSONB DEFAULT '[]'::jsonb;

-- 컬럼 설명 추가
COMMENT ON COLUMN profiles.equipment_presets IS '사용자 장비 프리셋 목록. 트러블슈팅 작성 시 빠르게 불러올 수 있음.';

-- ============================================================================
-- equipment_presets 구조 예시:
-- [
--   {
--     "id": "uuid-v4",
--     "name": "메인 프린터",
--     "is_default": true,
--     "printer": {
--       "model": "Ender 3 V2",
--       "firmware": "Klipper",
--       "nozzle_size": "0.4mm",
--       "bed_type": "PEI"
--     },
--     "filament": {
--       "type": "PLA",
--       "brand": "eSUN",
--       "dried": true
--     },
--     "slicer": {
--       "name": "OrcaSlicer",
--       "profile": "0.2mm Quality"
--     },
--     "created_at": "2026-01-16T10:00:00Z",
--     "updated_at": "2026-01-16T10:00:00Z"
--   }
-- ]
-- ============================================================================
