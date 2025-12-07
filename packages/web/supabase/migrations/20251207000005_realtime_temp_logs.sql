-- Realtime Temperature Logging with Auto-Archive
-- printer_temperature_logs: 실시간 데이터 (최대 800개/프린터)
-- printer_temperature_sessions: 압축 아카이브 (800개씩 JSONB)

-- 1. printer_temperature_logs 테이블이 이미 있다면 재활용, 없으면 생성
CREATE TABLE IF NOT EXISTS public.printer_temperature_logs (
  id BIGSERIAL PRIMARY KEY,
  printer_id UUID NOT NULL,
  nozzle_temp FLOAT NOT NULL DEFAULT 0,
  nozzle_target FLOAT NOT NULL DEFAULT 0,
  bed_temp FLOAT NOT NULL DEFAULT 0,
  bed_target FLOAT NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_printer_logs FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_temp_logs_printer_id ON public.printer_temperature_logs(printer_id);
CREATE INDEX IF NOT EXISTS idx_temp_logs_recorded_at ON public.printer_temperature_logs(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_temp_logs_printer_time ON public.printer_temperature_logs(printer_id, recorded_at DESC);

-- RLS 설정
ALTER TABLE public.printer_temperature_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own printer temperature logs"
  ON public.printer_temperature_logs
  FOR SELECT
  USING (
    printer_id IN (
      SELECT id FROM public.printers
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage temperature logs"
  ON public.printer_temperature_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 권한 부여
GRANT SELECT, INSERT, DELETE ON public.printer_temperature_logs TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.printer_temperature_logs TO service_role;

-- 2. 800개 도달 시 자동 아카이브 Function
CREATE OR REPLACE FUNCTION archive_temperature_logs()
RETURNS TRIGGER AS $$
DECLARE
  log_count INTEGER;
  old_logs RECORD;
  readings JSONB;
BEGIN
  -- 현재 프린터의 로그 개수 확인
  SELECT COUNT(*) INTO log_count
  FROM public.printer_temperature_logs
  WHERE printer_id = NEW.printer_id;

  -- 800개 이상이면 아카이브
  IF log_count >= 800 THEN
    RAISE NOTICE '[Archive] Printer % reached 800 logs. Archiving...', NEW.printer_id;

    -- 가장 오래된 800개 데이터를 JSON으로 변환
    SELECT jsonb_agg(
      jsonb_build_object(
        't', recorded_at,
        'nt', nozzle_temp,
        'nto', nozzle_target,
        'bt', bed_temp,
        'bto', bed_target
      ) ORDER BY recorded_at ASC
    ) INTO readings
    FROM (
      SELECT * FROM public.printer_temperature_logs
      WHERE printer_id = NEW.printer_id
      ORDER BY recorded_at ASC
      LIMIT 800
    ) AS oldest_logs;

    -- printer_temperature_sessions에 저장
    INSERT INTO public.printer_temperature_sessions (
      printer_id,
      session_start,
      session_end,
      temperature_data,
      reading_count
    )
    SELECT
      NEW.printer_id,
      MIN(recorded_at),
      MAX(recorded_at),
      jsonb_build_object('readings', readings),
      800
    FROM (
      SELECT * FROM public.printer_temperature_logs
      WHERE printer_id = NEW.printer_id
      ORDER BY recorded_at ASC
      LIMIT 800
    ) AS archived;

    -- printer_temperature_logs에서 아카이브된 데이터 삭제
    DELETE FROM public.printer_temperature_logs
    WHERE id IN (
      SELECT id FROM public.printer_temperature_logs
      WHERE printer_id = NEW.printer_id
      ORDER BY recorded_at ASC
      LIMIT 800
    );

    RAISE NOTICE '[Archive] Archived and deleted 800 old logs for printer %', NEW.printer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger: INSERT 시 800개 체크
CREATE TRIGGER check_and_archive_logs
  AFTER INSERT ON public.printer_temperature_logs
  FOR EACH ROW
  EXECUTE FUNCTION archive_temperature_logs();

-- 4. Realtime Publication 설정
-- Supabase Realtime에서 printer_temperature_logs 테이블 구독 가능하도록 설정
-- 이미 등록되어 있을 수 있으므로 먼저 제거 후 다시 추가
DO $$
BEGIN
  -- 기존 publication에서 제거 (에러 무시)
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.printer_temperature_logs;
  EXCEPTION
    WHEN undefined_table THEN
      -- 테이블이 publication에 없으면 무시
      NULL;
    WHEN others THEN
      -- 다른 에러도 무시
      NULL;
  END;

  -- publication에 추가
  ALTER PUBLICATION supabase_realtime ADD TABLE public.printer_temperature_logs;
END $$;

-- Comments
COMMENT ON TABLE public.printer_temperature_logs IS 'Real-time temperature logs (max 800 per printer, auto-archived to sessions)';
COMMENT ON FUNCTION archive_temperature_logs() IS 'Automatically archives oldest 800 logs to printer_temperature_sessions when limit is reached';
