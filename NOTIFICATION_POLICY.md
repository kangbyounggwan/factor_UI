# 📱 알림 정책 (Notification Policy)

## 🎯 기본 원칙

### 1. 로그인 세션 기반 알림
- ✅ **활성 세션만 푸시 알림 전송**: 현재 로그인되어 있는 디바이스에만 푸시 알림 전송
- ❌ **로그아웃된 디바이스 제외**: 로그아웃 시 FCM 토큰을 비활성화하여 푸시 알림 차단
- ✅ **다중 디바이스 지원**: 한 사용자가 여러 디바이스에 로그인한 경우 모든 활성 디바이스에 전송

### 2. 앱 상태별 알림 처리

#### 📱 앱이 **활성화**(Foreground)되어 있을 때
- ❌ **푸시 알림 표시 안 함**: 시스템 알림 표시하지 않음
- ✅ **우측 상단 알림 아이콘에만 표시**: 빨간 점 (배지) 표시
- ✅ **DB에 알림 저장**: `notifications` 테이블에 기록
- ✅ **Realtime 업데이트**: 즉시 알림 카운트 증가

#### 📴 앱이 **백그라운드** 또는 **종료**되어 있을 때
- ✅ **푸시 알림 표시**: 시스템 알림 트레이에 표시
- ✅ **DB에 알림 저장**: `notifications` 테이블에 기록
- ✅ **알림 클릭 시**: 해당 페이지로 이동 (딥링크)

### 3. 알림 중복 방지
- ✅ **동일 이벤트 중복 방지**: 동일한 AI 모델 완료 알림은 1회만 전송
- ✅ **알림 ID 기반 관리**: `notifications` 테이블의 `id`로 중복 체크

---

## 📊 알림 플로우 차트

```
┌─────────────────────────────────────────┐
│  이벤트 발생 (AI 모델 완료, 프린팅 완료 등)  │
└──────────────────┬──────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │ DB에 알림 저장        │
         │ (notifications 테이블) │
         └──────────┬────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ 사용자 활성 디바이스   │
         │ FCM 토큰 조회         │
         └──────────┬────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ 각 디바이스별 상태 확인│
         └──────────┬────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
  ┌─────────────┐      ┌─────────────┐
  │ 앱 Foreground│      │ 앱 Background│
  │  (활성화)     │      │  (종료/백그라운드)│
  └──────┬──────┘      └──────┬──────┘
         │                     │
         ▼                     ▼
  ┌─────────────┐      ┌─────────────┐
  │ 푸시 알림 X  │      │ 푸시 알림 O  │
  │ 우측 상단 +1 │      │ 시스템 알림   │
  └─────────────┘      └─────────────┘
```

---

## 🔧 구현 방법

### 1. FCM 토큰 관리

#### 로그인 시
```typescript
// App.tsx - 로그인 시 FCM 토큰 등록
await pushNotificationService.initialize(user.id);
// → user_device_tokens 테이블에 저장 (is_active: true)
```

#### 로그아웃 시
```typescript
// 로그아웃 시 FCM 토큰 비활성화
await supabase
  .from('user_device_tokens')
  .update({ is_active: false })
  .eq('user_id', userId)
  .eq('device_token', currentDeviceToken);
```

#### 자동 정리 (90일 미사용 토큰)
```sql
-- 90일 이상 사용하지 않은 토큰 자동 비활성화
SELECT cleanup_inactive_device_tokens();
```

---

### 2. 앱 상태 감지

#### 방법 A: 앱에서 상태 전송 (권장)
앱이 활성화되어 있을 때 서버에 상태를 알려줍니다.

**구현**:
```typescript
// Mobile: Capacitor App State API
import { App as CapacitorApp } from '@capacitor/app';

CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
  if (isActive) {
    // 앱이 활성화됨 → 토큰 메타데이터에 표시
    await supabase
      .from('user_device_tokens')
      .update({
        last_used_at: new Date().toISOString(),
        metadata: { app_state: 'foreground' }
      })
      .eq('device_token', currentDeviceToken);
  } else {
    // 앱이 백그라운드로 전환
    await supabase
      .from('user_device_tokens')
      .update({
        metadata: { app_state: 'background' }
      })
      .eq('device_token', currentDeviceToken);
  }
});
```

**장점**: 정확한 상태 파악
**단점**: 네트워크 요청 증가

