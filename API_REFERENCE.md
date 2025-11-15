# FACTOR UI - API 레퍼런스

## 개요

FACTOR UI는 다음 세 가지 API 레이어를 사용합니다:
1. **Supabase API** - 데이터베이스 CRUD 및 인증
2. **Express REST API** - 프린터 제어 및 디바이스 관리
3. **MQTT** - 실시간 프린터 상태 업데이트

---

## 1. Supabase API

### 인증

#### 이메일 로그인
```typescript
supabase.auth.signInWithPassword({
  email: string,
  password: string
})
```

#### 이메일 회원가입
```typescript
supabase.auth.signUp({
  email: string,
  password: string
})
```

#### OAuth 로그인
```typescript
supabase.auth.signInWithOAuth({
  provider: 'google' | 'github' | 'kakao'
})
```

#### 로그아웃
```typescript
supabase.auth.signOut()
```

#### 세션 확인
```typescript
supabase.auth.getSession()
```

---

### 데이터베이스 테이블

#### `clients` - 클라이언트 디바이스

**조회**
```typescript
supabase
  .from('clients')
  .select('*')
  .eq('user_id', userId)
```

**필드**
- `id` (uuid) - Primary key
- `user_id` (uuid) - Foreign key to auth.users
- `device_uuid` (text) - 디바이스 고유 ID
- `device_name` (text)
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### `printers` - 프린터

**조회**
```typescript
supabase
  .from('printers')
  .select(`
    *,
    clients!inner(user_id),
    cameras(*)
  `)
  .eq('clients.user_id', userId)
```

**필드**
- `id` (uuid)
- `client_id` (uuid) - Foreign key to clients
- `device_uuid` (text)
- `printer_name` (text)
- `printer_type` (text)
- `status` (text) - 'operational' | 'printing' | 'offline' | 'error'
- `temperature` (jsonb)
- `position` (jsonb)
- `progress` (jsonb)
- `group_id` (uuid)

#### `cameras` - 카메라

**조회**
```typescript
supabase
  .from('cameras')
  .select('*')
  .eq('printer_id', printerId)
```

**필드**
- `id` (uuid)
- `printer_id` (uuid)
- `stream_url` (text)
- `snapshot_url` (text)
- `enabled` (boolean)

#### `user_roles` - 사용자 역할

**조회**
```typescript
supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', userId)
  .single()
```

**필드**
- `user_id` (uuid) - Primary key
- `role` (text) - 'admin' | 'user'

#### `ai_models` - AI 모델

**조회**
```typescript
supabase
  .from('ai_models')
  .select('*')
  .eq('user_id', userId)
```

**필드**
- `id` (uuid)
- `user_id` (uuid)
- `model_name` (text)
- `model_type` (text)
- `file_url` (text)
- `thumbnail_url` (text)
- `status` (text) - 'processing' | 'completed' | 'failed'
- `metadata` (jsonb)
- `dimensions` (jsonb) - { width, height, depth }

#### `ai_training_images` - AI 훈련 이미지

**조회**
```typescript
supabase
  .from('ai_training_images')
  .select('*')
  .eq('model_id', modelId)
```

**필드**
- `id` (uuid)
- `model_id` (uuid)
- `image_url` (text)
- `label` (text)
- `created_at` (timestamp)

#### `subscriptions` - 구독

**조회**
```typescript
supabase
  .from('subscriptions')
  .select('*')
  .eq('user_id', userId)
  .single()
```

**필드**
- `id` (uuid)
- `user_id` (uuid)
- `plan` (text) - 'free' | 'basic' | 'premium'
- `status` (text) - 'active' | 'cancelled' | 'expired'
- `start_date` (timestamp)
- `end_date` (timestamp)
- `payment_id` (text)

---

## 2. Express REST API

Base URL: `http://localhost:5000/api`

### 인증

