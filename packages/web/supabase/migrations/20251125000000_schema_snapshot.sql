-- ============================================================================
-- Schema Snapshot Migration
-- Generated: 2025-11-25
-- Description: 현재 데이터베이스 스키마의 전체 스냅샷
-- ============================================================================

-- 이 파일은 현재 Supabase 데이터베이스의 모든 테이블 구조를 문서화합니다.
-- 실제 마이그레이션이 아닌 스키마 참조용 문서입니다.

-- ============================================================================
-- TABLES SUMMARY (테이블 요약)
-- ============================================================================
/*
1. profiles                      - 사용자 프로필
2. user_roles                    - 사용자 역할 (admin/user)
3. clients                       - 클라이언트 디바이스
4. printers                      - 프린터 설정 및 상태
5. cameras                       - 카메라 설정 및 스트림 URL
6. ai_generated_models           - AI 생성 3D 모델
7. model_print_history           - 모델 출력 이력
8. manufacturing_printers        - Cura 프린터 정의 (제조사 DB)
9. stl_files                     - STL 파일 관리
10. gcode_files                  - G-code 파일 및 메타데이터
11. user_notification_settings   - 사용자 알림 설정
12. notifications                - 사용자 알림 메시지
13. user_subscriptions           - 사용자 구독 정보
14. payment_history              - 결제 내역
15. payment_methods              - 결제 수단
16. background_tasks             - 백그라운드 작업 (슬라이싱 등)
17. feedback                     - 사용자 피드백
18. user_device_tokens           - 푸시 알림용 디바이스 토큰
*/

-- ============================================================================
-- 1. profiles (사용자 프로필)
-- ============================================================================
-- 참고: auth.users 테이블과 연동
/*
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 2. user_roles (사용자 역할)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
*/

-- ============================================================================
-- 3. clients (클라이언트 디바이스)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_uuid TEXT NOT NULL UNIQUE,
  device_name TEXT,
  device_type TEXT,
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 4. printers (프린터 설정 및 상태)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_uuid TEXT NOT NULL,
  name TEXT NOT NULL,
  model TEXT,
  manufacturer TEXT,
  manufacture_id TEXT,
  printer_name TEXT,
  ip_address TEXT,
  port INTEGER,
  api_key TEXT,
  is_online BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'idle',
  current_job JSONB,
  temperatures JSONB,
  position JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 5. cameras (카메라 설정)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.cameras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id UUID REFERENCES printers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stream_url TEXT,
  snapshot_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 6. ai_generated_models (AI 생성 3D 모델)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.ai_generated_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_type VARCHAR(50) NOT NULL CHECK (generation_type IN ('text_to_3d', 'image_to_3d', 'text_to_image')),
  prompt TEXT,
  source_image_url TEXT,
  ai_model VARCHAR(50),
  quality VARCHAR(20),
  style VARCHAR(50),
  model_name VARCHAR(255) NOT NULL,
  file_format VARCHAR(20) NOT NULL DEFAULT 'glb',
  storage_path TEXT NOT NULL,
  download_url TEXT,
  stl_url TEXT,                    -- Added by 20251015140000
  file_size BIGINT,
  thumbnail_url TEXT,
  model_dimensions JSONB,
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
-- 7. model_print_history (모델 출력 이력)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.model_print_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES ai_generated_models(id) ON DELETE CASCADE,
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  print_status VARCHAR(50) DEFAULT 'queued' CHECK (print_status IN ('queued', 'printing', 'completed', 'failed', 'cancelled')),
  print_settings JSONB,
  gcode_file_id UUID REFERENCES gcode_files(id) ON DELETE SET NULL,
  print_time INTERVAL,
  filament_used NUMERIC(10, 2),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 8. manufacturing_printers (Cura 프린터 정의)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.manufacturing_printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer TEXT NOT NULL,
  series TEXT NOT NULL DEFAULT 'unknown',
  model TEXT NOT NULL,
  display_name TEXT NOT NULL,
  filename TEXT NOT NULL UNIQUE,
  version INTEGER DEFAULT 2,
  inherits TEXT,
  visible BOOLEAN DEFAULT true,
  author TEXT,
  def_file_url TEXT,
  def_file_path TEXT,
  metadata JSONB,
  build_volume JSONB,
  extruder_count INTEGER DEFAULT 1,
  heated_bed BOOLEAN DEFAULT true,
  file_formats TEXT[],
  technology TEXT DEFAULT 'FDM' CHECK (technology IN ('FDM', 'SLA', 'SLS', 'DLP', 'Binder Jetting', 'Material Jetting', 'Other')),
  nozzle_diameter NUMERIC(5, 2),
  layer_height_min NUMERIC(5, 3),
  layer_height_max NUMERIC(5, 3),
  supports_usb_connection BOOLEAN DEFAULT false,
  supports_network_connection BOOLEAN DEFAULT false,
  supports_material_flow_sensor BOOLEAN DEFAULT false,
  tags TEXT[],
  category TEXT,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 9. stl_files (STL 파일 관리)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.stl_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ai_model_id UUID REFERENCES ai_generated_models(id) ON DELETE SET NULL
);
*/

-- ============================================================================
-- 10. gcode_files (G-code 파일)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.gcode_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_url TEXT,
  model_id UUID REFERENCES ai_generated_models(id) ON DELETE CASCADE,
  printer_id TEXT,
  manufacturer TEXT,
  series TEXT,
  printer_model_name TEXT,
  printer_name TEXT,
  print_time_formatted TEXT,
  filament_used_m NUMERIC,
  filament_weight_g NUMERIC,
  filament_cost NUMERIC,
  layer_count INTEGER,
  layer_height NUMERIC,
  bounding_box JSONB,
  nozzle_temp NUMERIC,
  bed_temp NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 11. user_notification_settings (사용자 알림 설정)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  push_notifications BOOLEAN DEFAULT true,
  print_complete_notifications BOOLEAN DEFAULT true,
  error_notifications BOOLEAN DEFAULT true,
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
-- 12. notifications (알림 메시지)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  related_id TEXT,
  related_type TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