#### 방법 B: FCM Data Message만 전송 (간단, 권장)
푸시 알림을 **Data Message**로 전송하고, 앱에서 Foreground일 때만 알림을 숨깁니다.

**구현**:
```typescript
// pushNotificationService.ts
PushNotifications.addListener('pushNotificationReceived', (notification) => {
  console.log('[Push] Foreground notification received:', notification);

  // Foreground에서는 시스템 알림 표시 안 함
  // 대신 앱 내 알림 카운트만 증가
  incrementNotificationBadge();

  // Realtime으로 알림 목록도 자동 업데이트됨
});
```

**장점**: 구현 간단, 서버 부하 없음
**단점**: FCM이 자동으로 표시하는 알림을 숨기기 어려움

#### 방법 C: 하이브리드 (최종 권장)
- **DB 알림은 항상 저장**
- **푸시 알림은 항상 전송** (FCM이 자동 처리)
- **앱에서 Foreground 수신 시**: 시스템 알림은 FCM이 표시, 앱은 Realtime으로 배지만 업데이트

**구현**: 가장 간단하며 사용자 경험도 좋음

---

### 3. 알림 전송 로직

#### Edge Function 수정: `send-push-notification`

**현재 코드**:
```typescript
// 모든 활성 디바이스에 푸시 전송
const { data: deviceTokens } = await supabase
  .from('user_device_tokens')
  .select('device_token, platform')
  .eq('user_id', userId)
  .eq('is_active', true); // ✅ 활성 토큰만
```

**추가 필터링** (선택사항):
```typescript
// 최근 7일 내 사용한 토큰만
const { data: deviceTokens } = await supabase
  .from('user_device_tokens')
  .select('device_token, platform, metadata')
  .eq('user_id', userId)
  .eq('is_active', true)
  .gte('last_used_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
```

---

### 4. Foreground 알림 처리

#### Mobile: `pushNotificationService.ts`

```typescript
private showLocalNotification(notification: PushNotificationSchema): void {
  // Foreground에서는 로컬 알림 대신 앱 내 배지만 업데이트
  console.log('[Push] Foreground notification:', notification.title, notification.body);

  // 앱 내 알림 카운트 증가 (Realtime으로 자동 업데이트)
  // 별도 처리 불필요 - Supabase Realtime이 자동으로 업데이트
}
```

#### Web: 브라우저 알림 권한 요청 (선택)
```typescript
// Web Push Notification (FCM Web)
if ('Notification' in window && Notification.permission === 'default') {
  await Notification.requestPermission();
}
```

---

## 📝 데이터베이스 스키마 업데이트

### `user_device_tokens` 테이블에 메타데이터 추가 (선택)

```sql
-- metadata 컬럼에 앱 상태 저장 (선택사항)
ALTER TABLE user_device_tokens
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 예시 데이터:
-- metadata: { "app_state": "foreground" | "background", "last_ping": "2025-01-17T12:00:00Z" }
```

---

## 🎯 알림 타입별 정책

### 1. AI 모델 생성 완료 (`ai_model_complete`)
- ✅ **푸시 알림**: 항상 전송 (백그라운드 작업이므로 중요)
- ✅ **DB 저장**: 영구 기록
- ✅ **우선순위**: HIGH
- ✅ **이미지**: 썸네일 첨부 (가능 시)

### 2. 프린팅 완료 (`print_complete`)
- ✅ **푸시 알림**: 항상 전송
- ✅ **DB 저장**: 영구 기록
- ✅ **우선순위**: HIGH

### 3. 프린팅 오류 (`print_error`)
- ✅ **푸시 알림**: 항상 전송 (긴급)
- ✅ **DB 저장**: 영구 기록
- ✅ **우선순위**: HIGH
- ⚠️ **소리/진동**: 활성화

### 4. 결제 성공 (`payment_success`)
- ✅ **푸시 알림**: 항상 전송
- ✅ **DB 저장**: 영구 기록
- ✅ **우선순위**: HIGH

### 5. 구독 만료 예정 (`subscription_expiring`)
- ✅ **푸시 알림**: 항상 전송
- ✅ **DB 저장**: 영구 기록
- ✅ **우선순위**: NORMAL
- 📅 **스케줄**: 만료 7일 전, 3일 전, 1일 전

### 6. 테스트 알림 (`test`)
- ✅ **푸시 알림**: 전송
- ❌ **DB 저장**: 임시 (선택)
- ✅ **우선순위**: NORMAL

---

## 🔐 보안 및 프라이버시

