-- Background tasks table for slicing jobs
CREATE TABLE IF NOT EXISTS public.background_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('slicing', 'model_generation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Task parameters
  model_id UUID,
  printer_id TEXT,
  printer_model_id TEXT,

  -- Input data
  input_url TEXT,
  input_params JSONB,

  -- Output data
  output_url TEXT,
  output_metadata JSONB,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Indexes
  CONSTRAINT background_tasks_user_id_idx UNIQUE (user_id, id)
);

-- Add index for querying pending tasks
CREATE INDEX IF NOT EXISTS idx_background_tasks_status ON public.background_tasks(status, created_at);
CREATE INDEX IF NOT EXISTS idx_background_tasks_user_id ON public.background_tasks(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.background_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own background tasks" ON public.background_tasks;
CREATE POLICY "Users can view their own background tasks"
  ON public.background_tasks
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own background tasks" ON public.background_tasks;
CREATE POLICY "Users can insert their own background tasks"
  ON public.background_tasks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own background tasks" ON public.background_tasks;
CREATE POLICY "Users can update their own background tasks"
  ON public.background_tasks
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_background_tasks_updated_at ON public.background_tasks;
CREATE TRIGGER update_background_tasks_updated_at
  BEFORE UPDATE ON public.background_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create slicing task
CREATE OR REPLACE FUNCTION public.create_slicing_task(
  p_model_id UUID,
  p_printer_id TEXT,
  p_printer_model_id TEXT,
  p_input_url TEXT,
  p_input_params JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_id UUID;
BEGIN
  INSERT INTO public.background_tasks (
    user_id,
    task_type,
    status,
    model_id,
    printer_id,
    printer_model_id,
    input_url,
    input_params
  ) VALUES (
    auth.uid(),
    'slicing',
    'pending',
    p_model_id,
    p_printer_id,
    p_printer_model_id,
    p_input_url,
    p_input_params
  )
  RETURNING id INTO v_task_id;

  RETURN v_task_id;
END;
$$;

-- Function to update task status
CREATE OR REPLACE FUNCTION public.update_task_status(
  p_task_id UUID,
  p_status TEXT,
  p_output_url TEXT DEFAULT NULL,
  p_output_metadata JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.background_tasks
  SET
    status = p_status,
    output_url = COALESCE(p_output_url, output_url),
    output_metadata = COALESCE(p_output_metadata, output_metadata),
    error_message = p_error_message,
    started_at = CASE WHEN p_status = 'processing' AND started_at IS NULL THEN NOW() ELSE started_at END,
    completed_at = CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE completed_at END
  WHERE id = p_task_id AND user_id = auth.uid();
END;
$$;

-- Function to get pending tasks (for background worker)
CREATE OR REPLACE FUNCTION public.get_pending_tasks(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  task_type TEXT,
  model_id UUID,
  printer_id TEXT,
  printer_model_id TEXT,
  input_url TEXT,
  input_params JSONB,
  retry_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bt.id,
    bt.user_id,
    bt.task_type,
    bt.model_id,
    bt.printer_id,
    bt.printer_model_id,
    bt.input_url,
    bt.input_params,
    bt.retry_count,
    bt.created_at
  FROM public.background_tasks bt
  WHERE bt.status = 'pending'
    AND bt.retry_count < bt.max_retries
  ORDER BY bt.created_at ASC
  LIMIT p_limit;
END;
$$;
