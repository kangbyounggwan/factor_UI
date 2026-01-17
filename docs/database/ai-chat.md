# AI/채팅 테이블 스키마

> **Last Updated:** 2026-01-18
> **Database:** Supabase (PostgreSQL)

이 문서는 AI 기반 채팅, 트러블슈팅, 공유 기능 관련 테이블들을 정의합니다.

---

## 목차

1. [채팅 세션](#채팅-세션)
2. [채팅 메시지](#채팅-메시지)
3. [트러블슈팅 세션](#트러블슈팅-세션)
4. [트러블슈팅 메시지](#트러블슈팅-메시지)
5. [공유 채팅](#공유-채팅)
6. [공유 리포트](#공유-리포트)
7. [관리자 AI 통계](#관리자-ai-통계)
8. [키워드 분석](#키워드-분석)

---

## 채팅 세션

### chat_sessions

AI 채팅 세션 정보를 저장합니다.

```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,                           -- 세션 제목
  session_type TEXT DEFAULT 'general',  -- 세션 유형 (general, troubleshooting 등)
  context JSONB,                        -- 세션 컨텍스트 (프린터 정보 등)
  metadata JSONB,                       -- 추가 메타데이터
  is_archived BOOLEAN DEFAULT FALSE,    -- 아카이브 여부
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**session_type 값:**
| 타입 | 설명 |
|-----|------|
| `general` | 일반 AI 채팅 |
| `troubleshooting` | 트러블슈팅 전용 |
| `gcode_analysis` | G-code 분석 |

---

## 채팅 메시지

### chat_messages

채팅 세션 내 개별 메시지를 저장합니다.

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                   -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,                -- 메시지 내용
  metadata JSONB,                       -- 추가 메타데이터 (토큰 수, 모델 등)
  attachments JSONB,                    -- 첨부 파일 정보
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**role 값:**
| 역할 | 설명 |
|-----|------|
| `user` | 사용자 메시지 |
| `assistant` | AI 응답 |
| `system` | 시스템 메시지 |

**metadata 구조 예시:**
```json
{
  "model": "claude-3-sonnet",
  "input_tokens": 150,
  "output_tokens": 320,
  "processing_time_ms": 2340
}
```

---

## 트러블슈팅 세션

### troubleshooting_sessions

3D 프린팅 문제 해결을 위한 트러블슈팅 세션입니다.

```sql
CREATE TABLE troubleshooting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,                           -- 문제 요약 제목
  problem_type TEXT,                    -- 문제 유형 (stringing, warping 등)
  printer_info JSONB,                   -- 프린터 정보
  filament_info JSONB,                  -- 필라멘트 정보
  slicer_settings JSONB,                -- 슬라이서 설정
  status TEXT DEFAULT 'open',           -- open, resolved, closed
  resolution TEXT,                      -- 해결 방법 요약
  is_public BOOLEAN DEFAULT FALSE,      -- 공개 여부 (커뮤니티 공유)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**printer_info 구조:**
```json
{
  "model": "Ender 3 V2",
  "firmware": "Klipper",
  "nozzle_size": "0.4mm",
  "bed_type": "PEI"
}
```

---

## 트러블슈팅 메시지

### troubleshooting_messages

트러블슈팅 세션의 대화 내용을 저장합니다.

```sql
CREATE TABLE troubleshooting_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES troubleshooting_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                   -- 'user', 'assistant'
  content TEXT NOT NULL,
  images TEXT[],                        -- 첨부 이미지 URL 배열
  suggestions JSONB,                    -- AI 제안 사항
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 공유 채팅

### shared_chats

사용자가 공개한 채팅 세션 정보입니다.

```sql
CREATE TABLE shared_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_code TEXT UNIQUE NOT NULL,      -- 공유 링크 코드
  title TEXT,                           -- 공유 제목
  description TEXT,                     -- 설명
  view_count INTEGER DEFAULT 0,         -- 조회수
  is_active BOOLEAN DEFAULT TRUE,       -- 활성화 여부
  expires_at TIMESTAMPTZ,               -- 만료일 (NULL = 무기한)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**공유 URL 형식:** `/shared/chat/{share_code}`

---

## 공유 리포트

### shared_reports

G-code 분석 리포트 등의 공유 정보입니다.

```sql
CREATE TABLE shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID,                       -- 원본 리포트 ID
  report_type TEXT NOT NULL,            -- 'gcode_analysis', 'troubleshooting' 등
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_code TEXT UNIQUE NOT NULL,      -- 공유 링크 코드
  title TEXT,
  data JSONB,                           -- 리포트 데이터 스냅샷
  view_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 관리자 AI 통계

### admin_ai_stats

관리자용 AI 사용 통계 데이터입니다.

```sql
CREATE TABLE admin_ai_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_date DATE NOT NULL,              -- 통계 날짜
  stat_type TEXT NOT NULL,              -- 통계 유형
  model_name TEXT,                      -- AI 모델명
  total_requests INTEGER DEFAULT 0,     -- 총 요청 수
  total_tokens INTEGER DEFAULT 0,       -- 총 토큰 수
  input_tokens INTEGER DEFAULT 0,       -- 입력 토큰
  output_tokens INTEGER DEFAULT 0,      -- 출력 토큰
  avg_response_time_ms NUMERIC,         -- 평균 응답 시간
  error_count INTEGER DEFAULT 0,        -- 에러 수
  metadata JSONB,                       -- 추가 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stat_date, stat_type, model_name)
);
```

**stat_type 값:**
| 타입 | 설명 |
|-----|------|
| `daily_summary` | 일별 요약 |
| `hourly` | 시간별 통계 |
| `by_feature` | 기능별 통계 |

---

## 키워드 분석

### keyword_analytics

사용자 질문에서 추출한 키워드 분석 데이터입니다.

```sql
CREATE TABLE keyword_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,                -- 키워드
  keyword_type TEXT,                    -- 키워드 유형 (problem, printer, filament 등)
  frequency INTEGER DEFAULT 1,          -- 빈도
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  related_keywords TEXT[],              -- 관련 키워드
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_keyword_analytics_keyword ON keyword_analytics(keyword);
CREATE INDEX idx_keyword_analytics_type ON keyword_analytics(keyword_type);
```

**활용 사례:**
- 자주 발생하는 문제 파악
- AI 응답 품질 개선
- 트렌드 분석

---

## 인덱스

```sql
-- chat_sessions
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_type ON chat_sessions(session_type);

-- chat_messages
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- shared_chats
CREATE INDEX idx_shared_chats_share_code ON shared_chats(share_code);
CREATE INDEX idx_shared_chats_user_id ON shared_chats(user_id);
```

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-18 | 최초 문서 작성 (Supabase 실제 스키마 기준) |
