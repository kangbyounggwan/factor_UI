# 푸시 알림 설정 완료 가이드

## 📋 완료된 작업

Firebase Cloud Messaging (FCM)을 이용한 푸시 알림 시스템이 성공적으로 구축되었습니다.

### ✅ 1. Firebase 설정
- **google-services.json**: Android 앱 디렉토리에 복사 완료
  - 경로: `packages/mobile/android/app/google-services.json`
  - Project ID: `factor-f38b9`
  - Project Number: `645731278056`
  - Package Name: `com.factor.app`

### ✅ 2. Android 네이티브 설정
- **build.gradle**: Firebase BOM 및 Firebase Messaging 의존성 추가
  ```gradle
  implementation platform('com.google.firebase:firebase-bom:32.7.0')
  implementation 'com.google.firebase:firebase-messaging'
  ```

- **AndroidManifest.xml**: FCM 메타데이터 및 권한 추가
  - 알림 아이콘: `@mipmap/ic_launcher`
  - 알림 색상: `@android:color/white`
  - 알림 채널 ID: `factor_default`
  - Android 13+ POST_NOTIFICATIONS 권한

- **MainActivity.java**: 알림 채널 생성 로직 구현
  - 채널 이름: "FACTOR Notifications"
  - 중요도: IMPORTANCE_HIGH
  - 진동 및 LED 활성화

### ✅ 3. Capacitor 플러그인
- **@capacitor/push-notifications@7.0.3**: 설치 완료
- Android 프로젝트와 동기화 완료

### ✅ 4. 모바일 서비스 구현
- **pushNotificationService.ts**: FCM 토큰 관리 및 푸시 알림 처리
  - FCM 토큰 자동 등록
  - 알림 수신 및 처리
  - 알림 클릭 시 딥링크 라우팅
  - 토큰 저장 및 관리

### ✅ 5. 앱 초기화
- **App.tsx**: 푸시 알림 서비스 자동 초기화
  - 로그인 시 FCM 토큰 등록
  - 인증 상태 변경 시 자동 재초기화

### ✅ 6. 데이터베이스 마이그레이션
- **user_device_tokens 테이블**: FCM 토큰 저장
  ```sql
  CREATE TABLE user_device_tokens (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    device_token TEXT NOT NULL,
    platform TEXT CHECK (platform IN ('android', 'ios', 'web')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    UNIQUE(user_id, device_token)
  );
  ```
- RLS (Row Level Security) 정책 설정
- 인덱스 최적화
- 자동 업데이트 트리거

### ✅ 7. Supabase Edge Function
- **send-push-notification**: FCM v1 API를 사용한 푸시 알림 전송
  - Firebase Service Account 인증
  - 다중 디바이스 토큰 지원
  - 이미지 첨부 지원
  - 우선순위 설정 (high/normal)

### ✅ 8. 공유 서비스 확장
- **notifications.ts**: 푸시 알림 헬퍼 함수 추가
  - `sendPushNotification()`: Edge Function 호출
  - `createNotificationWithPush()`: DB 저장 + 푸시 전송

---

## 🚀 다음 단계: Firebase 서비스 계정 설정

푸시 알림을 실제로 전송하려면 Firebase 서비스 계정을 Supabase에 설정해야 합니다.

### 1. Firebase 서비스 계정 키 다운로드

1. **Firebase Console** 접속: https://console.firebase.google.com/
2. 프로젝트 선택: `factor-f38b9`
3. **프로젝트 설정** (⚙️) → **서비스 계정** 탭
4. **새 비공개 키 생성** 버튼 클릭
5. JSON 파일 다운로드 (예: `factor-f38b9-firebase-adminsdk-xxxxx.json`)

### 2. Supabase 환경 변수 설정

다운로드한 JSON 파일에서 다음 정보를 Supabase에 등록합니다:

```bash
# Supabase Dashboard → Project Settings → Edge Functions → Environment variables

FIREBASE_PROJECT_ID=factor-f38b9
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@factor-f38b9.iam.gserviceaccount.com
```

**중요**: `FIREBASE_PRIVATE_KEY`는 JSON 파일의 `private_key` 값을 그대로 복사합니다 (줄바꿈 문자 `\n` 포함).

### 3. Supabase Edge Function 배포

```bash
# 프로젝트 루트에서 실행
cd packages/web

# Supabase CLI로 Edge Function 배포
npx supabase functions deploy send-push-notification

# 또는 모든 함수 배포
npx supabase functions deploy
```

### 4. 데이터베이스 마이그레이션 적용

```bash
# Supabase Dashboard → SQL Editor → New query

# 또는 Supabase CLI 사용
npx supabase db push
```

마이그레이션 파일이 자동으로 적용됩니다:
- `packages/web/supabase/migrations/20251117000000_user_device_tokens.sql`
- `packages/mobile/supabase/migrations/20251117000000_user_device_tokens.sql`

