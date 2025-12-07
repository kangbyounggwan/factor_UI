-- Cleanup old temperature logging system
-- Run this AFTER verifying new system works correctly

-- ⚠️ WARNING: This will delete historical temperature data
-- Make sure to:
-- 1. Verify new system is working for at least 7 days
-- 2. Backup old data if needed
-- 3. Confirm no references to printer_temperature_logs in code

-- Step 1: Archive old data (optional - uncomment if you want to keep it)
-- CREATE TABLE IF NOT EXISTS public.printer_temperature_logs_archive AS
-- SELECT * FROM public.printer_temperature_logs;

-- Step 2: Drop old table
-- DROP TABLE IF EXISTS public.printer_temperature_logs CASCADE;

-- Step 3: Clean up any remaining references
-- DROP TRIGGER IF EXISTS update_printer_temperature_logs_updated_at_trigger ON public.printer_temperature_logs;
-- DROP FUNCTION IF EXISTS update_printer_temperature_logs_updated_at();

-- Verification query - run this before dropping
-- SELECT
--   COUNT(*) as total_sessions,
--   MIN(session_start) as first_session,
--   MAX(session_end) as last_session,
--   SUM(reading_count) as total_readings
-- FROM public.printer_temperature_sessions;

COMMENT ON SCHEMA public IS 'Old printer_temperature_logs table cleanup - NOT EXECUTED YET';
