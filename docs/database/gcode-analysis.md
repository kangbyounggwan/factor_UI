# G-code 분석 테이블 스키마

> **Last Updated:** 2026-01-18
> **Database:** Supabase (PostgreSQL)

이 문서는 G-code 파일 분석 및 이슈 관리 관련 테이블들을 정의합니다.

---

## 목차

1. [G-code 분석 리포트](#g-code-분석-리포트)
2. [G-code 세그먼트 데이터](#g-code-세그먼트-데이터)
3. [G-code 이슈 타입](#g-code-이슈-타입)
4. [G-code 이슈 수정](#g-code-이슈-수정)
5. [백그라운드 작업](#백그라운드-작업)

---

## G-code 분석 리포트

### gcode_analysis_reports

G-code 파일 분석 결과를 저장합니다.

```sql
CREATE TABLE gcode_analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gcode_file_id UUID REFERENCES gcode_files(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,               -- 원본 파일명
  file_size BIGINT,                     -- 파일 크기 (bytes)

  -- 분석 상태
  status TEXT DEFAULT 'pending',        -- pending, processing, completed, failed
  progress INTEGER DEFAULT 0,           -- 진행률 (0-100)
  error_message TEXT,                   -- 에러 메시지

  -- 기본 분석 결과
  total_lines INTEGER,                  -- 총 라인 수
  total_layers INTEGER,                 -- 총 레이어 수
  estimated_print_time_seconds NUMERIC, -- 예상 출력 시간
  filament_used_mm NUMERIC,             -- 필라멘트 사용량 (mm)
  filament_used_g NUMERIC,              -- 필라멘트 사용량 (g)

  -- 온도 설정
  nozzle_temp NUMERIC,                  -- 노즐 온도
  bed_temp NUMERIC,                     -- 베드 온도

  -- 바운딩 박스
  bounding_box JSONB,                   -- {min_x, max_x, min_y, max_y, min_z, max_z}

  -- 이슈 요약
  total_issues INTEGER DEFAULT 0,       -- 총 이슈 수
  critical_issues INTEGER DEFAULT 0,    -- 심각한 이슈 수
  warning_issues INTEGER DEFAULT 0,     -- 경고 이슈 수
  info_issues INTEGER DEFAULT 0,        -- 정보 이슈 수

  -- AI 분석 결과
  ai_summary TEXT,                      -- AI 분석 요약
  ai_recommendations JSONB,             -- AI 추천 사항

  -- 메타데이터
  slicer_info JSONB,                    -- 슬라이서 정보
  printer_info JSONB,                   -- 프린터 정보
  analysis_metadata JSONB,              -- 분석 메타데이터

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**status 값:**
| 상태 | 설명 |
|-----|------|
| `pending` | 대기 중 |
| `processing` | 분석 중 |
| `completed` | 완료 |
| `failed` | 실패 |

**bounding_box 구조:**
```json
{
  "min_x": 0,
  "max_x": 220,
  "min_y": 0,
  "max_y": 220,
  "min_z": 0,
  "max_z": 150
}
```

**ai_recommendations 구조:**
```json
[
  {
    "type": "optimization",
    "priority": "high",
    "title": "레트랙션 설정 조정",
    "description": "스트링 방지를 위해 레트랙션 거리를 5mm로 증가 권장",
    "affected_layers": [10, 15, 23]
  }
]
```

---

## G-code 세그먼트 데이터

### gcode_segment_data

레이어별 또는 세그먼트별 상세 분석 데이터입니다.

```sql
CREATE TABLE gcode_segment_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES gcode_analysis_reports(id) ON DELETE CASCADE,

  -- 세그먼트 정보
  segment_type TEXT NOT NULL,           -- 'layer', 'travel', 'extrusion', 'retraction'
  segment_index INTEGER NOT NULL,       -- 세그먼트 순서
  layer_number INTEGER,                 -- 레이어 번호 (레이어 타입인 경우)

  -- 시작/종료 라인
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,

  -- 이동 관련
  travel_distance_mm NUMERIC,           -- 이동 거리
  extrusion_amount_mm NUMERIC,          -- 압출량

  -- 속도 정보
  min_speed NUMERIC,                    -- 최소 속도
  max_speed NUMERIC,                    -- 최대 속도
  avg_speed NUMERIC,                    -- 평균 속도

  -- Z 높이
  z_height NUMERIC,
  layer_height NUMERIC,

  -- 시간 정보
  estimated_time_seconds NUMERIC,       -- 예상 소요 시간

  -- 이슈 정보
  issues JSONB DEFAULT '[]',            -- 해당 세그먼트의 이슈 목록

  -- 원본 G-code (선택적)
  gcode_snippet TEXT,                   -- 해당 세그먼트의 G-code 일부

  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_gcode_segment_report_id ON gcode_segment_data(report_id);
CREATE INDEX idx_gcode_segment_layer ON gcode_segment_data(layer_number);
```

**segment_type 값:**
| 타입 | 설명 |
|-----|------|
| `layer` | 레이어 전체 |
| `travel` | 이동 (비압출) |
| `extrusion` | 압출 |
| `retraction` | 레트랙션 |
| `wipe` | 와이프 동작 |

---

## G-code 이슈 타입

### gcode_issue_types

G-code 분석에서 감지 가능한 이슈 유형 정의입니다.

```sql
CREATE TABLE gcode_issue_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,            -- 이슈 코드 (예: 'RETRACTION_TOO_SHORT')
  name TEXT NOT NULL,                   -- 이슈 이름
  name_ko TEXT,                         -- 한국어 이름
  description TEXT,                     -- 설명
  description_ko TEXT,                  -- 한국어 설명
  severity TEXT NOT NULL,               -- critical, warning, info
  category TEXT NOT NULL,               -- temperature, speed, retraction, travel 등
  detection_rule JSONB,                 -- 감지 규칙 (자동 분석용)
  suggested_fix TEXT,                   -- 권장 해결책
  suggested_fix_ko TEXT,                -- 한국어 해결책
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**severity 값:**
| 심각도 | 설명 | 아이콘 |
|-------|------|--------|
| `critical` | 출력 실패 가능성 높음 | 🔴 |
| `warning` | 품질 저하 가능성 | 🟡 |
| `info` | 참고 정보 | 🔵 |

**category 값:**
| 카테고리 | 설명 |
|---------|------|
| `temperature` | 온도 관련 |
| `speed` | 속도 관련 |
| `retraction` | 레트랙션 관련 |
| `travel` | 이동 경로 관련 |
| `extrusion` | 압출 관련 |
| `layer` | 레이어 관련 |
| `start_end` | 시작/종료 G-code |

**기본 이슈 타입 예시:**
```sql
INSERT INTO gcode_issue_types (code, name, name_ko, severity, category, suggested_fix, suggested_fix_ko) VALUES
('RETRACTION_TOO_SHORT', 'Retraction Too Short', '레트랙션 거리 부족', 'warning', 'retraction', 'Increase retraction distance to 4-6mm', '레트랙션 거리를 4-6mm로 증가'),
('TEMP_TOO_HIGH', 'Temperature Too High', '온도 과열', 'critical', 'temperature', 'Reduce nozzle temperature', '노즐 온도를 낮추세요'),
('EXCESSIVE_TRAVEL', 'Excessive Travel Move', '과도한 이동 거리', 'info', 'travel', 'Enable combing/avoid crossing perimeters', 'Combing 기능 활성화');
```

---

## G-code 이슈 수정

### gcode_issue_edits

사용자가 이슈에 대해 수행한 수정 기록입니다.

```sql
CREATE TABLE gcode_issue_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES gcode_analysis_reports(id) ON DELETE CASCADE,
  issue_type_id UUID REFERENCES gcode_issue_types(id),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 수정 정보
  original_value TEXT,                  -- 원본 값
  new_value TEXT,                       -- 수정된 값
  edit_type TEXT NOT NULL,              -- 'fix', 'ignore', 'note'

  -- 영향 범위
  affected_lines JSONB,                 -- 영향받은 라인 번호들
  affected_layers JSONB,                -- 영향받은 레이어 번호들

  -- 사용자 메모
  note TEXT,

  -- 결과
  is_applied BOOLEAN DEFAULT FALSE,     -- 실제 G-code에 적용 여부
  applied_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**edit_type 값:**
| 타입 | 설명 |
|-----|------|
| `fix` | 수정 적용 |
| `ignore` | 무시 (의도적) |
| `note` | 메모만 추가 |

---

## 백그라운드 작업

### background_tasks

G-code 분석 등 시간이 걸리는 백그라운드 작업을 관리합니다.

```sql
CREATE TABLE background_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 작업 정보
  task_type TEXT NOT NULL,              -- 'gcode_analysis', 'model_generation', 'stl_conversion'
  task_name TEXT,                       -- 작업 이름 (표시용)

  -- 상태
  status TEXT DEFAULT 'pending',        -- pending, running, completed, failed, cancelled
  progress INTEGER DEFAULT 0,           -- 0-100

  -- 입력/출력
  input_data JSONB,                     -- 입력 데이터
  output_data JSONB,                    -- 출력 데이터 (결과)

  -- 에러 처리
  error_message TEXT,
  error_details JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- 시간 정보
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion TIMESTAMPTZ,

  -- 우선순위
  priority INTEGER DEFAULT 0,           -- 높을수록 우선

  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_background_tasks_user_id ON background_tasks(user_id);
CREATE INDEX idx_background_tasks_status ON background_tasks(status);
CREATE INDEX idx_background_tasks_type ON background_tasks(task_type);
```

**task_type 값:**
| 타입 | 설명 |
|-----|------|
| `gcode_analysis` | G-code 파일 분석 |
| `model_generation` | AI 3D 모델 생성 |
| `stl_conversion` | GLB → STL 변환 |
| `gcode_generation` | STL → G-code 슬라이싱 |
| `thumbnail_generation` | 썸네일 생성 |

**status 값:**
| 상태 | 설명 |
|-----|------|
| `pending` | 대기 중 |
| `running` | 실행 중 |
| `completed` | 완료 |
| `failed` | 실패 |
| `cancelled` | 취소됨 |

---

## 인덱스 요약

```sql
-- gcode_analysis_reports
CREATE INDEX idx_gcode_reports_user_id ON gcode_analysis_reports(user_id);
CREATE INDEX idx_gcode_reports_status ON gcode_analysis_reports(status);
CREATE INDEX idx_gcode_reports_file_id ON gcode_analysis_reports(gcode_file_id);

-- gcode_segment_data
CREATE INDEX idx_gcode_segment_report_id ON gcode_segment_data(report_id);
CREATE INDEX idx_gcode_segment_layer ON gcode_segment_data(layer_number);

-- gcode_issue_types
CREATE INDEX idx_gcode_issue_types_code ON gcode_issue_types(code);
CREATE INDEX idx_gcode_issue_types_category ON gcode_issue_types(category);

-- background_tasks
CREATE INDEX idx_background_tasks_user_status ON background_tasks(user_id, status);
```

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-18 | 최초 문서 작성 (Supabase 실제 스키마 기준) |
