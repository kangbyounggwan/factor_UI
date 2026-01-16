# FACTOR HIBRID - Database Migrations

> **Last Updated:** 2026-01-16
> **Total Migrations:** 80+
> **경로:** `packages/shared/supabase/migrations/`

---

## 마이그레이션 파일 명명 규칙

```
YYYYMMDDHHMMSS_description.sql
```

예: `20260116300000_consolidate_vote_tables.sql`

---

## 2026년 1월 마이그레이션

### 20260116300000_consolidate_vote_tables.sql ⭐ 최신
**투표 테이블 통합 (6개 → 2개)**

- `vote_type` ENUM 생성 ('like', 'dislike', 'helpful')
- `community_post_votes` 테이블 생성
- `community_comment_votes` 테이블 생성
- 기존 데이터 마이그레이션
- 기존 6개 테이블 삭제:
  - `community_post_likes`
  - `community_post_dislikes`
  - `community_post_helpful`
  - `community_comment_likes`
  - `community_comment_dislikes`
  - `community_comment_helpful`

### 20260116200000_add_equipment_presets.sql
**장비 프리셋 기능 추가**

- `profiles.equipment_presets` JSONB 컬럼 추가
- 트러블슈팅 작성 시 자주 사용하는 프린터/필라멘트 정보 저장

### 20260116100000_reset_display_name.sql
**닉네임 초기화**

- 기존 사용자의 `display_name`을 NULL로 초기화
- `full_name`/`display_name` 분리 작업의 일부

### 20260116000000_add_dislike_system.sql
**비추천 시스템 추가**

- `community_post_dislikes` 테이블 생성
- `community_comment_dislikes` 테이블 생성
- `community_posts.dislike_count` 컬럼 추가
- `community_comments.dislike_count` 컬럼 추가

> ⚠️ 이 테이블은 `20260116300000_consolidate_vote_tables.sql`에서 삭제됨

### 20260115100000_add_images_to_community_comments.sql
**댓글 이미지 지원**

- `community_comments.images` TEXT[] 컬럼 추가

### 20260115000000_add_author_display_type.sql
**작성자 표시 방식 추가**

- `community_posts.author_display_type` 컬럼 추가
- 'nickname', 'realname', 'anonymous' 선택 가능

### 20260112150000_add_gcode_files_to_community_posts.sql
**게시물 G-code 첨부 지원**

- `community_posts.gcode_files` JSONB 컬럼 추가

### 20260112100000_add_model_to_community_posts.sql
**게시물 3D 모델 첨부 지원**

- `community_posts.model_id` 컬럼 추가

### 20260112000000_add_display_name.sql
**실명/닉네임 분리**

- `profiles.full_name` 컬럼 추가 (실명, 필수)
- `profiles.display_name` 컬럼 유지 (닉네임, 선택)

### 20260110000000_community_tables.sql
**커뮤니티 테이블 생성**

- `community_posts` 테이블 생성
- `community_comments` 테이블 생성
- `community_post_likes` 테이블 생성
- `community_comment_likes` 테이블 생성
- `community_post_helpful` 테이블 생성
- `community_comment_helpful` 테이블 생성
- `community-images` 스토리지 버킷 생성
- `community-models` 스토리지 버킷 생성
- `community-gcode` 스토리지 버킷 생성

### 20260108000000_keyword_analytics.sql
**키워드 분석 테이블**

- 검색 키워드 분석용 테이블 생성

---

## 2025년 12월 마이그레이션

### 20251227100000_fix_shared_chats_rls.sql
- 공유 채팅 RLS 정책 수정

### 20251224000000_shared_reports.sql
- 공유 리포트 테이블 생성

### 20251222110000_update_starter_plan_price.sql
- Starter 플랜 가격 업데이트

### 20251221000000_add_troubleshoot_advanced_usage.sql
- 고급 트러블슈팅 사용량 추적

### 20251219100000_shared_chats.sql
- 공유 채팅 기능 추가

### 20251218150000_gcode_segments_storage.sql
- G-code 세그먼트 저장 기능

