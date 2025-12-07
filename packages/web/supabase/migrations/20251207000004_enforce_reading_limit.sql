-- Enforce 800 reading limit per printer
-- This trigger automatically deletes old sessions when limit is exceeded

-- Function to enforce reading limit
CREATE OR REPLACE FUNCTION enforce_temperature_reading_limit()
RETURNS TRIGGER AS $$
DECLARE
  total_readings INTEGER;
  excess_readings INTEGER;
  max_readings_per_printer CONSTANT INTEGER := 800;
  sessions_to_delete UUID[];
  readings_deleted INTEGER := 0;
BEGIN
  -- Calculate total readings for this printer
  SELECT COALESCE(SUM(reading_count), 0)
  INTO total_readings
  FROM public.printer_temperature_sessions
  WHERE printer_id = NEW.printer_id;

  -- If within limit, allow insert/update
  IF total_readings <= max_readings_per_printer THEN
    RETURN NEW;
  END IF;

  -- Calculate excess
  excess_readings := total_readings - max_readings_per_printer;

  RAISE NOTICE 'Printer % has % readings (limit: %). Deleting oldest sessions...',
    NEW.printer_id, total_readings, max_readings_per_printer;

  -- Delete oldest sessions until we're under the limit
  WITH sessions_ranked AS (
    SELECT
      id,
      reading_count,
      SUM(reading_count) OVER (ORDER BY session_start ASC) as cumulative_count
    FROM public.printer_temperature_sessions
    WHERE printer_id = NEW.printer_id
    ORDER BY session_start ASC
  ),
  sessions_to_remove AS (
    SELECT id, reading_count
    FROM sessions_ranked
    WHERE cumulative_count <= excess_readings + 100  -- Delete a bit extra for headroom
  )
  DELETE FROM public.printer_temperature_sessions
  WHERE id IN (SELECT id FROM sessions_to_remove)
  RETURNING id INTO sessions_to_delete;

  GET DIAGNOSTICS readings_deleted = ROW_COUNT;

  RAISE NOTICE 'Deleted % old sessions for printer %', readings_deleted, NEW.printer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT (when new session is created)
CREATE TRIGGER enforce_reading_limit_on_insert
  AFTER INSERT ON public.printer_temperature_sessions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_temperature_reading_limit();

-- Trigger on UPDATE (when readings are added to session)
CREATE TRIGGER enforce_reading_limit_on_update
  AFTER UPDATE OF reading_count ON public.printer_temperature_sessions
  FOR EACH ROW
  WHEN (NEW.reading_count > OLD.reading_count)
  EXECUTE FUNCTION enforce_temperature_reading_limit();

-- Add constraint comment
COMMENT ON FUNCTION enforce_temperature_reading_limit() IS
  'Automatically maintains maximum 800 temperature readings per printer by deleting oldest sessions';
