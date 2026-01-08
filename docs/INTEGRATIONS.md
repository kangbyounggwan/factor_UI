# FACTOR HIBRID 외부 연동 문서

## 목차

1. [Supabase 연동](#1-supabase-연동)
2. [MQTT 연동](#2-mqtt-연동)
3. [WebRTC / MediaMTX 연동](#3-webrtc--mediamtx-연동)
4. [OctoPrint Plugin 연동](#4-octoprint-plugin-연동)
5. [AI 서비스 연동](#5-ai-서비스-연동)
6. [결제 시스템 연동](#6-결제-시스템-연동)

---

## 1. Supabase 연동

### 환경 변수

```env
VITE_SUPABASE_URL=https://ecmrkjwsjkthurwljhvp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 클라이언트 초기화

**파일**: `packages/shared/src/integrations/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### 인증 (Auth)

```typescript
// 로그인
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

// OAuth 로그인
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`
  }
});

// 세션 확인
const { data: { session } } = await supabase.auth.getSession();

// 로그아웃
await supabase.auth.signOut();
```

### 주요 테이블

| 테이블 | 용도 |
|--------|------|
| `user_profiles` | 사용자 프로필 |
| `printers` | 등록된 프린터 |
| `chat_sessions` | 채팅 세션 |
| `chat_messages` | 채팅 메시지 |
| `ai_generated_models` | AI 생성 모델 |
| `gcode_analysis_reports` | G-code 분석 보고서 |
| `model_print_history` | 출력 이력 |
| `temperature_logs` | 온도 로그 |
| `shared_chats` | 공유된 채팅 |
| `subscriptions` | 구독 정보 |

### Storage 버킷

| 버킷 | 용도 |
|------|------|
| `avatars` | 사용자 아바타 |
| `chat-images` | 채팅 이미지 |
| `ai-models` | AI 생성 모델 파일 |
| `gcode-files` | G-code 파일 |
| `reference-images` | 참조 이미지 |

### Edge Functions

**배포 명령**:
```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx npx supabase functions deploy <function-name> --project-ref ecmrkjwsjkthurwljhvp
```

**주요 함수**:

| 함수 | 용도 | 호출 방법 |
|------|------|-----------|
| `admin-ai-analytics` | AI 분석 통계 | `supabase.functions.invoke('admin-ai-analytics', { body: { action: 'stats', days: 30 } })` |
| `admin-users` | 사용자 관리 | Admin 페이지에서 사용 |
| `save-temperature` | 온도 저장 | MQTT → Edge Function |
| `send-push-notification` | 푸시 알림 | 서버에서 호출 |
| `paddle-webhook` | 결제 웹훅 | Paddle에서 호출 |

### Realtime 구독

```typescript
// 프린터 상태 변경 구독
const subscription = supabase
  .channel('printer-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'printers',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    console.log('Printer changed:', payload);
  })
  .subscribe();

// 구독 해제
subscription.unsubscribe();
```

---

## 2. MQTT 연동

### 환경 변수

```env
VITE_MQTT_URL=wss://mqtt.factor3d.com:8084/mqtt
VITE_MQTT_USERNAME=factor_client
VITE_MQTT_PASSWORD=xxx
```

### MqttBridge 클래스

**파일**: `packages/shared/src/component/mqtt.ts`

```typescript
import { MqttBridge, createSharedMqttClient } from '@shared/component/mqtt';

// 싱글톤 클라이언트
const mqtt = createSharedMqttClient();

// 연결
await mqtt.connect();

// 구독
await mqtt.subscribe('octoprint/status/+', (topic, payload) => {
  const data = JSON.parse(payload);
  console.log('Status:', data);
});

// 발행
await mqtt.publish('control/device-uuid', {
  action: 'start',
  file: 'model.gcode'
}, 1); // QoS 1

// 연결 해제
await mqtt.disconnect();
```

### 토픽 구조

#### 상태 토픽 (octoprint/status/{uuid})

OctoPrint Plugin이 2초마다 발행:

```typescript
interface StatusPayload {
  state: {
    text: string;           // "Printing", "Operational", "Closed"
    flags: {
      operational: boolean;
      printing: boolean;
      paused: boolean;
      ready: boolean;
      error: boolean;
    };
    error?: string;
  };
  temperatures: {
    bed: { actual: number; target: number; offset: number; };
    tool0: { actual: number; target: number; offset: number; };
    chamber?: { actual: number; target: number; offset: number; };
  };
  progress: {
    completion: number;      // 0-100
    printTime: number;       // 경과 시간 (초)
    printTimeLeft: number;   // 남은 시간 (초)
    filepos: number;         // 파일 위치
  };
  job: {
    file: {
      name: string;
      display: string;
      path: string;
      size: number;
      origin: 'local' | 'sdcard';
    };
    estimatedPrintTime: number;
    id: string;              // OctoPrint job ID
  };
  connection: [string, string, number, { name: string }];
  // [state, port, baudrate, profile]
  sd: {
    local: Array<{ name: string; size: number; date: number; }>;
    sdcard: Array<{ name: string; size: number; }>;
  };
}
```

#### 제어 토픽 (control/{uuid})

```typescript
// 출력 시작
mqtt.publish('control/uuid', {
  action: 'start',
  file: 'model.gcode',
  origin: 'local'  // 또는 'sdcard'
});

// 일시정지
mqtt.publish('control/uuid', { action: 'pause' });

// 재개
mqtt.publish('control/uuid', { action: 'resume' });

// 취소
mqtt.publish('control/uuid', { action: 'cancel' });

// 온도 설정
mqtt.publish('control/uuid', {
  action: 'temperature',
  target: 'bed',     // 또는 'tool0'
  value: 60          // 섭씨
});

// 파일 업로드
mqtt.publish('control/uuid', {
  action: 'upload',
  filename: 'model.gcode',
  content: 'base64...'
});
```

#### 제어 결과 토픽 (control_result/{uuid})

```typescript
interface ControlResult {
  type: string;       // 'start', 'pause', etc.
  ok: boolean;
  action: string;
  message?: string;
  error?: string;
}
```

#### AI 모델 토픽

```typescript
// 완료
// ai/model/completed/{user_id}
interface AIModelCompletedPayload {
  model_id: string;
  status: 'completed';
  download_url: string;
  thumbnail_url?: string;
  stl_download_url?: string;
  model_name: string;
  generation_type: 'text_to_3d' | 'image_to_3d';
}

// 실패
// ai/model/failed/{user_id}
interface AIModelFailedPayload {
  model_id: string;
  status: 'failed';
  error_message: string;
  generation_type: string;
}

// 진행률
// ai/model/progress/{user_id}
interface AIModelProgressPayload {
  model_id: string;
  status: 'processing';
  progress: number;    // 0-100
  message: string;
}
```

### 사용자별 구독 관리

```typescript
import {
  startDashStatusSubscriptionsForUser,
  stopDashStatusSubscriptions,
  onDashStatusMessage,
  subscribeAllForUser
} from '@shared/component/mqtt';

// 모든 프린터 상태 구독 시작
await subscribeAllForUser(userId);

// 상태 메시지 리스너
const unsubscribe = onDashStatusMessage((uuid, data) => {
  console.log(`Printer ${uuid}:`, data);
});

// 구독 해제
await stopDashStatusSubscriptions();
unsubscribe();
```

### PrinterStatusManager

```typescript
// 상태 매핑
const status = printerStatusManager.extractStatus(payload);
// 'printing' | 'paused' | 'idle' | 'error' | 'disconnected'

// DB 동기화 (throttled)
await printerStatusManager.syncToDb(deviceUuid, status);

// 출력 히스토리 관리
await printerStatusManager.handlePrintStatusChange(deviceUuid, status, payload);
```

---

## 3. WebRTC / MediaMTX 연동

### 환경 변수

```env
VITE_MEDIAMTX_URL=https://stream.factor3d.com
```

### 스트리밍 URL 구조

```
{MEDIAMTX_URL}/{device_uuid}/whep
```

### StreamPlayer 컴포넌트

```typescript
interface StreamPlayerProps {
  deviceUuid: string;
  autoPlay?: boolean;
  muted?: boolean;
  onError?: (error: Error) => void;
}
```

### WHEP 연결 플로우

```typescript
// 1. WHEP 엔드포인트 요청
const response = await fetch(`${MEDIAMTX_URL}/${uuid}/whep`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/sdp' },
  body: localDescription.sdp
});

// 2. SDP Answer 수신
const remoteSdp = await response.text();
const remoteDescription = new RTCSessionDescription({
  type: 'answer',
  sdp: remoteSdp
});

// 3. PeerConnection 설정
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});
await pc.setRemoteDescription(remoteDescription);