#### POST `/api/auth/login`

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token"
  }
}
```

---

### 프린터

#### POST `/api/printer/register`

디바이스 등록 및 정규화

**Request Body**
```json
{
  "device_uuid": "printer-001",
  "client_id": "client-uuid",
  "printer_name": "Ender 3",
  "printer_type": "FDM"
}
```

**Response**
```json
{
  "success": true,
  "printer": {
    "id": "uuid",
    "device_uuid": "printer-001",
    "normalized": true
  }
}
```

#### GET `/api/printers/summary`

사용자의 모든 프린터 요약 정보

**Query Parameters**
- `user_id` (required)

**Response**
```json
{
  "success": true,
  "printers": [
    {
      "id": "uuid",
      "printer_name": "Ender 3",
      "status": "operational",
      "temperature": {
        "bed": { "actual": 60, "target": 60 },
        "tool0": { "actual": 200, "target": 200 }
      },
      "progress": {
        "completion": 45.5,
        "printTime": 1234,
        "printTimeLeft": 1500
      }
    }
  ]
}
```

#### POST `/api/printer/update`

프린터 데이터 업데이트

**Request Body**
```json
{
  "device_uuid": "printer-001",
  "status": "printing",
  "temperature": { ... },
  "position": { ... },
  "progress": { ... }
}
```

#### GET `/api/status`

서버 상태 및 연결 수

**Response**
```json
{
  "success": true,
  "connections": {
    "websocket": 5,
    "rest": 10
  },
  "uptime": 12345,
  "version": "1.0.0"
}
```

---

### 프린터 제어 (Edge Client API)

Base URL: `http://edge-device:5000`

#### GET `/status`

통합 스냅샷

**Response**
```json
{
  "printer_status": {
    "state": "Printing",
    "flags": {
      "operational": true,
      "printing": true,
      "paused": false,
      "ready": true,
      "error": false
    }
  },
  "temperature_info": {
    "bed": { "actual": 60, "target": 60, "offset": 0 },
    "tool0": { "actual": 200, "target": 200, "offset": 0 }
  },
  "position": {
    "x": 100.5,
    "y": 50.2,
    "z": 10.0,
    "e": 500.0
  },
  "progress": {
    "completion": 45.5,
    "filepos": 123456,
    "printTime": 1234,
    "printTimeLeft": 1500
  },
  "connected": true,
  "timestamp": 1699999999,
  "equipment_uuid": "printer-001"
}
```

#### GET `/printer/status`

프린터 상태만 조회

#### GET `/printer/temperature`

온도 정보만 조회

#### GET `/printer/position`

위치 정보만 조회

#### GET `/printer/progress`

진행률 정보만 조회

#### POST `/printer/command`

G-code 명령 전송

**Request Body**
```json
{
  "command": "G28"
}
```

**Response**
```json
{
  "success": true,
  "command": "G28"
}
```

#### POST `/printer/reconnect`

프린터 재연결

**Response**
```json
{
  "success": true,
  "message": "Reconnecting..."
}
```

#### GET `/printer/sd/list`

SD 카드 파일 목록

**Response**
```json
{
  "success": true,
  "files": [
    { "name": "test.gcode", "size": 123456 }
  ],
  "last_update": 1699999999
}
```

#### POST `/printer/sd/print`

SD 카드에서 출력 시작

**Request Body**
```json
{
  "name": "test.gcode"
}
```

#### POST `/printer/sd/upload`

SD 카드에 파일 업로드

**Request Body** (multipart/form-data)
- `file` (File)
- `name` (optional string)

**Response**
```json
{
  "success": true,
  "name": "uploaded.gcode",
  "lines": 1000,
  "bytes": 123456,
  "closed": true
}
```

---

## 3. MQTT API

Broker URL: `ws://broker:9001`

### 토픽 구조

#### Subscribe

```
octoprint/status/{device_uuid}
```

프린터 상태 업데이트 수신

**메시지 형식**
```json
{
  "type": "printer_status",
  "device_uuid": "printer-001",
  "timestamp": 1699999999,
  "data": {
    "state": "Printing",
    "flags": {
      "operational": true,
      "printing": true
    }
  }
}
```

#### Publish

```
control_result/{device_uuid}
```

제어 명령 결과 발행

**메시지 형식**
```json
{
  "type": "control_command",
  "device_uuid": "printer-001",
  "command": "pause",
  "timestamp": 1699999999,
  "result": "success"
}
```

### 메시지 타입

#### `printer_status`
프린터 상태 업데이트

#### `temperature_update`
온도 변경

```json
{
  "type": "temperature_update",
  "device_uuid": "printer-001",
  "timestamp": 1699999999,
  "data": {
    "bed": { "actual": 60, "target": 60 },
    "tool0": { "actual": 200, "target": 200 }
  }
}
```

#### `position_update`
위치 변경

```json
{
  "type": "position_update",
  "device_uuid": "printer-001",
  "timestamp": 1699999999,
  "data": {
    "x": 100.5,
    "y": 50.2,
    "z": 10.0
  }
}
```

#### `print_progress`
진행률 업데이트

```json
{
  "type": "print_progress",
  "device_uuid": "printer-001",
  "timestamp": 1699999999,
  "data": {
    "completion": 45.5,
    "printTime": 1234,
    "printTimeLeft": 1500
  }
}
```

### MQTT 클라이언트 설정