### 1. 토큰 보안
- ✅ **HTTPS 전용**: FCM 토큰은 HTTPS로만 전송
- ✅ **서비스 계정 키 보호**: Supabase 환경 변수에 저장
- ✅ **RLS (Row Level Security)**: 사용자는 자신의 토큰만 조회/수정 가능

### 2. 알림 내용 보호
- ⚠️ **민감 정보 제외**: 알림에 개인정보 포함 금지
- ✅ **일반적인 메시지**: "AI 모델 생성 완료" (모델명은 앱에서만 표시)

### 3. 토큰 만료 관리
- ✅ **자동 갱신**: 앱 실행 시 `last_used_at` 업데이트
- ✅ **90일 미사용 정리**: 자동 비활성화

---

## 🧪 테스트 시나리오

### 시나리오 1: 로그인 → AI 생성 → 완료
1. ✅ 앱 실행 → 로그인
2. ✅ FCM 토큰 등록 확인 (`user_device_tokens` 테이블)
3. ✅ AI 모델 생성 요청
4. ✅ 앱 종료
5. ✅ 백그라운드에서 생성 완료
6. ✅ 푸시 알림 수신 확인
7. ✅ 알림 클릭 → 모델 상세 페이지 이동

### 시나리오 2: 앱 활성화 상태에서 완료
1. ✅ 앱 실행 → AI 생성 요청
2. ✅ 앱을 계속 열어둠 (Foreground)
3. ✅ 생성 완료 → **푸시 알림 표시됨** (FCM이 자동 표시)
4. ✅ 우측 상단 알림 배지 +1
5. ✅ Realtime으로 알림 목록 업데이트

### 시나리오 3: 로그아웃 후 알림
1. ✅ 로그인 → AI 생성 요청
2. ✅ 로그아웃 (FCM 토큰 비활성화)
3. ✅ 생성 완료
4. ❌ 푸시 알림 수신 안 함 (is_active: false)
5. ✅ 재로그인 시 알림 목록에서 확인 가능

### 시나리오 4: 다중 디바이스
1. ✅ 디바이스 A, B 모두 로그인
2. ✅ 디바이스 A에서 AI 생성 요청
3. ✅ 생성 완료
4. ✅ 디바이스 A, B 모두 푸시 알림 수신
5. ✅ 한 디바이스에서 읽음 처리 → 다른 디바이스도 동기화 (Realtime)

---

## 📊 구현 우선순위

### Phase 1: 기본 알림 (완료)
- [x] FCM 토큰 등록
- [x] 푸시 알림 전송 (Edge Function)
- [x] DB 알림 저장
- [x] 활성 토큰만 전송

### Phase 2: 로그아웃 처리 (다음)
- [ ] 로그아웃 시 FCM 토큰 비활성화
- [ ] 재로그인 시 토큰 재활성화

### Phase 3: Foreground 처리 (선택)
- [ ] 앱 상태 감지 (Capacitor App State)
- [ ] Foreground 알림 커스터마이징
- [ ] 앱 내 배지 업데이트

### Phase 4: 고급 기능 (향후)
- [ ] 알림 우선순위별 차등 처리
- [ ] 알림 그룹화 (같은 타입 여러 개)
- [ ] 알림 스케줄링 (구독 만료 예정)
- [ ] 알림 통계 대시보드

---

## 🎉 최종 정책 요약

| 상황 | DB 저장 | 푸시 알림 | 앱 내 배지 | 소리/진동 |
|-----|--------|----------|-----------|---------|
| **앱 Foreground** | ✅ | ✅ (FCM 자동) | ✅ | ⚠️ (FCM 설정) |
| **앱 Background** | ✅ | ✅ | ✅ | ✅ |
| **앱 종료** | ✅ | ✅ | ✅ | ✅ |
| **로그아웃 상태** | ✅ | ❌ | N/A | N/A |
| **다중 디바이스** | ✅ | ✅ (모든 활성 기기) | ✅ | ✅ |

**핵심**:
- ✅ **DB 알림은 항상 저장** (영구 기록)
- ✅ **푸시 알림은 활성 세션에만 전송**
- ✅ **Foreground/Background 모두 푸시 알림 표시** (FCM이 처리)
- ✅ **로그아웃 시 토큰 비활성화**

이 정책을 따르면 사용자 경험을 해치지 않으면서도 효과적인 알림 시스템을 구축할 수 있습니다! 🚀