// 4. 비디오 트랙 수신
pc.ontrack = (event) => {
  videoElement.srcObject = event.streams[0];
};
```

### MediaMTX 설정 (서버)

```yaml
# mediamtx.yml
paths:
  ~^octoprint/(.+)$:
    source: rtsp://octoprint:$1@localhost:8554/$1
    sourceProtocol: tcp
    runOnReady: >
      ffmpeg -i rtsp://localhost:$RTSP_PORT/$MTX_PATH
      -c:v libx264 -preset ultrafast
      -f rtsp rtsp://localhost:$RTSP_PORT/$MTX_PATH
```

---

## 4. OctoPrint Plugin 연동

### Plugin 구조

```
octoprint_factor/
├── __init__.py           # 메인 플러그인
├── static/
│   ├── js/
│   │   └── factor.js     # 프론트엔드
│   └── css/
│       └── factor.css
├── templates/
│   └── factor_settings.jinja2
└── setup.py
```

### MQTT 발행 포인트

**상태 발행 (2초 간격)**:

```python
# __init__.py
def on_timer_tick(self):
    status_data = {
        'state': self._printer.get_state_data(),
        'temperatures': self._printer.get_current_temperatures(),
        'progress': self._printer.get_current_data().get('progress', {}),
        'job': self._printer.get_current_data().get('job', {}),
        'connection': self._printer.get_connection_options(),
        'sd': {
            'local': self.get_local_files(),
            'sdcard': self.get_sd_files()
        }
    }
    self._mqtt_publish(
        f'octoprint/status/{self.device_uuid}',
        json.dumps(status_data)
    )
