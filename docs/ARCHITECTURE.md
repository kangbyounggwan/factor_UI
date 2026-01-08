# FACTOR HIBRID 아키텍처 문서

## 프로젝트 개요

FACTOR HIBRID는 3D 프린터 관리 및 AI 기반 지원 서비스를 제공하는 풀스택 애플리케이션입니다.

### 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 18, TypeScript, Vite, TailwindCSS, Shadcn/UI |
| 상태 관리 | TanStack React Query, Zustand |
| 백엔드 | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| AI 서버 | Python FastAPI (Meshy 3D, Gemini, OpenAI 통합) |
| 실시간 통신 | MQTT (WebSocket), Supabase Realtime |
| 카메라 스트리밍 | WebRTC / MediaMTX |
| 프린터 연동 | OctoPrint Plugin |
| 모바일 | Capacitor (iOS/Android) |

---

## 패키지 구조

```
packages/
├── web/                 # 웹 애플리케이션 (React + Vite)
│   ├── src/
│   │   ├── components/  # UI 컴포넌트
│   │   ├── features/    # 기능별 모듈 (ai-chat 등)
│   │   ├── hooks/       # 커스텀 훅
│   │   ├── pages/       # 페이지 컴포넌트
│   │   └── lib/         # 유틸리티
│   └── supabase/
│       └── functions/   # Supabase Edge Functions
├── mobile/              # 모바일 앱 (Capacitor)
├── shared/              # 공유 코드
│   ├── src/
│   │   ├── components/  # 공통 컴포넌트 (MQTT 등)
│   │   ├── contexts/    # React Context (Auth 등)
│   │   ├── hooks/       # 공유 훅
│   │   └── services/    # 서비스 레이어
├── mcp-printer/         # MCP 프린터 서버
└── host/                # 호스트 애플리케이션
```

---

## 컴포넌트 아키텍처

### 1. AI 채팅 시스템

```
AIChat.tsx (페이지)
├── 훅 레이어
│   ├── useChatSessions      # 세션 관리
│   ├── useChatMessages      # 메시지 상태
│   ├── useChatComposer      # 입력 컴포저
│   ├── useChatPermissions   # 권한 관리
│   ├── useFileUpload        # 파일 업로드
│   ├── useGcodeController   # G-code 분석
│   └── useAnonChat          # 익명 채팅
├── 컴포넌트
│   ├── ChatInput            # 입력창
│   ├── ChatMessage          # 메시지 표시
│   ├── WelcomeScreen        # 시작 화면
│   └── GCodeAnalysisReport  # G-code 보고서
└── 서비스
    ├── sendChat()           # Chat API 호출
    ├── geminiService        # Gemini AI
    └── supabaseService      # DB 저장
```

### 2. 프린터 대시보드

```
Dashboard.tsx
├── PrinterCard              # 프린터 카드
│   ├── 상태 표시
│   ├── 온도 정보
│   └── 진행률
├── MQTT 구독
│   └── octoprint/status/{uuid}
└── PrinterDetail.tsx
    ├── 실시간 온도 차트
    ├── 카메라 스트리밍
    ├── 파일 관리
    └── 제어 패널
```

---

## AI 도구 (Tool Types)

### 도구 분류

| Tool Type | 설명 | 기능 |
|-----------|------|------|
| `general` | 일반 채팅 | 3D 프린팅 관련 질문 답변, 제품 정보 |
| `troubleshoot` | 진단 메시지 | 프린터 문제 진단, 이미지 분석, 해결 방안 제시 |
| `gcode` | G-code 분석 | 파일 분석, 품질 점수, 문제점 감지, 수정 제안 |
| `modeling` | AI 모델 생성 | Text-to-3D, Image-to-3D 모델링 (Meshy AI) |
| `resolve_issue` | 문제 해결 | G-code 이슈 자동 수정 |
| `price_comparison` | 가격 비교 | 제품 가격 비교, 구매 링크 제공 |

