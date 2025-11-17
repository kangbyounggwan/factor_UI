# 모바일 푸시 알림 연동 계획

FACTOR 모바일 앱에서 푸시 알림을 구현하기 위한 통합 계획서입니다.

---

## 📱 푸시 알림이 필요한 주요 시나리오

### 1. **프린터 상태 변경 알림** (최우선)
실시간 MQTT를 통해 프린터 상태가 변경될 때 푸시 알림을 발송합니다.

#### 1.1 프린팅 완료 (Print Complete)
- **트리거**: 프린터 상태가 `printing` → `idle` 또는 `operational`로 변경
- **조건**:
  - `PrinterStateFlags.printing === false` (이전에는 true)
  - `Progress.completion === 100`
- **메시지**:
  ```
  제목: "프린팅 완료 🎉"
  내용: "[프린터명] - [파일명] 프린팅이 완료되었습니다."
  ```
- **사용자 설정**: `print_complete_notifications`
- **관련 파일**:
  - `packages/shared/src/services/mqttService/index.ts` - MQTT 상태 구독
  - `packages/shared/src/types/printerType.ts` - PrinterState, PrinterStateFlags

#### 1.2 프린팅 오류 (Print Error)
- **트리거**: 프린터 상태가 `error`로 변경
- **조건**:
  - `PrinterState === 'error'`
  - `PrinterStateFlags.error === true`
- **메시지**:
  ```
  제목: "프린팅 오류 ⚠️"
  내용: "[프린터명] 프린팅 중 오류가 발생했습니다."
  상세: "[에러 메시지]"
  ```
- **사용자 설정**: `error_notifications`
- **우선순위**: High (즉시 알림)

#### 1.3 프린터 연결 끊김 (Printer Disconnected)
- **트리거**: 프린터 상태가 `disconnected` 또는 `disconnect`로 변경
- **조건**:
  - `PrinterState === 'disconnected' | 'disconnect'`
  - `PrinterStateFlags.closedOrError === true`
- **메시지**:
  ```
  제목: "프린터 연결 끊김 🔌"
  내용: "[프린터명]과의 연결이 끊어졌습니다."
  ```
- **사용자 설정**: `error_notifications`

#### 1.4 온도 이상 (Temperature Alert)
- **트리거**: 노즐 또는 베드 온도가 설정값과 크게 차이날 때
- **조건**:
  - `Math.abs(current - target) > 15` (15도 이상 차이)
  - 프린팅 중일 때만 (`PrinterStateFlags.printing === true`)
- **메시지**:
  ```
  제목: "온도 이상 🌡️"
  내용: "[프린터명] 온도가 정상 범위를 벗어났습니다."
  상세: "노즐: [current]°C (목표: [target]°C)"
  ```
- **사용자 설정**: `error_notifications`

---

### 2. **AI 모델 생성 완료 알림**
AI 3D 모델 생성이 완료되었을 때 알림을 발송합니다.

- **트리거**: Background task 완료
- **파일**: `packages/shared/src/services/backgroundSlicing.ts`
- **조건**:
  - `BackgroundTask.task_type === 'model_generation'`
  - `BackgroundTask.status === 'completed'`
- **메시지**:
  ```
  제목: "AI 모델 생성 완료 ✨"
  내용: "[모델명] 생성이 완료되었습니다."
  액션: "모델 보기"
  ```
- **사용자 설정**: 항상 활성화 (비활성화 불가)
- **딥링크**: `/create?model_id=[model_id]`
- **관련 함수**:
  - `packages/shared/src/services/supabaseService/notifications.ts::notifyAIModelComplete`

---

### 3. **G-Code 슬라이싱 완료 알림**
STL 파일을 G-Code로 변환 완료 시 알림을 발송합니다.

- **트리거**: Background slicing task 완료
- **파일**: `packages/shared/src/services/backgroundSlicing.ts`
- **조건**:
  - `BackgroundTask.task_type === 'slicing'`
  - `BackgroundTask.status === 'completed'`
- **메시지**:
  ```
  제목: "슬라이싱 완료 📦"
  내용: "[파일명] G-Code 변환이 완료되었습니다."
  액션: "다운로드"
  ```
