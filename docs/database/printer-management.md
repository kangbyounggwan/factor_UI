# 프린터 관리 테이블 스키마

> **Last Updated:** 2026-01-18
> **Database:** Supabase (PostgreSQL)

이 문서는 프린터, 프린터 그룹, 클라이언트, 제조사 정보 관련 테이블들을 정의합니다.

---

## 목차

1. [프린터 그룹](#프린터-그룹)
2. [제조사 프린터 정보](#제조사-프린터-정보)
3. [클라이언트 (OctoPrint)](#클라이언트-octoprint)
4. [모델 출력 이력](#모델-출력-이력)
5. [API 키 관리](#api-키-관리)

---

## 프린터 그룹

### printer_groups

프린터를 그룹으로 관리합니다 (농장/팜 관리용).

```sql
CREATE TABLE printer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                   -- 그룹 이름
  description TEXT,                     -- 설명
  color TEXT,                           -- 그룹 색상 (HEX)
  icon TEXT,                            -- 아이콘 (이모지 또는 아이콘명)
  sort_order INTEGER DEFAULT 0,         -- 정렬 순서
  is_default BOOLEAN DEFAULT FALSE,     -- 기본 그룹 여부
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_printer_groups_user_id ON printer_groups(user_id);
```

**활용 예시:**
- "1층 프린터", "2층 프린터"
- "PLA 전용", "ABS 전용"
- "고객사 A", "고객사 B"

---

## 제조사 프린터 정보

### manufacturing_printers

Cura 슬라이서에서 사용하는 프린터 제조사/모델 정의입니다.

```sql
CREATE TABLE manufacturing_printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer TEXT NOT NULL,           -- 제조사 (예: Creality, Prusa)
  manufacturer_id TEXT,                 -- 제조사 ID (슬라이서용)
  series TEXT,                          -- 시리즈 (예: Ender, i3)
  model_name TEXT NOT NULL,             -- 모델명 (예: Ender 3 V2)
  model_id TEXT,                        -- 모델 ID (슬라이서용)

  -- 빌드 볼륨
  build_volume_x NUMERIC,               -- X 크기 (mm)
  build_volume_y NUMERIC,               -- Y 크기 (mm)
  build_volume_z NUMERIC,               -- Z 크기 (mm)

  -- 기본 설정
  default_nozzle_size NUMERIC DEFAULT 0.4,
  heated_bed BOOLEAN DEFAULT TRUE,
  heated_chamber BOOLEAN DEFAULT FALSE,

  -- 펌웨어
  firmware_type TEXT,                   -- marlin, klipper, reprap 등
  gcode_flavor TEXT,                    -- G-code 방언

  -- 메타데이터
  image_url TEXT,                       -- 프린터 이미지
  specs JSONB,                          -- 상세 스펙
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(manufacturer, model_name)
);

-- 인덱스
CREATE INDEX idx_manufacturing_printers_manufacturer ON manufacturing_printers(manufacturer);
CREATE INDEX idx_manufacturing_printers_model ON manufacturing_printers(model_name);
```

**주요 제조사:**
| 제조사 | 시리즈 예시 |
|-------|------------|
| Creality | Ender, CR, K1 |
| Prusa | i3, MINI, XL |
| Bambu Lab | X1, P1, A1 |
| Voron | 0, 2.4, Trident |
| Anycubic | Kobra, Photon |

**gcode_flavor 값:**
| 값 | 설명 |
|---|------|
| `marlin` | Marlin 펌웨어 |
| `klipper` | Klipper 펌웨어 |
| `reprap` | RepRap 펌웨어 |
| `ultigcode` | Ultimaker |
| `griffin` | Ultimaker S 시리즈 |

---

## 클라이언트 (OctoPrint)

### clients

OctoPrint 클라이언트 (라즈베리파이) 연결 정보입니다.

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_uuid TEXT NOT NULL UNIQUE,     -- 디바이스 고유 ID

  -- 연결 정보
  name TEXT,                            -- 클라이언트 이름
  ip_address TEXT,                      -- IP 주소
  hostname TEXT,                        -- 호스트명

  -- OctoPrint 정보
  octoprint_version TEXT,               -- OctoPrint 버전
  api_key TEXT,                         -- OctoPrint API 키

  -- 상태
  status TEXT DEFAULT 'offline',        -- online, offline, error
  last_seen TIMESTAMPTZ,                -- 마지막 접속 시간
  last_heartbeat TIMESTAMPTZ,           -- 마지막 하트비트

  -- 하드웨어 정보
  hardware_info JSONB,                  -- CPU, RAM, 저장공간 등
  system_info JSONB,                    -- OS, Python 버전 등

  -- MQTT 설정
  mqtt_topic_prefix TEXT,               -- MQTT 토픽 접두사

  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_clients_device_uuid ON clients(device_uuid);
CREATE INDEX idx_clients_status ON clients(status);
```

**status 값:**
| 상태 | 설명 |
|-----|------|
| `online` | 온라인 (연결됨) |
| `offline` | 오프라인 |
| `error` | 에러 상태 |
| `updating` | 업데이트 중 |

**hardware_info 구조:**
```json
{
  "cpu_model": "BCM2711",
  "cpu_cores": 4,
  "ram_total_mb": 4096,
  "ram_available_mb": 2048,
  "storage_total_gb": 32,
  "storage_available_gb": 15,
  "temperature_c": 52.5
}
```

---

## 모델 출력 이력

### model_print_history

3D 모델의 출력 이력을 기록합니다.

```sql
CREATE TABLE model_print_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id UUID REFERENCES ai_generated_models(id) ON DELETE SET NULL,
  gcode_file_id UUID REFERENCES gcode_files(id) ON DELETE SET NULL,
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,

  -- 출력 정보
  print_name TEXT,                      -- 출력 작업 이름
  started_at TIMESTAMPTZ,               -- 시작 시간
  completed_at TIMESTAMPTZ,             -- 완료 시간
  actual_print_time_seconds NUMERIC,    -- 실제 소요 시간

  -- 상태
  status TEXT DEFAULT 'pending',        -- pending, printing, completed, failed, cancelled
  progress NUMERIC DEFAULT 0,           -- 진행률 (0-100)

  -- 필라멘트
  filament_type TEXT,                   -- PLA, ABS, PETG 등
  filament_brand TEXT,                  -- 필라멘트 브랜드
  filament_used_g NUMERIC,              -- 사용된 필라멘트 (g)
  filament_cost NUMERIC,                -- 필라멘트 비용

  -- 품질 평가
  quality_rating INTEGER,               -- 1-5 별점
  quality_notes TEXT,                   -- 품질 메모

  -- 실패 정보
  failure_reason TEXT,                  -- 실패 사유
  failure_layer INTEGER,                -- 실패한 레이어

  -- 이미지
  result_images TEXT[],                 -- 결과물 이미지 URL

  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_print_history_user_id ON model_print_history(user_id);
CREATE INDEX idx_print_history_model_id ON model_print_history(model_id);
CREATE INDEX idx_print_history_printer_id ON model_print_history(printer_id);
CREATE INDEX idx_print_history_status ON model_print_history(status);
```

**status 값:**
| 상태 | 설명 |
|-----|------|
| `pending` | 대기 중 |
| `printing` | 출력 중 |
| `paused` | 일시정지 |
| `completed` | 완료 |
| `failed` | 실패 |
| `cancelled` | 취소 |

**활용:**
- 모델별 출력 횟수 집계
- 필라멘트 사용량 통계
- 프린터별 출력 이력
- 실패율 분석

---

## API 키 관리

### api_keys

외부 API 연동을 위한 키 관리입니다.

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 키 정보
  name TEXT NOT NULL,                   -- 키 이름 (예: "내 앱", "자동화 스크립트")
  key_hash TEXT NOT NULL,               -- 해시된 API 키
  key_prefix TEXT NOT NULL,             -- 키 앞 8자리 (표시용)

  -- 권한
  permissions JSONB DEFAULT '["read"]', -- 권한 배열
  allowed_ips TEXT[],                   -- 허용 IP 목록 (NULL = 전체)

  -- 사용량
  request_count INTEGER DEFAULT 0,      -- 총 요청 수
  last_used_at TIMESTAMPTZ,             -- 마지막 사용 시간

  -- 제한
  rate_limit INTEGER DEFAULT 1000,      -- 시간당 요청 제한
  daily_limit INTEGER DEFAULT 10000,    -- 일일 요청 제한

  -- 상태
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,               -- 만료일 (NULL = 무기한)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
```

**permissions 값:**
| 권한 | 설명 |
|-----|------|
| `read` | 읽기 전용 |
| `write` | 쓰기 가능 |
| `printer_control` | 프린터 제어 |
| `admin` | 관리자 권한 |

**API 키 형식:** `fh_` + 32자리 랜덤 문자열
- 예: `fh_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

---

## 관련 테이블 (다른 문서 참조)

- [printers](./schema.md#프린터-관리-테이블) - 사용자 프린터
- [cameras](./schema.md#cameras-카메라-설정) - 카메라 설정
- [printer_temperature_logs](./schema.md#printer_temperature_logs-실시간-온도-로그) - 온도 로그
- [edge_devices](./schema.md#프린터-관리-테이블) - 엣지 디바이스

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-18 | 최초 문서 작성 (Supabase 실제 스키마 기준) |