### 도구별 상세 기능

#### 1. 일반 채팅 (general)
- Gemini Pro 기반 대화
- 3D 프린팅 전문 지식 응답
- 다국어 지원 (한국어/영어)
- 대화 컨텍스트 유지 (최대 15개 메시지)

#### 2. 진단 도구 (troubleshoot)
```typescript
interface TroubleshootingRequest {
  manufacturer?: string;      // 제조사
  series?: string;            // 시리즈
  model?: string;             // 모델명
  symptom_text: string;       // 증상 설명
  images?: string[];          // Base64 이미지 (최대 4장)
  language?: 'ko' | 'en';
  session_id?: string;
}

interface TroubleshootingResponse {
  diagnosis: string;          // 진단 결과
  detected_issues: string[];  // 감지된 문제
  possible_causes: string[];  // 가능한 원인
  solutions: string[];        // 해결 방안
  confidence: number;         // 신뢰도 (0-1)
  reference_images?: {...};   // 참조 이미지
}
```

#### 3. G-code 분석 (gcode)
```typescript
// 분석 결과 구조
interface GCodeAnalysisReport {
  analysis_id: string;
  file_name: string;
  quality_score: number;      // 0-100
  print_time_estimate: string;
  filament_usage: number;     // grams
  issues: GCodeIssue[];       // 문제점 목록
  segments: GCodeSegment[];   // 레이어 세그먼트
  recommendations: string[];  // 개선 제안
}

interface GCodeIssue {
  type: string;               // 'stringing', 'overhang', etc.
  severity: 'low' | 'medium' | 'high';
  line_number: number;
  description: string;
  fix_suggestion?: string;
}
```

#### 4. AI 모델 생성 (modeling)
```typescript
// Text-to-3D
interface TextTo3DRequest {
  prompt: string;             // 모델 설명
  symmetry_mode: 'off' | 'auto' | 'on';
  art_style: 'realistic' | 'sculpture';
  target_polycount: number;
}

// Image-to-3D
interface ImageTo3DRequest {
  image: File;                // 입력 이미지
  symmetry_mode: string;
  art_style: string;
}

// 응답
interface AIModelResponse {
  task_id: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  progress: number;           // 0-100
  glb_download_url?: string;  // GLB 파일
  stl_download_url?: string;  // STL 파일
  thumbnail_url?: string;
}
```

#### 5. 가격 비교 (price_comparison)
```typescript
interface PriceComparisonData {
  search_query: string;
  products: {
    name: string;
    price: number;
    original_price?: number;
    discount_rate?: string;
    product_url: string;
    image_url?: string;
    store_name: string;
    rating?: number;
    review_count?: number;
  }[];
}
```

---

## 프린터 연결 시스템

### MQTT 토픽 구조

```
octoprint/
├── status/{device_uuid}       # 프린터 상태 (실시간)
│   ├── state.flags            # printing, paused, error
│   ├── temperatures           # bed, tool0, chamber
│   ├── progress               # completion, printTime
│   ├── job.file               # 현재 출력 파일
│   └── connection             # 연결 정보
├── control/{device_uuid}      # 프린터 제어 명령
│   ├── start                  # 출력 시작
│   ├── pause                  # 일시정지
│   ├── resume                 # 재개
│   ├── cancel                 # 취소
│   └── temperature            # 온도 설정
└── control_result/{uuid}      # 제어 결과

ai/model/
├── completed/{user_id}        # AI 모델 생성 완료
├── failed/{user_id}           # AI 모델 생성 실패
└── progress/{user_id}         # AI 모델 진행률
```

### MQTT 메시지 형식