### 20251218135000_create_chat_tables.sql
- `chat_sessions` 테이블 생성
- `chat_messages` 테이블 생성

### 20251218120000_add_starter_plan.sql
- Starter 플랜 추가

### 20251217000000_troubleshooting_tables.sql
- 트러블슈팅 관련 테이블 생성

### 20251214000000_fix_profiles_rls.sql
- profiles 테이블 RLS 정책 수정

### 20251211000000_gcode_analysis_tables.sql
- G-code 분석 결과 테이블 생성

### 20251210100000_gcode_files_slicer_settings.sql
- G-code 파일 슬라이서 설정 컬럼 추가

### 20251209150000_drop_unused_tables.sql
**미사용 테이블 삭제**

삭제된 테이블:
- `ai_usage_logs` → user_usage로 대체
- `failure_scenes` → 미사용
- `paddle_customers` → user_subscriptions로 통합
- `paddle_subscriptions` → user_subscriptions로 통합
- `paddle_transactions` → payment_history로 관리
- `print_jobs` → MQTT 실시간 처리
- `printer_position_history` → 미사용
- `printer_status` → MQTT 실시간 처리
- `stl_files` → Storage 버킷 직접 저장

### 20251209120000_create_user_usage.sql
- `user_usage` 테이블 생성 (사용량 추적)

### 20251209110000_create_subscription_plans.sql
- `subscription_plans` 테이블 생성

### 20251207000001_temperature_sessions.sql
- `printer_temperature_sessions` 테이블 생성

### 20251207000005_realtime_temp_logs.sql
- `printer_temperature_logs` 실시간 지원

### 20251202000000_add_notification_columns.sql
- 알림 관련 컬럼 추가

---

## 2025년 11월 마이그레이션

### 20251128000000_api_keys.sql
- `api_keys` 테이블 생성

### 20251121000000_add_device_id_to_tokens.sql
- 디바이스 토큰 ID 컬럼 추가

### 20251117000000_user_device_tokens.sql
- `user_device_tokens` 테이블 생성

### 20251116000000_feedback.sql
- 피드백 테이블 생성

### 20251110000000_payment_methods.sql
- `payment_methods` 테이블 생성

---

## 2025년 10월 마이그레이션

### 20251028000000_fix_signup_rls.sql
- 회원가입 RLS 정책 수정

### 20251027030000_background_tasks.sql
- `background_tasks` 테이블 생성

### 20251027020000_subscriptions.sql
- 구독 관련 테이블 초기 생성

### 20251027010000_notifications.sql
- `notifications` 테이블 생성

### 20251027000000_user_notification_settings.sql
- `user_notification_settings` 테이블 생성

### 20251025000000_gcode_metadata.sql
- G-code 메타데이터 컬럼 추가

### 20251017010000_add_printer_name.sql
- 프린터 이름 컬럼 추가

### 20251017000000_add_manufacture_id.sql
- 제조사 ID 컬럼 추가

### 20251015071000_manufacturing_printers.sql
- `manufacturing_printers` 테이블 생성 (Cura 프린터 정의)

### 20251015000000_ai_generated_models.sql
- `ai_generated_models` 테이블 생성

### 20251015000001_create_ai_models_bucket.sql
- `ai-models` 스토리지 버킷 생성

---

## 실행 방법

### Supabase CLI 사용

```bash
# 마이그레이션 실행
supabase db push

# 특정 마이그레이션 실행
supabase migration up

# 마이그레이션 상태 확인
supabase migration list
```

### Supabase Dashboard 사용

1. Supabase Dashboard → SQL Editor
2. 마이그레이션 파일 내용 복사
3. 실행

---

## 주의사항

1. **순서 중요**: 마이그레이션은 타임스탬프 순서대로 실행되어야 함
2. **롤백 없음**: 대부분의 마이그레이션은 롤백 스크립트가 없음
3. **데이터 백업**: 프로덕션 실행 전 반드시 백업
4. **RLS 정책**: 테이블 생성 후 RLS 정책 활성화 필수
