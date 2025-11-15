# FACTOR UI

> 3D 프린터 원격 모니터링 및 제어 플랫폼

[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](https://github.com/factor/factor-ui)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Web%20%7C%20iOS%20%7C%20Android-green.svg)](https://factor.io.kr)

## 🚀 빠른 시작

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 Supabase 및 MQTT 설정

# 개발 서버 시작 (전체 스택)
npm run dev:stack

# 또는 개별 패키지 실행
npm run dev:host      # Host (플랫폼 라우터)
npm run dev:web       # Web App
npm run dev:mobile    # Mobile App
```

웹 브라우저에서 `http://localhost:8080` 접속

## 📖 문서

- **[프로젝트 문서](./PROJECT_DOCUMENTATION.md)** - 전체 프로젝트 개요 및 아키텍처
- **[기술 스택](./TECH_STACK.md)** - 사용된 기술 및 라이브러리
- **[API 레퍼런스](./API_REFERENCE.md)** - REST API, MQTT, WebSocket 문서
- **[개발 가이드](./CLAUDE.md)** - AI 개발 가이드 및 규칙

## ✨ 주요 기능

- 🖥️ **크로스 플랫폼**: 웹, iOS, Android 지원
- 🔄 **실시간 모니터링**: MQTT 기반 프린터 상태 업데이트
- 🤖 **AI 통합**: 이미지 → 3D 모델 자동 생성
- 📱 **네이티브 기능**: 카메라, 파일 시스템, 푸시 알림
- 🌍 **다국어**: 한국어, English
- 🎨 **테마**: Light, Dark, System

## 🏗️ 프로젝트 구조

```
factor_UI/
├── packages/
│   ├── host/          # 플랫폼 디스패처
│   ├── web/           # 웹 앱
│   ├── mobile/        # 모바일 앱 (Capacitor)
│   └── shared/        # 공통 코드
├── docs/              # 문서
├── CLAUDE.md          # AI 개발 가이드
└── package.json       # Monorepo 설정
```

## 🛠️ 기술 스택

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Radix UI
- **Mobile**: Capacitor 7
- **State**: TanStack React Query
- **Database**: Supabase (PostgreSQL)
- **Real-time**: MQTT + WebSocket
- **3D**: Three.js + React Three Fiber

전체 기술 스택은 [TECH_STACK.md](./TECH_STACK.md) 참조

## 🔧 빌드

```bash
# 전체 빌드
npm run build:all

# 개별 빌드
npm run build:host
npm run build:web
npm run build:mobile

# 모바일 네이티브 빌드
cd packages/mobile
npx cap sync ios
npx cap open ios    # Xcode에서 빌드
```

## 📱 모바일 배포

### iOS
```bash
cd packages/mobile
npm run build
npx cap sync ios
npx cap open ios
# Xcode: Product → Archive
```

### Android
```bash
cd packages/mobile
npm run build
npx cap sync android
npx cap open android
# Android Studio: Build → Generate Signed Bundle/APK
```

## 🧪 테스트

```bash
# Lint
npm --workspace @factor/web run lint
npm --workspace @factor/mobile run lint

# Type Check
npx tsc --noEmit
```

## 📦 배포

- **Web**: Vercel / Netlify
- **iOS**: App Store
- **Android**: Google Play

자세한 내용은 [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) 참조

## 🤝 기여

이 프로젝트는 비공개 프로젝트입니다. 기여하려면 팀에 문의하세요.

## 📞 연락처

- 웹사이트: https://factor.io.kr
- 지원: https://factor.io.kr/terms
- 개인정보: https://factor.io.kr/privacy

## 📄 라이센스

© 2024 FACTOR. All rights reserved.

---

**버전**: 1.2.0 (Build 3)
**최종 업데이트**: 2024년 11월 14일
