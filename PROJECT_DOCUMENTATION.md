# FACTOR UI - 프로젝트 문서

## 📋 프로젝트 개요

**FACTOR**는 3D 프린터 원격 모니터링 및 제어를 위한 크로스 플랫폼 관리 솔루션입니다.

- **프로젝트명**: FACTOR UI
- **버전**: 1.2.0 (Build 3)
- **개발팀**: FACTOR Team
- **번들 ID**: com.byeonggwan.factor
- **배포**: Web (Browser) + iOS/Android (Capacitor)

### 주요 특징

- 🖥️ **크로스 플랫폼**: 웹, iOS, Android 지원
- 🔄 **실시간 모니터링**: MQTT 기반 프린터 상태 실시간 업데이트
- 🤖 **AI 통합**: 이미지 기반 3D 모델 생성 및 슬라이싱
- 📱 **네이티브 기능**: 카메라, 파일 시스템, 알림 등
- 🌍 **다국어 지원**: 한국어, 영어
- 🎨 **테마 시스템**: Light/Dark/System 테마

---

## 🏗️ 아키텍처

### Monorepo 구조

```
factor_UI/
├── packages/
│   ├── host/          # 플랫폼 디스패처 (라우팅)
│   ├── web/           # 웹 애플리케이션
│   ├── mobile/        # 모바일 앱 (Capacitor)
│   └── shared/        # 공통 코드 (비즈니스 로직)
├── CLAUDE.md          # AI 개발 가이드
└── package.json       # 루트 workspace 설정
```

### 패키지별 역할

#### 1. **host** - 플랫폼 디스패처
- 사용자 환경(웹/모바일)을 감지하고 적절한 앱으로 라우팅
- 플랫폼 감지 우선순위:
  1. Query parameter (`?platform=web|mobile`)
  2. localStorage override
  3. Capacitor 환경 감지
  4. User agent 감지
  5. Default: web

#### 2. **web** - 웹 애플리케이션
- 완전한 기능의 데스크톱 브라우저 앱
- AI 어시스턴트 사이드바
- 고급 프린터 제어
- 구독 관리
- 3D 모델 뷰어

#### 3. **mobile** - 모바일 앱 (Capacitor)
- iOS/Android 네이티브 앱
- Capacitor 플러그인 통합:
  - Status Bar, Keyboard, Network
  - Camera, Filesystem, Preferences
  - Safe Area, Toast
- AI 어시스턴트 비활성화 (모바일 최적화)

#### 4. **shared** - 공통 코드
- API 클라이언트
- React Query 훅
- Supabase 통합
- MQTT 서비스
- TypeScript 타입
- i18n (국제화)

---

## 🛠️ 기술 스택

### Frontend
- **Framework**: React 18.3 + TypeScript 5.5
- **Build Tool**: Vite 5.4
- **Routing**: React Router 6.26
- **UI Components**: Radix UI
- **Styling**: Tailwind CSS 3.4
- **State Management**:
  - TanStack React Query (서버 상태)
  - React Context (전역 상태)
- **3D Rendering**: Three.js + React Three Fiber
- **Forms**: React Hook Form + Zod

### Mobile
- **Platform**: Capacitor 7.4
- **Native Plugins**:
  - @capacitor/app, camera, filesystem
  - @capacitor-community/safe-area
  - @capawesome/capacitor-file-picker

