# FACTOR HIBRID 페이지 및 라우트 문서

## 라우트 구조 요약

### 공개 페이지 (Public)

| 경로 | 컴포넌트 | 기능 |
|------|----------|------|
| `/` | Home | 랜딩 페이지, 서비스 소개 |
| `/auth` | Auth | 로그인/회원가입 |
| `/auth/callback` | AuthCallback | OAuth 콜백 처리 |
| `/email-verification` | EmailVerification | 이메일 인증 |
| `/subscription` | Subscription | 구독 플랜 안내 |
| `/supported-printers` | SupportedPrinters | 지원 프린터 목록 |
| `/privacy` | PrivacyPolicy | 개인정보 처리방침 |
| `/terms` | TermsOfService | 이용약관 |
| `/refund` | RefundPolicy | 환불 정책 |
| `/create` | AI | AI 모델 생성 페이지 |
| `/ai-chat` | AIChat | AI 채팅 (익명 가능) |
| `/share/:shareId` | SharedChat | 공유된 채팅 보기 |
| `/shared/report/:shareId` | SharedReport | 공유된 G-code 보고서 |
| `/setup/:uuid` | DeviceSetup | 프린터 설정 (QR 코드) |

### 인증 필요 페이지 (Protected)

| 경로 | 컴포넌트 | 기능 |
|------|----------|------|
| `/dashboard` | Dashboard | 프린터 대시보드 |
| `/printer/:id` | PrinterDetail | 프린터 상세 제어 |
| `/user-settings` | UserSettings | 사용자 설정 |
| `/profile-setup` | ProfileSetup | 초기 프로필 설정 |
| `/gcode-analytics` | GCodeAnalytics | G-code 분석 이력 |
| `/payment/checkout` | PaymentCheckout | 결제 |
| `/payment/success` | PaymentSuccess | 결제 성공 |
| `/payment/fail` | PaymentFail | 결제 실패 |

### 관리자 페이지 (Admin)

| 경로 | 컴포넌트 | 기능 |
|------|----------|------|
| `/admin` | Admin | 관리자 대시보드 |
| `/admin/users` | AdminUsers | 사용자 관리 |
| `/admin/device/register` | DeviceRegister | 디바이스 등록 |
| `/admin/ai-analytics` | AdminAIAnalytics | AI 분석 대시보드 |
| `/admin/ai-analytics/chat` | AdminChatAnalytics | 채팅 분석 |
| `/admin/ai-analytics/models` | AdminModelAnalytics | 모델 생성 분석 |
| `/admin/ai-analytics/usage` | AdminUsageAnalytics | 사용량 분석 |

### 테스트 페이지

| 경로 | 컴포넌트 | 기능 |
|------|----------|------|
| `/test/gcode-api` | GCodeAPITest | G-code API 테스트 |

---

## 페이지별 상세 설명

### 1. Home (/)

**파일**: `src/pages/Home.tsx`

**기능**:
- 서비스 소개 랜딩 페이지
- 히어로 섹션
- 기능 소개
- 가격 플랜
- CTA (Call to Action) 버튼

**컴포넌트**:
- `Header` - 네비게이션
- `EventBanner` - 이벤트 배너 (홈에서만 표시)
- `Footer` - 푸터

---

### 2. Auth (/auth)

**파일**: `src/pages/Auth.tsx`

**기능**:
- 이메일/비밀번호 로그인
- OAuth 로그인 (Google, Apple)
- 회원가입
- 비밀번호 재설정

**상태**:
- `mode`: 'login' | 'signup' | 'reset'

**연동**:
- Supabase Auth

---

### 3. Dashboard (/dashboard)

**파일**: `src/pages/Dashboard.tsx`

**기능**:
- 등록된 프린터 목록 표시
- 실시간 상태 업데이트 (MQTT)
- 프린터 추가/삭제
- 빠른 제어 (시작, 일시정지, 취소)

**컴포넌트**:
- `AppSidebar` - 사이드바
- `AppHeader` - 헤더
- `PrinterCard` - 프린터 카드
  - 상태 아이콘
  - 온도 정보 (베드, 노즐)
  - 진행률 표시
  - 빠른 제어 버튼

