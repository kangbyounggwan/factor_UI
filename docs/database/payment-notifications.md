# 결제/알림 테이블 스키마

> **Last Updated:** 2026-01-18
> **Database:** Supabase (PostgreSQL)

이 문서는 결제, 구독, 알림, 사용량 추적 관련 테이블들을 정의합니다.

---

## 목차

1. [결제 내역](#결제-내역)
2. [결제 수단](#결제-수단)
3. [사용량 로그](#사용량-로그)
4. [알림](#알림)
5. [사용자 알림 설정](#사용자-알림-설정)
6. [사용자 디바이스 토큰](#사용자-디바이스-토큰)

---

## 결제 내역

### payment_history

결제 트랜잭션 기록입니다.

```sql
CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,

  -- 결제 정보
  amount INTEGER NOT NULL,              -- 결제 금액 (원)
  currency TEXT DEFAULT 'KRW',          -- 통화
  status TEXT NOT NULL,                 -- completed, pending, failed, refunded

  -- Paddle 정보
  paddle_transaction_id TEXT,           -- Paddle 트랜잭션 ID
  paddle_invoice_id TEXT,               -- Paddle 인보이스 ID
  paddle_checkout_id TEXT,              -- Paddle 체크아웃 ID

  -- 상세 정보
  payment_type TEXT,                    -- subscription, one_time, addon
  billing_period_start TIMESTAMPTZ,     -- 결제 기간 시작
  billing_period_end TIMESTAMPTZ,       -- 결제 기간 종료

  -- 플랜 정보 (스냅샷)
  plan_name TEXT,                       -- 결제 시점 플랜명
  plan_price INTEGER,                   -- 결제 시점 가격

  -- 할인/쿠폰
  discount_amount INTEGER DEFAULT 0,    -- 할인 금액
  coupon_code TEXT,                     -- 사용된 쿠폰 코드

  -- 환불 정보
  refund_amount INTEGER,                -- 환불 금액
  refund_reason TEXT,                   -- 환불 사유
  refunded_at TIMESTAMPTZ,              -- 환불 일시

  -- 영수증
  receipt_url TEXT,                     -- 영수증 URL
  invoice_pdf_url TEXT,                 -- 인보이스 PDF URL

  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX idx_payment_history_status ON payment_history(status);
CREATE INDEX idx_payment_history_created_at ON payment_history(created_at);
```

**status 값:**
| 상태 | 설명 |
|-----|------|
| `completed` | 결제 완료 |
| `pending` | 처리 중 |
| `failed` | 실패 |
| `refunded` | 환불됨 |
| `partially_refunded` | 부분 환불 |

**payment_type 값:**
| 타입 | 설명 |
|-----|------|
| `subscription` | 구독 결제 |
| `one_time` | 일회성 결제 |
| `addon` | 추가 기능 구매 |
| `credit` | 크레딧 충전 |

---

## 결제 수단

### payment_methods

사용자의 저장된 결제 수단입니다.

```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Paddle 정보
  paddle_payment_method_id TEXT,        -- Paddle 결제 수단 ID
  paddle_customer_id TEXT,              -- Paddle 고객 ID

  -- 카드 정보 (마스킹됨)
  card_brand TEXT,                      -- visa, mastercard, amex 등
  card_last_four TEXT,                  -- 카드 뒤 4자리
  card_expiry_month INTEGER,            -- 만료 월
  card_expiry_year INTEGER,             -- 만료 연도

  -- 상태
  is_default BOOLEAN DEFAULT FALSE,     -- 기본 결제 수단
  is_active BOOLEAN DEFAULT TRUE,       -- 활성화 여부

  -- 검증
  is_verified BOOLEAN DEFAULT FALSE,    -- 검증 완료 여부
  verified_at TIMESTAMPTZ,

  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
```

**card_brand 값:**
| 브랜드 | 설명 |
|-------|------|
| `visa` | Visa |
| `mastercard` | Mastercard |
| `amex` | American Express |
| `jcb` | JCB |
| `unionpay` | UnionPay |

---

## 사용량 로그

### usage_logs

기능별 사용량 상세 로그입니다.

```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 사용 정보
  usage_type TEXT NOT NULL,             -- ai_generation, storage, api_call 등
  feature TEXT,                         -- 세부 기능 (text_to_3d, image_to_3d 등)
  quantity INTEGER DEFAULT 1,           -- 사용량

  -- 리소스 정보
  resource_id UUID,                     -- 관련 리소스 ID (모델, 파일 등)
  resource_type TEXT,                   -- 리소스 타입

  -- 비용 정보
  credits_used NUMERIC DEFAULT 0,       -- 사용된 크레딧
  estimated_cost NUMERIC,               -- 예상 비용 (내부 계산용)

  -- 컨텍스트
  ip_address TEXT,                      -- 요청 IP
  user_agent TEXT,                      -- User Agent
  session_id TEXT,                      -- 세션 ID

  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_type ON usage_logs(usage_type);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);

-- 파티셔닝 권장 (대용량 데이터)
-- CREATE INDEX idx_usage_logs_user_date ON usage_logs(user_id, created_at);
```

**usage_type 값:**
| 타입 | 설명 | 단위 |
|-----|------|-----|
| `ai_model_generation` | AI 3D 모델 생성 | 회 |
| `ai_image_generation` | AI 이미지 생성 | 회 |
| `gcode_analysis` | G-code 분석 | 회 |
| `storage` | 저장공간 사용 | bytes |
| `api_call` | API 호출 | 회 |
| `ai_chat` | AI 채팅 | 메시지 수 |

---

## 알림

### notifications

사용자 알림 메시지입니다.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 알림 내용
  title TEXT NOT NULL,                  -- 알림 제목
  body TEXT,                            -- 알림 본문
  type TEXT NOT NULL,                   -- 알림 유형

  -- 참조 정보
  reference_type TEXT,                  -- 참조 리소스 타입 (post, comment, printer 등)
  reference_id UUID,                    -- 참조 리소스 ID

  -- 상태
  is_read BOOLEAN DEFAULT FALSE,        -- 읽음 여부
  read_at TIMESTAMPTZ,                  -- 읽은 시간

  -- 액션
  action_url TEXT,                      -- 클릭 시 이동 URL
  action_data JSONB,                    -- 추가 액션 데이터

  -- 발송 정보
  sent_via TEXT[],                      -- 발송 채널 (push, email, in_app)
  push_sent_at TIMESTAMPTZ,             -- 푸시 발송 시간
  email_sent_at TIMESTAMPTZ,            -- 이메일 발송 시간

  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ                -- 만료 시간 (NULL = 무기한)
);

-- 인덱스
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
```

**type 값:**
| 타입 | 설명 |
|-----|------|
| `print_complete` | 출력 완료 |
| `print_failed` | 출력 실패 |
| `print_paused` | 출력 일시정지 |
| `comment_reply` | 댓글 답글 |
| `post_like` | 게시글 좋아요 |
| `answer_accepted` | 답변 채택 |
| `subscription_expiring` | 구독 만료 예정 |
| `subscription_renewed` | 구독 갱신 |
| `payment_failed` | 결제 실패 |
| `system_notice` | 시스템 공지 |

---

## 사용자 알림 설정

### user_notification_settings

사용자별 알림 수신 설정입니다.

```sql
CREATE TABLE user_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 채널별 활성화
  push_enabled BOOLEAN DEFAULT TRUE,    -- 푸시 알림
  email_enabled BOOLEAN DEFAULT TRUE,   -- 이메일 알림
  in_app_enabled BOOLEAN DEFAULT TRUE,  -- 인앱 알림

  -- 알림 유형별 설정
  print_notifications BOOLEAN DEFAULT TRUE,    -- 출력 관련
  comment_notifications BOOLEAN DEFAULT TRUE,  -- 댓글 관련
  like_notifications BOOLEAN DEFAULT TRUE,     -- 좋아요 관련
  system_notifications BOOLEAN DEFAULT TRUE,   -- 시스템 공지
  marketing_notifications BOOLEAN DEFAULT FALSE, -- 마케팅

  -- 방해 금지
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,   -- 방해금지 모드
  quiet_hours_start TIME,                      -- 시작 시간 (예: 22:00)
  quiet_hours_end TIME,                        -- 종료 시간 (예: 08:00)
  quiet_hours_timezone TEXT DEFAULT 'Asia/Seoul',

  -- 요약 설정
  daily_digest_enabled BOOLEAN DEFAULT FALSE,  -- 일일 요약
  digest_time TIME DEFAULT '09:00',            -- 요약 발송 시간

  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_notification_settings_user_id ON user_notification_settings(user_id);
```

---

## 사용자 디바이스 토큰

### user_device_tokens

푸시 알림을 위한 디바이스 토큰입니다.

```sql
CREATE TABLE user_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 토큰 정보
  token TEXT NOT NULL,                  -- FCM/APNs 토큰
  platform TEXT NOT NULL,               -- ios, android, web

  -- 디바이스 정보
  device_id TEXT,                       -- 디바이스 고유 ID
  device_name TEXT,                     -- 디바이스 이름 (예: iPhone 15)
  device_model TEXT,                    -- 디바이스 모델
  os_version TEXT,                      -- OS 버전
  app_version TEXT,                     -- 앱 버전

  -- 상태
  is_active BOOLEAN DEFAULT TRUE,       -- 활성화 여부
  last_used_at TIMESTAMPTZ,             -- 마지막 사용

  -- 에러 추적
  error_count INTEGER DEFAULT 0,        -- 연속 실패 횟수
  last_error TEXT,                      -- 마지막 에러
  last_error_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, token)
);

-- 인덱스
CREATE INDEX idx_device_tokens_user_id ON user_device_tokens(user_id);
CREATE INDEX idx_device_tokens_platform ON user_device_tokens(platform);
CREATE INDEX idx_device_tokens_active ON user_device_tokens(is_active);
```

**platform 값:**
| 플랫폼 | 설명 | 푸시 서비스 |
|-------|------|------------|
| `ios` | iOS 앱 | APNs |
| `android` | Android 앱 | FCM |
| `web` | 웹 브라우저 | FCM Web Push |

**토큰 갱신 정책:**
- 앱 시작 시 토큰 확인 및 갱신
- `error_count` >= 3 이면 토큰 비활성화
- 30일 이상 미사용 토큰 정리

---

## 관련 테이블 (다른 문서 참조)

- [subscription_plans](./schema.md#subscription_plans-구독-플랜-정의) - 구독 플랜
- [user_subscriptions](./schema.md#user_subscriptions-사용자-구독-정보) - 사용자 구독
- [user_usage](./schema.md#user_usage-유저별-사용량-추적) - 사용량 집계

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-18 | 최초 문서 작성 (Supabase 실제 스키마 기준) |
