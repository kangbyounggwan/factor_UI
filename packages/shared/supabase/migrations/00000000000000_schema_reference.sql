-- ============================================================================
-- FACTOR HIBRID - Supabase Database Schema Reference
-- Generated: 2025-12-09
-- Total Tables: 25 (9 unused tables removed)
-- ============================================================================
-- 이 파일은 참조용 스키마 문서입니다.
-- 실제 테이블은 이미 Supabase에 존재하므로 이 파일을 실행할 필요가 없습니다.
-- ============================================================================

-- ============================================================================
-- TABLE LIST (테이블 목록)
-- ============================================================================
/*
 1. ai_generated_models       - AI 생성 3D 모델
 2. api_keys                  - API 키 관리
 3. background_tasks          - 백그라운드 작업 (슬라이싱 등)
 4. cameras                   - 카메라 설정
 5. chat_messages             - 채팅 메시지
 6. chat_sessions             - 채팅 세션
 7. clients                   - OctoPrint 클라이언트
 8. edge_devices              - 엣지 디바이스 등록
 9. gcode_files               - GCode 파일 메타데이터
10. manufacturing_printers    - Cura 프린터 정의
11. model_print_history       - 모델 출력 이력
12. notifications             - 사용자 알림
13. payment_history           - 결제 내역
14. payment_methods           - 결제 수단
15. printer_groups            - 프린터 그룹
16. printer_temperature_logs  - 실시간 온도 로그
17. printer_temperature_sessions - 온도 세션 (아카이브)
18. printers                  - 사용자 프린터
19. profiles                  - 사용자 프로필
20. subscription_plans        - 구독 플랜 정의
21. usage_logs                - 사용량 상세 로그
22. user_device_tokens        - 푸시 알림 토큰
23. user_notification_settings- 알림 설정
24. user_subscriptions        - 사용자 구독 정보
25. user_usage                - 유저별 사용량 추적

삭제된 테이블 (20251209150000_drop_unused_tables.sql):
- ai_usage_logs          -> user_usage로 대체
- failure_scenes         -> 미사용
- paddle_customers       -> user_subscriptions.paddle_customer_id로 관리
- paddle_subscriptions   -> user_subscriptions로 통합
- paddle_transactions    -> payment_history로 관리
- print_jobs             -> MQTT 실시간 처리
- printer_position_history -> 미사용
- printer_status         -> MQTT 실시간 처리
- stl_files              -> Storage 버킷 직접 저장
*/

-- ============================================================================
-- 1. ai_generated_models (AI 생성 3D 모델)
-- ============================================================================
/*
CREATE TABLE public.ai_generated_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_type VARCHAR(50) NOT NULL CHECK (generation_type IN ('text_to_3d', 'image_to_3d', 'text_to_image')),
  prompt TEXT,                          -- 텍스트 프롬프트
  source_image_url TEXT,                -- 원본 이미지 URL (image_to_3d)
  art_style VARCHAR,
  target_polycount NUMERIC,
  symmetry_mode VARCHAR,
  model_name VARCHAR(255) NOT NULL,
  short_name VARCHAR(50),               -- Claude API로 생성된 짧은 영문 이름
  file_format VARCHAR(20) NOT NULL DEFAULT 'glb',
  storage_path TEXT NOT NULL,           -- GLB 파일 Storage 경로
  download_url TEXT,                    -- GLB 파일 다운로드 URL
  stl_storage_path TEXT,                -- STL 파일 Storage 경로
  stl_download_url TEXT,                -- STL 파일 다운로드 URL
  gcode_url TEXT,                       -- GCode 파일 URL
  file_size BIGINT,
  thumbnail_url TEXT,
  model_dimensions JSONB,               -- {x, y, z} mm
  generation_metadata JSONB,
  status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed', 'archived')),
  tags TEXT[],
  is_favorite BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  printed_count INTEGER DEFAULT 0,
  last_printed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 2. api_keys (API 키 관리)
-- ============================================================================
/*
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  key_hash VARCHAR NOT NULL,
  key_prefix VARCHAR NOT NULL,
  permissions JSONB,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 3. background_tasks (백그라운드 작업)
-- ============================================================================
/*
CREATE TABLE public.background_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,              -- 'slicing', 'conversion', etc.
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  model_id UUID REFERENCES ai_generated_models(id) ON DELETE SET NULL,
  printer_id TEXT,
  printer_model_id TEXT,
  input_url TEXT,
  input_params JSONB,
  output_url TEXT,
  output_metadata JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
*/

