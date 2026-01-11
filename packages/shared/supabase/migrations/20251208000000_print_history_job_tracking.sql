-- Migration: Print History Enhancement
-- Description: Add 'paused' status to model_print_history
-- Created: 2025-12-08

-- ============================================================================
-- Add 'paused' status to model_print_history
-- ============================================================================

-- Drop existing constraint
ALTER TABLE public.model_print_history
  DROP CONSTRAINT IF EXISTS valid_print_status;

-- Add new constraint with 'paused' status
ALTER TABLE public.model_print_history
  ADD CONSTRAINT valid_print_status CHECK (
    print_status IN ('queued', 'printing', 'paused', 'completed', 'failed', 'cancelled')
  );

COMMENT ON COLUMN public.model_print_history.print_status IS 'Print job status: queued, printing, paused, completed, failed, cancelled';

-- ============================================================================
-- Migration Complete
-- ============================================================================