```typescript
import { createSharedMqttClient } from '@shared/component/mqtt';

const mqttClient = createSharedMqttClient({
  brokerUrl: process.env.VITE_MQTT_BROKER_URL,
  onConnect: () => console.log('Connected'),
  onMessage: (topic, message) => {
    console.log(`Received on ${topic}:`, message);
  }
});

// 구독
mqttClient.subscribe(`octoprint/status/${deviceUuid}`);

// 발행
mqttClient.publish(`control_result/${deviceUuid}`, {
  type: 'control_command',
  command: 'pause'
});
```

---

## 4. WebSocket API (Legacy)

WebSocket URL: `ws://localhost:5000`

### 클라이언트 → 서버

#### `register`
에지 클라이언트 등록

```json
{
  "type": "register",
  "device_uuid": "printer-001"
}
```

#### `heartbeat`
연결 유지

```json
{
  "type": "heartbeat",
  "device_uuid": "printer-001",
  "timestamp": 1699999999
}
```

#### `printer_status`
프린터 상태 업데이트

```json
{
  "type": "printer_status",
  "device_uuid": "printer-001",
  "data": { ... }
}
```

### 서버 → 클라이언트

#### `broadcast`
모든 웹 클라이언트에 전송

```json
{
  "type": "printer_status",
  "device_uuid": "printer-001",
  "data": { ... }
}
```

#### `ack`
메시지 수신 확인

```json
{
  "type": "ack",
  "message_id": "msg-123"
}
```

---

## 5. 파일 업로드 API

### Supabase Storage

#### 이미지 업로드
```typescript
const { data, error } = await supabase.storage
  .from('ai-images')
  .upload(`${userId}/${filename}`, file, {
    contentType: 'image/jpeg',
    upsert: false
  });
```

#### 파일 다운로드 URL
```typescript
const { data } = supabase.storage
  .from('ai-images')
  .getPublicUrl(filePath);
```

#### 파일 삭제
```typescript
const { error } = await supabase.storage
  .from('ai-images')
  .remove([filePath]);
```

---

## 6. AI Workflow API

### POST `/api/ai/generate`

이미지 → 3D 모델 생성

**Request Body** (multipart/form-data)
```
image: File
user_id: string
model_name: string (optional)
```

**Response**
```json
{
  "success": true,
  "model_id": "uuid",
  "status": "processing"
}
```

### GET `/api/ai/status/:model_id`

생성 진행 상태 확인

**Response**
```json
{
  "success": true,
  "model_id": "uuid",
  "status": "completed",
  "progress": 100,
  "file_url": "https://...",
  "thumbnail_url": "https://..."
}
```

---

## 에러 코드

### HTTP 상태 코드

| 코드 | 의미 | 설명 |
|------|------|------|
| 200 | OK | 성공 |
| 201 | Created | 생성 완료 |
| 400 | Bad Request | 잘못된 요청 |
| 401 | Unauthorized | 인증 필요 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 500 | Internal Server Error | 서버 오류 |

### 커스텀 에러 응답

```json
{
  "success": false,
  "error": {
    "code": "PRINTER_OFFLINE",
    "message": "프린터가 오프라인 상태입니다",
    "details": { ... }
  }
}
```

### 일반적인 에러 코드

- `AUTH_FAILED` - 인증 실패
- `INVALID_TOKEN` - 토큰 만료 또는 무효
- `DEVICE_NOT_FOUND` - 디바이스를 찾을 수 없음
- `PRINTER_OFFLINE` - 프린터 오프라인
- `PRINTER_BUSY` - 프린터 사용 중
- `FILE_TOO_LARGE` - 파일 크기 초과
- `INVALID_GCODE` - 잘못된 G-code
- `PAYMENT_FAILED` - 결제 실패
- `QUOTA_EXCEEDED` - 할당량 초과

---

## Rate Limiting

### REST API
- 기본: 100 requests/분
- 인증된 사용자: 300 requests/분
- Admin: 무제한

### MQTT
- 메시지 크기: 최대 256KB
- 발행 빈도: 10 messages/초

### WebSocket
- 연결 제한: 사용자당 5개
- 하트비트: 30초마다

---

## 인증 헤더

### REST API

```
Authorization: Bearer <supabase_access_token>
```

### MQTT

토큰은 연결 시 username으로 전달:

```typescript
mqttClient.connect({
  username: access_token,
  password: ''
});
```

---

## Webhook (추가 예정)

### 프린터 이벤트
- `printer.status.changed`
- `printer.error.occurred`
- `print.completed`
- `print.failed`

### AI 이벤트
- `ai.generation.completed`
- `ai.generation.failed`

---

**최종 업데이트**: 2024년 11월 14일