**MQTT 구독**:
```javascript
// 사용자 프린터 상태 구독
subscribeAllForUser(userId);
// 토픽: octoprint/status/{device_uuid}
```

**데이터**:
- `printers` 테이블
- `model_print_history` 테이블

---

### 4. PrinterDetail (/printer/:id)

**파일**: `src/pages/PrinterDetail.tsx`

**기능**:
- 프린터 상세 정보
- 실시간 온도 차트
- 카메라 스트리밍 (WebRTC)
- 파일 관리 (로컬/SD카드)
- 출력 제어
- 온도 설정
- 설정 관리

**탭 구조**:
| 탭 | 기능 |
|----|------|
| 개요 | 상태, 온도, 진행률 |
| 파일 | 파일 목록, 업로드 |
| 제어 | 온도 설정, 이동, 압출 |
| 카메라 | 실시간 스트리밍 |
| 기록 | 출력 이력 |
| 설정 | 프린터 설정 |

**컴포넌트**:
- `TemperatureChart` - Recharts 온도 그래프
- `StreamPlayer` - WebRTC 카메라
- `FileList` - 파일 목록
- `ControlPanel` - 제어 패널

**MQTT**:
```javascript
// 상태 구독
subscribe(`octoprint/status/${deviceUuid}`);

// 제어 명령
publish(`control/${deviceUuid}`, {
  action: 'start' | 'pause' | 'cancel' | 'temperature',
  params: {...}
});

// 제어 결과 구독
subscribe(`control_result/${deviceUuid}`);
```

---

### 5. AIChat (/ai-chat)

**파일**: `src/pages/AIChat.tsx`

**기능**:
- 통합 AI 채팅 인터페이스
- 6가지 도구 지원
- 파일 업로드 (이미지, G-code)
- 대화 세션 관리
- 대화 공유

**도구 타입**:
| 도구 | 아이콘 | 설명 |
|------|--------|------|
| general | `MessageSquare` | 일반 채팅 |
| troubleshoot | `Wrench` | 진단 도구 |
| gcode | `FileCode2` | G-code 분석 |
| modeling | `Box` | 3D 모델 생성 |
| price_comparison | `DollarSign` | 가격 비교 |

**훅 구조**:
```typescript
const fileUpload = useFileUpload();
const sidebar = useSidebarState();
const sharing = useChatSharing();
const anonChat = useAnonChat();
const chatMessages = useChatMessages();
const chatSessions = useChatSessions();
const composer = useChatComposer();
const permissions = useChatPermissions();
const gcode = useGcodeController();
```

**컴포넌트**:
- `AppSidebar` - 세션 목록
- `AppHeader` - 헤더 + 공유 버튼
- `WelcomeScreen` - 시작 화면
- `ChatInput` - 입력창
- `ChatMessage` - 메시지 표시
- `FilePreviewList` - 업로드 파일 미리보기
- `GCodeAnalysisReport` - G-code 보고서 패널

**데이터**:
- `chat_sessions` - 세션 정보
- `chat_messages` - 메시지 저장
- `shared_chats` - 공유 정보
- `gcode_analysis_reports` - G-code 보고서

---

### 6. AI (/create)

**파일**: `src/pages/AI.tsx`

**기능**:
- AI 3D 모델 생성 전용 페이지
- Text-to-3D
- Image-to-3D
- 생성된 모델 갤러리

**탭**:
| 탭 | 기능 |
|----|------|
| 텍스트 | 텍스트 프롬프트로 3D 생성 |
| 이미지 | 이미지 업로드로 3D 생성 |
| 내 모델 | 생성된 모델 갤러리 |

**컴포넌트**:
- `TextTo3DForm` - 텍스트 입력 폼
- `ImageTo3DForm` - 이미지 업로드 폼
- `ModelViewer` - 3D 뷰어 (Three.js)
- `ModelGallery` - 모델 갤러리

**데이터**:
- `ai_generated_models` 테이블

---

### 7. Admin (/admin)

**파일**: `src/pages/Admin.tsx`

**기능**:
- 관리자 대시보드
- 통계 요약
- 빠른 링크