```

**제어 명령 수신**:

```python
def on_mqtt_message(self, topic, payload):
    data = json.loads(payload)
    action = data.get('action')

    if action == 'start':
        self._printer.start_print(data.get('file'))
    elif action == 'pause':
        self._printer.pause_print()
    elif action == 'resume':
        self._printer.resume_print()
    elif action == 'cancel':
        self._printer.cancel_print()
    elif action == 'temperature':
        self._printer.set_temperature(
            data.get('target'),
            data.get('value')
        )

    # 결과 발행
    self._mqtt_publish(
        f'control_result/{self.device_uuid}',
        json.dumps({'action': action, 'ok': True})
    )
```

### 설정 항목

```python
def get_settings_defaults(self):
    return {
        'mqtt_broker': 'mqtt.factor3d.com',
        'mqtt_port': 8084,
        'mqtt_username': '',
        'mqtt_password': '',
        'device_uuid': str(uuid.uuid4()),
        'publish_interval': 2,  # 초
    }
```

### 이벤트 훅

```python
def get_settings_events(self):
    return {
        'PrintStarted': self.on_print_started,
        'PrintDone': self.on_print_done,
        'PrintFailed': self.on_print_failed,
        'PrintCancelled': self.on_print_cancelled,
        'PrintPaused': self.on_print_paused,
        'PrintResumed': self.on_print_resumed,
    }
```

---

## 5. AI 서비스 연동

### 환경 변수

```env
VITE_AI_PYTHON_URL=http://127.0.0.1:7000
GEMINI_API_KEY=xxx
SERPAPI_KEY=xxx
```

### Python AI 서버 엔드포인트

| 엔드포인트 | 메서드 | 용도 |
|------------|--------|------|
| `/v1/process/modelling` | POST | 3D 모델 생성 |
| `/v1/process/modelling/{task_id}` | GET | 진행률 조회 |
| `/v1/process/upload-stl-and-slice` | POST | STL 슬라이싱 |
| `/api/v1/troubleshoot/diagnose` | POST | 트러블슈팅 진단 |
| `/api/v1/chat` | POST | 일반 채팅 |
| `/api/v1/gcode/analyze` | POST | G-code 분석 |

### 3D 모델 생성 (Meshy AI)

**Text-to-3D**:

```typescript
import { postTextTo3D, buildPrintablePrompt } from '@shared/services/aiService';

const payload = {
  prompt: buildPrintablePrompt('cute robot figurine'),
  symmetry_mode: 'auto',
  art_style: 'realistic',
  target_polycount: 30000,
  output: { format: 'glb', unit: 'mm', scale: 1 },
  metadata: { user_id: userId, source: 'web' }
};

// 비동기 모드
const result = await postTextTo3D(payload, true);
// { status: 'ok', data: { task_id: 'xxx', status: 'PENDING' } }

// 진행률 폴링
const finalResult = await pollTaskUntilComplete(result.data.task_id, (progress, status) => {
  console.log(`Progress: ${progress}% - ${status}`);
});
```

**Image-to-3D**:

```typescript
import { postImageTo3D } from '@shared/services/aiService';

const formData = new FormData();
formData.append('image', imageFile);
formData.append('settings', JSON.stringify({
  symmetry_mode: 'auto',
  art_style: 'realistic',
  target_polycount: 30000
}));