*/

-- ============================================================================
-- 13. user_subscriptions (구독 정보)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_name TEXT NOT NULL DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'canceled', 'expired', 'trial')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  toss_payment_key TEXT,
  toss_order_id TEXT,
  toss_billing_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 14. payment_history (결제 내역)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KRW',
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'refunded', 'pending', 'canceled')),
  payment_method TEXT,
  card_company TEXT,
  card_number TEXT,
  payment_key TEXT,
  order_id TEXT,
  transaction_id TEXT,
  receipt_url TEXT,
  refund_reason TEXT,
  refunded_amount DECIMAL(10, 2),
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 15. payment_methods (결제 수단)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_company TEXT,
  card_number TEXT NOT NULL,
  card_expiry TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  toss_billing_key TEXT,
  toss_customer_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 16. background_tasks (백그라운드 작업)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.background_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('slicing', 'model_generation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  model_id UUID,
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
-- 17. feedback (사용자 피드백)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('issue', 'idea')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  image_urls TEXT[],
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================================================
-- 18. user_device_tokens (푸시 알림용 디바이스 토큰)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS public.user_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,                    -- 디바이스 고유 식별자
  device_token TEXT NOT NULL,                 -- FCM 토큰
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  device_name TEXT,
  device_model TEXT,
  app_version TEXT,
  push_enabled BOOLEAN DEFAULT true,          -- 디바이스별 푸시 알림 ON/OFF
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),     -- 마지막 활성화 시간
  UNIQUE(user_id, device_id)
);
*/

-- ============================================================================
-- STORAGE BUCKETS (스토리지 버킷)
-- ============================================================================
/*
1. ai-models        - AI 생성 모델 파일 (GLB, STL 등)
2. stl-files        - STL 파일
3. stl-thumbnails   - STL 썸네일 (공개)
4. printer-definitions - Cura DEF 파일
5. feedback-images  - 피드백 이미지
*/

-- ============================================================================
-- KEY FUNCTIONS (주요 함수)
-- ============================================================================
/*
1. update_updated_at_column()           - updated_at 자동 업데이트
2. increment_print_count(model_id)      - 모델 출력 횟수 증가
3. get_user_model_stats(user_id)        - 사용자 모델 통계
4. search_manufacturing_printers(query) - 프린터 검색
5. get_manufacturer_stats()             - 제조사별 통계
6. increment_printer_usage(printer_id)  - 프린터 사용 횟수 증가
7. mark_notification_as_read(id)        - 알림 읽음 처리
8. mark_all_notifications_as_read()     - 모든 알림 읽음 처리
9. delete_notification(id)              - 알림 삭제
10. delete_all_notifications()          - 모든 알림 삭제
11. create_slicing_task(...)            - 슬라이싱 작업 생성
12. update_task_status(...)             - 작업 상태 업데이트
13. get_pending_tasks(limit)            - 대기 중인 작업 조회
14. cleanup_inactive_device_tokens()    - 비활성 토큰 정리
*/

-- ============================================================================
-- KEY TRIGGERS (주요 트리거)
-- ============================================================================
/*
1. set_ai_models_updated_at             - ai_generated_models
2. set_manufacturing_printers_updated_at - manufacturing_printers
3. set_stl_files_updated_at             - stl_files
4. update_gcode_files_updated_at_trigger - gcode_files
5. update_user_notification_settings_updated_at_trigger - user_notification_settings
6. update_user_subscriptions_updated_at - user_subscriptions
7. update_payment_methods_updated_at    - payment_methods
8. update_background_tasks_updated_at   - background_tasks
9. update_feedback_updated_at           - feedback
10. trigger_update_user_device_tokens_updated_at - user_device_tokens
11. create_default_notification_settings_on_signup - auth.users (회원가입 시)
*/

-- ============================================================================
-- REMOVED TRIGGERS (제거된 트리거)
-- ============================================================================
/*
1. on_auth_user_created (handle_new_user) - 소셜 로그인 시 자동 프로필 생성 방지
*/

-- ============================================================================
-- Migration History (마이그레이션 이력)
-- ============================================================================
/*
20251015000000 - ai_generated_models, model_print_history
20251015000001 - ai-models bucket
20251015071000 - manufacturing_printers
20251015130000 - stl_files, stl-files/stl-thumbnails buckets
20251015140000 - add stl_url to ai_generated_models
20251015_ai_storage_policies - ai-models storage policies
20251015120000 - cascade delete for ai_generated_models
20251017000000 - add manufacture_id to printers
20251017010000 - add printer_name to printers
20251025000000 - gcode_files metadata columns
20251027000000 - user_notification_settings
20251027010000 - notifications
20251027020000 - user_subscriptions, payment_history
20251027030000 - background_tasks
20251027100000 - gcode model only cache (unique index)
20251027110000 - add cura engine support
20251027120000 - remove auth.users trigger
20251028000000 - fix signup RLS
20251110000000 - payment_methods
20251110010000 - add camera_stream_url
20251116000000 - feedback
20251116010000 - feedback-images bucket
20251117000000 - user_device_tokens
20251121000000 - add device_id to user_device_tokens
20251121100000 - remove handle_new_user trigger
20251125000000 - schema snapshot (this file)
*/

-- ============================================================================
-- End of Schema Snapshot
-- ============================================================================