```typescript
// 상태 메시지 (octoprint/status/{uuid})
interface PrinterStatusPayload {
  state: {
    text: string;           // "Printing", "Operational", etc.
    flags: {
      operational: boolean;
      printing: boolean;
      paused: boolean;
      error: boolean;
    };
  };
  temperatures: {
    bed: { actual: number; target: number; };
    tool0: { actual: number; target: number; };
    chamber?: { actual: number; target: number; };
  };
  progress: {
    completion: number;     // 0-100
    printTime: number;      // 초
    printTimeLeft: number;  // 초
  };
  job: {
    file: { name: string; size: number; };
    estimatedPrintTime: number;
  };
  connection: [string, string, number, object];
  // [state, port, baudrate, profile]
}
```

### 프린터 상태 관리 (PrinterStatusManager)

```typescript
class PrinterStatusManager {
  // 상태 캐시 (메모리)
  private statusCache = new Map<string, string>();

  // 타임아웃 체크 (30초)
  private readonly TIMEOUT_MS = 30000;

  // DB 동기화 throttle (30초)
  private readonly SYNC_THROTTLE_MS = 30000;

  // 상태 매핑
  extractStatus(payload): 'printing' | 'paused' | 'idle' | 'error' | 'disconnected';

  // DB 동기화
  async syncToDb(deviceUuid, newStatus): Promise<void>;

  // 프린트 히스토리 관리
  async handlePrintStatusChange(deviceUuid, newStatus, payload): Promise<void>;
}
```

### OctoPrint Plugin 연동

```python
# OctoPrint Plugin이 publish하는 데이터
{
    "device_uuid": "프린터 고유 ID",
    "temperatures": {...},
    "state": {...},
    "progress": {...},
    "job": {...},
    "sd": {
        "local": [...],    # 로컬 파일 목록
        "sdcard": [...]    # SD 카드 파일 목록
    }
}
```

---

## 데이터 플로우

### 1. AI 채팅 플로우

```
사용자 입력
    ↓
[도구 타입 결정]
    ↓
[권한 체크] → (거부) → 로그인/업그레이드 유도
    ↓
[세션 생성/로드]
    ↓
[사용자 메시지 저장] → Supabase: chat_messages
    ↓
[AI API 호출]
├── general     → Gemini Pro
├── troubleshoot → Python AI Server → Gemini Vision
├── gcode       → Python AI Server → G-code Parser
├── modeling    → Python AI Server → Meshy AI
└── price_comp  → SerpAPI → 가격 파싱
    ↓
[응답 처리]
├── 메시지 표시
├── DB 저장
├── 참조 이미지 저장 (Supabase Storage)
└── G-code 보고서 생성 (선택적)
```

### 2. 프린터 상태 플로우

```
OctoPrint Plugin
    ↓ (MQTT publish)
MQTT Broker (wss://mqtt.factor3d.com)
    ↓ (WebSocket)
[MqttBridge 클래스]
    ↓
[onDashStatusMessage]
├── 상태 파싱 및 정규화
├── PrinterStatusManager.syncToDb()
│   ├── 캐시 비교
│   └── 상태 변경 시 DB 업데이트
├── PrinterStatusManager.handlePrintStatusChange()
│   └── model_print_history 테이블 업데이트
└── 리스너 콜백 호출 → React 상태 업데이트
```

### 3. 카메라 스트리밍 플로우

```
OctoPrint Camera
    ↓
MediaMTX Server (WebRTC SFU)
    ↓
[StreamPlayer 컴포넌트]
├── WHEPClient 연결
├── WebRTC PeerConnection
└── <video> 렌더링
```

---

## 외부 의존성

### API 서비스

| 서비스 | 용도 | 환경변수 |
|--------|------|----------|
| Supabase | DB, Auth, Storage, Edge Functions | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| MQTT Broker | 실시간 프린터 통신 | `VITE_MQTT_URL`, `VITE_MQTT_USERNAME` |
| Gemini AI | 대화, 이미지 분석 | `GEMINI_API_KEY` |
| Meshy AI | 3D 모델 생성 | (Python 서버 내부) |
| SerpAPI | 가격 검색 | `SERPAPI_KEY` |
| MediaMTX | WebRTC 스트리밍 | `VITE_MEDIAMTX_URL` |