- **사용자 설정**: 항상 활성화
- **관련 함수**: `processSlicingTask`, `updateTaskStatus`

---

### 4. **결제 관련 알림**
구독 및 결제 처리 시 알림을 발송합니다.

#### 4.1 결제 성공 (Payment Success)
- **트리거**: 토스페이먼츠 결제 성공 콜백
- **파일**: `packages/mobile/src/pages/PaymentSuccess.tsx`
- **메시지**:
  ```
  제목: "결제 완료 💳"
  내용: "[플랜명] 구독이 활성화되었습니다."
  ```
- **관련 함수**:
  - `packages/shared/src/services/supabaseService/notifications.ts::notifyPaymentSuccess`

#### 4.2 구독 만료 예정 (Subscription Expiring)
- **트리거**: 구독 만료 7일 전, 3일 전, 1일 전
- **조건**: Cron job 또는 Supabase Edge Function
- **메시지**:
  ```
  제목: "구독 만료 예정 ⏰"
  내용: "[플랜명] 구독이 [N]일 후 만료됩니다."
  액션: "갱신하기"
  ```
- **관련 함수**:
  - `packages/shared/src/services/supabaseService/notifications.ts::notifySubscriptionExpiring`

---

### 5. **시스템 알림**
운영진이 보내는 공지사항 및 시스템 메시지입니다.

- **트리거**: Admin 대시보드에서 수동 발송
- **타입**: `system_notice`, `maintenance`, `feature_update`
- **메시지**: 관리자가 직접 작성
- **우선순위**: Medium
- **사용자 설정**: 비활성화 불가 (중요 공지만)

---

## 🔧 기술 스택 및 구현 방법

### 1. **Firebase Cloud Messaging (FCM)**
- **Android**: Google Play Services 사용
- **iOS**: APNs (Apple Push Notification service) 통합
- **Capacitor Plugin**: `@capacitor/push-notifications`

### 2. **Supabase Edge Function**
푸시 알림 발송을 위한 서버리스 함수를 구현합니다.

```typescript
// packages/web/supabase/functions/send-push-notification/index.ts
export async function sendPushNotification(params: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  actionUrl?: string;
}) {
  // 1. 사용자의 FCM 토큰 조회
  const tokens = await getUserDeviceTokens(userId);

  // 2. 사용자 알림 설정 확인
  const settings = await getUserNotificationSettings(userId);
  if (!settings.push_enabled) return;

  // 3. FCM API 호출
  await sendToFCM({
    tokens,
    notification: {
      title: params.title,
      body: params.body,
      image: params.imageUrl,
    },
    data: params.data,
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'factor_default',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  });
}
```

### 3. **데이터베이스 스키마**

#### 3.1 사용자 디바이스 토큰 테이블
```sql
CREATE TABLE user_device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  device_info JSONB, -- 기기 정보 (모델, OS 버전 등)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_device_tokens_user_id ON user_device_tokens(user_id);
CREATE INDEX idx_user_device_tokens_platform ON user_device_tokens(platform);
```

#### 3.2 알림 설정 테이블 (기존)
```sql
-- packages/mobile/supabase/migrations/20251027000000_user_notification_settings.sql
-- 이미 존재하는 테이블:
-- - push_notifications (푸시 알림 전체 활성화)
-- - print_complete_notifications (프린팅 완료)
-- - error_notifications (오류 알림)
-- - email_notifications (이메일 알림)
-- - weekly_report (주간 리포트)
```

#### 3.3 알림 로그 테이블 (선택사항)
```sql
CREATE TABLE push_notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  device_token TEXT,
  platform TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered BOOLEAN DEFAULT FALSE,
  opened BOOLEAN DEFAULT FALSE,
  error TEXT
);
```

---

## 📋 구현 단계

### Phase 1: 기본 인프라 구축 (1-2주)

#### 1. Firebase 프로젝트 설정
- [ ] Firebase Console에서 프로젝트 생성
- [ ] Android 앱 등록 (`com.factor.app`)
- [ ] iOS 앱 등록 (Bundle ID 확인 필요)
- [ ] `google-services.json` 다운로드 → `packages/mobile/android/app/`
- [ ] `GoogleService-Info.plist` 다운로드 → `packages/mobile/ios/App/App/`

