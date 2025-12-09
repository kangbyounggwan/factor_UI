-- Create AI usage logs table to track API usage independently of model records
-- This ensures usage count persists even when models are deleted

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    usage_type VARCHAR(50) NOT NULL DEFAULT 'model_generation',
    model_id UUID NULL, -- Optional reference to the generated model (can be null if model was deleted)
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient monthly usage queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created
ON public.ai_usage_logs(user_id, created_at DESC);

-- Index for usage type filtering
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_type
ON public.ai_usage_logs(usage_type);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own usage logs
CREATE POLICY "Users can view their own usage logs"
ON public.ai_usage_logs FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own usage logs
CREATE POLICY "Users can insert their own usage logs"
ON public.ai_usage_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Comment for documentation
COMMENT ON TABLE public.ai_usage_logs IS 'AI API 사용량 로그 - 모델 삭제와 무관하게 사용량 추적';
COMMENT ON COLUMN public.ai_usage_logs.usage_type IS '사용 유형: model_generation, image_generation 등';
COMMENT ON COLUMN public.ai_usage_logs.model_id IS '생성된 모델 ID (모델 삭제 후에도 로그는 유지)';
COMMENT ON COLUMN public.ai_usage_logs.metadata IS '추가 메타데이터 (프롬프트 타입, 소스 등)';

-- Function to get monthly usage count
CREATE OR REPLACE FUNCTION public.get_ai_usage_count(
    p_user_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_usage_type VARCHAR DEFAULT 'model_generation'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    usage_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO usage_count
    FROM public.ai_usage_logs
    WHERE user_id = p_user_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date
      AND usage_type = p_usage_type;

    RETURN COALESCE(usage_count, 0);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_ai_usage_count TO authenticated;
