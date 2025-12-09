-- ============================================================================
-- FACTOR HIBRID - Supabase Database Schema Reference
-- Generated: 2025-12-09
-- Total Tables: 27
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
 8. failure_scenes            - 출력 실패 감지 데이터
 9. gcode_files               - GCode 파일 메타데이터
10. manufacturing_printers    - Cura 프린터 정의
11. model_print_history       - 모델 출력 이력
12. notifications             - 사용자 알림
13. paddle_customers          - Paddle 고객 정보
14. paddle_subscriptions      - Paddle 구독 정보
15. paddle_transactions       - Paddle 결제 내역
16. payment_history           - 결제 내역 (레거시)
17. print_jobs                - 출력 작업 기록
18. printer_groups            - 프린터 그룹
19. printer_position_history  - 프린터 위치 이력
20. printer_status            - 프린터 상태 (평균 온도)
21. printer_temperature_logs  - 실시간 온도 로그
22. printers                  - 사용자 프린터
23. profiles                  - 사용자 프로필
24. stl_files                 - STL 파일 관리
25. user_device_tokens        - 푸시 알림 토큰
26. user_notification_settings- 알림 설정
27. user_subscriptions        - 사용자 구독 정보
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
  short_name VARCHAR(50),               -- Claude API로 생성된 짧은 영문 이름 (아카이브 표시 및 GCode 파일명용)
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
-- 8. failure_scenes (출력 실패 감지)
-- ============================================================================
/*
CREATE TABLE public.failure_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_uuid UUID NOT NULL,
  failure_type VARCHAR NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  severity VARCHAR NOT NULL DEFAULT 'medium',
  detection_model VARCHAR DEFAULT 'spaghetti_detective',
  original_frame_url TEXT NOT NULL,
  annotated_frame_url TEXT,
  before_frames_url TEXT,
  after_frames_url TEXT,
  gcode_filename VARCHAR,
  layer_number INTEGER,
  print_progress DOUBLE PRECISION,
  nozzle_temp DOUBLE PRECISION,
  bed_temp DOUBLE PRECISION,
  print_speed DOUBLE PRECISION,
  fan_speed INTEGER,
  z_height DOUBLE PRECISION,
  estimated_time_remaining INTEGER,
  detection_bbox JSONB,
  detection_mask_url TEXT,
  raw_prediction_data JSONB,
  gpt_description TEXT,
  gpt_root_cause TEXT,
  gpt_suggested_action TEXT,
  gpt_prevention_tips TEXT,
  gpt_raw_response TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_false_positive BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  include_in_dataset BOOLEAN DEFAULT true,
  dataset_split VARCHAR,
  dataset_exported_at TIMESTAMPTZ,
  action_taken VARCHAR,
  user_notified BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
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
  short_filename TEXT,                  -- MQTT 전송용 짧은 파일명 (e.g., snowman.gcode)
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
  technology TEXT DEFAULT 'FDM' CHECK (technology IN ('FDM', 'SLA', 'SLS', 'DLP', 'Binder Jetting', 'Material Jetting', 'Other')),
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
/*
CREATE TABLE public.model_print_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES ai_generated_models(id) ON DELETE CASCADE,
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  print_status VARCHAR(50) DEFAULT 'queued' CHECK (print_status IN ('queued', 'printing', 'paused', 'completed', 'failed', 'cancelled')),
  print_settings JSONB,
  gcode_file_id UUID REFERENCES gcode_files(id) ON DELETE SET NULL,
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
  type TEXT NOT NULL,                   -- 'ai_model_complete', 'print_complete', 'print_error', etc.
  read BOOLEAN NOT NULL DEFAULT false,
  related_id TEXT,
  related_type TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
*/

