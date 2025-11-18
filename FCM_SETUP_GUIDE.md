# Firebase Cloud Messaging (FCM) 설정 가이드

FACTOR 프로젝트에 Firebase Admin SDK를 사용하여 푸시 알림을 전송하는 방법을 설명합니다.

## 📋 현재 상태

✅ Firebase Service Account 키 다운로드 완료
- 파일: `bypunggwan-firebase-adminsdk-fbsvc-a77f021a55.json`
- 프로젝트 ID: `bypunggwan`
- 클라이언트 이메일: `firebase-adminsdk-fbsvc@bypunggwan.iam.gserviceaccount.com`

✅ Edge Function 구현 완료
- 경로: `packages/web/supabase/functions/send-push-notification/index.ts`
- FCM v1 API 사용
- DB 알림 저장 + FCM 푸시 전송

✅ 모바일 앱 FCM 설정 완료
- Capacitor Push Notifications 플러그인 설치
- Android FCM 토큰 자동 등록
- `user_device_tokens` 테이블에 저장

## ⚠️ 보안 주의사항

**중요**: Firebase Service Account 비공개 키는 절대 Git에 커밋하지 마세요!

- ✅ `.gitignore`에 이미 추가됨: `**/*firebase-adminsdk*.json`
- ✅ 다운로드한 원본 JSON 파일은 삭제 권장 (이미 Supabase에 설정 후)
- ✅ 비공개 키는 Supabase 환경 변수로만 관리

## 🚀 설정 방법

### Step 1: Supabase에 Firebase 환경 변수 설정

Firebase Service Account 키에서 다음 정보를 추출하여 Supabase에 등록합니다.

#### 옵션 A: Supabase Dashboard (권장 - 프로덕션)

1. **Supabase Dashboard** 접속
   - https://supabase.com/dashboard

2. **프로젝트 선택** → **Settings** → **Edge Functions**

3. **Environment Variables** 섹션에서 다음 3개 변수 추가:

   ```
   FIREBASE_PROJECT_ID
   ```
   값: `bypunggwan`

   ```
   FIREBASE_CLIENT_EMAIL
   ```
   값: `firebase-adminsdk-fbsvc@bypunggwan.iam.gserviceaccount.com`

   ```
   FIREBASE_PRIVATE_KEY
   ```
   값: `C:\Users\USER\Downloads\bypunggwan-firebase-adminsdk-fbsvc-a77f021a55.json` 파일의 `private_key` 값을 복사하여 붙여넣기

   **중요**: Private Key는 `-----BEGIN PRIVATE KEY-----`로 시작하고 `-----END PRIVATE KEY-----`로 끝나는 전체 문자열입니다. 줄바꿈 문자(`\n`)를 포함하여 정확히 복사해야 합니다.

4. **Save** 클릭

#### 옵션 B: Supabase CLI (로컬 개발)

터미널에서 다음 명령 실행:

```bash
cd packages/web

# Firebase 환경 변수 설정
npx supabase secrets set FIREBASE_PROJECT_ID=bypunggwan

npx supabase secrets set FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@bypunggwan.iam.gserviceaccount.com

# Private Key는 bypunggwan-firebase-adminsdk-fbsvc-a77f021a55.json 파일에서 복사
npx supabase secrets set FIREBASE_PRIVATE_KEY="<JSON 파일의 private_key 값>"
```

**주의**: Windows CMD에서는 여러 줄 문자열 입력이 어려울 수 있습니다. PowerShell이나 Git Bash 사용을 권장합니다.

### Step 2: Edge Function 재배포

환경 변수 설정 후 Edge Function을 재배포합니다:

```bash
cd packages/web

# Edge Function 배포
npx supabase functions deploy send-push-notification
```

## 🧪 테스트

### 1. 사용자 ID 확인

먼저 푸시 알림을 받을 사용자의 ID를 확인합니다:

1. **Supabase Dashboard** → **Authentication** → **Users**
2. 사용자 목록에서 ID 복사 (예: `12345678-1234-1234-1234-123456789abc`)

### 2. 테스트 스크립트 실행

터미널에서 다음 명령 실행:

```bash
cd packages/web

# 테스트 스크립트 실행 (사용자 ID 대체)
npx tsx test-push-notification.ts 12345678-1234-1234-1234-123456789abc
```

### 3. 예상 출력