const result = await postImageTo3D(formData, true);
```

### 트러블슈팅 진단

```typescript
import { postTroubleshootingDiagnose, filesToBase64 } from '@shared/services/aiService';

const request = {
  manufacturer: 'Creality',
  series: 'Ender',
  model: 'Ender 3 V2',
  symptom_text: '출력물이 바닥에서 떨어집니다',
  images: await filesToBase64(imageFiles),  // Base64 배열
  language: 'ko',
  session_id: sessionId
};

const response = await postTroubleshootingDiagnose(request);
// {
//   status: 'ok',
//   data: {
//     diagnosis: '...',
//     detected_issues: ['베드 레벨링 불량', '...'],
//     solutions: ['베드 레벨링 재조정', '...'],
//     reference_images: { images: [...] }
//   }
// }
```

### G-code 분석

```typescript
// POST /api/v1/gcode/analyze
const response = await fetch(`${AI_URL}/api/v1/gcode/analyze`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    gcode_content: gcodeFileContent,
    file_name: file.name,
    user_id: userId,
    session_id: sessionId
  })
});

const result = await response.json();
// {
//   analysis_id: 'xxx',
//   quality_score: 85,
//   issues: [...],
//   segments: [...],
//   recommendations: [...]
// }
```

### 가격 비교 (SerpAPI)

```typescript
// Python 서버 내부에서 SerpAPI 호출
// 프론트엔드는 chat API로 요청

const result = await sendChat({
  tool: 'price_comparison',
  message: 'PLA 필라멘트 가격 비교해줘',
  context: { userId, language: 'ko' }
});

// result.priceComparisonData: {
//   search_query: 'PLA 필라멘트',
//   products: [
//     { name: '...', price: 15000, store_name: '쿠팡', product_url: '...' },
//     ...
//   ]
// }
```

---

## 6. 결제 시스템 연동

### Paddle 연동

**환경 변수**:
```env
PADDLE_VENDOR_ID=xxx
PADDLE_API_KEY=xxx
PADDLE_WEBHOOK_SECRET=xxx
```

### 결제 플로우

```typescript
// 1. 결제 페이지에서 Paddle Checkout 초기화
Paddle.Checkout.open({
  product: productId,
  email: userEmail,
  passthrough: JSON.stringify({
    user_id: userId,
    plan: 'starter'
  }),
  successCallback: (data) => {
    // 결제 성공 → /payment/success로 리다이렉트
  }
});

// 2. Paddle 웹훅 → paddle-webhook Edge Function
// POST /functions/v1/paddle-webhook
{
  alert_name: 'subscription_created',
  passthrough: '{"user_id":"xxx","plan":"starter"}',
  subscription_id: 'xxx',
  // ...
}

// 3. Edge Function에서 DB 업데이트
await supabase.from('subscriptions').upsert({
  user_id: passthrough.user_id,
  paddle_subscription_id: subscription_id,
  plan: passthrough.plan,
  status: 'active'
});
```

### 구독 상태 관리

```typescript
// 구독 조회
const { data: subscription } = await supabase
  .from('subscriptions')
  .select('*')
  .eq('user_id', userId)
  .single();

// 플랜 확인
const userPlan = subscription?.plan || 'free';
```

### 웹훅 이벤트

| 이벤트 | 처리 |
|--------|------|
| `subscription_created` | 구독 생성 |
| `subscription_updated` | 플랜 변경 |
| `subscription_cancelled` | 구독 취소 |
| `subscription_payment_succeeded` | 결제 성공 |
| `subscription_payment_failed` | 결제 실패 |

---

## 연동 체크리스트

### 개발 환경 설정

- [ ] `.env` 파일 생성 (`.env.example` 참고)
- [ ] Supabase 프로젝트 연결
- [ ] MQTT 브로커 접속 정보 설정
- [ ] Python AI 서버 실행
- [ ] MediaMTX 서버 실행 (카메라 테스트 시)

### 프로덕션 배포

- [ ] 환경 변수 설정 (Vercel/Netlify)
- [ ] Supabase Edge Functions 배포
- [ ] MQTT 브로커 SSL 인증서
- [ ] MediaMTX HTTPS 설정
- [ ] Paddle 웹훅 URL 설정
- [ ] CORS 설정 확인

### 디버깅

```typescript
// MQTT 디버그 모드
const mqtt = new MqttBridge({ debug: true });

// Supabase 쿼리 로깅
const { data, error } = await supabase
  .from('printers')
  .select('*')
  .explain();
console.log(data);

// AI 서버 응답 로깅
console.log('[aiService]', JSON.stringify(result, null, 2));
```
