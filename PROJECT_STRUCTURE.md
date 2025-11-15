# FACTOR-HIBRID-r1.0 프로젝트 구조 문서

## 목차
1. [프로젝트 개요](#1-프로젝트-개요)
2. [라우팅 및 페이지 구조](#2-라우팅-및-페이지-구조)
3. [컴포넌트 구조](#3-컴포넌트-구조)
4. [서비스 및 로직 레이어](#4-서비스-및-로직-레이어)
5. [주요 기능별 구조](#5-주요-기능별-구조)
6. [개발 서버 및 API](#6-개발-서버-및-api)
7. [기술 스택](#7-기술-스택)
8. [빌드 및 배포](#8-빌드-및-배포)
9. [핵심 함수 및 위치](#9-핵심-함수-및-위치)

---

## 1. 프로젝트 개요

### 1.1 Monorepo 아키텍처

FACTOR-HIBRID은 **NPM Workspace 기반 Monorepo** 구조로 되어 있습니다:

```
FACTOR-HIBRID-r1.0/
├── package.json (루트 - workspaces 정의)
├── tsconfig.base.json (공통 TypeScript 설정)
├── tailwind.config.ts (공통 스타일)
├── packages/
│   ├── host/          # 플랫폼 라우팅 디스패처
│   ├── web/           # 웹 애플리케이션 (데스크톱)
│   ├── mobile/        # 모바일 앱 (Capacitor)
│   └── shared/        # 공유 비즈니스 로직 및 라이브러리
├── docs/              # 문서
├── .env               # 환경 변수 (모든 패키지에서 공유)
└── ecosystem.config.* # PM2 설정
```

### 1.2 각 패키지의 역할

#### **Host Package** (`packages/host`)
- **목적**: 플랫폼 감지 및 라우팅
- **핵심 파일**:
  - `src/main.tsx` - 진입점
  - `src/pages/Dashboard.tsx` - 플랫폼 분기 로직
  - `src/lib/platform.ts` - 플랫폼 감지 함수

**플랫폼 감지 우선순위**:
1. 쿼리 파라미터: `?platform=web|mobile`
2. localStorage: `platformOverride` 키
3. Capacitor 환경 감지
4. User Agent 감지 (Android, iPhone, iPad 등)
5. 기본값: web

#### **Web Package** (`packages/web`)
- **목적**: 데스크톱 브라우저 기반 전체 기능 애플리케이션
- **특징**:
  - AI 어시스턴트 사이드바 포함
  - 구독 관리
  - 고급 프린터 제어
  - 3D 모델 뷰어
  - 직관적인 UI/UX

#### **Mobile Package** (`packages/mobile`)
- **목적**: Capacitor 기반 네이티브 모바일 앱
- **특징**:
  - iOS/Android 네이티브 API 통합
  - 상태바, 키보드, 파일시스템, 네트워크 감지
  - Safe area 지원 (노치 핸들링)
  - AI 어시스턴트 미포함 (간소화)
- **Capacitor 설정**:
  ```typescript
  appId: 'com.byeonggwan.factor'
  appName: 'FACTOR'
  webDir: 'dist'
  ```

#### **Shared Package** (`packages/shared`)
- **목적**: 모든 패키지가 공유하는 비즈니스 로직
- **주요 폴더 구조**:
  ```
  shared/src/
  ├── api/              # HTTP API 클라이언트
  ├── component/        # 실시간 통신 (MQTT, WebSocket)
  ├── components/       # 공유 UI 컴포넌트
  ├── config/           # 설정 파일
  ├── contexts/         # React Context (Auth 등)
  ├── hooks/            # 공유 React Hooks
  ├── i18n/             # 다국어 지원 (EN, KO)
  ├── integrations/     # 외부 서비스 (Supabase)
  ├── queries/          # React Query 훅
  ├── services/         # 비즈니스 로직 서비스
  ├── types/            # TypeScript 타입 정의
  ├── utils/            # 유틸리티 함수
  ├── styles/           # 공유 스타일
  ├── index.ts          # 모든 export
  └── server.js         # Express 개발 서버 (REST/WebSocket)
  ```

---

## 2. 라우팅 및 페이지 구조

### 2.1 웹 애플리케이션 라우팅

**파일 위치**: `packages/web/src/App.tsx`

```typescript
Route 구조:
├── "/" - Home (로그인 페이지)
├── "/auth" - 인증 페이지
├── "/email-verification" - 이메일 검증
├── "/dashboard" - 프린터 대시보드 (보호됨)
├── "/printer/:id" - 프린터 상세 페이지 (보호됨)
├── "/settings" - 설정 (보호됨)
├── "/user-settings" - 사용자 설정 (보호됨)
├── "/subscription" - 구독 관리
├── "/supported-printers" - 지원 프린터 목록
├── "/create" - AI 어시스턴트 (3D 생성, 보호됨)
├── "/admin" - 관리자 패널 (어드민만)
├── "/admin/device/register" - 디바이스 등록 (어드민만)
├── "/setup/:uuid" - 디바이스 셋업
├── "/payment/checkout" - 결제
├── "/payment/success" - 결제 성공
├── "/payment/fail" - 결제 실패
├── "/privacy" - 개인정보 처리방침
├── "/terms" - 이용약관
├── "/refund" - 환불 정책
└── "*" - 404 NotFound
```

### 2.2 페이지 컴포넌트 위치

**Web Pages** (`packages/web/src/pages/`):

| 파일 | 라우트 | 설명 |
|------|--------|------|
| Home.tsx | / | 랜딩/로그인 페이지 |
| Dashboard.tsx | /dashboard | 프린터 목록 및 상태 관리 |
| PrinterDetail.tsx | /printer/:id | 프린터 상세 제어 |
| AI.tsx | /create | AI 모델 생성 (Text/Image to 3D) |
| Settings.tsx | /settings | 프린터 및 기기 설정 |
| UserSettings.tsx | /user-settings | 사용자 계정 설정 |
| Admin.tsx | /admin | 관리자 대시보드 |
| DeviceRegister.tsx | /admin/device/register | 디바이스 등록 (어드민) |
| DeviceSetup.tsx | /setup/:uuid | 초기 설정 흐름 |
| Subscription.tsx | /subscription | 구독 플랜 선택 |
| SupportedPrinters.tsx | /supported-printers | 호환 프린터 목록 |
| EmailVerification.tsx | /email-verification | 이메일 인증 |
| PaymentCheckout.tsx | /payment/checkout | 결제 페이지 |
| PaymentSuccess.tsx | /payment/success | 결제 완료 |
| PaymentFail.tsx | /payment/fail | 결제 실패 |
| PrivacyPolicy.tsx | /privacy | 개인정보 처리방침 |
| TermsOfService.tsx | /terms | 이용약관 |
| RefundPolicy.tsx | /refund | 환불 정책 |

---

## 3. 컴포넌트 구조

### 3.1 웹 컴포넌트 분류 (78개 컴포넌트)

**위치**: `packages/web/src/components/`

#### 레이아웃 컴포넌트
- **Header.tsx** - 상단 네비게이션
- **Footer.tsx** - 하단 푸터
- **ScrollToTop.tsx** - 페이지 스크롤 자동 상단 이동

#### 프린터 관련 컴포넌트
| 컴포넌트 | 기능 |
|----------|------|
| PrinterCard.tsx | 프린터 카드 UI |
| PrinterControlPad.tsx | 프린터 조종 패드 (X, Y, Z, E축 제어) |
| PrinterSetupModal.tsx | 프린터 초기 설정 모달 |
| PrinterStatusBadge.tsx | 상태 배지 |
| TemperaturePanel.tsx | 온도 제어 패널 |
| PrintProgress.tsx | 인쇄 진행률 표시 |

#### 모델 뷰어 컴포넌트
| 컴포넌트 | 기능 |
|----------|------|
| ModelViewer.tsx | 3D GLB/STL 뷰어 (Three.js 기반) |
| GCodeViewer.tsx | G-Code 3D 시각화 |
| GCodePreview.tsx | G-Code 미리보기 |
| GCodeUpload.tsx | G-Code 파일 업로드 |
| STLUpload.tsx | STL 파일 업로드 |

#### AI 어시스턴트 컴포넌트 (`components/ai/`)
| 컴포넌트 | 기능 |
|----------|------|
| AIAssistantSidebar.tsx | AI 챗봇 사이드바 |
| AIChatSidebar.tsx | 채팅 인터페이스 |
| TextTo3DForm.tsx | 텍스트 → 3D 폼 |
| ImageTo3DForm.tsx | 이미지 → 3D 폼 |
| ModelPreview.tsx | 생성된 모델 미리보기 |
| ModelArchive.tsx | 생성된 모델 저장소 |
| UploadArchive.tsx | 업로드된 모델 관리 |
| WorkflowStatusCard.tsx | AI 작업 상태 카드 |

#### 카메라 및 IoT
- **CameraFeed.tsx** - 카메라 스트림 표시 (HLS 지원)
- **IoTDevicePanel.tsx** - IoT 기기 제어

#### 인증 및 결제
- **ProtectedRoute.tsx** - 로그인 필수 라우트 래퍼
- **AdminRoute.tsx** - 어드민 권한 필수 래퍼
- **PaymentDialog.tsx** - 결제 다이얼로그

#### UI 컴포넌트 (`components/ui/`)
Radix UI 기반 40+ 기본 UI 컴포넌트:
- accordion, alert, alert-dialog, badge, button
- card, checkbox, dialog, dropdown-menu
- form, input, label, select, separator
- sheet, slider, switch, table, tabs
- textarea, toast, tooltip 등

#### 유틸리티 컴포넌트
- **LanguageSwitcher.tsx** - 언어 선택 (EN/KO)

---

## 4. 서비스 및 로직 레이어

### 4.1 API 클라이언트 (`packages/shared/src/api/`)

| 파일 | 기능 |
|------|------|
| auth.ts | Supabase 인증 (로그인/가입) |
| printer.ts | 프린터 상태 조회/제어 |
| system.ts | 시스템 정보 |
| config.ts | 설정 정보 |
| wifi.ts | Wi-Fi 제어 |
| data.ts | 데이터 조회 |
| manufacturingPrinter.ts | 제조 프린터 관리 |
| aiWorkflow.ts | AI 워크플로우 (Modelling → Optimization → G-code) |
| http.ts | HTTP 클라이언트 래퍼 |

### 4.2 실시간 통신 (`packages/shared/src/component/`)

#### MQTT (`mqtt.ts`)
- **싱글톤 패턴**: `createSharedMqttClient()`로 앱당 1개 클라이언트
- **토픽 구조**:
  ```
  octoprint/status/{device_uuid}     - 프린터 상태 업데이트
  control_result/{device_uuid}       - 제어 명령 결과
  control/{device_serial}            - 제어 명령 발행
  ```
- **자동 구독**: AuthContext에서 로그인 시 구독, 로그아웃 시 구독 해제
- **UUID 캐싱**: 60초 TTL로 데이터베이스 쿼리 감소
- **Graceful Degradation**: `VITE_MQTT_BROKER_URL` 미설정 시 inert 모드

**주요 함수**:
```typescript
class MqttBridge {
  connect() - MQTT 브로커 연결
  publish(topic, message, qos, retain) - 메시지 발행
  subscribe(topic, handler, qos) - 토픽 구독
  unsubscribe(topic, handler) - 구독 해제
  disconnect() - 연결 종료
}

createSharedMqttClient() - 앱당 1개 클라이언트 생성
startDashStatusSubscriptionsForUser(userId) - MQTT 자동 구독
stopDashStatusSubscriptions() - 구독 해제
```

#### WebSocket (`websocket.ts`)
- 웹소켓 기반 실시간 통신 지원
- MQTT 보조 역할

### 4.3 React Query 훅 (`packages/shared/src/queries/`)

```typescript
// 프린터 관련
usePrinterSnapshot() - 전체 스냅샷 (2초마다 갱신)
usePrinterStatus() - 연결 상태
usePrinterTemperature() - 온도 정보
usePrinterPosition() - 축 위치
usePrinterProgress() - 인쇄 진행률

// 시스템 관련
useSystemInfo()
useWifiInfo()

// 데이터
useDataQuery()

// AI 모델
useAIModels()
```

### 4.4 서비스 레이어 (`packages/shared/src/services/`)

#### Supabase 서비스 (`supabaseService/`):
| 파일 | 기능 |
|------|------|
| admin.ts | 어드민 기능 |
| aiModel.ts | AI 모델 관리 |
| aiStorage.ts | 모델 저장소 |
| equipment.ts | 장비 정보 |
| notifications.ts | 알림 관리 |
| paymentMethod.ts | 결제 수단 |
| printerList.ts | 프린터 목록 및 그룹 |
| subscription.ts | 구독 관리 |

#### 기타 서비스:
- **aiService.ts** - AI Python 백엔드 통신 (Text/Image to 3D)
- **tossPaymentsService.ts** - Toss Payments 결제 위젯
- **mqttProxy.ts** - MQTT 프록시 (선택 사항)
- **backgroundSlicing.ts** - 백그라운드 슬라이싱
- **mqttService/index.ts** - MQTT 래퍼 API

### 4.5 인증 Context

**파일**: `packages/shared/src/contexts/AuthContext.tsx`

```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: "admin" | "user" | null;
  isAdmin: boolean;
  loading: boolean;
  signUp(): Promise;
  signIn(): Promise;
  signInWithGoogle(): Promise;
  linkGoogleAccount(): Promise;
  unlinkProvider(): Promise;
  signOut(): Promise;
}
```

**주요 기능**:
- Supabase 세션 자동 새로고침
- 사용자 역할 로드 (user_roles 테이블)
- MQTT 자동 구독/구독 해제
- 구독 중복 방지 (ref 사용)

**핵심 함수**:
```typescript
loadUserRole(userId) - 사용자 역할 로드
teardownSubscriptions() - MQTT 구독 정리
ensureSubscriptions(userId) - MQTT 자동 구독 보장
```

### 4.6 타입 정의 (`packages/shared/src/types/`)

#### **printerType.ts**:
```typescript
TemperatureInfo - {tool, bed}의 {current, target}
PositionData - {x, y, z, e}
PrintProgressData - {completion, file_position, file_size, print_time, ...}
PrinterState - 'idle' | 'printing' | 'paused' | 'error' | 'connecting' | 'disconnected'
PrinterStateFlags - {operational, ready, printing, paused, error, ...}
```

#### **subscription.ts**:
```typescript
SubscriptionPlan: 'free' | 'pro' | 'enterprise'

PLAN_FEATURES:
- free: 1 프린터, AI 0회, 지원 커뮤니티만
- pro: 5 프린터, AI 50회/월, 우선 지원
- enterprise: 무제한, 무제한 AI, 전담 지원
```

#### **aiModelType.ts**:
```typescript
ProcessModellingRequest/Response
OptimizeModelRequest/Response
GenerateGcodeRequest/Response
```

---

## 5. 주요 기능별 구조

### 5.1 인증/로그인 흐름

```
User Login Form (Auth.tsx)
  ↓
AuthContext.signIn()
  ↓
Supabase Auth (supabase.auth.signInWithPassword)
  ↓
Session 저장 (localStorage)
  ↓
user_roles 테이블에서 역할 로드
  ↓
MQTT 구독 시작 (startDashStatusSubscriptionsForUser)
  ↓
AuthProvider 상태 업데이트
```

**관련 파일**:
- `packages/web/src/pages/Auth.tsx`
- `packages/shared/src/contexts/AuthContext.tsx`
- `packages/shared/src/api/auth.ts`

### 5.2 프린터 대시보드 흐름

```
Dashboard.tsx
  ↓
getUserPrinters() - Supabase에서 프린터 목록 조회
  ↓
MQTT 구독 (octoprint/status/{device_uuid})
  ↓
onDashStatusMessage() 리스너 등록
  ↓
MQTT 메시지 수신 → 상태 업데이트
  ↓
PrinterCard 렌더링
  ↓
PrinterStatusBadge 표시
```

**관련 파일**:
- `packages/web/src/pages/Dashboard.tsx`
- `packages/web/src/components/PrinterCard.tsx`
- `packages/shared/src/services/supabaseService/printerList.ts`
- `packages/shared/src/component/mqtt.ts`

### 5.3 프린터 제어 흐름

```
PrinterControlPad.tsx
  ↓
publishDashboardMove() / publishControlPause() 등
  ↓
MQTT Publish (control/{device_serial})
  ↓
IoT 기기 수신
  ↓
제어 명령 실행
  ↓
MQTT Publish (control_result/{device_uuid})
  ↓
Frontend 메시지 수신
```

**관련 파일**:
- `packages/web/src/components/PrinterControlPad.tsx`
- `packages/shared/src/services/mqttService/index.ts`

### 5.4 AI 모델 생성 (3D 워크플로우)

```
AI.tsx (또는 TextTo3DForm.tsx)
  ↓
postTextTo3D() / postImageTo3D()
  ↓
AI Python 서버 (VITE_AI_PYTHON_URL)
  /v1/process/modelling (async_mode=true 옵션)
  ↓
Task ID 반환
  ↓
pollWorkflowStatus() - 5초마다 상태 확인
  ↓
완료 시:
  - remeshModelOptimization()
  - publishGcodeGeneration()
  ↓
결과 GLB/G-code 다운로드
```

**관련 파일**:
- `packages/web/src/pages/AI.tsx`
- `packages/web/src/components/ai/TextTo3DForm.tsx`
- `packages/web/src/components/ai/ImageTo3DForm.tsx`
- `packages/shared/src/services/aiService.ts`
- `packages/shared/src/api/aiWorkflow.ts`

### 5.5 결제 통합 (Toss Payments)

```
Subscription.tsx / PaymentCheckout.tsx
  ↓
initializePaymentWidget(customerKey)
  ↓
loadPaymentWidget() - V2 SDK
  ↓
renderPaymentMethods(selector, amount)
  ↓
requestPayment(orderId, orderName, customerName)
  ↓
Payment Window 열기
  ↓
PaymentSuccess.tsx / PaymentFail.tsx
```

**관련 파일**:
- `packages/web/src/pages/Subscription.tsx`
- `packages/web/src/pages/PaymentCheckout.tsx`
- `packages/shared/src/services/tossPaymentsService.ts`

### 5.6 Supabase 데이터베이스 테이블

| 테이블 | 설명 |
|--------|------|
| auth.users | 사용자 인증 정보 |
| user_roles | 사용자 역할 (admin/user) |
| clients | IoT 클라이언트 기기 등록 |
| printers | 프린터 정보 및 상태 |
| printer_groups | 프린터 그룹 관리 |
| cameras | 카메라 스트림 설정 |
| ai_models | AI 생성 모델 메타데이터 |
| ai_training_images | AI 학습 데이터 |
| subscriptions | 사용자 구독 정보 |
| notifications | 사용자 알림 |

---

## 6. 개발 서버 및 API

### 6.1 Express 개발 서버 (`packages/shared/server.js`)

**시작**:
```bash
node packages/shared/server.js --host 0.0.0.0 --port 5000 --ws --rest
```

**REST API 엔드포인트**:
```
POST /api/auth/login - Supabase 로그인
POST /api/printer/register - 프린터 등록
GET /api/printers/summary - 프린터 요약 조회
GET /api/status - 서버 상태
POST /api/printer/update - 프린터 데이터 업데이트
```

**WebSocket 서버**:
- Edge 클라이언트(Python)에서 프린터 상태 업데이트 수신
- Web 클라이언트로 실시간 브로드캐스트
- 하트비트/확인 메시지 지원

**디바이스 등록 흐름**:
1. Edge 클라이언트에서 `POST /api/printer/register` 호출
2. 페이로드 정규화 (normalizePayload)
3. Supabase REST API로 upsert
4. clients, printers, cameras 테이블 업데이트

---

## 7. 기술 스택

자세한 기술 스택 정보는 [TECH_STACK.md](TECH_STACK.md)를 참조하세요.

**주요 기술**:
- Frontend: React 18 + TypeScript 5.5 + Vite 5.4
- Styling: Tailwind CSS + Radix UI
- Mobile: Capacitor 7.4 (iOS/Android)
- State: TanStack React Query
- Database: Supabase (PostgreSQL)
- Real-time: MQTT
- 3D: Three.js + React Three Fiber

---

## 8. 빌드 및 배포

### 8.1 개발 명령어

```bash
# 개발 시작 (Host + API + Media)
npm run dev:stack

# 개별 패키지 개발
npm run dev:host      # 호스트만
npm run dev:web       # 웹만
npm run dev:mobile    # 모바일만

# API 서버만
npm run dev:api

# 미디어 서버 (Docker)
npm run media:start
```

### 8.2 빌드 명령어

```bash
# 전체 빌드
npm run build:stack

# 개별 빌드
npm run build:host
npm run build:web
npm run build:mobile

# 모든 패키지 빌드
npm run build:all
```

### 8.3 빌드 최적화

**Web 패키지** (`vite.config.ts`):
```typescript
manualChunks: {
  'three-bundle': Three.js 라이브러리 (큰 번들)
  'vendor': React, React Router
  'ui': Radix UI 컴포넌트들
  'supabase': Supabase 클라이언트
}
```

**Mobile 패키지**: 유사한 청크 분할 + rollup-plugin-visualizer

### 8.4 모바일 빌드

```bash
# 모바일 빌드 후 Capacitor 동기화
npm run build:mobile
cd packages/mobile
npx cap sync
npx cap open android   # Android Studio
npx cap open ios       # Xcode
```

---

## 9. 핵심 함수 및 위치

### 9.1 인증 관련

**파일**: `packages/shared/src/contexts/AuthContext.tsx`

```typescript
loadUserRole(userId) - 사용자 역할 로드
teardownSubscriptions() - MQTT 구독 정리
ensureSubscriptions(userId) - MQTT 자동 구독 보장
```

**파일**: `packages/shared/src/api/auth.ts`

```typescript
authAPI.login(email, password) - Supabase 로그인
```

### 9.2 MQTT 관련

**파일**: `packages/shared/src/component/mqtt.ts`

```typescript
class MqttBridge {
  connect() - MQTT 브로커 연결
  publish(topic, message, qos, retain) - 메시지 발행
  subscribe(topic, handler, qos) - 토픽 구독
  unsubscribe(topic, handler) - 구독 해제
  disconnect() - 연결 종료
}

// 싱글톤 생성자
createSharedMqttClient() - 앱당 1개 클라이언트
startDashStatusSubscriptionsForUser(userId) - 사용자별 MQTT 자동 구독
stopDashStatusSubscriptions() - 구독 해제
clearMqttClientId(uid) - 클라이언트 ID 삭제
```

### 9.3 프린터 제어

**파일**: `packages/shared/src/services/mqttService/index.ts`

```typescript
publishDashboardMove() - 축 이동 (X, Y, Z, E)
publishControlHome() - 홈 복귀
publishControlPause() - 일시정지
publishControlResume() - 재시작
publishControlCancel() - 취소
publishSetTemperature() - 온도 설정
publishSetFan() - 팬 속도 설정
publishLoadFilament() - 필라멘트 로드
publishUnloadFilament() - 필라멘트 언로드
```

### 9.4 AI 워크플로우

**파일**: `packages/shared/src/services/aiService.ts`

```typescript
postTextTo3D(payload, asyncMode) - 텍스트 → 3D
postImageTo3D(payload, asyncMode) - 이미지 → 3D
```

**파일**: `packages/shared/src/api/aiWorkflow.ts`

```typescript
processModelling() - Step 1: 모델 생성
remeshModelOptimization() - Step 2: 최적화
publishGcodeGeneration() - Step 3: G-code 생성
pollWorkflowStatus() - 작업 상태 폴링 (5초 간격)
```

### 9.5 결제

**파일**: `packages/shared/src/services/tossPaymentsService.ts`

```typescript
initializePaymentWidget(customerKey)
renderPaymentWidget({paymentWidget, amount, selector})
requestPayment({orderId, orderName, ...})
```

### 9.6 대시보드 정리

**파일**: `packages/shared/src/component/dashboardSummary.ts`

```typescript
computeDashboardSummary(printers) - 프린터 요약 계산
publishDashboardSummary(summary) - 요약 발행
useDashboardSummary() - 요약 조회 Hook
```

### 9.7 Supabase 서비스

**프린터 관리** - `packages/shared/src/services/supabaseService/printerList.ts`:
```typescript
getUserPrinters(userId) - 사용자 프린터 목록
getUserPrinterGroups(userId) - 프린터 그룹
getUserPrintersWithGroup() - 그룹별 프린터
addPrinterToGroup() - 그룹에 추가
removePrinterFromGroup() - 그룹에서 제거
```

**구독 관리** - `packages/shared/src/services/supabaseService/subscription.ts`:
```typescript
getUserSubscription(userId) - 구독 정보 조회
updateSubscriptionPlan() - 계획 변경
```

**AI 모델** - `packages/shared/src/services/supabaseService/aiModel.ts`:
```typescript
getUserAIModels() - 생성된 모델 목록
saveAIModelMetadata() - 모델 메타데이터 저장
```

---

## 요약

**FACTOR-HIBRID-r1.0**은 **3D 프린터 관리 및 AI 모델 생성 플랫폼**입니다:

### 핵심 특징:
1. **Monorepo 구조**: Host(라우팅) + Web(데스크톱) + Mobile(Capacitor) + Shared(로직)
2. **실시간 통신**: MQTT 싱글톤으로 프린터 상태 실시간 업데이트
3. **AI 통합**: Text/Image to 3D 모델 생성 (Python 백엔드)
4. **결제**: Toss Payments V2 SDK 통합
5. **3D 렌더링**: Three.js + React Three Fiber
6. **멀티플랫폼**: 웹/모바일 동시 지원 (플랫폼 자동 감지)
7. **클라우드 백엔드**: Supabase (PostgreSQL, Auth, Storage)
8. **다국어**: 영어/한국어 지원

모든 파일이 명확한 책임 분리와 함께 체계적으로 구성되어 있습니다.
