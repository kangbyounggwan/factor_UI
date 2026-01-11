-- Safely rename old temperature table for 30-day grace period
-- This allows rollback if issues are discovered

-- Rename old table
ALTER TABLE IF EXISTS public.printer_temperature_logs
RENAME TO printer_temperature_logs_old;

-- Add deprecation notice
COMMENT ON TABLE public.printer_temperature_logs_old IS
  'DEPRECATED: Renamed on 2025-12-07. Safe to delete after 2026-01-06 if new system is stable.';

-- Disable RLS on old table (no longer accessed)
ALTER TABLE public.printer_temperature_logs_old DISABLE ROW LEVEL SECURITY;

-- Verification: Check new system is working
DO $$
DECLARE
  session_count INTEGER;
  reading_count INTEGER;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(reading_count), 0)
  INTO session_count, reading_count
  FROM public.printer_temperature_sessions;

  RAISE NOTICE 'New system status:';
  RAISE NOTICE '  Sessions: %', session_count;
  RAISE NOTICE '  Total readings: %', reading_count;

  IF session_count = 0 THEN
    RAISE WARNING 'No sessions found in new system! Monitor for 24 hours before proceeding.';
  END IF;
END $$;
