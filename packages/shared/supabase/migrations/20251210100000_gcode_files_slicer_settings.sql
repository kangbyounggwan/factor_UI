-- Migration: Add slicer_settings column to gcode_files table
-- Description: Store slicing configuration extracted from GCode file headers
-- Created: 2025-12-10

-- ============================================================================
-- gcode_files 테이블에 슬라이싱 설정 컬럼 추가
-- GCode 파일 헤더에서 파싱한 슬라이서 설정 정보를 저장
-- ============================================================================

-- slicer_settings JSONB 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gcode_files'
    AND column_name = 'slicer_settings'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.gcode_files ADD COLUMN slicer_settings JSONB;
    COMMENT ON COLUMN public.gcode_files.slicer_settings IS 'Slicing settings parsed from GCode header (slicer_name, slicer_version, printer_model, nozzle_diameter, layer_height, fill_density, filament_type, print_time_estimate, filament_used, etc.)';
  END IF;
END $$;

-- ============================================================================
-- slicer_settings JSONB 예시 구조:
-- {
--   "slicer_name": "PrusaSlicer",
--   "slicer_version": "2.6.0",
--   "printer_model": "Creality Ender-3 Pro",
--   "nozzle_diameter": 0.4,
--   "layer_height": 0.2,
--   "fill_density": 20,
--   "filament_type": "PLA",
--   "filament_diameter": 1.75,
--   "print_time_estimate": 7200,
--   "filament_used_mm": 5000,
--   "filament_used_g": 15,
--   "bed_temperature": 60,
--   "nozzle_temperature": 210,
--   "print_speed": 50,
--   "support_material": false,
--   "infill_pattern": "grid"
-- }
-- ============================================================================

COMMENT ON TABLE public.gcode_files IS 'GCode files stored in cloud storage with metadata and slicing settings';