#### 2. Capacitor Push Notifications 플러그인 설치
```bash
cd packages/mobile
npm install @capacitor/push-notifications
npx cap sync
```

#### 3. Android 설정
```gradle
// packages/mobile/android/app/build.gradle
dependencies {
  implementation platform('com.google.firebase:firebase-bom:32.7.0')
  implementation 'com.google.firebase:firebase-messaging'
}
```

#### 4. iOS 설정
- APNs 인증서 생성 (Apple Developer Console)
- Firebase Console에 APNs 인증서 업로드
- Xcode에서 Capabilities > Push Notifications 활성화

#### 5. 데이터베이스 마이그레이션
```bash
# user_device_tokens 테이블 생성
npx supabase migration new create_device_tokens
npx supabase db push
```

---

### Phase 2: 모바일 앱 통합 (1주)

#### 1. Push Notification 서비스 구현
```typescript
// packages/mobile/src/services/pushNotificationService.ts
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@shared/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';

export async function initializePushNotifications(userId: string) {
  const platform = Capacitor.getPlatform();

  // iOS만 권한 요청 필요
  if (platform === 'ios') {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      console.log('Push notification permission denied');
      return;
    }
  }

  // FCM 토큰 등록
  await PushNotifications.register();

  // 토큰 수신 리스너
  PushNotifications.addListener('registration', async (token) => {
    console.log('Push registration success, token:', token.value);

    // Supabase에 토큰 저장
    await supabase.from('user_device_tokens').upsert({
      user_id: userId,
      device_token: token.value,
      platform: platform,
      device_info: {
        model: await Device.getInfo(),
      },
    });
  });

  // 알림 수신 리스너 (앱 실행 중)
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push notification received:', notification);

    // In-app 알림 표시 (Toast)
    showInAppNotification({
      title: notification.title,
      body: notification.body,
    });
  });

  // 알림 클릭 리스너
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('Push notification action performed:', action);

    // 딥링크 처리
    handleNotificationAction(action.notification);
  });
}
```

#### 2. App.tsx에 초기화 추가
```typescript
// packages/mobile/src/App.tsx
import { initializePushNotifications } from './services/pushNotificationService';

useEffect(() => {
  if (user && Capacitor.isNativePlatform()) {
    initializePushNotifications(user.id);
  }
}, [user]);
```

---

### Phase 3: 백엔드 알림 발송 로직 (2주)

#### 1. Supabase Edge Function 생성
```bash
cd packages/web
npx supabase functions new send-push-notification
```

```typescript
// packages/web/supabase/functions/send-push-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY");

serve(async (req) => {
  const {
    userId,
    title,
    body,
    data,
    imageUrl,
  } = await req.json();

  // 1. 사용자 디바이스 토큰 조회
  const { data: tokens } = await supabase
    .from('user_device_tokens')
    .select('device_token, platform')
    .eq('user_id', userId);

  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ error: 'No device tokens found' }), {
      status: 404,
    });
  }

  // 2. FCM API 호출
  const fcmPromises = tokens.map(async (token) => {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${FCM_SERVER_KEY}`,
      },
      body: JSON.stringify({
        to: token.device_token,
        notification: {
          title,
          body,
          image: imageUrl,
          sound: 'default',
        },
        data,
        priority: 'high',
      }),
    });

    return response.json();
  });

  const results = await Promise.all(fcmPromises);

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

#### 2. MQTT 상태 변경 감지 및 푸시 발송
```typescript
// packages/shared/src/services/mqttService/pushNotificationTrigger.ts
import { supabase } from '../../integrations/supabase/client';

export async function handlePrinterStateChange(
  printerId: string,
  userId: string,
  oldState: PrinterState,
  newState: PrinterState,
  flags: PrinterStateFlags
) {
  // 프린팅 완료
  if (oldState === 'printing' && newState === 'idle') {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        userId,
        title: '프린팅 완료 🎉',
        body: `프린터의 프린팅이 완료되었습니다.`,
        data: {
          type: 'print_complete',
          printer_id: printerId,
          action_url: `/printer/${printerId}`,
        },
      },
    });
  }

  // 오류 발생
  if (newState === 'error') {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        userId,
        title: '프린팅 오류 ⚠️',
        body: `프린터에서 오류가 발생했습니다.`,
        data: {
          type: 'print_error',
          printer_id: printerId,
          action_url: `/printer/${printerId}`,
        },
      },
    });
  }
}
```