-- ============================================================================
-- 13. paddle_customers (Paddle 고객)
-- ============================================================================
/*
CREATE TABLE public.paddle_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_customer_id TEXT NOT NULL UNIQUE,
  email TEXT,
  name TEXT,
  locale TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 14. paddle_subscriptions (Paddle 구독)
-- ============================================================================
/*
CREATE TABLE public.paddle_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_subscription_id TEXT NOT NULL UNIQUE,
  paddle_customer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  plan_name TEXT NOT NULL DEFAULT 'pro',
  price_id TEXT,
  currency TEXT DEFAULT 'USD',
  unit_price INTEGER,
  billing_cycle_interval TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 15. paddle_transactions (Paddle 결제 내역)
-- ============================================================================
/*
CREATE TABLE public.paddle_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_transaction_id TEXT NOT NULL UNIQUE,
  paddle_subscription_id TEXT,
  paddle_customer_id TEXT,
  status TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_method TEXT,
  receipt_url TEXT,
  invoice_number TEXT,
  billed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 16. payment_history (결제 내역 - 레거시)
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
-- 17. print_jobs (출력 작업 기록)
-- ============================================================================
/*
CREATE TABLE public.print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_size BIGINT,
  file_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'failed')),
  progress DOUBLE PRECISION DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_duration INTERVAL,
  actual_duration INTERVAL,
  filament_used DOUBLE PRECISION,
  filament_type TEXT,
  current_layer INTEGER,
  total_layers INTEGER,
  failure_reason TEXT,
  cancelled_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
*/

-- ============================================================================
-- 18. printer_groups (프린터 그룹)
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
-- 19. printer_position_history (프린터 위치 이력)
-- ============================================================================
/*
CREATE TABLE public.printer_position_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  x_current NUMERIC,
  y_current NUMERIC,
  z_current NUMERIC,
  e_current NUMERIC,
  x_target NUMERIC,
  y_target NUMERIC,
  z_target NUMERIC,
  e_target NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 20. printer_status (프린터 상태)
-- ============================================================================
/*
CREATE TABLE public.printer_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  nozzle_avg_30s DOUBLE PRECISION,
  bed_avg_30s DOUBLE PRECISION,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 21. printer_temperature_logs (실시간 온도 로그)
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
-- 22. printers (사용자 프린터)
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
-- 23. profiles (사용자 프로필)
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
-- 24. stl_files (STL 파일 관리)
-- ============================================================================
/*
CREATE TABLE public.stl_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_model_id UUID REFERENCES ai_generated_models(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_url TEXT,
  thumbnail_path TEXT,
  thumbnail_url TEXT,
  triangle_count INTEGER,
  bounding_box JSONB,
  print_time_estimate INTEGER,
  filament_estimate REAL,
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'ready', 'printing', 'completed', 'failed')),
  tags TEXT[],
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 25. user_device_tokens (푸시 알림 토큰)
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
-- 26. user_notification_settings (알림 설정)
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
  notification_frequency TEXT DEFAULT 'immediate' CHECK (notification_frequency IN ('immediate', 'hourly', 'daily')),
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 27. user_subscriptions (사용자 구독 정보)
-- ============================================================================
/*
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name VARCHAR NOT NULL DEFAULT 'basic',
  status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired', 'trial')),
  provider TEXT DEFAULT 'toss',         -- 'toss', 'paddle'
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  cancel_at_period_end BOOLEAN DEFAULT false,
  -- Toss Payments (레거시)
  toss_payment_key VARCHAR,
  toss_order_id VARCHAR,
  toss_billing_key VARCHAR,
  -- Paddle
  paddle_subscription_id TEXT,
  paddle_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- STORAGE BUCKETS (스토리지 버킷)
-- ============================================================================
/*
1. ai-models           - AI 생성 모델 파일 (GLB, STL, PNG)
                        50MB, public
                        MIME: model/gltf-binary, application/octet-stream, image/png, image/jpeg, image/webp

2. gcode-files         - GCode 파일
                        50MB, public
                        MIME: text/plain, text/x-gcode
                        구조: {userId}/{modelId}/{modelFolder}/{filename}.gcode (AI)
                              {userId}/{uploadId}/{filename}.gcode (직접 업로드)

3. stl-files           - STL 파일
                        구조: {userId}/stl/{filename}.stl

4. feedback-images     - 피드백 첨부 이미지
                        public
                        구조: {userId}/{filename}

5. failure-scenes      - 출력 실패 감지 이미지
*/

-- ============================================================================
-- END OF SCHEMA REFERENCE
-- ============================================================================
