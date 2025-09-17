-- Fix search_path for security
CREATE OR REPLACE FUNCTION public.update_chat_session_stats()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.chat_sessions 
    SET 
      updated_at = now(),
      last_message_at = now(),
      message_count = message_count + 1
    WHERE id = NEW.session_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.chat_sessions 
    SET 
      updated_at = now(),
      message_count = GREATEST(0, message_count - 1)
    WHERE id = OLD.session_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;