#### 3. AI 모델 생성 완료 시 푸시 발송
```typescript
// packages/shared/src/services/supabaseService/aiModel.ts
// generateAIModel 함수 내부에 추가

// 모델 생성 완료 후
await supabase.functions.invoke('send-push-notification', {
  body: {
    userId: user.id,
    title: 'AI 모델 생성 완료 ✨',
    body: `${modelName} 모델 생성이 완료되었습니다.`,
    data: {
      type: 'ai_model_complete',
      model_id: modelId,
      action_url: `/ai?model_id=${modelId}`,
    },
    imageUrl: thumbnailUrl,
  },
});
```

---

### Phase 4: 딥링크 및 UI/UX 개선 (1주)

#### 1. 딥링크 처리
```typescript
// packages/mobile/src/services/pushNotificationService.ts
function handleNotificationAction(notification: any) {
  const data = notification.data;

  switch (data.type) {
    case 'print_complete':
    case 'print_error':
      navigate(`/printer/${data.printer_id}`);
      break;

    case 'ai_model_complete':
      navigate(`/ai?model_id=${data.model_id}`);
      break;

    case 'payment_success':
      navigate('/user-settings');
      break;

    default:
      navigate('/notifications');
  }
}
```

#### 2. Android Notification Channels 설정
```typescript
// packages/mobile/android/app/src/main/java/com/factor/app/MainActivity.java
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    createNotificationChannels();
  }

  private void createNotificationChannels() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      // 기본 채널
      NotificationChannel defaultChannel = new NotificationChannel(
        "factor_default",
        "일반 알림",
        NotificationManager.IMPORTANCE_DEFAULT
      );

      // 프린터 오류 채널 (High Priority)
      NotificationChannel errorChannel = new NotificationChannel(
        "factor_errors",
        "오류 알림",
        NotificationManager.IMPORTANCE_HIGH
      );

      NotificationManager manager = getSystemService(NotificationManager.class);
      manager.createNotificationChannel(defaultChannel);
      manager.createNotificationChannel(errorChannel);
    }
  }
}
```

---

## 🎯 알림 우선순위 및 채널 전략

### Android Notification Channels

| 채널 ID | 이름 | 우선순위 | 사용 시나리오 |
|---------|------|---------|--------------|
| `factor_default` | 일반 알림 | Default | 프린팅 완료, AI 모델 생성 완료 |
| `factor_errors` | 오류 알림 | High | 프린팅 오류, 온도 이상, 연결 끊김 |
| `factor_system` | 시스템 공지 | Low | 점검 공지, 기능 업데이트 |

### iOS 우선순위

- **Critical**: 프린터 화재 감지 (향후 추가 시)
- **Time-Sensitive**: 프린팅 오류
- **Default**: 프린팅 완료, AI 모델 완료
- **Passive**: 시스템 공지

---

## 📊 테스트 계획

### 1. 단위 테스트
- [ ] FCM 토큰 등록/해제
- [ ] 알림 설정 저장/로드
- [ ] Edge Function 호출

### 2. 통합 테스트
- [ ] MQTT 상태 변경 → 푸시 발송
- [ ] AI 모델 생성 완료 → 푸시 발송
- [ ] 결제 완료 → 푸시 발송

### 3. 사용자 시나리오 테스트
- [ ] 앱 포그라운드 상태에서 알림 수신
- [ ] 앱 백그라운드 상태에서 알림 수신
- [ ] 앱 종료 상태에서 알림 수신
- [ ] 알림 클릭 → 딥링크 동작
- [ ] 알림 설정 변경 → 푸시 수신 여부 확인