---

## 📱 테스트 방법

### 1. 모바일 앱에서 FCM 토큰 확인

1. 앱 빌드 및 실행:
   ```bash
   cd packages/mobile
   npm run build
   npx cap sync android
   npx cap run android
   ```

2. Chrome DevTools에서 로그 확인:
   - Android Studio → Logcat
   - 또는 `chrome://inspect` → Remote devices
   - 콘솔에서 FCM 토큰 등록 로그 확인:
     ```
     [App] Push notifications initialized for user: <user-id>
     FCM token received: <fcm-token>
     FCM token saved successfully
     ```

### 2. 테스트 알림 전송

Supabase SQL Editor에서 다음 쿼리 실행:

```sql
-- 1. 현재 사용자의 FCM 토큰 확인
SELECT * FROM user_device_tokens WHERE user_id = '<your-user-id>';

-- 2. 테스트 알림 생성
INSERT INTO notifications (user_id, title, message, type)
VALUES ('<your-user-id>', '테스트 알림', '푸시 알림이 정상 작동합니다!', 'test');
```

### 3. Edge Function으로 푸시 알림 전송

JavaScript/TypeScript 코드에서:

```typescript
import { sendPushNotification } from '@shared/services/supabaseService/notifications';

// 푸시 알림 전송
await sendPushNotification({
  userId: 'user-uuid',
  title: '테스트 알림',
  body: '푸시 알림이 정상 작동합니다!',
  data: {
    type: 'test',
  },
  priority: 'high',
});
```

또는 DB 알림 생성과 동시에 푸시 전송:

```typescript
import { createNotificationWithPush } from '@shared/services/supabaseService/notifications';

await createNotificationWithPush({
  userId: 'user-uuid',
  title: 'AI 모델 생성 완료',
  message: '모델이 성공적으로 생성되었습니다.',
  type: 'ai_model_complete',
  relatedId: 'model-uuid',
  relatedType: 'ai_model',
});
```

### 4. 기존 알림 함수에 푸시 전송 추가

기존 알림 함수를 `createNotificationWithPush`로 변경하면 자동으로 푸시 알림도 전송됩니다:

```typescript
// Before
await createNotification({...});

// After (DB 저장 + 푸시 전송)
await createNotificationWithPush({...});
```

---

## 🔧 알림 타입별 라우팅

푸시 알림 클릭 시 자동으로 해당 페이지로 이동합니다:

- `ai_model_complete` → `/ai/{model_id}`
- `print_complete`, `print_error` → `/print/{print_job_id}`
- `payment_success`, `subscription_expiring` → `/settings/subscription`
- 기타 → `/notifications`

라우팅 로직은 `packages/mobile/src/services/pushNotificationService.ts`의 `handleNotificationAction()` 함수에서 수정할 수 있습니다.

---

## 📊 알림 채널 정보

Android 8.0 (API 26) 이상에서는 알림 채널이 자동으로 생성됩니다:

- **채널 ID**: `factor_default`
- **채널 이름**: "FACTOR Notifications"
- **중요도**: HIGH (팝업 알림, 소리)
- **진동**: 활성화
- **LED**: 활성화

사용자는 **설정 → 알림 → FACTOR**에서 알림 설정을 변경할 수 있습니다.

---

## 🐛 문제 해결

### FCM 토큰이 등록되지 않는 경우

1. Android 권한 확인:
   ```xml
   <!-- AndroidManifest.xml -->
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
   ```

2. Google Play Services 확인:
   - Android 기기에 Google Play Services가 설치되어 있는지 확인

3. 로그 확인:
   ```
   FCM registration error: <error-message>
   ```

### 푸시 알림이 전송되지 않는 경우

1. Supabase Edge Function 로그 확인:
   ```bash
   npx supabase functions logs send-push-notification
   ```

2. Firebase 서비스 계정 환경 변수 확인:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_CLIENT_EMAIL`

3. FCM API v1 사용 여부 확인:
   - Firebase Console → Cloud Messaging → API 사용 설정

### 알림이 표시되지 않는 경우

1. 앱이 foreground일 때:
   - `pushNotificationReceived` 리스너에서 로컬 알림 표시 필요
   - 현재는 콘솔 로그만 출력

2. 앱이 background/killed일 때:
   - FCM이 자동으로 알림 표시
   - 알림 채널이 올바르게 생성되었는지 확인

---

## 📝 참고 자료

- [Firebase Cloud Messaging (FCM)](https://firebase.google.com/docs/cloud-messaging)
- [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Android Notification Channels](https://developer.android.com/develop/ui/views/notifications/channels)

---

## 🎉 완료!

푸시 알림 시스템이 성공적으로 구축되었습니다. Firebase 서비스 계정을 설정하고 Edge Function을 배포하면 실제 푸시 알림을 전송할 수 있습니다.

추가 질문이나 도움이 필요하시면 언제든지 문의해주세요!
