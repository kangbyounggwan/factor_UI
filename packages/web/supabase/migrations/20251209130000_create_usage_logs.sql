-- ============================================
-- usage_logs 테이블 생성
-- 상세 사용 로그 (감사 및 디버깅용)
-- ============================================

CREATE TABLE IF NOT EXISTS public.usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 사용자
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 사용량 정보
    usage_type VARCHAR(30) NOT NULL,
    -- 'ai_model_generation' - AI 3D 모델 생성
    -- 'ai_image_generation' - AI 이미지 생성
    -- 'printer_registration' - 프린터 등록
    -- 'printer_deletion'    - 프린터 삭제
    -- 'storage_upload'      - 파일 업로드
    -- 'storage_delete'      - 파일 삭제
    -- 'api_call'            - API 호출

    action VARCHAR(20) NOT NULL,                -- create, delete, update

    -- 관련 리소스
    resource_id UUID,                           -- 모델 ID, 프린터 ID 등
    resource_type VARCHAR(30),                  -- ai_model, printer, gcode, storage

    -- 변경량
    delta INTEGER DEFAULT 1,                    -- +1 (추가), -1 (삭제)

    -- 메타데이터
    metadata JSONB DEFAULT '{}',
    -- 예: { "prompt": "...", "file_size": 1024, "generation_type": "text_to_3d" }

    -- 요청 정보
    ip_address INET,                            -- 요청 IP
    user_agent TEXT,                            -- User Agent

    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON public.usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_type ON public.usage_logs(usage_type);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON public.usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_created ON public.usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_resource ON public.usage_logs(resource_type, resource_id);

-- RLS 활성화
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 로그만 조회 가능
CREATE POLICY "Users can view their own logs"
ON public.usage_logs FOR SELECT
USING (auth.uid() = user_id);

-- 사용자는 자신의 로그 생성 가능
CREATE POLICY "Users can insert their own logs"
ON public.usage_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 코멘트 (테이블)
COMMENT ON TABLE public.usage_logs IS '상세 사용 로그 테이블. 감사(audit), 디버깅, 사용 패턴 분석용. user_usage 테이블의 집계 데이터 원본';

-- 코멘트 (컬럼)
COMMENT ON COLUMN public.usage_logs.id IS '로그 고유 식별자 (UUID)';
COMMENT ON COLUMN public.usage_logs.user_id IS '사용자 ID (auth.users 참조)';
COMMENT ON COLUMN public.usage_logs.usage_type IS '사용량 유형 - ai_model_generation(AI 모델 생성), ai_image_generation(AI 이미지), printer_registration(프린터 등록), printer_deletion(프린터 삭제), storage_upload(업로드), storage_delete(삭제), api_call(API 호출)';
COMMENT ON COLUMN public.usage_logs.action IS '수행된 액션 - create(생성), delete(삭제), update(수정)';
COMMENT ON COLUMN public.usage_logs.resource_id IS '관련 리소스 ID. AI 모델, 프린터, GCode 등의 UUID';
COMMENT ON COLUMN public.usage_logs.resource_type IS '리소스 유형 - ai_model(AI 모델), printer(프린터), gcode(GCode 파일), storage(스토리지)';
COMMENT ON COLUMN public.usage_logs.delta IS '변경량. +1(추가), -1(삭제). user_usage.used_count 증감에 사용';
COMMENT ON COLUMN public.usage_logs.metadata IS '추가 메타데이터 (JSONB). 예: {"prompt": "...", "file_size": 1024, "generation_type": "text_to_3d"}';
COMMENT ON COLUMN public.usage_logs.ip_address IS '요청 IP 주소. 보안 감사용';
COMMENT ON COLUMN public.usage_logs.user_agent IS 'User Agent 문자열. 클라이언트 추적용';
COMMENT ON COLUMN public.usage_logs.created_at IS '로그 생성 일시';

-- ============================================
-- 로그 기록 함수 (사용량 증가와 함께 로그 남김)
-- ============================================
CREATE OR REPLACE FUNCTION public.log_usage(
    p_user_id UUID,
    p_usage_type VARCHAR(30),
    p_action VARCHAR(20),
    p_resource_id UUID DEFAULT NULL,
    p_resource_type VARCHAR(30) DEFAULT NULL,
    p_delta INTEGER DEFAULT 1,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    -- 로그 삽입
    INSERT INTO public.usage_logs (
        user_id, usage_type, action, resource_id, resource_type, delta, metadata
    ) VALUES (
        p_user_id, p_usage_type, p_action, p_resource_id, p_resource_type, p_delta, p_metadata
    )
    RETURNING id INTO v_log_id;

    -- 사용량 테이블 업데이트 (횟수 기반)
    IF p_delta != 0 THEN
        PERFORM public.increment_usage(p_user_id, p_usage_type, p_delta);
    END IF;

    RETURN v_log_id;
END;
$$;

-- ============================================
-- AI 모델 생성 로그 기록 (편의 함수)
-- ============================================
CREATE OR REPLACE FUNCTION public.log_ai_generation(
    p_user_id UUID,
    p_model_id UUID,
    p_generation_type VARCHAR(50),
    p_prompt TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.log_usage(
        p_user_id,
        'ai_model_generation',
        'create',
        p_model_id,
        'ai_model',
        1,
        jsonb_build_object(
            'generation_type', p_generation_type,
            'prompt', COALESCE(p_prompt, '')
        )
    );
END;
$$;

-- 함수 실행 권한
GRANT EXECUTE ON FUNCTION public.log_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_ai_generation TO authenticated;
