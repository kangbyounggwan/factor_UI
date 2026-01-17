# FACTOR HIBRID - Shared Package Functions

> **Last Updated:** 2026-01-18
> **Package:** `@shared` (packages/shared)

Web과 Mobile에서 공통으로 사용하는 함수 및 서비스 목록입니다.

---

## 목차

1. [패키지 구조](#패키지-구조)
2. [Utils (유틸리티)](#utils-유틸리티)
3. [API Client](#api-client)
4. [Supabase Services](#supabase-services)
5. [MQTT Services](#mqtt-services)
6. [React Hooks](#react-hooks)
7. [Types](#types)
8. [Constants](#constants)

---

## 패키지 구조

```
packages/shared/src/
├── api/                      # HTTP API 클라이언트
│   ├── http.ts               # HTTP 요청 기본 함수
│   ├── printer.ts            # 프린터 API
│   ├── system.ts             # 시스템 API
│   ├── wifi.ts               # WiFi API
│   ├── config.ts             # 설정 API
│   ├── data.ts               # 데이터 API
│   ├── account.ts            # 계정 API
│   ├── manufacturingPrinter.ts # 제조사 프린터 API
│   └── aiWorkflow.ts         # AI 워크플로우 API
│
├── services/                 # 비즈니스 서비스
│   ├── supabaseService/      # Supabase 서비스 모음
│   │   ├── aiModel.ts        # AI 모델 CRUD
│   │   ├── aiStorage.ts      # AI 모델 Storage
│   │   ├── equipment.ts      # 장비 등록
│   │   ├── equipmentPreset.ts # 장비 프리셋
│   │   ├── printerList.ts    # 프린터 목록
│   │   ├── subscription.ts   # 구독 관리
│   │   ├── notifications.ts  # 알림
│   │   ├── feedback.ts       # 피드백
│   │   ├── community.ts      # 커뮤니티
│   │   ├── chat.ts           # 채팅
│   │   ├── sharedChat.ts     # 공유 채팅
│   │   ├── troubleshooting.ts # 트러블슈팅
│   │   ├── paymentMethod.ts  # 결제 수단
│   │   ├── apiKeys.ts        # API 키
│   │   └── admin.ts          # 관리자
│   │
│   ├── mqttService/          # MQTT 서비스
│   ├── aiService.ts          # AI 서비스 (Claude)
│   ├── claudeService.ts      # Claude API
│   ├── geminiService.ts      # Gemini API
│   ├── chatApiService.ts     # 채팅 API 서비스
│   ├── gcodeAnalysisService.ts # G-code 분석
│   ├── temperatureSession.ts # 온도 세션
│   ├── backgroundSlicing.ts  # 백그라운드 슬라이싱
│   └── mqttProxy.ts          # MQTT 프록시
│
├── utils/                    # 유틸리티 함수
│   ├── time.ts               # 시간 포맷
│   ├── printerStatus.ts      # 프린터 상태 유틸
│   ├── imageValidation.ts    # 이미지 검증
│   ├── subscription.ts       # 구독 유틸
│   ├── file.ts               # 파일 변환 유틸 (Base64)
│   ├── filename.ts           # 파일명 유틸 (G-code)
│   ├── string.ts             # 문자열 유틸 (세션 제목)
│   ├── logger.ts             # 로거
│   ├── platform.ts           # 플랫폼 감지
│   ├── mqttUtils.ts          # MQTT 유틸
│   ├── anonymousId.ts        # 익명 ID
│   ├── stlThumbnail.ts       # STL 썸네일 (Three.js)
│   ├── modelViewerUtils.ts   # 모델 뷰어 유틸
│   └── ai/                   # AI 유틸
│       └── gcodeAnalytics/   # G-code 분석 유틸
│
├── hooks/                    # React Hooks
│   ├── useWebSocket.ts       # WebSocket 훅
│   ├── useAIImageUpload.ts   # AI 이미지 업로드 훅
│   ├── useUserRole.ts        # 사용자 역할 훅
│   └── useUserPlan.ts        # 사용자 플랜 훅
│
├── component/                # 컴포넌트 유틸
│   ├── mqtt.ts               # MQTT Bridge
│   ├── websocket.ts          # WebSocket 유틸
│   └── dashboardSummary.ts   # 대시보드 요약
│
├── queries/                  # React Query 훅
│   ├── system.ts
│   ├── wifi.ts
│   ├── data.ts
│   ├── account.ts
│   └── aiModel.ts
│
├── types/                    # TypeScript 타입
│   ├── printerType.ts
│   ├── systemType.ts
│   ├── commonType.ts
│   ├── aiModelType.ts
│   ├── subscription.ts
│   ├── gcodeAnalysisTypes.ts
│   ├── gcodeAnalysisDbTypes.ts
│   └── troubleshootingTypes.ts
│
├── constants/                # 상수
│   └── community.ts
│
├── config/                   # 설정
│   └── modelViewerConfig.ts
│
├── integrations/             # 외부 통합
│   └── supabase/
│       └── client.ts
│
├── i18n/                     # 다국어
│   ├── index.ts
│   └── locales/
│       ├── ko.ts
│       └── en.ts
│
└── index.ts                  # 메인 엔트리
```

---

## Utils (유틸리티)

### time.ts

| 함수 | 설명 | 사용처 |
|-----|------|-------|
| `formatTime(seconds)` | 초를 "X시간 X분" 형식으로 변환 | 출력 시간 표시 |

```typescript
formatTime(3720) // "1시간 2분"
formatTime(120)  // "2분"
```

### printerStatus.ts

| 함수 | 설명 | 반환값 |
|-----|------|-------|
| `getPrinterStatusInfo(state, flags, translations)` | 프린터 상태 정보 반환 | `{ label, badgeClass }` |
| `isIdleState(state, flags)` | idle 상태 여부 확인 | `boolean` |
| `isControllable(state, flags)` | 제어 가능 여부 확인 | `boolean` |

**상태 우선순위:** error > printing > paused > ready/operational > connecting > disconnected

```typescript
const { label, badgeClass } = getPrinterStatusInfo(
  'operational',
  { ready: true, printing: false },
  { idle: '대기', printing: '출력중', ... }
);
```

### imageValidation.ts

| 함수 | 설명 |
|-----|------|
| `validateImageFile(file)` | 이미지 파일 검증 (크기, 형식) |
| `getMimeTypeFromExtension(filename)` | 확장자로 MIME 타입 추론 |
| `formatFileSize(bytes)` | 파일 크기 포맷 ("10 MB") |

**제한:** 최대 10MB, JPEG/PNG/WEBP/GIF만 허용

### file.ts

| 함수 | 설명 |
|-----|------|
| `fileToBase64(file)` | File 객체를 Base64 문자열로 변환 |
| `filesToBase64(files)` | 여러 File 객체를 Base64 배열로 변환 |

```typescript
const base64 = await fileToBase64(imageFile);
const base64Array = await filesToBase64([file1, file2]);
```

### filename.ts

| 함수 | 설명 |
|-----|------|
| `toGcodeFilename(shortName)` | 파일명에 .gcode 확장자 추가 |
| `extractFallbackFilename(text)` | 텍스트에서 안전한 파일명 추출 |
| `generateUniqueModelFilename()` | 고유한 모델 파일명 생성 |

```typescript
toGcodeFilename('snowman')  // "snowman.gcode"
extractFallbackFilename('cute_snowman_model')  // "cute"
generateUniqueModelFilename()  // "model_abc1"
```

### string.ts

| 함수 | 설명 |
|-----|------|
| `generateSessionTitle(firstMessage, maxLength?)` | 세션 제목 자동 생성 (30자 기본) |
| `truncateText(text, maxLength)` | 텍스트 자르기 + "..." |
| `truncateAtWordBoundary(text, maxLength, minLength?)` | 단어 경계에서 자르기 (영문용) |

```typescript
generateSessionTitle('긴 메시지 내용입니다...')  // "긴 메시지 내용입니다..."
truncateText('Hello World', 5)  // "Hello..."
truncateAtWordBoundary('Hello World Example', 12)  // "Hello..."
```

### subscription.ts

| 함수 | 설명 | 비고 |
|-----|------|------|
| `loadPlansFromDB()` | DB에서 플랜 정보 로드 | 5분 캐시 |
| `getPlanInfo(planCode)` | 특정 플랜 정보 조회 | |
| `checkUsageLimit(userId, type)` | 사용량 한도 체크 | DB RPC |
| `canAddPrinterAsync(userId)` | 프린터 추가 가능 여부 | |
| `canGenerateAiModelAsync(userId)` | AI 생성 가능 여부 | |
| `incrementUsage(userId, type, delta)` | 사용량 증가 | |
| `checkTroubleshootAdvancedUsage(userId)` | 고급 진단 사용량 체크 | 일별 리셋 |
| `checkPremiumModelTrialUsage(userId)` | 프리미엄 모델 체험 체크 | 일별 리셋 |
| `checkAnonymousUsage()` | 익명 사용자 사용량 체크 | localStorage |
| `incrementAnonymousUsage()` | 익명 사용량 증가 | 일일 10회 |

**플랜별 함수 (동기):**
| 함수 | 설명 |
|-----|------|
| `canAddPrinterWithPlanInfo(planInfo, count)` | 플랜 정보로 프린터 추가 확인 |
| `canGenerateAiModelWithPlanInfo(planInfo, usage)` | 플랜 정보로 AI 생성 확인 |
| `getMaxPrintersFromPlanInfo(planInfo)` | 최대 프린터 수 |
| `getAiGenerationLimitFromPlanInfo(planInfo)` | AI 생성 한도 |
| `getWebcamReconnectInterval(plan)` | 웹캠 재연결 간격 |

---

## API Client

### http.ts

| 함수 | 설명 |
|-----|------|
| `httpGet<T>(path, init?)` | GET 요청 |
| `httpPost<T>(path, data?, init?)` | POST 요청 |
| `httpPut<T>(path, data?, init?)` | PUT 요청 |
| `httpDelete<T>(path, init?)` | DELETE 요청 |
| `httpUpload<T>(path, form, init?)` | FormData 업로드 |

**기본 URL:** `VITE_RASP_SERVER` 환경변수 또는 `/api`

### printer.ts - PrinterAPI

```typescript
const PrinterAPI = {
  // 통합 스냅샷
  getSnapshot(),           // 전체 상태 조회

  // 개별 조회
  getStatus(),             // 프린터 상태
  getTemperature(),        // 온도 정보
  getPosition(),           // 위치 정보
  getProgress(),           // 출력 진행률

  // 제어
  sendGcode(command),      // G-code 명령 전송
  reconnect(),             // 재연결

  // SD 카드
  listSdFiles(),           // SD 파일 목록
  sdPrint(name),           // SD 출력 시작
  sdCancel(params),        // SD 출력 취소/일시정지
  sdUpload(file, name?),   // SD 파일 업로드
};
```

---

## Supabase Services

### supabaseService/aiModel.ts

| 함수 | 설명 |
|-----|------|
| `createAIModel(supabase, data, userId)` | AI 모델 생성 |
| `getAIModel(supabase, modelId)` | AI 모델 조회 (Signed URL 갱신) |
| `listAIModels(supabase, userId, options?)` | 모델 목록 (페이지네이션) |
| `listPublicAIModels(supabase, options?)` | 공개 모델 목록 |
| `updateAIModel(supabase, modelId, updates)` | 모델 업데이트 |
| `deleteAIModel(supabase, modelId)` | 모델 삭제 |
| `toggleFavoriteAIModel(supabase, modelId, isFavorite)` | 즐겨찾기 토글 |
| `createPrintHistory(supabase, data)` | 출력 이력 생성 |
| `getModelPrintHistory(supabase, modelId)` | 모델별 출력 이력 |
| `getUserPrintHistory(supabase, userId, options?)` | 사용자 출력 이력 |
| `updatePrintHistoryStatus(supabase, historyId, status, updates?)` | 출력 상태 업데이트 |
| `getUserModelStats(supabase, userId)` | 사용자 모델 통계 |
| `searchModelsByTag(supabase, userId, tag)` | 태그로 검색 |
| `searchModelsByName(supabase, userId, searchTerm)` | 이름으로 검색 |

### supabaseService/equipment.ts

| 함수 | 설명 |
|-----|------|
| `saveRegistration(payload, userId)` | 장비 등록 (clients, printers, cameras) |

**Payload 구조:**
```typescript
{
  client: { uuid },
  printer: { model, firmware, uuid },
  camera: { uuid, resolution },
  software: { firmware_version, firmware, last_update, uuid }
}
```

---

## MQTT Services

### component/mqtt.ts

#### MqttBridge 클래스

```typescript
const mqtt = new MqttBridge({
  brokerUrl?: string,
  username?: string,
  password?: string,
  clientId?: string,
  reconnectPeriodMs?: number,
  debug?: boolean
});

await mqtt.connect();
await mqtt.subscribe(topic, handler, qos);
await mqtt.publish(topic, message, qos, retain);
await mqtt.unsubscribe(topic, handler);
await mqtt.disconnect(force);
```

#### 전역 함수

| 함수 | 설명 |
|-----|------|
| `createSharedMqttClient(options?)` | 공유 MQTT 클라이언트 생성 (싱글톤) |
| `disconnectSharedMqtt()` | 공유 클라이언트 종료 |
| `createUserMqttClient(uid, options?)` | 사용자별 MQTT 클라이언트 |
| `createMqttClientId(uid?)` | Client ID 생성 (localStorage 영구 저장) |
| `clearMqttClientId(uid?)` | Client ID 삭제 (로그아웃 시) |

#### 대시보드 상태 구독

| 함수 | 설명 |
|-----|------|
| `startDashStatusSubscriptionsForUser(userId, opts?)` | 사용자 프린터 상태 구독 시작 |
| `stopDashStatusSubscriptions()` | 상태 구독 중지 |
| `onDashStatusMessage(listener)` | 상태 메시지 리스너 등록 |

#### 제어 결과 구독

| 함수 | 설명 |
|-----|------|
| `subscribeControlResult(deviceSerial, onMessage, qos)` | 단일 디바이스 제어 결과 |
| `subscribeControlResultForUser(userId, qos)` | 사용자 전체 디바이스 제어 결과 |

#### AI 모델 생성 알림 구독

| 함수 | 설명 |
|-----|------|
| `subscribeAIModelCompleted(userId, onCompleted, qos)` | AI 모델 생성 완료 |
| `subscribeAIModelFailed(userId, onFailed, qos)` | AI 모델 생성 실패 |
| `subscribeAIModelProgress(userId, onProgress, qos)` | AI 모델 생성 진행률 |

#### 통합 구독

```typescript
// 사용자의 모든 구독을 한 번에 시작
await subscribeAllForUser(userId, qos);
```

#### PrinterStatusManager (내부)

- 프린터 상태 캐시 관리 (메모리)
- DB 동기화 (상태 전환 시에만)
- MQTT 타임아웃 체크 (30초 무응답 시 disconnected)
- 프린트 히스토리 자동 관리

---

## React Hooks

### useWebSocket.ts

WebSocket 연결 관리 훅

### useAIImageUpload.ts

AI 이미지 업로드 처리 훅

### useUserRole.ts

사용자 역할 (admin/user) 조회 훅

### useUserPlan.ts

사용자 구독 플랜 정보 조회 훅

---

## Types

### printerType.ts

```typescript
type PrinterState = 'operational' | 'printing' | 'paused' | 'disconnected' | 'connecting' | 'error' | ...;

interface PrinterStateFlags {
  operational?: boolean;
  printing?: boolean;
  paused?: boolean;
  error?: boolean;
  ready?: boolean;
  closedOrError?: boolean;
}

interface PrinterStatusInfo {
  label: string;
  badgeClass: string;
}

interface TemperatureInfo {
  bed: { actual: number; target: number };
  tool: { tool0: { actual: number; target: number } };
}

interface Progress {
  completion: number;
  print_time_left?: number;
  print_time?: number;
}
```

### aiModelType.ts

```typescript
interface AIGeneratedModel {
  id: string;
  user_id: string;
  generation_type: 'text_to_3d' | 'image_to_3d' | 'text_to_image';
  prompt?: string;
  model_name: string;
  storage_path: string;
  thumbnail_url?: string;
  stl_url?: string;
  gcode_url?: string;
  status: 'processing' | 'completed' | 'failed' | 'archived';
  is_favorite: boolean;
  is_public: boolean;
  // ...
}

interface ModelPrintHistory {
  id: string;
  model_id: string;
  printer_id?: string;
  print_status: PrintStatus;
  started_at?: string;
  completed_at?: string;
  // ...
}
```

### subscription.ts

```typescript
type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'enterprise';

interface SubscriptionPlanInfo {
  plan_code: string;
  display_name: string;
  price_monthly: number;
  max_printers: number;       // -1 = unlimited
  ai_generation_limit: number; // -1 = unlimited
  storage_limit_gb: number;
  has_analytics: boolean;
  has_api_access: boolean;
  // ...
}

interface UsageLimitCheck {
  can_use: boolean;
  current_usage: number;
  limit: number;
  remaining: number;
}
```

### commonType.ts

```typescript
interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

---

## Constants

### community.ts

커뮤니티 관련 상수 (카테고리, 정렬 옵션 등)

---

## Import 방법

```typescript
// 메인 엔트리에서 export된 함수
import {
  formatTime,
  getPrinterStatusInfo,
  PrinterAPI,
  createSharedMqttClient,
  // ...
} from '@shared';

// 직접 import (Three.js 등 무거운 의존성)
import { generateSTLThumbnail } from '@shared/utils/stlThumbnail';

// Supabase 서비스
import { createAIModel, listAIModels } from '@shared/services/supabaseService/aiModel';

// 구독 유틸
import { checkUsageLimit, canAddPrinterAsync } from '@shared/utils/subscription';
```

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-18 | 최초 문서 작성 |
| 2026-01-18 | 중복 함수 통합 (file.ts, filename.ts, string.ts 생성) |
| 2026-01-18 | Deprecated 함수 제거 (canAddPrinter, getMaxPrinters 등 5개) |