-- ============================================================================
-- 4. cameras (카메라 설정)
-- ============================================================================
/*
CREATE TABLE public.cameras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_uuid TEXT NOT NULL,
  stream_url TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
*/

-- ============================================================================
-- 5. chat_messages (채팅 메시지)
-- ============================================================================
/*
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                   -- 'user', 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
*/

-- ============================================================================
-- 6. chat_sessions (채팅 세션)
-- ============================================================================
/*
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0
);
*/

-- ============================================================================
-- 7. clients (OctoPrint 클라이언트)
-- ============================================================================
/*
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_uuid TEXT,
  software_uuid TEXT,
  display_name TEXT,
  device_type TEXT NOT NULL DEFAULT 'printer',
  status TEXT NOT NULL DEFAULT 'disconnected',
  ip_address TEXT,
  port INTEGER DEFAULT 80,
  client_key TEXT,
  firmware TEXT,
  firmware_version TEXT DEFAULT 'marlin',
  metadata JSONB,
  last_seen TIMESTAMPTZ,
  last_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
*/

-- ============================================================================
-- 8. edge_devices (엣지 디바이스)
-- ============================================================================
/*
CREATE TABLE public.edge_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_uuid TEXT NOT NULL UNIQUE,
  device_name TEXT,
  device_type TEXT DEFAULT 'raspberry_pi',
  status TEXT DEFAULT 'pending',
  ip_address TEXT,
  mac_address TEXT,
  firmware_version TEXT,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 9. gcode_files (GCode 파일 메타데이터)
-- ============================================================================
/*
CREATE TABLE public.gcode_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id UUID REFERENCES ai_generated_models(id) ON DELETE CASCADE,
  printer_id TEXT,                      -- 프린터 device_uuid
  filename TEXT NOT NULL,               -- 원본 파일명
  short_filename TEXT,                  -- MQTT 전송용 짧은 파일명
  file_path TEXT NOT NULL,              -- Storage 경로
  file_size BIGINT NOT NULL,
  manufacturer TEXT,
  series TEXT,
  printer_model_name TEXT,
  printer_name TEXT,
  print_time_formatted TEXT,
  print_time_seconds NUMERIC,
  filament_used_m NUMERIC,
  filament_weight_g NUMERIC,
  filament_cost NUMERIC,
  layer_count INTEGER,
  layer_height NUMERIC,
  bounding_box JSONB,
  nozzle_temp NUMERIC,
  bed_temp NUMERIC,
  status TEXT DEFAULT 'uploaded',
  upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
*/

