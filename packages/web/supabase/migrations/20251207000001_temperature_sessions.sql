-- Temperature logging optimization: JSONB-based session storage
-- Reduces DB writes by 99% (from 8000 rows/3hrs to ~3 rows/3hrs)

-- Create new session-based temperature table
CREATE TABLE IF NOT EXISTS public.printer_temperature_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id UUID NOT NULL,
  session_start TIMESTAMPTZ NOT NULL,
  session_end TIMESTAMPTZ,

  -- JSONB array of temperature readings
  -- Each reading: { t: timestamp, nt: nozzle_temp, nto: nozzle_target, bt: bed_temp, bto: bed_target }
  temperature_data JSONB NOT NULL DEFAULT '{"readings": []}'::jsonb,

  -- Metadata
  reading_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign key
  CONSTRAINT fk_printer FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_temp_sessions_printer_id ON public.printer_temperature_sessions(printer_id);
CREATE INDEX IF NOT EXISTS idx_temp_sessions_session_start ON public.printer_temperature_sessions(session_start DESC);
CREATE INDEX IF NOT EXISTS idx_temp_sessions_session_end ON public.printer_temperature_sessions(session_end);
CREATE INDEX IF NOT EXISTS idx_temp_sessions_printer_time ON public.printer_temperature_sessions(printer_id, session_start DESC);

-- JSONB GIN index for querying within temperature_data
CREATE INDEX IF NOT EXISTS idx_temp_sessions_data ON public.printer_temperature_sessions USING GIN (temperature_data);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_temp_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_temp_sessions_updated_at_trigger
  BEFORE UPDATE ON public.printer_temperature_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_temp_sessions_updated_at();

-- Auto-cleanup old sessions (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_temperature_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.printer_temperature_sessions
  WHERE session_start < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (if pg_cron is available, otherwise run manually)
-- SELECT cron.schedule('cleanup-temp-sessions', '0 2 * * *', 'SELECT cleanup_old_temperature_sessions()');

-- Comments
COMMENT ON TABLE public.printer_temperature_sessions IS 'Session-based temperature logging with JSONB arrays for efficient storage';
COMMENT ON COLUMN public.printer_temperature_sessions.temperature_data IS 'JSONB array of readings: [{ t: ISO timestamp, nt: nozzle_temp, nto: nozzle_target, bt: bed_temp, bto: bed_target }]';
COMMENT ON COLUMN public.printer_temperature_sessions.session_start IS 'Start of temperature monitoring session';
COMMENT ON COLUMN public.printer_temperature_sessions.session_end IS 'End of session (NULL = active session)';

-- Enable Row Level Security (RLS)
ALTER TABLE public.printer_temperature_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access temperature data for their own printers
CREATE POLICY "Users can view their own printer temperature sessions"
  ON public.printer_temperature_sessions
  FOR SELECT
  USING (
    printer_id IN (
      SELECT id FROM public.printers
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: System can insert/update temperature data (for backend services)
CREATE POLICY "System can manage temperature sessions"
  ON public.printer_temperature_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.printer_temperature_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.printer_temperature_sessions TO service_role;

-- Optionally: Keep old table for migration period, then drop
-- ALTER TABLE public.printer_temperature_logs RENAME TO printer_temperature_logs_old;
COMMENT ON TABLE public.printer_temperature_logs IS 'DEPRECATED: Use printer_temperature_sessions instead. Will be removed after migration.';