**위젯**:
- 총 사용자 수
- 활성 프린터 수
- 오늘 채팅 수
- AI 모델 생성 수

---

### 8. AdminAIAnalytics (/admin/ai-analytics)

**파일**: `src/pages/AdminAIAnalytics.tsx`

**기능**:
- AI 기능 사용 통계
- 키워드 클라우드
- 일별 사용량 차트
- 도구별 사용량 (도넛 차트)
- 상위 사용자
- 공유된 채팅 목록

**기간 필터**: 7일, 14일, 30일, 90일

**컴포넌트**:
- `StatsSummaryCards` - 요약 카드
- `KeywordCloud` - 키워드 클라우드
- `DailyUsageChart` - 일별 차트
- `ToolUsageChart` - 도구별 차트
- `TopUsersList` - 사용자 순위
- `SharedChatsList` - 공유 채팅

**API**: `admin-ai-analytics` Edge Function

---

### 9. UserSettings (/user-settings)

**파일**: `src/pages/UserSettings.tsx`

**기능**:
- 프로필 수정
- 이메일 변경
- 비밀번호 변경
- 알림 설정
- 구독 관리
- 계정 삭제

**탭**:
| 탭 | 기능 |
|----|------|
| 프로필 | 이름, 아바타 |
| 계정 | 이메일, 비밀번호 |
| 알림 | 푸시, 이메일 알림 |
| 구독 | 현재 플랜, 결제 내역 |
| 위험 | 계정 삭제 |

---

### 10. GCodeAnalytics (/gcode-analytics)

**파일**: `src/pages/GCodeAnalytics.tsx`

**기능**:
- G-code 분석 이력 조회
- 보고서 상세 보기
- 보고서 공유

**컴포넌트**:
- `ReportList` - 보고서 목록
- `GCodeAnalysisReport` - 상세 보고서

**데이터**:
- `gcode_analysis_reports` 테이블

---

### 11. SharedChat (/share/:shareId)

**파일**: `src/pages/SharedChat.tsx`

**기능**:
- 공유된 채팅 보기 (읽기 전용)
- 공유 메타데이터 표시

**데이터**:
- `shared_chats` 테이블
- `chat_messages` 테이블

---

### 12. PaymentCheckout (/payment/checkout)

**파일**: `src/pages/PaymentCheckout.tsx`

**기능**:
- 구독 결제 페이지
- 플랜 선택
- 결제 수단 선택

**연동**:
- Paddle 결제

---

## 라우트 보호

### ProtectedRoute

```typescript
// 로그인 필수 페이지 보호
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>
```

- 로그인 상태 확인
- 미로그인 시 `/auth`로 리다이렉트

### AdminRoute

```typescript
// 관리자 전용 페이지 보호
<AdminRoute>
  <Admin />
</AdminRoute>
```

- 로그인 상태 확인
- `is_admin` 플래그 확인
- 권한 없으면 `/`로 리다이렉트

---

## 헤더/푸터 표시 규칙

### Header 숨기는 페이지

```typescript
const hideHeaderPaths = [
  '/ai-chat',
  '/user-settings',
  '/dashboard',
  '/create',
  '/printer',
  '/admin',
  '/gcode-analytics',
  '/shared',
  '/share'
];
```

→ 자체 `AppHeader` 사용

### Footer 숨기는 페이지

```typescript
const hideFooterPaths = [
  '/dashboard',
  '/printer',
  '/create',
  '/ai-chat',
  '/user-settings',
  '/admin',
  '/auth',
  '/gcode-analytics',
  '/shared',
  '/share'
];
```

---

## 모바일 대응

### SharedBottomNavigation

모바일에서 하단 네비게이션 바 표시:

```typescript
{isMobile && <SharedBottomNavigation />}
```

네비게이션 항목:
- 홈
- 대시보드
- AI 채팅
- 설정

---

## Lazy Loading

모든 페이지는 `React.lazy()`로 코드 스플리팅:

```typescript
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AIChat = lazy(() => import("./pages/AIChat"));
// ...
```

로딩 표시:

```typescript
<Suspense fallback={
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
  </div>
}>
  <Routes>...</Routes>
</Suspense>
```