-- ============================================================================
-- 10. manufacturing_printers (Cura 프린터 정의)
-- ============================================================================
/*
CREATE TABLE public.manufacturing_printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer TEXT NOT NULL,
  series TEXT NOT NULL DEFAULT 'unknown',
  model TEXT NOT NULL,
  display_name TEXT NOT NULL,
  filename TEXT NOT NULL UNIQUE,        -- Cura DEF 파일명
  version INTEGER DEFAULT 2,
  inherits TEXT,
  visible BOOLEAN DEFAULT true,
  author TEXT,
  def_file_url TEXT,
  def_file_path TEXT,
  metadata JSONB,
  build_volume JSONB,                   -- {x, y, z}
  extruder_count INTEGER DEFAULT 1,
  heated_bed BOOLEAN DEFAULT true,
  file_formats TEXT[],
  technology TEXT DEFAULT 'FDM',
  nozzle_diameter NUMERIC,
  layer_height_min NUMERIC,
  layer_height_max NUMERIC,
  supports_usb_connection BOOLEAN DEFAULT false,
  supports_network_connection BOOLEAN DEFAULT false,
  supports_material_flow_sensor BOOLEAN DEFAULT false,
  cura_engine_support BOOLEAN,
  tags TEXT[],
  category TEXT,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 11. model_print_history (모델 출력 이력)
-- ============================================================================
-- NOTE: model_id는 nullable (OctoPrint 직접 출력 시 AI 모델 없이 출력 기록 가능)
/*
CREATE TABLE public.model_print_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES ai_generated_models(id) ON DELETE SET NULL,  -- nullable for direct prints
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  print_status VARCHAR(50) DEFAULT 'queued' CHECK (print_status IN ('queued', 'printing', 'paused', 'completed', 'failed', 'cancelled')),
  print_settings JSONB,                   -- {file_name, file_path, file_size, file_origin, estimated_time}
  gcode_file_id UUID REFERENCES gcode_files(id) ON DELETE SET NULL,
  gcode_url TEXT,                         -- GCode file URL from Storage bucket
  short_filename TEXT,                    -- Short filename for display (from OctoPrint)
  print_time INTERVAL,
  filament_used NUMERIC,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 12. notifications (사용자 알림)
-- ============================================================================
/*
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  message_en TEXT,                      -- 영문 메시지
  type TEXT NOT NULL,                   -- 'ai_model_complete', 'print_complete', etc.
  read BOOLEAN NOT NULL DEFAULT false,
  related_id TEXT,
  related_type TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
*/

-- ============================================================================
-- 13. payment_history (결제 내역)
-- ============================================================================
/*
CREATE TABLE public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  plan_name VARCHAR NOT NULL,
  amount NUMERIC NOT NULL,
  currency VARCHAR DEFAULT 'KRW',
  status VARCHAR NOT NULL CHECK (status IN ('success', 'failed', 'refunded', 'pending', 'canceled')),
  payment_method VARCHAR,
  card_company VARCHAR,
  card_number VARCHAR,
  payment_key VARCHAR,
  order_id VARCHAR,
  transaction_id VARCHAR,
  receipt_url TEXT,
  refund_reason TEXT,
  refunded_amount NUMERIC,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 14. payment_methods (결제 수단)
-- ============================================================================
/*
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method_type VARCHAR NOT NULL,         -- 'card', 'bank', etc.
  card_company VARCHAR,
  card_number VARCHAR,                  -- 마스킹된 카드번호
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 15. printer_groups (프린터 그룹)
-- ============================================================================
/*
CREATE TABLE public.printer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
*/

-- ============================================================================
-- 16. printer_temperature_logs (실시간 온도 로그)
-- ============================================================================
/*
CREATE TABLE public.printer_temperature_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  nozzle_temp DOUBLE PRECISION NOT NULL,
  nozzle_target DOUBLE PRECISION,
  bed_temp DOUBLE PRECISION NOT NULL,
  bed_target DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  job_id UUID REFERENCES model_print_history(id) ON DELETE SET NULL
);
-- Max 800 records per printer, auto-archived to sessions
*/

