-- Enable Realtime for printers table
-- This allows WebSocket Proxy to monitor printer status changes

-- Add printers table to Realtime publication
DO $$
BEGIN
  -- 기존 publication에서 제거 (에러 무시)
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.printers;
  EXCEPTION
    WHEN undefined_table THEN
      -- 테이블이 publication에 없으면 무시
      NULL;
    WHEN others THEN
      -- 다른 에러도 무시
      NULL;
  END;

  -- publication에 추가
  ALTER PUBLICATION supabase_realtime ADD TABLE public.printers;
END $$;

COMMENT ON TABLE public.printers IS 'User printers with Realtime enabled for status monitoring';
