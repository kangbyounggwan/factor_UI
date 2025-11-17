# Firebase Cloud Messaging (FCM) 설정 가이드

FACTOR 모바일 앱에 Firebase Cloud Messaging을 설정하여 푸시 알림을 활성화하는 단계별 가이드입니다.

---

## 📋 목차

1. [Firebase 프로젝트 생성](#1-firebase-프로젝트-생성)
2. [Android 앱 설정](#2-android-앱-설정)
3. [iOS 앱 설정](#3-ios-앱-설정)
4. [Capacitor 플러그인 설치](#4-capacitor-플러그인-설치)
5. [모바일 앱 코드 구현](#5-모바일-앱-코드-구현)
6. [백엔드 설정](#6-백엔드-설정)
7. [테스트](#7-테스트)

---

## 1. Firebase 프로젝트 생성

### 1.1 Firebase Console 접속

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. Google 계정으로 로그인
3. **"프로젝트 추가"** 클릭

### 1.2 프로젝트 생성

1. **프로젝트 이름**: `FACTOR` 입력
2. **프로젝트 ID**: `factor-hibrid` (자동 생성, 원하는 대로 수정 가능)
3. **Google Analytics**: 선택 (권장) 또는 건너뛰기
4. **"프로젝트 만들기"** 클릭

⏱️ 프로젝트 생성에 약 30초~1분 소요됩니다.

### 1.3 Cloud Messaging 활성화

1. Firebase Console > **프로젝트 설정** (⚙️ 아이콘)
2. **"클라우드 메시징"** 탭 선택
3. **Cloud Messaging API (Legacy) 사용 설정됨** 확인
   - ⚠️ 만약 비활성화되어 있다면:
     - Google Cloud Console로 이동
     - **Cloud Messaging API** 검색 후 활성화

---

## 2. Android 앱 설정

### 2.1 Android 앱 등록

1. Firebase Console > **프로젝트 개요**
2. **Android 앱 추가** (Android 아이콘) 클릭
3. 앱 등록 정보 입력:
   ```
   Android 패키지 이름: com.factor.app
   앱 닉네임: FACTOR (선택사항)
   디버그 서명 인증서 SHA-1: (선택사항, 나중에 추가 가능)
   ```
4. **"앱 등록"** 클릭

### 2.2 google-services.json 다운로드

1. **`google-services.json`** 파일 다운로드
2. 파일을 다음 경로에 복사:
   ```
   packages/mobile/android/app/google-services.json
   ```

### 2.3 Android 프로젝트 설정

#### 2.3.1 프로젝트 수준 build.gradle 수정

파일: `packages/mobile/android/build.gradle`

```gradle
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.0.0'
        // Firebase 추가
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

#### 2.3.2 앱 수준 build.gradle 확인

파일: `packages/mobile/android/app/build.gradle`

기존 코드가 이미 있는지 확인:

```gradle
// 맨 아래에 이미 존재하는 코드
try {
    def servicesJSON = file('google-services.json')
    if (servicesJSON.text) {
        apply plugin: 'com.google.gms.google-services'
    }
} catch(Exception e) {
    logger.info("google-services.json not found, google-services plugin not applied. Push Notifications won't work")
}
```

✅ **이미 있다면 추가 작업 불필요!**

#### 2.3.3 Firebase BOM 및 Messaging 추가

파일: `packages/mobile/android/app/build.gradle`

`dependencies` 블록에 추가:

```gradle
dependencies {
    // 기존 dependencies...

    // Firebase BOM (Bill of Materials)
    implementation platform('com.google.firebase:firebase-bom:32.7.0')

    // Firebase Cloud Messaging
    implementation 'com.google.firebase:firebase-messaging'

    // Capacitor Push Notifications (나중에 설치)
    // implementation 'com.google.firebase:firebase-analytics' // Analytics 사용 시
}
```

### 2.4 AndroidManifest.xml 설정

파일: `packages/mobile/android/app/src/main/AndroidManifest.xml`

`<application>` 태그 안에 추가:

```xml
<application
    ...>

    <!-- FCM 기본 알림 아이콘 (선택사항) -->
    <meta-data
        android:name="com.google.firebase.messaging.default_notification_icon"
        android:resource="@mipmap/ic_launcher" />

    <!-- FCM 기본 알림 색상 (선택사항) -->
    <meta-data
        android:name="com.google.firebase.messaging.default_notification_color"
        android:resource="@color/colorPrimary" />

    <!-- FCM 기본 알림 채널 (Android 8.0+) -->
    <meta-data
        android:name="com.google.firebase.messaging.default_notification_channel_id"
        android:value="factor_default" />

</application>
```

`<manifest>` 태그 안에 권한 추가:

```xml
<manifest ...>

    <!-- Android 13+ 푸시 알림 권한 -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

</manifest>
```

---

## 3. iOS 앱 설정

### 3.1 iOS 앱 등록

1. Firebase Console > **프로젝트 개요**
2. **iOS 앱 추가** (Apple 아이콘) 클릭
3. 앱 등록 정보 입력:
   ```
   iOS 번들 ID: com.byeonggwan.factor
   앱 닉네임: FACTOR (선택사항)
   App Store ID: (나중에 추가 가능)
   ```

   ⚠️ **Bundle ID 확인 방법**:
   - Xcode에서 `packages/mobile/ios/App/App.xcworkspace` 열기
   - **TARGETS > App > General > Identity > Bundle Identifier** 확인

4. **"앱 등록"** 클릭

### 3.2 GoogleService-Info.plist 다운로드

1. **`GoogleService-Info.plist`** 파일 다운로드
2. 파일을 다음 경로에 복사:
   ```
   packages/mobile/ios/App/App/GoogleService-Info.plist
   ```
3. Xcode에서 프로젝트에 추가:
   - Xcode 열기
   - `GoogleService-Info.plist` 파일을 **App** 폴더로 드래그
   - **"Copy items if needed"** 체크
   - **"Add to targets: App"** 체크

### 3.3 APNs 인증 키 생성

#### 3.3.1 Apple Developer Console에서 APNs 키 생성

1. [Apple Developer Console](https://developer.apple.com/account/) 로그인
2. **Certificates, Identifiers & Profiles** 선택
3. **Keys** > **+** (새 키 생성)
4. 키 이름 입력: `FACTOR APNs Key`
5. **Apple Push Notifications service (APNs)** 체크
6. **Continue** > **Register**
7. **Download** 클릭 → `.p8` 파일 다운로드
   - ⚠️ **Key ID**를 메모 (예: `AB12CD34EF`)
8. **Team ID** 확인:
   - 우측 상단 계정 정보에서 확인 (예: `XYZ1234ABC`)

#### 3.3.2 Firebase에 APNs 키 업로드

1. Firebase Console > **프로젝트 설정** > **클라우드 메시징** 탭
2. **Apple 앱 구성** 섹션
3. **APNs 인증 키** > **업로드** 클릭
4. 다운로드한 `.p8` 파일 선택
5. **Key ID** 입력
6. **Team ID** 입력
7. **업로드** 클릭

### 3.4 Xcode Capabilities 설정

1. Xcode에서 **TARGETS > App** 선택
2. **Signing & Capabilities** 탭
3. **+ Capability** 클릭
4. **Push Notifications** 추가
5. **Background Modes** 추가
   - **Remote notifications** 체크

### 3.5 AppDelegate.swift 수정

파일: `packages/mobile/ios/App/App/AppDelegate.swift`

```swift
import UIKit
import Capacitor
import Firebase  // 추가

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

        // Firebase 초기화 (추가)
        FirebaseApp.configure()

        return true
    }

    // ... 나머지 코드
}
```

### 3.6 Podfile 수정

파일: `packages/mobile/ios/App/Podfile`

```ruby
platform :ios, '13.0'
use_frameworks!

# Firebase 추가
pod 'Firebase/Messaging'

target 'App' do
  capacitor_pods
  # 기존 pods...
end
```

터미널에서 실행:

```bash
cd packages/mobile/ios/App
pod install
```

---

## 4. Capacitor 플러그인 설치

### 4.1 Push Notifications 플러그인 설치

```bash
cd packages/mobile
npm install @capacitor/push-notifications
npx cap sync
```

### 4.2 설치 확인

```bash
npx cap ls
```

출력에서 `@capacitor/push-notifications` 확인

---

## 5. 모바일 앱 코드 구현

### 5.1 푸시 알림 서비스 생성

파일: `packages/mobile/src/services/pushNotificationService.ts`

```typescript
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@shared/integrations/supabase/client';
import { Device } from '@capacitor/device';

/**
 * 푸시 알림 초기화
 */
export async function initializePushNotifications(userId: string) {
  const platform = Capacitor.getPlatform();

  if (!Capacitor.isNativePlatform()) {
    console.log('[Push] Web platform, push notifications not supported');
    return;
  }

  console.log('[Push] Initializing push notifications...');

  // iOS에서만 권한 요청
  if (platform === 'ios') {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      console.log('[Push] Permission denied');
      return;
    }
  }

  // FCM 토큰 등록
  await PushNotifications.register();

  // 이벤트 리스너 등록
  setupPushListeners(userId);
}

/**
 * 푸시 알림 이벤트 리스너 설정
 */
function setupPushListeners(userId: string) {
  // 1. 토큰 수신 성공
  PushNotifications.addListener('registration', async (token: Token) => {
    console.log('[Push] Registration success, token:', token.value);

    try {
      // 디바이스 정보 가져오기
      const deviceInfo = await Device.getInfo();
      const platform = Capacitor.getPlatform();

      // Supabase에 토큰 저장
      const { error } = await supabase
        .from('user_device_tokens')
        .upsert({
          user_id: userId,
          device_token: token.value,
          platform: platform,
          device_info: {
            model: deviceInfo.model,
            platform: deviceInfo.platform,
            osVersion: deviceInfo.osVersion,
            manufacturer: deviceInfo.manufacturer,
          },
          last_used_at: new Date().toISOString(),
        }, {
          onConflict: 'device_token',
        });

      if (error) {
        console.error('[Push] Failed to save token:', error);
      } else {
        console.log('[Push] Token saved to database');
      }
    } catch (error) {
      console.error('[Push] Error saving token:', error);
    }
  });

  // 2. 토큰 등록 실패
  PushNotifications.addListener('registrationError', (error: any) => {
    console.error('[Push] Registration error:', error);
  });

  // 3. 푸시 알림 수신 (앱 실행 중)
  PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
    console.log('[Push] Notification received:', notification);

    // In-app 알림 표시 (선택사항)
    // showInAppNotification(notification);
  });

  // 4. 푸시 알림 클릭 (딥링크 처리)
  PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    console.log('[Push] Notification action performed:', action);

    // 딥링크 처리
    handleNotificationAction(action.notification);
  });
}