### Backend & Services
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: MQTT (ws://broker)
- **API Server**: Express.js
- **Media Streaming**: MediaMTX (Docker)

### DevOps
- **Package Manager**: npm workspaces
- **Version Control**: Git
- **CI/CD**: (추가 예정)
- **Deployment**:
  - Web: Vercel/Netlify
  - iOS: App Store
  - Android: Google Play

---

## 📱 주요 기능

### 1. 인증 및 사용자 관리
- 이메일/비밀번호 인증 (Supabase)
- 소셜 로그인 (OAuth)
- 역할 기반 접근 제어 (Admin/User)
- 프로필 관리

### 2. 프린터 관리
- 실시간 프린터 상태 모니터링
- 온도, 위치, 진행률 추적
- 원격 제어 (일시정지, 재개, 취소)
- 카메라 스트리밍
- 그룹 관리

### 3. AI 기능
- 이미지 → 3D 모델 변환
- 자동 슬라이싱
- AI 모델 훈련 데이터 관리
- 진행 상태 추적

### 4. 구독 관리
- Toss Payments 통합
- 플랜 업그레이드/다운그레이드
- 결제 이력

### 5. 설정
- 언어 설정 (한국어/영어)
- 테마 설정 (Light/Dark/System)
- 알림 설정
- 비밀번호 변경

### 6. 네이티브 기능 (모바일)
- 카메라 접근
- 파일 시스템
- 네트워크 상태 감지
- 하드웨어 백 버튼 처리
- Safe Area 지원 (iPad/iPhone)

---

## 🔄 실시간 통신

### MQTT 아키텍처

```
사용자                MQTT Broker           디바이스
  |                       |                    |
  |--Subscribe----------->|                    |
  |  octoprint/status/    |                    |
  |  {device_uuid}        |                    |
  |                       |<---Publish---------|
  |                       |  (상태 업데이트)    |
  |<------Message---------|                    |
  |                       |                    |
  |--Publish------------->|                    |
  |  control_result/      |                    |
  |  {device_uuid}        |                    |
  |                       |----Message-------->|
```

### 주요 토픽
- `octoprint/status/{device_uuid}` - 프린터 상태
- `control_result/{device_uuid}` - 제어 결과
- `temperature/{device_uuid}` - 온도 업데이트
- `position/{device_uuid}` - 위치 업데이트
- `print_progress/{device_uuid}` - 출력 진행률

### WebSocket (Legacy)
- Edge 클라이언트: Python/requests
- 웹 클라이언트: 실시간 브로드캐스트
- 메시지 타입: printer_status, temperature_update, position_update

---

## 🗄️ 데이터베이스 스키마 (Supabase)

### 주요 테이블

#### `clients`
- 사용자에게 등록된 클라이언트 디바이스

#### `printers`
- 프린터 구성 및 상태
- device_uuid (고유 식별자)

#### `cameras`
- 카메라 구성 및 스트림 URL

#### `user_roles`
- 역할 기반 접근 제어 (admin/user)

#### `ai_models`
- AI 모델 메타데이터

#### `ai_training_images`
- AI 훈련 데이터

#### `subscriptions`
- 사용자 구독 정보

---

## 🚀 개발 워크플로우

### 환경 설정

1. **환경 변수** (`.env`)
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MQTT_BROKER_URL=ws://localhost:9001
VITE_DEV_HOST=::
VITE_DEV_PORT=8080
```

2. **의존성 설치**
```bash
npm install
```

### 개발 서버 실행

```bash
# 미디어 서비스 시작 (Docker)
npm run media:start

# 개별 패키지
npm run dev:host      # Host
npm run dev:web       # Web
npm run dev:mobile    # Mobile

# 전체 스택 (Host + API + Media)
npm run dev:stack
```

### 빌드

```bash
# 개별 빌드
npm run build:host
npm run build:web
npm run build:mobile

# 전체 빌드
npm run build:all
npm run build:stack
```

### 모바일 개발

```bash
# 빌드 및 동기화
npm run build:mobile
cd packages/mobile
npx cap sync

# 네이티브 IDE 열기
npx cap open ios
npx cap open android
```

---

## 📦 빌드 및 배포

### iOS 배포 (App Store)

1. **버전 업데이트**
```bash
# package.json
"version": "1.2.0"

# project.pbxproj
MARKETING_VERSION = 1.2.0
CURRENT_PROJECT_VERSION = 3
```

2. **빌드**
```bash
npm run build:mobile
cd packages/mobile
npx cap sync ios
```

3. **Xcode Archive**
- Product → Archive
- Distribute App → App Store Connect
- Upload

4. **App Store Connect**
- 빌드 선택
- 메타데이터 작성
- 심사 제출

### Android 배포 (Google Play)

1. **빌드**
```bash
npm run build:mobile
cd packages/mobile
npx cap sync android
```

2. **Android Studio**
- Build → Generate Signed Bundle/APK
- Release 빌드 생성

3. **Google Play Console**
- APK/AAB 업로드
- 릴리스 관리

---

## 🎨 디자인 시스템

### 색상 팔레트

```css
/* Light Mode */
--background: 210 20% 98%;
--foreground: 215 25% 27%;
--primary: 214 84% 56%;     /* 산업용 청색 */

/* Dark Mode */
--background: 220 13% 9%;
--foreground: 210 40% 98%;
--primary: 214 84% 65%;
```

### 타이포그래피
- Primary: Inter
- Monospace: Orbitron

### 컴포넌트
- Radix UI 기반
- Tailwind CSS 스타일링
- Shadcn/ui 패턴

---

## 📝 코딩 규칙

### Import 순서
1. External libraries
2. Shared package (`@shared/*`)
3. Local package (`@/components`)
4. Relative imports

### 컴포넌트 패턴
- Lazy loading (React.lazy)
- Error boundaries
- Protected routes
- Type safety (TypeScript)

### 비동기 처리
- React Query (데이터 페칭)
- Timeout protection
- Error handling

---

## 🔍 디버깅 팁

### MQTT 연결 문제
- `VITE_MQTT_BROKER_URL` 확인
- 브로커 실행 상태 확인
- Client ID 중복 확인 (localStorage)

### 인증 문제
- localStorage 초기화
- Supabase 설정 확인
- `user_roles` 테이블 확인

### 플랫폼 감지 문제
- Query param 테스트: `?platform=mobile`
- localStorage `platformOverride` 확인
- Capacitor 초기화 확인

### 빌드 실패
- 의존성 재설치: `npm install`
- TypeScript 체크: `npx tsc --noEmit`
- 캐시 삭제: `rm -rf dist/`

---

## 📊 최근 개발 이력

### v1.2.0 (Build 3) - 2024-11-14
- ✅ iPad Safe Area 문제 수정
  - viewport-fit=cover 추가
  - 하단 패딩 증가 (0.5rem → 1.5rem)
- ✅ 테마 설정 UX 개선
  - 선택 즉시 적용
  - 불필요한 완료 버튼 제거
- ✅ 언어 설정 Safe Area 추가
- ✅ App Store 빌드 업로드 완료

### v1.2.0 (Build 2) - 2024-11-13
- ✅ 언어 설정 즉시 반영
- ✅ Capacitor Preferences 통합
- ✅ iOS i18n 지원 수정

### v1.1.0 - 2024-11
- 🤖 AI 생성 최적화
- 🐛 ModelViewer passive listener 경고 수정
- 📊 AI 요청/응답 로깅 추가
- ♻️ 렌더링 최적화 (과도한 re-render 방지)

---

## 🔐 보안 고려사항

### 환경 변수
- API 키는 `.env`에만 저장
- 절대 하드코딩 금지
- Git에 커밋 금지

### 인증
- Supabase JWT 토큰
- localStorage 자동 갱신
- 역할 기반 접근 제어

### MQTT
- 토큰 인증
- device_uuid 기반 토픽 접근
- 구독 정리 (로그아웃 시)

---

## 🧪 테스트

### Lint
```bash
npm --workspace @factor/web run lint
npm --workspace @factor/mobile run lint
```

### Type Check
```bash
npx tsc --noEmit
```

---

## 📚 참고 자료

### 문서
- [Capacitor Docs](https://capacitorjs.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [React Query Docs](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com/docs)

### 내부 문서
- `CLAUDE.md` - AI 개발 가이드
- `packages/*/README.md` - 패키지별 문서

---

## 👥 팀 및 연락처

- **개발팀**: FACTOR Team
- **웹사이트**: https://factor.io.kr
- **지원**: https://factor.io.kr/terms
- **개인정보**: https://factor.io.kr/privacy

---

## 📄 라이센스

© 2024 FACTOR. All rights reserved.

---

## 🗺️ 로드맵

### 단기 (1-2개월)
- [ ] Android 빌드 및 배포
- [ ] 푸시 알림 구현
- [ ] 오프라인 모드 지원
- [ ] 성능 최적화

### 중기 (3-6개월)
- [ ] 다중 프린터 제어
- [ ] G-code 에디터
- [ ] 프린터 펌웨어 업데이트
- [ ] 커뮤니티 기능

### 장기 (6-12개월)
- [ ] AR 프린터 시각화
- [ ] 고급 AI 기능
- [ ] 기업용 대시보드
- [ ] API 공개

---

**마지막 업데이트**: 2024년 11월 14일