### Python AI 서버 엔드포인트

```
POST /v1/process/modelling              # 3D 모델 생성
GET  /v1/process/modelling/{task_id}    # 진행률 조회
POST /v1/process/upload-stl-and-slice   # STL 슬라이싱
POST /api/v1/troubleshoot/diagnose      # 트러블슈팅
POST /api/v1/chat                       # 일반 채팅
POST /api/v1/gcode/analyze              # G-code 분석
```

### Supabase Edge Functions

| Function | 용도 |
|----------|------|
| `admin-ai-analytics` | AI 사용 통계 조회 |
| `admin-users` | 사용자 관리 |
| `generate-ai-model-background` | 비동기 모델 생성 |
| `save-temperature` | 온도 데이터 저장 |
| `send-push-notification` | 푸시 알림 |
| `paddle-webhook` | 결제 웹훅 |

---

## 보안 및 인증

### 인증 플로우

```
[AuthContext]
├── Supabase Auth 세션 관리
├── OAuth (Google, Apple) 지원
├── 이메일/비밀번호 로그인
└── 익명 사용자 지원 (localStorage)

[ProtectedRoute]
├── 로그인 필수 페이지 보호
└── 미인증 시 /auth로 리다이렉트

[AdminRoute]
├── 관리자 권한 체크
└── is_admin 플래그 확인
```

### 권한 레벨

| 플랜 | 기능 제한 |
|------|-----------|
| `free` | 일반 채팅 5회/일, AI 모델 1회/월 |
| `starter` | 채팅 무제한, AI 모델 10회/월 |
| `pro` | 모든 기능 무제한 |
| `enterprise` | 커스텀 |

---

## 성능 최적화

### 코드 스플리팅

```typescript
// 페이지별 Lazy Loading
const AIChat = lazy(() => import("./pages/AIChat"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PrinterDetail = lazy(() => import("./pages/PrinterDetail"));
```

### 캐싱 전략

```typescript
// React Query 캐시
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5분
      gcTime: 30 * 60 * 1000,    // 30분
    },
  },
});

// MQTT 상태 캐시
const userDeviceUuidCache = new Map<string, { uuids: string[]; expiresAt: number }>();
const USER_DEVICE_CACHE_TTL_MS = 60_000;  // 60초
```

### DB 요청 최적화

```typescript
// 상태 동기화 Throttle
private readonly SYNC_THROTTLE_MS = 30000;

// 배치 데이터 로드
const [stats, keywords, daily, tools, users, chats] = await Promise.all([
  callAnalyticsAPI('stats', { days }),
  callAnalyticsAPI('keywords', { days }),
  callAnalyticsAPI('daily-usage', { days }),
  callAnalyticsAPI('tool-usage', { days }),
  callAnalyticsAPI('top-users', { days }),
  callAnalyticsAPI('shared-chats', { days }),
]);
```

---

## 에러 처리

### 전역 에러 핸들링

```typescript
// Toast 알림
const { toast } = useToast();
toast({
  title: "오류",
  description: error.message,
  variant: "destructive",
});

// MQTT 재연결
this.client.on("reconnect", () => this.log("reconnecting..."));

// API 타임아웃
const REQUEST_TIMEOUT = 600000;  // 10분
const POLL_TIMEOUT = 30000;      // 30초
```

### 에러 타입별 처리

| 에러 유형 | 처리 방식 |
|-----------|-----------|
| 네트워크 오류 | 재시도 + 사용자 알림 |
| 인증 만료 | 자동 갱신 또는 재로그인 유도 |
| 권한 부족 | 플랜 업그레이드 안내 |
| AI 서버 오류 | 대체 응답 메시지 표시 |
| MQTT 연결 끊김 | 자동 재연결 (3초 간격) |
