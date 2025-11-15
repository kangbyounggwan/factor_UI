# FACTOR UI - Sub Agent System

## 개요

FACTOR UI는 **전문화된 서브 에이전트 시스템**을 통해 효율적인 분산 개발을 지원합니다. 각 에이전트는 특정 도메인에 집중하여 병렬로 작업할 수 있으며, 명확한 책임과 협업 패턴을 가지고 있습니다.

## 🎯 8개의 전문 에이전트

### 1. **docs-manager** - 문서 관리자
- **역할**: 모든 프로젝트 문서 유지 관리
- **관리 파일**: `*.md` (README, API_REFERENCE, CLAUDE 등)
- **주요 작업**:
  - 문서 업데이트 및 동기화
  - 버전 정보 관리
  - 릴리스 노트 작성
  - API 문서화

### 2. **api-developer** - API 개발자
- **역할**: REST API, React Query 훅 개발
- **관리 파일**: `api/*.ts`, `queries/*.ts`, `server.js`
- **주요 작업**:
  - REST API 엔드포인트 구현
  - Supabase 쿼리
  - React Query 훅 생성
  - 에러 핸들링

### 3. **mobile-builder** - 모바일 빌더
- **역할**: iOS/Android 빌드 및 배포
- **관리 파일**: `ios/`, `android/`, `capacitor.config.ts`
- **주요 작업**:
  - 버전 관리 (MARKETING_VERSION, BUILD_NUMBER)
  - Xcode/Android Studio 빌드
  - App Store/Play Store 배포
  - Safe Area 최적화

### 4. **ui-components** - UI 컴포넌트 개발자
- **역할**: React 컴포넌트 및 UI/UX
- **관리 파일**: `components/`, `pages/`, `index.css`
- **주요 작업**:
  - React 컴포넌트 개발
  - Tailwind CSS 스타일링
  - Radix UI 통합
  - 반응형 디자인

### 5. **type-safety** - 타입 안전성 관리자
- **역할**: TypeScript 타입 정의 및 검증
- **관리 파일**: `types/*.ts`, `tsconfig.json`
- **주요 작업**:
  - 인터페이스 및 타입 정의
  - Zod 스키마 작성
  - 타입 에러 수정
  - Generic 타입 최적화

### 6. **i18n-manager** - 다국어 관리자
- **역할**: 번역 및 다국어 지원
- **관리 파일**: `i18n/**/*.json`
- **주요 작업**:
  - 번역 키 관리 (한국어, 영어)
  - 번역 누락 감지
  - Capacitor Preferences 언어 설정
  - 번역 일관성 유지

### 7. **quality-checker** - 품질 검사자
- **역할**: 코드 품질, 린트, 빌드 검증
- **관리 파일**: ESLint, TypeScript 설정
- **주요 작업**:
  - ESLint 검사
  - TypeScript 타입 체크
  - 빌드 오류 해결
  - 성능 이슈 탐지

### 8. **realtime-engineer** - 실시간 통신 엔지니어
- **역할**: MQTT/WebSocket 실시간 통신
- **관리 파일**: `mqtt.ts`, `websocket.ts`
- **주요 작업**:
  - MQTT 토픽 설계
  - 구독/발행 패턴 구현
  - WebSocket 연결 관리
  - 실시간 메시지 핸들링

## 📊 에이전트 선택 가이드

### 파일 변경 기준

```
*.md 파일                  → docs-manager
api/*.ts, queries/*.ts     → api-developer
components/*.tsx, pages/   → ui-components
types/*.ts                 → type-safety
i18n/**/*.json            → i18n-manager
mqtt.ts, websocket.ts     → realtime-engineer
ios/, android/            → mobile-builder
ESLint, TypeScript 설정   → quality-checker
```

### 작업 유형 기준

| 작업 | 에이전트 워크플로우 |
|------|-------------------|
| 새 API 추가 | type-safety → api-developer → docs-manager |
| 새 화면 추가 | ui-components → i18n-manager → quality-checker |
| 모바일 배포 | quality-checker → mobile-builder → docs-manager |
| 실시간 기능 | realtime-engineer → type-safety → ui-components |
| 버그 수정 | (해당 에이전트) → quality-checker |
| 성능 최적화 | quality-checker → ui-components → quality-checker |

## 🔄 협업 패턴

### 패턴 1: 새 기능 개발 (전체 플로우)
```
1. type-safety      → 타입 정의
2. api-developer    → API 구현
3. ui-components    → UI 개발
4. i18n-manager     → 번역 추가
5. quality-checker  → 품질 검사
6. docs-manager     → 문서화
```

### 패턴 2: 병렬 작업 (독립적인 작업)
```
병렬 실행:
- api-developer    → API 엔드포인트 구현
- type-safety      → 타입 정의
- docs-manager     → API 문서 작성
```

