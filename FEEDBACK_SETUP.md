# 피드백 이메일 설정 가이드

웹 애플리케이션의 피드백 기능이 `factor@factor.io.kr`로 이메일을 보내도록 설정하는 방법입니다.

## 1. Resend API 키 발급

1. [Resend](https://resend.com) 가입 및 로그인
2. Dashboard > API Keys에서 새 API 키 생성
3. API 키 복사

## 2. Supabase Edge Function 설정

### 환경 변수 설정

Supabase 프로젝트에 환경 변수를 추가합니다:

```bash
# Supabase CLI 사용
npx supabase secrets set RESEND_API_KEY=re_xxxxxxxxxx
```

또는 Supabase Dashboard에서:
1. Project Settings > Edge Functions
2. Add secret: `RESEND_API_KEY` = `re_xxxxxxxxxx`

## 3. Edge Function 배포

```bash
cd packages/web

# Edge Function 배포
npx supabase functions deploy send-feedback-email
```

## 4. 데이터베이스 마이그레이션 실행

```bash
# Supabase 마이그레이션 실행
npx supabase db push

# 또는 수동으로 실행
npx supabase db reset
```

실행되는 마이그레이션:
- `20251116000000_feedback.sql` - 피드백 테이블 생성
- `20251116010000_feedback_images_bucket.sql` - 이미지 스토리지 버킷 생성

## 5. 기능 테스트

### 웹 애플리케이션에서 테스트:

1. 로그인
2. 우측 상단 "Feedback" 버튼 클릭
3. "문제 보고" 또는 "아이디어" 선택
4. 제목, 내용 입력
5. (선택) 프린터 선택 (문제 보고 시)
6. (선택) 이미지 첨부 (아이디어 제안 시)
7. "제출" 클릭

### 확인:

- Toast 알림: "피드백을 보내주셔서 감사합니다!"
- `factor@factor.io.kr`로 이메일 수신 확인
- Supabase Dashboard > Table Editor > feedback 테이블에 데이터 저장 확인

## 6. 이메일 도메인 설정 (선택사항)

### Resend에서 커스텀 도메인 사용:

1. Resend Dashboard > Domains
2. "Add Domain" 클릭
3. `factor.io.kr` 입력
4. DNS 레코드 설정:
   - SPF: `v=spf1 include:_spf.resend.com ~all`
   - DKIM: Resend에서 제공하는 값 추가
   - DMARC: `v=DMARC1; p=none;`

5. Edge Function 코드 수정:
```typescript
// send-feedback-email/index.ts
from: "FACTOR Feedback <feedback@factor.io.kr>",  // noreply 대신 feedback 사용
```

6. 재배포:
```bash
npx supabase functions deploy send-feedback-email
```

## 7. 트러블슈팅

### 이메일이 발송되지 않는 경우:

1. **Supabase Edge Function 로그 확인:**
```bash
npx supabase functions logs send-feedback-email
```

2. **Resend API 키 확인:**
```bash
# Supabase secrets 확인
npx supabase secrets list
```

3. **Edge Function 재배포:**
```bash
npx supabase functions deploy send-feedback-email --no-verify-jwt
```

### 이미지 업로드 실패 시:

1. **Storage 정책 확인:**
   - Supabase Dashboard > Storage > feedback-images
   - Policies 탭에서 정책 확인

2. **버킷 생성 확인:**
```sql
-- Supabase SQL Editor에서 실행
SELECT * FROM storage.buckets WHERE id = 'feedback-images';
```

### 데이터베이스 에러:

```bash
# 마이그레이션 재실행
npx supabase db reset

# 또는 특정 마이그레이션만
npx supabase migration up
```

## 8. 구조

### 데이터 흐름:

```
User (Web)
  ↓ 제출 버튼 클릭
Header.tsx (submitFeedback 호출)
  ↓
feedback.ts (이미지 업로드, DB 저장)
  ↓ 데이터 저장
Supabase Database (feedback 테이블)
  ↓ Edge Function 호출
send-feedback-email (Resend API)
  ↓ 이메일 발송
factor@factor.io.kr (수신)
```

### 파일 구조:

```
packages/
├── shared/
│   └── src/
│       └── services/
│           └── supabaseService/
│               └── feedback.ts        # 피드백 제출 로직
└── web/
    ├── src/
    │   └── components/
    │       └── Header.tsx              # UI 및 제출 핸들러
    └── supabase/
        ├── migrations/
        │   ├── 20251116000000_feedback.sql          # 테이블 생성
        │   └── 20251116010000_feedback_images_bucket.sql  # 스토리지
        └── functions/
            └── send-feedback-email/
                └── index.ts            # 이메일 발송 Edge Function
```

## 9. Admin 피드백 관리 (향후 기능)

피드백을 관리하는 Admin 페이지 추가 예정:

- 모든 피드백 조회
- 상태 변경 (pending → reviewed → resolved → closed)
- 사용자에게 답변 이메일 발송

Admin 쿼리 예시:
```typescript
// 모든 피드백 조회 (Admin만 가능)
const { data } = await supabase
  .from('feedback')
  .select(`
    *,
    profiles:user_id (name, email),
    printers:printer_id (name, model)
  `)
  .order('created_at', { ascending: false });
```

## 10. 비용

### Resend 무료 플랜:
- 월 3,000 이메일 무료
- 초과 시: $1.00 / 1,000 이메일

### Supabase 무료 플랜:
- Edge Functions: 500,000 실행/월
- Storage: 1GB
- Database: 500MB

일반적인 사용량으로는 무료 플랜으로 충분합니다.