### 4. 플랫폼별 테스트
- [ ] Android 8.0+ (Notification Channels)
- [ ] Android 13+ (POST_NOTIFICATIONS 권한)
- [ ] iOS 15+
- [ ] iOS 16+ (Live Activities - 향후)

---

## 🔐 보안 및 개인정보 고려사항

### 1. 사용자 권한
- iOS: `Info.plist`에 사용 목적 명시
- Android: `AndroidManifest.xml`에 권한 추가
- 사용자가 거부 시 graceful degradation

### 2. 토큰 관리
- 디바이스 토큰은 암호화하여 저장
- 로그아웃 시 토큰 삭제
- 만료된 토큰 자동 정리 (Cron job)

### 3. 데이터 최소화
- 푸시 알림에 민감한 정보 포함 금지
- 상세 내용은 앱 내에서만 표시

---

## 💰 비용 산정

### Firebase Cloud Messaging (FCM)
- **무료**: 무제한 메시지
- **단, Google Cloud Platform 사용 시**:
  - Cloud Functions: 월 2M 호출 무료
  - 초과 시: $0.40 / 1M 호출

### Supabase Edge Functions
- **무료 플랜**: 500K 실행/월
- **Pro 플랜**: $25/월 (2M 실행 포함)

### 예상 비용 (월 1,000 사용자 기준)
- 사용자당 평균 푸시 10개/일
- 월 총 푸시: 300K
- **비용**: $0 (무료 범위 내)

---

## 📈 모니터링 및 분석

### 1. 알림 발송 성공률
- FCM 응답 로그 수집
- 실패 사유 분석 (토큰 만료, 앱 삭제 등)

### 2. 알림 오픈율
- 알림 클릭 이벤트 추적
- Google Analytics / Firebase Analytics 연동

### 3. 사용자 설정 분석
- 알림 유형별 활성화율
- 알림 끄는 사용자 비율

---

## 🚀 향후 확장 계획

### 1. Rich Notifications
- 이미지, 동영상 첨부
- 액션 버튼 (일시정지, 재시작 등)

### 2. iOS Live Activities (iOS 16+)
- 프린팅 진행률 실시간 표시
- Dynamic Island 지원

### 3. Notification Grouping
- 같은 프린터의 알림 그룹화
- 여러 알림을 요약하여 표시

### 4. Quiet Hours (방해 금지)
- 사용자 설정 시간대에 알림 비활성화
- 긴급 알림 (오류)만 예외 허용

### 5. 다국어 지원
- 사용자 언어 설정에 따른 알림 메시지
- `message_en` 필드 활용

---

## 📝 체크리스트

### 개발 완료 전 확인사항
- [ ] Firebase 프로젝트 생성 및 앱 등록
- [ ] `google-services.json`, `GoogleService-Info.plist` 추가
- [ ] `@capacitor/push-notifications` 설치 및 설정
- [ ] 데이터베이스 테이블 생성 (`user_device_tokens`)
- [ ] Edge Function 구현 (`send-push-notification`)
- [ ] FCM_SERVER_KEY 환경 변수 설정
- [ ] 모바일 앱에 푸시 초기화 코드 추가
- [ ] MQTT 상태 변경 감지 로직 추가
- [ ] AI 모델/슬라이싱 완료 시 푸시 발송
- [ ] 딥링크 처리 구현
- [ ] Android Notification Channels 설정
- [ ] 알림 설정 UI 연동
- [ ] 테스트 (포그라운드, 백그라운드, 종료 상태)
- [ ] 로그아웃 시 토큰 삭제 구현
- [ ] 프로덕션 배포 전 FCM 프로젝트 검증

---

## 📚 참고 자료

- [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [APNs (Apple Push Notification service)](https://developer.apple.com/documentation/usernotifications)
- [Android Notification Channels](https://developer.android.com/develop/ui/views/notifications/channels)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

## 🎉 예상 완료 일정

- **Phase 1** (기본 인프라): 2주
- **Phase 2** (모바일 통합): 1주
- **Phase 3** (백엔드 로직): 2주
- **Phase 4** (딥링크/UX): 1주
- **테스트 및 버그 수정**: 1주

**총 예상 기간**: 7주 (약 1.5-2개월)