### 패턴 3: 긴급 수정 (빠른 순차)
```
1. mobile-builder  → 버그 수정
2. quality-checker → 빠른 검증
3. mobile-builder  → 핫픽스 배포
```

## 💡 사용 예시

### 예시 1: 프린터 일시정지 기능 추가

```
Step 1: 타입 정의
@type-safety: Define pause API types (request, response, error)

Step 2: API 구현
@api-developer: Implement pause API
- Add PrinterAPI.pausePrint()
- Create usePausePrint() hook

Step 3: UI 개발
@ui-components: Add pause button to PrinterDetail page

Step 4: 번역
@i18n-manager: Add "printer.controls.pause" translation key

Step 5: 문서화
@docs-manager: Document pause API in API_REFERENCE.md
```

### 예시 2: iOS v1.3.0 배포

```
Step 1: 품질 검사
@quality-checker: Full pre-deployment check
- TypeScript errors: 0
- ESLint warnings: 0
- Build: success
- Bundle size: OK

Step 2: 빌드 및 배포
@mobile-builder: Build iOS v1.3.0 Build 1
- Update version numbers
- Create archive
- Upload to App Store Connect

Step 3: 릴리스 노트
@docs-manager: Update release notes
- Add to PROJECT_DOCUMENTATION.md
- Update README.md version
```

### 예시 3: MQTT 카메라 스냅샷 추가

```
Step 1: 토픽 설계
@realtime-engineer: Design camera/snapshot/{uuid} topic

Step 2: 타입 정의
@type-safety: Define SnapshotMessage interface

Step 3: 구독 구현
@realtime-engineer: Add MQTT subscription in AuthContext

Step 4: UI 통합
@ui-components: Create CameraSnapshot component
```

## 📝 에이전트 문서

각 에이전트의 상세 정보는 다음 문서를 참조하세요:

- **[.claude/agents/README.md](./.claude/agents/README.md)** - 에이전트 시스템 개요
- **[.claude/agents/EXAMPLES.md](./.claude/agents/EXAMPLES.md)** - 실전 사용 예시
- **[.claude/agents/docs-manager.md](./.claude/agents/docs-manager.md)** - 문서 관리자
- **[.claude/agents/api-developer.md](./.claude/agents/api-developer.md)** - API 개발자
- **[.claude/agents/mobile-builder.md](./.claude/agents/mobile-builder.md)** - 모바일 빌더
- **[.claude/agents/ui-components.md](./.claude/agents/ui-components.md)** - UI 컴포넌트
- **[.claude/agents/type-safety.md](./.claude/agents/type-safety.md)** - 타입 안전성
- **[.claude/agents/i18n-manager.md](./.claude/agents/i18n-manager.md)** - 다국어 관리
- **[.claude/agents/quality-checker.md](./.claude/agents/quality-checker.md)** - 품질 검사
- **[.claude/agents/realtime-engineer.md](./.claude/agents/realtime-engineer.md)** - 실시간 통신

## ⚠️ 주의사항

### Do
- ✅ 파일 충돌 방지: 같은 파일을 수정하는 에이전트는 순차 실행
- ✅ 의존성 순서: 타입 정의 → API/UI 구현 → 문서화
- ✅ 품질 검사 필수: 배포 전 quality-checker 실행
- ✅ 문서는 마지막: 기능 완성 후 docs-manager 실행

### Don't
- ❌ 에이전트 역할 넘어서기: 각자의 전문 영역만 담당
- ❌ 문서 업데이트 누락: 모든 변경사항은 문서화
- ❌ 품질 검사 생략: 항상 quality-checker로 검증
- ❌ 타입 없이 개발: 항상 type-safety 먼저

## 📈 효율성 지표

### 병렬 처리 가능 작업
- API 개발 + 타입 정의 + 문서 작성 (3배 속도)
- UI 개발 + 번역 작업 (2배 속도)

### 순차 처리 필요 작업
- 타입 정의 → API 구현 (의존성)
- UI 개발 → 번역 추가 (의존성)
- 품질 검사 → 배포 (필수 순서)

## 🎓 학습 리소스

1. **시작하기**: [.claude/agents/README.md](./.claude/agents/README.md)
2. **실전 예시**: [.claude/agents/EXAMPLES.md](./.claude/agents/EXAMPLES.md)
3. **개발 가이드**: [CLAUDE.md](./CLAUDE.md)
4. **프로젝트 문서**: [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)

## 🔗 관련 문서

- [README.md](./README.md) - 프로젝트 개요
- [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - 전체 프로젝트 문서
- [TECH_STACK.md](./TECH_STACK.md) - 기술 스택
- [API_REFERENCE.md](./API_REFERENCE.md) - API 레퍼런스
- [CLAUDE.md](./CLAUDE.md) - AI 개발 가이드

---

**버전**: 1.0.0
**최종 업데이트**: 2024년 11월 16일
**호환**: FACTOR UI v1.2.0+