```
🔔 Sending test push notification to user: 12345678-1234-1234-1234-123456789abc

📱 Checking user device tokens...
✅ Found 1 device token(s):
   1. Platform: android, Active: true

📤 Sending FCM push notification via Edge Function...

✅ Push notification sent successfully!

📊 Results:
   Notification ID: abcd1234-5678-90ef-ghij-klmnopqrstuv
   Total devices: 1
   Success count: 1
   Failure count: 0

📋 Device Results:
   1. ✅ Sent

📥 Checking notification in database...
✅ Notification saved in DB:
   Title: 🧪 테스트 푸시 알림
   Message: FCM 푸시 알림이 정상적으로 작동합니다!
   Type: test
   Read: false
   Created: 2025-11-18T12:00:00.000Z

✅ Test completed! Check your mobile device for the push notification.
```

### 4. 모바일 기기 확인

- Android 기기에서 알림 수신 확인
- 알림을 탭하면 앱이 열리고 알림 목록으로 이동

## 🔧 문제 해결

### "No device tokens found for this user"

**원인**: 사용자가 모바일 앱에 로그인하지 않았거나 FCM 토큰이 등록되지 않았습니다.

**해결 방법**:
1. 모바일 앱에서 해당 사용자로 로그인
2. 로그인 시 자동으로 FCM 토큰이 `user_device_tokens` 테이블에 저장됨
3. Android Studio Logcat 또는 Chrome DevTools에서 로그 확인:
   ```
   [App] Push notifications initialized for user: <user-id>
   FCM token received: <fcm-token>
   FCM token saved successfully
   ```

### "Firebase credentials not configured"

**원인**: Supabase 환경 변수가 설정되지 않았습니다.

**해결 방법**:
1. 위 Step 1을 다시 수행하여 환경 변수 설정
2. 환경 변수 확인:
   ```bash
   npx supabase secrets list
   ```
3. Edge Function 재배포:
   ```bash
   npx supabase functions deploy send-push-notification
   ```

### "Failed to get access token"

**원인**: Firebase Private Key가 잘못 입력되었습니다.

**해결 방법**:
1. Private Key 전체를 다시 복사하여 설정
2. 줄바꿈 문자가 포함되어 있는지 확인 (`\n` 또는 실제 줄바꿈)
3. 따옴표로 감싸서 입력: `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`

### FCM 푸시가 전송되지 않음

**원인**: Android 권한 또는 Firebase 설정 문제

**해결 방법**:
1. Android 13+에서 알림 권한 확인:
   - 설정 → 앱 → FACTOR → 권한 → 알림 허용
2. `google-services.json` 파일 확인:
   ```bash
   ls packages/mobile/android/app/google-services.json
   ```
3. Firebase Console에서 프로젝트 설정 확인:
   - Project ID: `bypunggwan`
   - Android 패키지명: `com.factor.app`

## 📚 다음 단계

### 1. 알림 트리거 추가

다양한 이벤트에서 푸시 알림을 전송하도록 설정:

```typescript
import { createNotificationWithPush } from '@shared/services/supabaseService/notifications';

// AI 모델 생성 완료 시
await createNotificationWithPush({
  userId: user.id,
  title: 'AI 모델 생성 완료',
  message: '모델이 성공적으로 생성되었습니다.',
  type: 'ai_model_complete',
  relatedId: modelId,
  relatedType: 'ai_model',
});

// 프린팅 완료 시
await createNotificationWithPush({
  userId: user.id,
  title: '프린팅 완료',
  message: '모델 프린팅이 완료되었습니다.',
  type: 'print_complete',
  relatedId: printJobId,
  relatedType: 'print_job',
});
```

### 2. 알림 설정 UI 추가

사용자가 앱에서 알림 종류별로 켜고 끌 수 있도록 설정 페이지 추가

### 3. iOS 지원 추가

- APNs 인증 키 설정
- iOS 프로젝트에 Firebase 설정 추가
- iOS 빌드 및 테스트

## ✅ 완료 체크리스트

- [x] Firebase Service Account 키 다운로드
- [x] `.gitignore`에 Firebase 키 제외 규칙 추가
- [x] Edge Function README 작성
- [x] 테스트 스크립트 작성
- [ ] Supabase에 Firebase 환경 변수 설정
- [ ] Edge Function 재배포
- [ ] 테스트 푸시 알림 전송 확인
- [ ] 모바일 기기에서 알림 수신 확인

---

**참고 문서**:
- [packages/web/supabase/functions/send-push-notification/README.md](./packages/web/supabase/functions/send-push-notification/README.md)
- [PUSH_NOTIFICATION_SETUP_COMPLETE.md](./PUSH_NOTIFICATION_SETUP_COMPLETE.md)
- [FIREBASE_FCM_SETUP.md](./FIREBASE_FCM_SETUP.md)