/**
 * 푸시 알림 클릭 시 딥링크 처리
 */
function handleNotificationAction(notification: any) {
  const data = notification.data;

  // Router를 직접 사용할 수 없으므로 이벤트 발행
  window.dispatchEvent(
    new CustomEvent('push-notification-action', {
      detail: { type: data.type, actionUrl: data.action_url, data },
    })
  );
}

/**
 * 로그아웃 시 디바이스 토큰 삭제
 */
export async function removePushToken(userId: string) {
  try {
    const platform = Capacitor.getPlatform();

    // 현재 디바이스의 토큰 삭제
    const { error } = await supabase
      .from('user_device_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('platform', platform);

    if (error) {
      console.error('[Push] Failed to remove token:', error);
    } else {
      console.log('[Push] Token removed from database');
    }
  } catch (error) {
    console.error('[Push] Error removing token:', error);
  }
}
```

### 5.2 App.tsx에 초기화 추가

파일: `packages/mobile/src/App.tsx`

```typescript
import { initializePushNotifications, removePushToken } from './services/pushNotificationService';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';

const AppContent = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // 푸시 알림 초기화
  useEffect(() => {
    if (user && Capacitor.isNativePlatform()) {
      initializePushNotifications(user.id);
    }
  }, [user]);

  // 푸시 알림 클릭 이벤트 리스너
  useEffect(() => {
    const handlePushAction = (event: any) => {
      const { type, actionUrl } = event.detail;

      console.log('[App] Push action:', type, actionUrl);

      // 딥링크 처리
      if (actionUrl) {
        navigate(actionUrl);
      }
    };

    window.addEventListener('push-notification-action', handlePushAction);

    return () => {
      window.removeEventListener('push-notification-action', handlePushAction);
    };
  }, [navigate]);

  // 로그아웃 시 토큰 삭제
  const handleSignOut = async () => {
    if (user && Capacitor.isNativePlatform()) {
      await removePushToken(user.id);
    }
    await signOut();
  };

  // 기존 signOut을 handleSignOut으로 변경
  // ...
};
```

### 5.3 Android Notification Channels 설정

파일: `packages/mobile/android/app/src/main/java/com/factor/app/MainActivity.java`

```java
package com.factor.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Notification Channels 생성 (Android 8.0+)
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);

            // 1. 기본 채널
            NotificationChannel defaultChannel = new NotificationChannel(
                "factor_default",
                "일반 알림",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            defaultChannel.setDescription("프린팅 완료, AI 모델 생성 등");
            defaultChannel.enableVibration(true);
            defaultChannel.setShowBadge(true);

            // 2. 오류 알림 채널 (High Priority)
            NotificationChannel errorChannel = new NotificationChannel(
                "factor_errors",
                "오류 알림",
                NotificationManager.IMPORTANCE_HIGH
            );
            errorChannel.setDescription("프린팅 오류, 온도 이상 등");
            errorChannel.enableVibration(true);
            errorChannel.setShowBadge(true);

            // 3. 시스템 공지 채널 (Low Priority)
            NotificationChannel systemChannel = new NotificationChannel(
                "factor_system",
                "시스템 공지",
                NotificationManager.IMPORTANCE_LOW
            );
            systemChannel.setDescription("점검 공지, 기능 업데이트");

            // 채널 등록
            if (manager != null) {
                manager.createNotificationChannel(defaultChannel);
                manager.createNotificationChannel(errorChannel);
                manager.createNotificationChannel(systemChannel);
            }
        }
    }
}
```

---

## 6. 백엔드 설정

### 6.1 데이터베이스 마이그레이션

파일: `packages/web/supabase/migrations/20251116020000_user_device_tokens.sql`

```sql
-- 사용자 디바이스 토큰 테이블 생성
CREATE TABLE IF NOT EXISTS user_device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_id ON user_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_device_token ON user_device_tokens(device_token);
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_platform ON user_device_tokens(platform);

