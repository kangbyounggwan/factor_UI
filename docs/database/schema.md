# FACTOR HIBRID - Database Schema

> **Last Updated:** 2026-01-16
> **Database:** Supabase (PostgreSQL)
> **Total Tables:** 30+

---

## 목차

1. [테이블 목록](#테이블-목록)
2. [핵심 테이블](#핵심-테이블)
3. [커뮤니티 테이블](#커뮤니티-테이블)
4. [AI/3D 모델 테이블](#ai3d-모델-테이블)
5. [프린터 관리 테이블](#프린터-관리-테이블)
6. [결제/구독 테이블](#결제구독-테이블)
7. [사용량 추적 테이블](#사용량-추적-테이블)
8. [Storage Buckets](#storage-buckets)
9. [ENUM Types](#enum-types)

---

## 테이블 목록

### 핵심 테이블
| 테이블명 | 설명 |
|---------|------|
| `profiles` | 사용자 프로필 |
| `user_notification_settings` | 알림 설정 |
| `user_device_tokens` | 푸시 알림 토큰 |
| `notifications` | 사용자 알림 |
| `api_keys` | API 키 관리 |

### 커뮤니티 테이블
| 테이블명 | 설명 |
|---------|------|
| `community_posts` | 게시물 |
| `community_comments` | 댓글 |
| `community_post_votes` | 게시물 투표 (좋아요/싫어요/유용함) |
| `community_comment_votes` | 댓글 투표 (좋아요/싫어요/유용함) |

### AI/3D 모델 테이블
| 테이블명 | 설명 |
|---------|------|
| `ai_generated_models` | AI 생성 3D 모델 |
| `gcode_files` | GCode 파일 메타데이터 |
| `gcode_analysis_results` | G-code 분석 결과 |
| `gcode_segment_data` | G-code 세그먼트 데이터 |
| `background_tasks` | 백그라운드 작업 |
| `chat_sessions` | 채팅 세션 |
| `chat_messages` | 채팅 메시지 |

### 프린터 관리 테이블
| 테이블명 | 설명 |
|---------|------|
| `printers` | 사용자 프린터 |
| `printer_groups` | 프린터 그룹 |
| `printer_temperature_logs` | 실시간 온도 로그 |
| `printer_temperature_sessions` | 온도 세션 (아카이브) |
| `manufacturing_printers` | Cura 프린터 정의 |
| `clients` | OctoPrint 클라이언트 |
| `edge_devices` | 엣지 디바이스 |
| `cameras` | 카메라 설정 |
| `model_print_history` | 모델 출력 이력 |

### 결제/구독 테이블
| 테이블명 | 설명 |
|---------|------|
| `subscription_plans` | 구독 플랜 정의 |
| `user_subscriptions` | 사용자 구독 정보 |
| `payment_history` | 결제 내역 |
| `payment_methods` | 결제 수단 |

### 사용량 추적 테이블
| 테이블명 | 설명 |
|---------|------|
| `user_usage` | 유저별 사용량 추적 |
| `usage_logs` | 사용량 상세 로그 |

---

## 핵심 테이블

### profiles (사용자 프로필)

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,                    -- 실명 (필수, 본인확인용)
  display_name TEXT,                 -- 닉네임 (선택, 커뮤니티 표시용)
  avatar_url TEXT,                   -- 프로필 이미지 URL
  phone TEXT,                        -- 휴대폰 번호 (필수)
  role TEXT DEFAULT 'user',          -- 'user', 'admin'
  equipment_presets JSONB DEFAULT '[]',  -- 장비 프리셋 목록
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**equipment_presets 구조:**
```json
[
  {
    "id": "uuid-v4",
    "name": "메인 프린터",
    "is_default": true,
    "printer": {
      "model": "Ender 3 V2",
      "firmware": "Klipper",
      "nozzle_size": "0.4mm",
      "bed_type": "PEI"
    },
    "filament": {
      "type": "PLA",
      "brand": "eSUN",
      "dried": true
    },
    "slicer": {
      "name": "OrcaSlicer",
      "profile": "0.2mm Quality"
    }
  }
]
```

---

## 커뮤니티 테이블

### community_posts (게시물)

```sql
CREATE TABLE community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'showcase',        -- 자랑
    'question',        -- 질문
    'tip',             -- 팁
    'review',          -- 리뷰
    'free',            -- 자유
    'troubleshooting'  -- 트러블슈팅
  )),
  author_display_type TEXT DEFAULT 'nickname' CHECK (author_display_type IN (
    'nickname',   -- 닉네임으로 표시
    'realname',   -- 실명으로 표시
    'anonymous'   -- 익명으로 표시
  )),
  images TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  dislike_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_solved BOOLEAN DEFAULT FALSE,
  accepted_answer_id UUID,
  troubleshooting_meta JSONB,        -- 트러블슈팅 메타데이터
  model_id UUID REFERENCES ai_generated_models(id),  -- 첨부 모델
  gcode_files JSONB DEFAULT '[]',    -- 첨부 G-code 파일 목록
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**troubleshooting_meta 구조:**
```json
{
  "printer_model": "Ender 3 V2",
  "firmware": "Klipper",
  "nozzle_size": "0.4mm",
  "bed_type": "PEI",
  "filament_type": "PLA",
  "filament_brand": "eSUN",
  "filament_dried": true,
  "slicer": "OrcaSlicer",
  "slicer_profile": "0.2mm Quality",
  "print_speed": "60mm/s",
  "nozzle_temp": "200°C",
  "bed_temp": "60°C",
  "symptoms": ["stringing", "layer_shift"]
}
```

### community_comments (댓글)

```sql
CREATE TABLE community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,  -- 대댓글
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',        -- 댓글 이미지
  like_count INTEGER DEFAULT 0,
  dislike_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  is_accepted BOOLEAN DEFAULT FALSE, -- 채택된 답변
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### community_post_votes (게시물 투표) ⭐ 통합 테이블

```sql
CREATE TABLE community_post_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type vote_type NOT NULL,      -- 'like', 'dislike', 'helpful'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id, vote_type)
);
```

### community_comment_votes (댓글 투표) ⭐ 통합 테이블

```sql
CREATE TABLE community_comment_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES community_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type vote_type NOT NULL,      -- 'like', 'dislike', 'helpful'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id, vote_type)
);
```

---

## AI/3D 모델 테이블

### ai_generated_models (AI 생성 3D 모델)

```sql
CREATE TABLE ai_generated_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_type VARCHAR(50) NOT NULL CHECK (generation_type IN (
    'text_to_3d',
    'image_to_3d',
    'text_to_image'
  )),
  prompt TEXT,
  source_image_url TEXT,
  art_style VARCHAR,
  target_polycount NUMERIC,
  symmetry_mode VARCHAR,
  model_name VARCHAR(255) NOT NULL,
  short_name VARCHAR(50),            -- Claude API로 생성된 짧은 영문 이름
  file_format VARCHAR(20) DEFAULT 'glb',
  storage_path TEXT NOT NULL,
  download_url TEXT,
  stl_storage_path TEXT,
  stl_download_url TEXT,
  gcode_url TEXT,
  file_size BIGINT,
  thumbnail_url TEXT,
  model_dimensions JSONB,            -- {x, y, z} mm
  generation_metadata JSONB,
  status VARCHAR(50) DEFAULT 'completed' CHECK (status IN (
    'processing', 'completed', 'failed', 'archived'
  )),
  tags TEXT[],
  is_favorite BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  printed_count INTEGER DEFAULT 0,
  last_printed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### gcode_files (GCode 파일 메타데이터)

```sql
CREATE TABLE gcode_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id UUID REFERENCES ai_generated_models(id) ON DELETE CASCADE,
  printer_id TEXT,
  filename TEXT NOT NULL,
  short_filename TEXT,               -- MQTT 전송용 짧은 파일명
  file_path TEXT NOT NULL,
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
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 프린터 관리 테이블

### printers (사용자 프린터)

```sql
CREATE TABLE printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES printer_groups(id) ON DELETE SET NULL,
  device_uuid TEXT,
  printer_uuid TEXT,
  name TEXT,
  model TEXT NOT NULL,
  manufacture_id TEXT,
  ip_address TEXT,
  port INTEGER DEFAULT 80,
  api_key TEXT,
  firmware TEXT DEFAULT 'marlin',
  status TEXT DEFAULT 'disconnected',
  last_connected TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Realtime enabled for status monitoring
```

### printer_temperature_logs (실시간 온도 로그)

```sql
CREATE TABLE printer_temperature_logs (
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
```

---

## 결제/구독 테이블

### subscription_plans (구독 플랜 정의)

```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code VARCHAR(20) UNIQUE NOT NULL,  -- 'free', 'starter', 'pro', 'enterprise'
  display_name VARCHAR(50) NOT NULL,
  display_name_ko VARCHAR(50),
  description TEXT,
  price_monthly INTEGER DEFAULT 0,
  price_yearly INTEGER DEFAULT 0,
  paddle_price_id_monthly VARCHAR(100),
  paddle_price_id_yearly VARCHAR(100),
  max_printers INTEGER DEFAULT 1,         -- -1 = 무제한
  ai_generation_limit INTEGER DEFAULT 20, -- -1 = 무제한
  storage_limit_gb INTEGER DEFAULT 1,
  webcam_reconnect_interval INTEGER,
  has_analytics BOOLEAN DEFAULT false,
  has_push_notifications BOOLEAN DEFAULT true,
  has_api_access BOOLEAN DEFAULT false,
  has_ai_assistant BOOLEAN DEFAULT false,
  has_erp_mes_integration BOOLEAN DEFAULT false,
  has_community_support BOOLEAN DEFAULT true,
  has_priority_support BOOLEAN DEFAULT false,
  has_dedicated_support BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**기본 플랜:**
| 플랜 | max_printers | ai_generation_limit | 가격(월) |
|-----|--------------|---------------------|---------|
| free | 1 | 20 | 0 |
| starter | 3 | 100 | 4,900원 |
| pro | 10 | 500 | 14,900원 |
| enterprise | -1 (무제한) | -1 (무제한) | 문의 |

### user_subscriptions (사용자 구독 정보)

```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  plan_name VARCHAR DEFAULT 'free',
  status VARCHAR DEFAULT 'active' CHECK (status IN (
    'active', 'cancelled', 'expired', 'trialing'
  )),
  billing_cycle VARCHAR(10) DEFAULT 'monthly',
  provider TEXT DEFAULT 'paddle',
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month'),
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  paddle_subscription_id TEXT,
  paddle_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 사용량 추적 테이블

### user_usage (유저별 사용량 추적)

```sql
CREATE TABLE user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  ai_model_generation INTEGER DEFAULT 0,   -- 월별 리셋
  ai_image_generation INTEGER DEFAULT 0,   -- 월별 리셋
  printer_count INTEGER DEFAULT 0,          -- 누적
  storage_bytes BIGINT DEFAULT 0,           -- 누적
  api_calls INTEGER DEFAULT 0,              -- 월별 리셋
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Storage Buckets

| 버킷명 | 용도 | 크기 제한 | 공개 |
|-------|------|----------|------|
| `ai-models` | AI 생성 모델 파일 (GLB, STL, PNG) | 50MB | O |
| `gcode-files` | GCode 파일 | 50MB | O |
| `stl-files` | STL 파일 | - | X |
| `feedback-images` | 피드백 첨부 이미지 | - | O |
| `avatars` | 사용자 아바타 이미지 | - | O |
| `community-images` | 커뮤니티 게시물 이미지 | 10MB | O |
| `community-models` | 커뮤니티 3D 모델 | 50MB | O |
| `community-gcode` | 커뮤니티 G-code 파일 | 50MB | O |

---

## ENUM Types

### vote_type

```sql
CREATE TYPE vote_type AS ENUM ('like', 'dislike', 'helpful');
```

**사용처:**
- `community_post_votes.vote_type`
- `community_comment_votes.vote_type`

---

## RLS (Row Level Security) 정책

모든 테이블에 RLS가 활성화되어 있으며, 기본 정책은:

1. **SELECT**: 대부분 공개 (누구나 조회 가능)
2. **INSERT**: 인증된 사용자만, `user_id = auth.uid()` 체크
3. **UPDATE/DELETE**: 본인 데이터만 (`user_id = auth.uid()`)

### 예시: community_posts

```sql
-- 누구나 게시물 조회 가능
CREATE POLICY "Anyone can view posts" ON community_posts
  FOR SELECT USING (true);

-- 인증된 사용자만 게시물 작성 가능
CREATE POLICY "Authenticated users can create posts" ON community_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 본인 게시물만 수정 가능
CREATE POLICY "Users can update their own posts" ON community_posts
  FOR UPDATE USING (auth.uid() = user_id);

-- 본인 게시물만 삭제 가능
CREATE POLICY "Users can delete their own posts" ON community_posts
  FOR DELETE USING (auth.uid() = user_id);
```

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-16 | 투표 테이블 통합 (6개 → 2개) |
| 2026-01-16 | profiles에 equipment_presets 컬럼 추가 |
| 2026-01-16 | community_posts에 author_display_type 컬럼 추가 |
| 2026-01-15 | community_comments에 images 컬럼 추가 |
| 2026-01-12 | profiles에 full_name, display_name 분리 |
| 2026-01-10 | 커뮤니티 테이블 최초 생성 |