-- ============================================================================
-- 17. printer_temperature_sessions (온도 세션 아카이브)
-- ============================================================================
/*
CREATE TABLE public.printer_temperature_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES model_print_history(id) ON DELETE SET NULL,
  session_start TIMESTAMPTZ NOT NULL,
  session_end TIMESTAMPTZ,
  reading_count INTEGER DEFAULT 0,
  nozzle_avg DOUBLE PRECISION,
  nozzle_min DOUBLE PRECISION,
  nozzle_max DOUBLE PRECISION,
  bed_avg DOUBLE PRECISION,
  bed_min DOUBLE PRECISION,
  bed_max DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 18. printers (사용자 프린터)
-- ============================================================================
/*
CREATE TABLE public.printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES printer_groups(id) ON DELETE SET NULL,
  device_uuid TEXT,
  printer_uuid TEXT,
  name TEXT,
  model TEXT NOT NULL,
  manufacture_id TEXT,
  ip_address TEXT,
  port INTEGER NOT NULL DEFAULT 80,
  api_key TEXT,
  firmware TEXT DEFAULT 'marlin',
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_connected TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Realtime enabled for status monitoring
*/

-- ============================================================================
-- 19. profiles (사용자 프로필)
-- ============================================================================
/*
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
*/

-- ============================================================================
-- 20. subscription_plans (구독 플랜 정의)
-- ============================================================================
/*
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 플랜 식별
  plan_code VARCHAR(20) UNIQUE NOT NULL,          -- free, pro, enterprise
  display_name VARCHAR(50) NOT NULL,              -- Free, Pro, Enterprise
  display_name_ko VARCHAR(50),                    -- 무료, 프로, 엔터프라이즈
  description TEXT,                               -- 플랜 설명
  -- 가격 정보
  price_monthly INTEGER DEFAULT 0,                -- 월간 가격 (원)
  price_yearly INTEGER DEFAULT 0,                 -- 연간 가격 (원)
  paddle_price_id_monthly VARCHAR(100),           -- Paddle 월간 결제 Price ID
  paddle_price_id_yearly VARCHAR(100),            -- Paddle 연간 결제 Price ID
  -- 수량 제한 (-1 = 무제한)
  max_printers INTEGER DEFAULT 1,                 -- 최대 프린터 등록 수
  ai_generation_limit INTEGER DEFAULT 20,         -- 월간 AI 모델 생성 한도
  storage_limit_gb INTEGER DEFAULT 1,             -- 스토리지 한도 (GB)
  webcam_reconnect_interval INTEGER,              -- 웹캠 재연결 간격 (분, NULL = 무제한)
  -- 기능 플래그
  has_analytics BOOLEAN DEFAULT false,            -- 분석 기능
  has_push_notifications BOOLEAN DEFAULT true,    -- 푸시 알림
  has_api_access BOOLEAN DEFAULT false,           -- API 접근
  has_ai_assistant BOOLEAN DEFAULT false,         -- AI 어시스턴트
  has_erp_mes_integration BOOLEAN DEFAULT false,  -- ERP/MES 연동
  has_community_support BOOLEAN DEFAULT true,     -- 커뮤니티 지원
  has_priority_support BOOLEAN DEFAULT false,     -- 우선 지원
  has_dedicated_support BOOLEAN DEFAULT false,    -- 전담 지원
  -- 관리
  sort_order INTEGER DEFAULT 0,                   -- 표시 순서
  is_active BOOLEAN DEFAULT true,                 -- 활성화 여부
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 플랜 데이터:
-- free:       max_printers=1, ai_generation_limit=20
-- pro:        max_printers=5, ai_generation_limit=50
-- enterprise: max_printers=-1 (무제한), ai_generation_limit=-1 (무제한)
*/

-- ============================================================================
-- 21. usage_logs (사용량 상세 로그)
-- ============================================================================
/*
CREATE TABLE public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_type VARCHAR(30) NOT NULL,
    -- 'ai_model_generation' - AI 3D 모델 생성
    -- 'ai_image_generation' - AI 이미지 생성
    -- 'printer_registration' - 프린터 등록
    -- 'printer_deletion'    - 프린터 삭제
    -- 'storage_upload'      - 파일 업로드
    -- 'api_call'            - API 호출
  action VARCHAR(20) NOT NULL,                    -- create, delete, update
  resource_id UUID,                               -- 모델 ID, 프린터 ID 등
  resource_type VARCHAR(30),                      -- ai_model, printer, gcode, storage
  delta INTEGER DEFAULT 1,                        -- +1 (추가), -1 (삭제)
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: 사용자는 자신의 로그만 조회 가능
-- 함수: log_usage(), log_ai_generation()
*/