-- RLS 정책
ALTER TABLE user_device_tokens ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 토큰만 삽입/업데이트/삭제 가능
CREATE POLICY "Users can manage their own device tokens"
  ON user_device_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_user_device_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_device_tokens_updated_at
  BEFORE UPDATE ON user_device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_user_device_tokens_updated_at();
```

마이그레이션 실행:

```bash
cd packages/web
npx supabase db push
```

### 6.2 FCM Server Key 발급

1. Firebase Console > **프로젝트 설정** > **클라우드 메시징** 탭
2. **Cloud Messaging API (Legacy)** 섹션
3. **서버 키** 복사 (예: `AAAAxxxxxxx:APA91bF...`)

### 6.3 Supabase Edge Function 생성

```bash
cd packages/web
npx supabase functions new send-push-notification
```

파일: `packages/web/supabase/functions/send-push-notification/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  channelId?: string; // Android only
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: PushNotificationPayload = await req.json();
    const { userId, title, body, data, imageUrl, channelId } = payload;

    // Supabase 클라이언트 생성
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

    // 1. 사용자 알림 설정 확인
    const { data: settings } = await supabase
      .from('user_notification_settings')
      .select('push_notifications')
      .eq('user_id', userId)
      .single();

    if (!settings?.push_notifications) {
      return new Response(
        JSON.stringify({ message: 'Push notifications disabled for this user' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // 2. 사용자 디바이스 토큰 조회
    const { data: tokens, error: tokensError } = await supabase
      .from('user_device_tokens')
      .select('device_token, platform')
      .eq('user_id', userId);

    if (tokensError || !tokens || tokens.length === 0) {
      console.log('No device tokens found for user:', userId);
      return new Response(
        JSON.stringify({ message: 'No device tokens found' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // 3. FCM API 호출 (각 토큰별로)
    const fcmPromises = tokens.map(async (tokenInfo) => {
      const fcmPayload: any = {
        to: tokenInfo.device_token,
        notification: {
          title,
          body,
          sound: 'default',
        },
        data: data || {},
        priority: 'high',
      };

      // 이미지 추가 (있는 경우)
      if (imageUrl) {
        fcmPayload.notification.image = imageUrl;
      }

      // Android 전용 설정
      if (tokenInfo.platform === 'android') {
        fcmPayload.android = {
          notification: {
            channelId: channelId || 'factor_default',
            sound: 'default',
          },
        };
      }

      // iOS 전용 설정
      if (tokenInfo.platform === 'ios') {
        fcmPayload.apns = {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        };
      }

      // FCM API 호출
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${FCM_SERVER_KEY}`,
        },
        body: JSON.stringify(fcmPayload),
      });

      const result = await response.json();

      // 실패한 토큰 처리 (만료, 앱 삭제 등)
      if (result.failure === 1) {
        console.log('Failed to send to token:', tokenInfo.device_token);

        // 만료된 토큰 삭제
        if (result.results?.[0]?.error === 'NotRegistered' ||
            result.results?.[0]?.error === 'InvalidRegistration') {
          await supabase
            .from('user_device_tokens')
            .delete()
            .eq('device_token', tokenInfo.device_token);

          console.log('Deleted expired token');
        }
      }

      return result;
    });

    const results = await Promise.all(fcmPromises);

    console.log('Push notification sent:', {
      userId,
      title,
      tokensCount: tokens.length,
      results,
    });

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error('Error sending push notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
```

### 6.4 Edge Function 배포

```bash
# FCM Server Key 환경 변수 설정
npx supabase secrets set FCM_SERVER_KEY=AAAAxxxxxxx:APA91bF...

# Edge Function 배포
npx supabase functions deploy send-push-notification
```

### 6.5 shared 패키지에 푸시 발송 함수 추가

파일: `packages/shared/src/services/supabaseService/pushNotification.ts`

```typescript
import { supabase } from "../../integrations/supabase/client";

export interface SendPushParams {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  channelId?: 'factor_default' | 'factor_errors' | 'factor_system';
}

/**
 * 푸시 알림 발송
 */
export async function sendPushNotification(params: SendPushParams) {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: params,
    });

    if (error) {
      console.error('Failed to send push notification:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error };
  }
}
```

---

## 7. 테스트

### 7.1 Android 테스트

```bash
cd packages/mobile
npm run build
npx cap sync android
npx cap run android
```

### 7.2 iOS 테스트

```bash
cd packages/mobile
npm run build
npx cap sync ios
npx cap open ios
```

Xcode에서 **실제 디바이스**에 빌드 및 실행 (시뮬레이터는 푸시 알림 미지원)

### 7.3 푸시 알림 테스트 발송

#### 방법 1: Supabase Edge Function 직접 호출

```typescript
// 모바일 앱 또는 웹에서 테스트
import { supabase } from '@shared/integrations/supabase/client';

async function testPushNotification(userId: string) {
  const { data, error } = await supabase.functions.invoke('send-push-notification', {
    body: {
      userId: userId,
      title: '테스트 푸시 알림',
      body: '푸시 알림이 정상적으로 작동합니다!',
      data: {
        type: 'test',
        action_url: '/notifications',
      },
    },
  });

  console.log('Test push result:', data, error);
}
```

#### 방법 2: Firebase Console에서 직접 발송

1. Firebase Console > **클라우드 메시징** > **Send your first message**
2. 알림 제목/본문 입력
3. **테스트 메시지 전송** 클릭
4. FCM 등록 토큰 입력 (앱 로그에서 복사)
5. **테스트** 클릭

### 7.4 테스트 체크리스트

- [ ] 앱 포그라운드 상태에서 푸시 수신
- [ ] 앱 백그라운드 상태에서 푸시 수신
- [ ] 앱 완전 종료 상태에서 푸시 수신
- [ ] 푸시 알림 클릭 → 딥링크 동작
- [ ] Android Notification Channels 확인
- [ ] iOS Badge 카운트 확인
- [ ] 알림 설정 비활성화 시 푸시 미수신
- [ ] 로그아웃 시 토큰 삭제 확인

---

## 🔥 문제 해결 (Troubleshooting)

### 1. Android: 푸시가 오지 않아요

**원인 1**: `google-services.json` 파일 누락
```bash
# 파일 위치 확인
ls packages/mobile/android/app/google-services.json
```

**원인 2**: Firebase Plugin 미적용
```bash
# build.gradle 확인
cat packages/mobile/android/app/build.gradle | grep google-services
```

**원인 3**: Android 13+ 권한 거부
- 앱 설정 > 권한 > 알림 허용

**원인 4**: Notification Channel 미생성
- MainActivity.java 확인

### 2. iOS: 푸시가 오지 않아요

**원인 1**: APNs 인증 키 미업로드
- Firebase Console > 클라우드 메시징 > APNs 인증 키 확인

**원인 2**: Xcode Capabilities 미설정
- Push Notifications 추가 확인
- Background Modes > Remote notifications 체크

**원인 3**: 시뮬레이터에서 테스트
- **실제 디바이스 필수**

**원인 4**: GoogleService-Info.plist 미추가
- Xcode 프로젝트에 파일 추가 확인

### 3. Edge Function 에러

**원인**: FCM_SERVER_KEY 환경 변수 미설정
```bash
# 환경 변수 확인
npx supabase secrets list

# 설정
npx supabase secrets set FCM_SERVER_KEY=YOUR_KEY
```

### 4. 토큰이 저장되지 않아요

**원인**: user_device_tokens 테이블 미생성
```bash
# 마이그레이션 확인
npx supabase db push
```

---

## 📚 다음 단계

1. [PUSH_NOTIFICATION_PLAN.md](./PUSH_NOTIFICATION_PLAN.md) - 푸시 알림 트리거 구현
2. MQTT 상태 변경 시 푸시 발송 로직 추가
3. AI 모델 생성 완료 시 푸시 발송
4. 알림 설정 UI 연동

---

## ✅ 완료 체크리스트

- [ ] Firebase 프로젝트 생성
- [ ] Android 앱 등록 (`com.factor.app`)
- [ ] iOS 앱 등록 (Bundle ID 확인)
- [ ] `google-services.json` 추가
- [ ] `GoogleService-Info.plist` 추가
- [ ] APNs 인증 키 업로드
- [ ] Capacitor Push Notifications 설치
- [ ] `pushNotificationService.ts` 구현
- [ ] App.tsx 초기화 코드 추가
- [ ] Android Notification Channels 설정
- [ ] `user_device_tokens` 테이블 생성
- [ ] Edge Function 구현 및 배포
- [ ] FCM_SERVER_KEY 환경 변수 설정
- [ ] 테스트 (Android/iOS)

---

축하합니다! 🎉 Firebase Cloud Messaging 설정이 완료되었습니다.
