# FCM Push Notification Edge Function

Firebase Cloud Messaging (FCM)을 통해 푸시 알림을 전송하는 Supabase Edge Function입니다.

## 🔧 설정 방법

### 1. Firebase Service Account 키 설정

Firebase Admin SDK를 사용하여 FCM 푸시 알림을 전송합니다.

#### 로컬 개발 환경

Supabase CLI를 사용하는 경우, 환경 변수를 `.env.local` 파일에 설정합니다:

```bash
# packages/web/.env.local
FIREBASE_PROJECT_ID=bypunggwan
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@bypunggwan.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAI...(전체 키)...\n-----END PRIVATE KEY-----\n"
```

**중요**: `FIREBASE_PRIVATE_KEY`는 줄바꿈 문자 `\n`을 포함한 전체 문자열입니다.

#### Supabase Cloud (프로덕션)

Supabase Dashboard에서 환경 변수를 설정합니다:

1. Supabase Dashboard → Project Settings → Edge Functions
2. Environment Variables 섹션에서 다음 변수 추가:
   - `FIREBASE_PROJECT_ID`: `bypunggwan`
   - `FIREBASE_CLIENT_EMAIL`: `firebase-adminsdk-fbsvc@bypunggwan.iam.gserviceaccount.com`
   - `FIREBASE_PRIVATE_KEY`: (Firebase service account JSON의 `private_key` 값 전체)

### 2. Edge Function 배포

```bash
cd packages/web

# 로컬 테스트
npx supabase functions serve send-push-notification --env-file .env.local

# 프로덕션 배포
npx supabase functions deploy send-push-notification
```

## 📡 사용 방법

### TypeScript/JavaScript에서 호출

```typescript
import { supabase } from '@shared/integrations/supabase/client';

// 푸시 알림 전송 (DB 저장 + FCM 푸시)
const { data, error } = await supabase.functions.invoke('send-push-notification', {
  body: {
    userId: 'user-uuid',
    title: 'AI 모델 생성 완료',
    body: '모델이 성공적으로 생성되었습니다.',
    type: 'ai_model_complete',
    relatedId: 'model-uuid',
    relatedType: 'ai_model',
    data: {
      modelId: 'model-uuid',
      modelName: 'My Model',
    },
    imageUrl: 'https://example.com/image.png', // 선택사항
    priority: 'high', // 'high' 또는 'normal'
  },
});

console.log('Push notification sent:', data);
```

### shared 패키지 헬퍼 함수 사용

```typescript
import { createNotificationWithPush } from '@shared/services/supabaseService/notifications';

// DB 알림 생성 + FCM 푸시 자동 전송
await createNotificationWithPush({
  userId: 'user-uuid',
  title: 'AI 모델 생성 완료',
  message: '모델이 성공적으로 생성되었습니다.',
  type: 'ai_model_complete',
  relatedId: 'model-uuid',
  relatedType: 'ai_model',
});
```

## 📋 요청 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `userId` | string | ✅ | 푸시를 받을 사용자 ID |
| `title` | string | ✅ | 알림 제목 |
| `body` | string | ✅ | 알림 본문 |
| `type` | string | ✅ | 알림 타입 (예: `ai_model_complete`, `print_complete`) |
| `relatedId` | string | ❌ | 관련 리소스 ID (예: 모델 ID, 프린트 잡 ID) |
| `relatedType` | string | ❌ | 관련 리소스 타입 (예: `ai_model`, `print_job`) |
| `data` | object | ❌ | 추가 커스텀 데이터 |
| `imageUrl` | string | ❌ | 알림 이미지 URL |
| `priority` | string | ❌ | 우선순위 (`high` 또는 `normal`, 기본값: `high`) |
| `messageEn` | string | ❌ | 영어 메시지 (다국어 지원) |

## 📊 응답 형식

### 성공 응답

```json
{
  "success": true,
  "notificationId": "notification-uuid",
  "totalDevices": 2,
  "successCount": 2,
  "failureCount": 0,
  "results": [
    { "success": true },
    { "success": true }
  ]
}
```

### FCM 토큰이 없는 경우

```json
{
  "success": true,
  "notificationId": "notification-uuid",
  "message": "Notification saved to DB, but no active device tokens found",
  "totalDevices": 0,
  "successCount": 0,
  "failureCount": 0
}
```

**중요**: FCM 토큰이 없어도 DB에는 알림이 저장되므로 `success: true`를 반환합니다.

## 🔔 알림 타입별 라우팅

푸시 알림 클릭 시 앱에서 자동으로 해당 페이지로 이동합니다:

| 알림 타입 | 라우팅 경로 |
|----------|-----------|
| `ai_model_complete` | `/ai/{model_id}` |
| `print_complete` | `/print/{print_job_id}` |
| `print_error` | `/print/{print_job_id}` |
| `payment_success` | `/settings/subscription` |
| `subscription_expiring` | `/settings/subscription` |
| 기타 | `/notifications` |

라우팅 로직은 `packages/mobile/src/services/pushNotificationService.ts`에 정의되어 있습니다.

## 🐛 문제 해결

### "Firebase credentials not configured" 에러

환경 변수가 올바르게 설정되지 않았습니다:

```bash
# 환경 변수 확인
npx supabase secrets list

# 환경 변수 설정
npx supabase secrets set FIREBASE_PROJECT_ID=bypunggwan
npx supabase secrets set FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@bypunggwan.iam.gserviceaccount.com
npx supabase secrets set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### "Failed to get access token" 에러

Firebase 서비스 계정 키가 잘못되었거나 만료되었습니다:

1. Firebase Console → Project Settings → Service Accounts
2. "Generate New Private Key" 클릭
3. 새 JSON 키 다운로드
4. `private_key`, `client_email`, `project_id` 값을 환경 변수에 재설정

### FCM 토큰이 저장되지 않는 경우

모바일 앱에서 FCM 토큰 등록이 제대로 되지 않은 경우:

1. Android/iOS 기기에서 앱 로그 확인:
   ```
   [App] Push notifications initialized for user: <user-id>
   FCM token received: <fcm-token>
   FCM token saved successfully
   ```

2. DB에서 토큰 확인:
   ```sql
   SELECT * FROM user_device_tokens WHERE user_id = 'user-uuid';
   ```

3. 권한 확인 (Android 13+):
   ```xml
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
   ```

## 📝 참고 자료

- [Firebase Cloud Messaging v1 API](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications)
