-- Migration: Print History Enhancement & Temperature Log Archive System
-- Description:
--   1. Add 'paused' status to model_print_history
--   2. Add job_id column to temperature tables for linking to print jobs
--   3. Create auto-archive function for temperature logs (600 records -> session)
-- Created: 2025-12-07

-- ============================================================================
-- 1. Add 'paused' status to model_print_history
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
-- 2. Add job_id column to printer_temperature_logs
-- ============================================================================

-- Add job_id column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'printer_temperature_logs'
    AND column_name = 'job_id'
  ) THEN
    ALTER TABLE public.printer_temperature_logs
      ADD COLUMN job_id UUID REFERENCES public.model_print_history(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_temp_logs_job_id
      ON public.printer_temperature_logs(job_id);
  END IF;
END $$;

COMMENT ON COLUMN public.printer_temperature_logs.job_id IS 'Reference to print job for linking temperature data';

-- ============================================================================
-- 3. Add job_id column to printer_temperature_sessions
-- ============================================================================

-- Add job_id column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'printer_temperature_sessions'
    AND column_name = 'job_id'
  ) THEN
    ALTER TABLE public.printer_temperature_sessions
      ADD COLUMN job_id UUID REFERENCES public.model_print_history(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_temp_sessions_job_id
      ON public.printer_temperature_sessions(job_id);
  END IF;
END $$;

COMMENT ON COLUMN public.printer_temperature_sessions.job_id IS 'Reference to print job for linking archived temperature data';

-- ============================================================================
-- 4. Auto-archive function for temperature logs (600 records threshold)
-- ============================================================================

-- Function to archive temperature logs when count reaches threshold
CREATE OR REPLACE FUNCTION public.archive_temperature_logs_by_job()
RETURNS TRIGGER AS $$
DECLARE
  v_count INTEGER;
  v_job_id UUID;
  v_printer_id UUID;
  v_session_data JSONB;
  v_min_time TIMESTAMPTZ;
  v_max_time TIMESTAMPTZ;
  v_archive_threshold INTEGER := 600;
BEGIN
  -- Get the job_id from the newly inserted row
  v_job_id := NEW.job_id;
  v_printer_id := NEW.printer_id;

  -- Skip if no job_id (not linked to a print job)
  IF v_job_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count logs for this job
  SELECT COUNT(*) INTO v_count
  FROM public.printer_temperature_logs
  WHERE job_id = v_job_id;

  -- Archive if threshold reached
  IF v_count >= v_archive_threshold THEN
    -- Build JSON data and get time range
    SELECT
      MIN(recorded_at),
      MAX(recorded_at),
      jsonb_build_object(
        'readings',
        jsonb_agg(
          jsonb_build_object(
            't', to_char(recorded_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'nt', nozzle_temp,
            'nto', nozzle_target,
            'bt', bed_temp,
            'bto', bed_target
          ) ORDER BY recorded_at
        )
      )
    INTO v_min_time, v_max_time, v_session_data
    FROM public.printer_temperature_logs
    WHERE job_id = v_job_id;

    -- Insert into sessions table
    INSERT INTO public.printer_temperature_sessions (
      printer_id,
      job_id,
      session_start,
      session_end,
      temperature_data,
      reading_count,
      created_at,
      updated_at
    ) VALUES (
      v_printer_id,
      v_job_id,
      v_min_time,
      v_max_time,
      v_session_data,
      v_count,
      NOW(),
      NOW()
    );

    -- Delete archived logs
    DELETE FROM public.printer_temperature_logs
    WHERE job_id = v_job_id;

    -- Log the archival (optional, for debugging)
    RAISE NOTICE 'Archived % temperature logs for job % to session', v_count, v_job_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop if exists first)
DROP TRIGGER IF EXISTS trigger_archive_temperature_logs ON public.printer_temperature_logs;

CREATE TRIGGER trigger_archive_temperature_logs
  AFTER INSERT ON public.printer_temperature_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.archive_temperature_logs_by_job();

COMMENT ON FUNCTION public.archive_temperature_logs_by_job() IS
  'Auto-archives temperature logs to sessions when 600 records accumulate for a job';

-- ============================================================================
-- 5. Manual archive function (for logs without job_id or manual cleanup)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.archive_temperature_logs_manual(
  p_printer_id UUID,
  p_job_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
  v_session_data JSONB;
  v_min_time TIMESTAMPTZ;
  v_max_time TIMESTAMPTZ;
  v_archived_count INTEGER := 0;
BEGIN
  -- Count and archive logs
  IF p_job_id IS NOT NULL THEN
    -- Archive by job_id
    SELECT COUNT(*) INTO v_count
    FROM public.printer_temperature_logs
    WHERE job_id = p_job_id;

    IF v_count > 0 THEN
      SELECT
        MIN(recorded_at),
        MAX(recorded_at),
        jsonb_build_object(
          'readings',
          jsonb_agg(
            jsonb_build_object(
              't', to_char(recorded_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'nt', nozzle_temp,
              'nto', nozzle_target,
              'bt', bed_temp,
              'bto', bed_target
            ) ORDER BY recorded_at
          )
        )
      INTO v_min_time, v_max_time, v_session_data
      FROM public.printer_temperature_logs
      WHERE job_id = p_job_id;

      INSERT INTO public.printer_temperature_sessions (
        printer_id, job_id, session_start, session_end, temperature_data, reading_count
      ) VALUES (
        p_printer_id, p_job_id, v_min_time, v_max_time, v_session_data, v_count
      );

      DELETE FROM public.printer_temperature_logs WHERE job_id = p_job_id;
      v_archived_count := v_count;
    END IF;
  ELSE
    -- Archive all logs for printer (no job_id filter)
    SELECT COUNT(*) INTO v_count
    FROM public.printer_temperature_logs
    WHERE printer_id = p_printer_id;

    IF v_count > 0 THEN
      SELECT
        MIN(recorded_at),
        MAX(recorded_at),
        jsonb_build_object(
          'readings',
          jsonb_agg(
            jsonb_build_object(
              't', to_char(recorded_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'nt', nozzle_temp,
              'nto', nozzle_target,
              'bt', bed_temp,
              'bto', bed_target
            ) ORDER BY recorded_at
          )
        )
      INTO v_min_time, v_max_time, v_session_data
      FROM public.printer_temperature_logs
      WHERE printer_id = p_printer_id;

      INSERT INTO public.printer_temperature_sessions (
        printer_id, session_start, session_end, temperature_data, reading_count
      ) VALUES (
        p_printer_id, v_min_time, v_max_time, v_session_data, v_count
      );

      DELETE FROM public.printer_temperature_logs WHERE printer_id = p_printer_id;
      v_archived_count := v_count;
    END IF;
  END IF;

  RETURN v_archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.archive_temperature_logs_manual(UUID, UUID) IS
  'Manually archive temperature logs for a printer/job. Returns number of archived records.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.archive_temperature_logs_manual(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_temperature_logs_manual(UUID, UUID) TO service_role;

-- ============================================================================
-- 6. View for print history with temperature data count
-- ============================================================================

CREATE OR REPLACE VIEW public.print_history_with_temp_stats AS
SELECT
  ph.*,
  COALESCE(tl.log_count, 0) AS current_temp_logs,
  COALESCE(ts.session_count, 0) AS archived_sessions,
  COALESCE(ts.total_readings, 0) AS total_archived_readings
FROM public.model_print_history ph
LEFT JOIN (
  SELECT job_id, COUNT(*) AS log_count
  FROM public.printer_temperature_logs
  WHERE job_id IS NOT NULL
  GROUP BY job_id
) tl ON ph.id = tl.job_id
LEFT JOIN (
  SELECT job_id, COUNT(*) AS session_count, SUM(reading_count) AS total_readings
  FROM public.printer_temperature_sessions
  WHERE job_id IS NOT NULL
  GROUP BY job_id
) ts ON ph.id = ts.job_id;

COMMENT ON VIEW public.print_history_with_temp_stats IS
  'Print history with temperature logging statistics';

-- ============================================================================
-- Migration Complete
-- ============================================================================