-- ============================================================================
-- 22. user_device_tokens (푸시 알림 토큰)
-- ============================================================================
/*
CREATE TABLE public.user_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  platform TEXT NOT NULL,               -- 'web', 'android', 'ios'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_token)
);
*/

-- ============================================================================
-- 23. user_notification_settings (알림 설정)
-- ============================================================================
/*
CREATE TABLE public.user_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  push_notifications BOOLEAN DEFAULT true,
  print_complete_notifications BOOLEAN DEFAULT true,
  error_notifications BOOLEAN DEFAULT true,
  ai_complete_enabled BOOLEAN DEFAULT true,
  payment_enabled BOOLEAN DEFAULT true,
  marketing_enabled BOOLEAN DEFAULT false,
  email_notifications BOOLEAN DEFAULT false,
  weekly_report BOOLEAN DEFAULT false,
  notification_sound BOOLEAN DEFAULT true,
  notification_frequency TEXT DEFAULT 'immediate',
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 24. user_subscriptions (사용자 구독 정보)
-- ============================================================================
/*
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id), -- 플랜 테이블 참조
  plan_name VARCHAR NOT NULL DEFAULT 'free',
  status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'trialing')),
  billing_cycle VARCHAR(10) DEFAULT 'monthly',    -- monthly, yearly
  provider TEXT DEFAULT 'paddle',                 -- 'paddle'
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,                       -- 취소 일시
  trial_start TIMESTAMPTZ,                        -- 체험 시작일
  trial_end TIMESTAMPTZ,                          -- 체험 종료일
  -- Paddle
  paddle_subscription_id TEXT,
  paddle_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 함수: get_user_plan_info() - 플랜 정보 및 제한 조회
*/

-- ============================================================================
-- 25. user_usage (유저별 사용량 추적) - 유저당 1개 row
-- ============================================================================
/*
CREATE TABLE public.user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 기간 (월별 리셋용)
  period_year INTEGER NOT NULL,                   -- 현재 추적 기간 연도
  period_month INTEGER NOT NULL,                  -- 현재 추적 기간 월
  -- AI 사용량 (월별 리셋)
  ai_model_generation INTEGER DEFAULT 0,          -- AI 3D 모델 생성 횟수
  ai_image_generation INTEGER DEFAULT 0,          -- AI 이미지 생성 횟수
  -- 프린터 (누적)
  printer_count INTEGER DEFAULT 0,                -- 현재 등록된 프린터 수
  -- 스토리지 (누적)
  storage_bytes BIGINT DEFAULT 0,                 -- 스토리지 사용량 (바이트)
  -- API (월별 리셋)
  api_calls INTEGER DEFAULT 0,                    -- API 호출 횟수
  -- 메타데이터
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 월별 리셋: ai_model_generation, ai_image_generation, api_calls
-- 누적 유지: printer_count, storage_bytes
-- RLS: 사용자는 자신의 사용량만 조회/수정 가능
-- 함수: increment_usage(), increment_storage(), get_current_usage(),
--       get_user_usage(), check_usage_limit()
*/

-- ============================================================================
-- STORAGE BUCKETS (스토리지 버킷)
-- ============================================================================
/*
1. ai-models           - AI 생성 모델 파일 (GLB, STL, PNG)
                        50MB, public

2. gcode-files         - GCode 파일
                        50MB, public

3. stl-files           - STL 파일
                        구조: {userId}/stl/{filename}.stl

4. feedback-images     - 피드백 첨부 이미지
                        public

5. avatars             - 사용자 아바타 이미지
*/

-- ============================================================================
-- END OF SCHEMA REFERENCE
-- ============================================================================
