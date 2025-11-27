-- API Keys 테이블 생성
-- 사용자가 외부 시스템에서 FACTOR API에 접근할 수 있도록 API 키 관리

CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,                    -- API 키 이름 (예: "Home Server", "Production")
    key_hash VARCHAR(64) NOT NULL,                 -- SHA-256 해시된 API 키
    key_prefix VARCHAR(12) NOT NULL,               -- 키의 앞 8자리 (표시용, 예: "fk_live_ab")
    permissions JSONB DEFAULT '["read"]'::jsonb,   -- 권한 배열: read, write, admin
    last_used_at TIMESTAMPTZ,                      -- 마지막 사용 시간
    expires_at TIMESTAMPTZ,                        -- 만료 시간 (NULL이면 무기한)
    is_active BOOLEAN DEFAULT true,                -- 활성화 여부
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 동일 사용자의 키 이름 중복 방지
    CONSTRAINT unique_user_key_name UNIQUE (user_id, name)
);

-- 인덱스 생성
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_key_prefix ON public.api_keys(key_prefix);
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_is_active ON public.api_keys(is_active);

-- RLS 활성화
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 API 키만 조회/관리 가능
CREATE POLICY "Users can view own api keys"
    ON public.api_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api keys"
    ON public.api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api keys"
    ON public.api_keys FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own api keys"
    ON public.api_keys FOR DELETE
    USING (auth.uid() = user_id);

-- API 키 사용 로그 테이블 (선택적)
CREATE TABLE IF NOT EXISTS public.api_key_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,                -- 호출된 엔드포인트
    method VARCHAR(10) NOT NULL,                   -- HTTP 메서드
    ip_address INET,                               -- 요청 IP
    user_agent TEXT,                               -- User Agent
    response_status INTEGER,                       -- 응답 상태 코드
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용 로그 인덱스
CREATE INDEX idx_api_key_usage_api_key_id ON public.api_key_usage_logs(api_key_id);
CREATE INDEX idx_api_key_usage_created_at ON public.api_key_usage_logs(created_at);

-- RLS 활성화
ALTER TABLE public.api_key_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책: API 키 소유자만 로그 조회 가능
CREATE POLICY "Users can view own api key logs"
    ON public.api_key_usage_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.api_keys
            WHERE api_keys.id = api_key_usage_logs.api_key_id
            AND api_keys.user_id = auth.uid()
        )
    );

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_api_keys_updated_at
    BEFORE UPDATE ON public.api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_api_keys_updated_at();

-- 코멘트 추가
COMMENT ON TABLE public.api_keys IS 'User API keys for external system access';
COMMENT ON COLUMN public.api_keys.key_hash IS 'SHA-256 hash of the API key (original key is never stored)';
COMMENT ON COLUMN public.api_keys.key_prefix IS 'First 8-12 characters of the key for identification';
COMMENT ON COLUMN public.api_keys.permissions IS 'Array of permissions: read, write, admin';
