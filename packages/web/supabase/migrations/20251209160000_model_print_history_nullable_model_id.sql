-- Migration: Make model_id nullable in model_print_history
-- Description: Allow print history records without AI model reference (OctoPrint direct prints)
-- Created: 2025-12-09

-- ============================================================================
-- model_print_history 테이블에서 model_id를 nullable로 변경
-- OctoPrint에서 직접 출력 시 AI 모델 없이 출력 기록을 저장하기 위함
-- ============================================================================

-- Step 1: Drop existing foreign key constraint
ALTER TABLE public.model_print_history
  DROP CONSTRAINT IF EXISTS model_print_history_model_id_fkey;

-- Step 2: Alter column to allow NULL
ALTER TABLE public.model_print_history
  ALTER COLUMN model_id DROP NOT NULL;

-- Step 3: Re-add foreign key constraint (with ON DELETE SET NULL instead of CASCADE)
ALTER TABLE public.model_print_history
  ADD CONSTRAINT model_print_history_model_id_fkey
  FOREIGN KEY (model_id) REFERENCES public.ai_generated_models(id) ON DELETE SET NULL;

-- Step 4: Add gcode_url column if not exists (for storing gcode file URL from bucket)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'model_print_history'
    AND column_name = 'gcode_url'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.model_print_history ADD COLUMN gcode_url TEXT;
    COMMENT ON COLUMN public.model_print_history.gcode_url IS 'GCode file URL from Storage bucket';
  END IF;
END $$;

-- Step 5: Add short_filename column if not exists (for display in history)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'model_print_history'
    AND column_name = 'short_filename'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.model_print_history ADD COLUMN short_filename TEXT;
    COMMENT ON COLUMN public.model_print_history.short_filename IS 'Short filename for display (from OctoPrint)';
  END IF;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
COMMENT ON TABLE public.model_print_history IS 'Print history for both AI-generated models and direct OctoPrint prints. model_id is nullable for direct prints.';
