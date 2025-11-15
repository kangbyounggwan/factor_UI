# FACTOR UI - 기술 스택 요약

## 프론트엔드

### 핵심 프레임워크
| 기술 | 버전 | 용도 |
|------|------|------|
| React | 18.3 | UI 라이브러리 |
| TypeScript | 5.5 | 타입 안전성 |
| Vite | 5.4 | 빌드 도구 |
| Tailwind CSS | 3.4 | 스타일링 |

### 상태 관리
| 기술 | 용도 |
|------|------|
| TanStack React Query | 서버 상태 관리 |
| React Context | 전역 상태 (Auth, Theme) |
| React Hook Form + Zod | 폼 관리 및 검증 |

### UI 컴포넌트
| 라이브러리 | 용도 |
|-----------|------|
| Radix UI | Headless UI 컴포넌트 |
| Lucide React | 아이콘 |
| next-themes | 테마 관리 |
| Sonner | Toast 알림 |

### 3D 렌더링
| 기술 | 용도 |
|------|------|
| Three.js | 3D 엔진 |
| React Three Fiber | React 통합 |
| @react-three/drei | 유틸리티 |

---

## 모바일

### Capacitor 플러그인
| 플러그인 | 용도 |
|---------|------|
| @capacitor/app | 앱 생명주기 |
| @capacitor/camera | 카메라 접근 |
| @capacitor/filesystem | 파일 시스템 |
| @capacitor/keyboard | 키보드 제어 |
| @capacitor/network | 네트워크 상태 |
| @capacitor/preferences | 로컬 저장소 |
| @capacitor/status-bar | 상태바 제어 |
| @capacitor/toast | 네이티브 토스트 |
| @capacitor-community/safe-area | Safe Area 처리 |
| @capawesome/capacitor-file-picker | 파일 선택 |

---

## 백엔드 & 서비스

### 데이터베이스 & 인증
| 서비스 | 용도 |
|--------|------|
| Supabase | PostgreSQL + Auth |
| @supabase/supabase-js | 클라이언트 SDK |

### 실시간 통신
| 기술 | 용도 |
|------|------|
| MQTT | 프린터 상태 실시간 업데이트 |
| WebSocket (ws) | Legacy 실시간 통신 |
| Express.js | REST API 서버 |

### 미디어 스트리밍
| 서비스 | 용도 |
|--------|------|
| MediaMTX | RTSP/HLS 스트리밍 (Docker) |
| HLS.js | 비디오 플레이어 |

---

## 개발 도구

### 빌드 & 번들링
| 도구 | 용도 |
|------|------|
| Vite | 개발 서버 & 빌드 |
| Rollup | 번들러 (Vite 내부) |
| Terser | 코드 압축 |

### 코드 품질
| 도구 | 용도 |
|------|------|
| ESLint | 린트 |
| TypeScript | 타입 체크 |
| Prettier | (추가 예정) |

### 패키지 관리
| 도구 | 용도 |
|------|------|
| npm workspaces | Monorepo 관리 |
| Concurrently | 병렬 스크립트 실행 |

---

## 국제화 (i18n)

| 라이브러리 | 용도 |
|-----------|------|
| i18next | 국제화 프레임워크 |
| react-i18next | React 통합 |
| i18next-browser-languagedetector | 언어 감지 |

**지원 언어**: 한국어 (ko), English (en)

---

## 결제

| 서비스 | 용도 |
|--------|------|
| Toss Payments | 한국 결제 게이트웨이 |

---

## 개발 환경

### 필수 요구사항
- Node.js >= 18.x
- npm >= 9.x
- Xcode >= 14.x (iOS 개발)
- Android Studio (Android 개발)
- Docker (미디어 서버)

### 권장 IDE
- Visual Studio Code
- WebStorm

### 권장 Extensions (VSCode)
- ESLint
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- Prettier (추가 예정)

---

## 프로덕션 배포

### 호스팅
| 플랫폼 | 용도 |
|--------|------|
| Vercel / Netlify | 웹 호스팅 (추천) |
| Apple App Store | iOS 배포 |
| Google Play Store | Android 배포 |

### 도메인
- 메인: https://factor.io.kr
- 개인정보: https://factor.io.kr/privacy
- 이용약관: https://factor.io.kr/terms

---

## 의존성 버전 요약

### 주요 라이브러리

```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.26.2",
  "typescript": "^5.5.3",
  "vite": "^5.4.1",
  "@tanstack/react-query": "^5.56.2",
  "@supabase/supabase-js": "^2.56.0",
  "@capacitor/core": "^7.4.3",
  "tailwindcss": "^3.4.11",
  "three": "^0.179.1"
}
```

### Capacitor 플러그인

```json
{
  "@capacitor/android": "^7.4.3",
  "@capacitor/ios": "^7.4.3",
  "@capacitor/cli": "^7.4.3",
  "@capacitor/app": "^7.0.2",
  "@capacitor/camera": "^7.0.2",
  "@capacitor/filesystem": "^7.1.4",
  "@capacitor/keyboard": "^7.0.2",
  "@capacitor/network": "^7.0.2",
  "@capacitor/preferences": "^7.0.2",
  "@capacitor/status-bar": "^7.0.2"
}
```

---

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────┐
│                    사용자                         │
└───────────┬─────────────────────┬───────────────┘
            │                     │
    ┌───────▼────────┐    ┌──────▼──────┐
    │   Web Browser   │    │   Mobile App │
    │   (Vite + React)│    │  (Capacitor) │
    └───────┬────────┘    └──────┬──────┘
            │                     │
            └──────────┬──────────┘
                       │
            ┌──────────▼──────────┐
            │    Host Package      │
            │  (Platform Router)   │
            └──────────┬──────────┘
                       │
            ┌──────────▼──────────┐
            │   Shared Package     │
            │  (Business Logic)    │
            └──────────┬──────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌────▼─────┐ ┌─────▼─────┐
│   Supabase    │ │   MQTT    │ │  Express  │
│  (Database)   │ │  (Broker) │ │   (API)   │
└───────────────┘ └───────────┘ └───────────┘
```

---

## 패키지 크기 (Production)

### Mobile App (iOS)
- 번들 크기: ~5 MB (gzip)
- 다운로드 크기: ~15-20 MB (App Store)

### Web App
- Initial Bundle: ~800 KB
- Total Assets: ~2.4 MB (gzip)
- Code Splitting: ✅ (lazy loading)

---

## 성능 최적화

### 적용된 최적화
- ✅ Code Splitting (React.lazy)
- ✅ Tree Shaking (Vite)
- ✅ Asset Optimization (이미지 압축)
- ✅ React Query Caching
- ✅ MQTT Singleton Pattern
- ✅ Device UUID Caching (60s TTL)

### 추가 예정
- [ ] Service Worker (PWA)
- [ ] Image Lazy Loading
- [ ] Virtual Scrolling
- [ ] Bundle Analysis

---

**최종 업데이트**: 2024년 11월 14일
