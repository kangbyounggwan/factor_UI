# FACTOR UI - Sub Agent System

이 디렉토리는 FACTOR UI 프로젝트의 분산 개발을 위한 서브 에이전트 정의를 포함합니다.

## 에이전트 개요

각 에이전트는 특정 도메인에 집중하여 병렬로 작업할 수 있도록 설계되었습니다.

### 사용 가능한 에이전트

1. **docs-manager** - 문서 관리 및 동기화
2. **api-developer** - API 개발 및 통합
3. **mobile-builder** - 모바일 빌드 및 배포
4. **ui-components** - UI 컴포넌트 개발
5. **type-safety** - TypeScript 타입 안전성
6. **i18n-manager** - 다국어 관리
7. **quality-checker** - 코드 품질 검사
8. **realtime-engineer** - MQTT/실시간 통신
9. **page-documenter** - 페이지별 종합 문서화 (15개 섹션 구조)
10. **dev-finalize** - 개발 마무리 파이프라인 ⭐ (품질검사 → 마이그레이션 → 문서정리 → docs 업데이트)

## 사용 방법

### 단일 에이전트 실행

```
@docs-manager 프로젝트 문서를 최신 상태로 업데이트해줘
```

### 병렬 에이전트 실행

```
다음 작업을 병렬로 실행해줘:
1. @api-developer 새로운 프린터 상태 API 추가
2. @type-safety 관련 타입 정의 추가
3. @docs-manager API 문서 업데이트
```

### 순차적 에이전트 실행 (의존성 있는 경우)

```
1. @ui-components 새로운 설정 페이지 컴포넌트 생성
2. 완료 후 @i18n-manager 해당 페이지의 번역 키 추가
3. 완료 후 @docs-manager 기능 문서화
```

## 에이전트 간 협업 패턴

### 패턴 1: API 추가 워크플로우

```
@api-developer → @type-safety → @docs-manager
```

1. API 엔드포인트 구현
2. TypeScript 타입 정의
3. API 문서 업데이트

### 패턴 2: UI 기능 추가 워크플로우

```
@ui-components → @i18n-manager → @quality-checker
```

1. React 컴포넌트 개발
2. 다국어 키 추가
3. 린트 및 타입 체크

### 패턴 3: 모바일 릴리스 워크플로우

```
@quality-checker → @mobile-builder → @docs-manager
```

1. 전체 코드 품질 검사
2. 모바일 빌드 및 배포
3. 릴리스 노트 작성

### 패턴 4: 실시간 기능 추가 워크플로우

```
@realtime-engineer → @api-developer → @type-safety → @docs-manager
```

1. MQTT 토픽 및 메시지 구조 설계
2. API 연동
3. 타입 정의
4. 문서화

### 패턴 5: 페이지 문서화 워크플로우

```
@page-documenter → @docs-manager
```

1. 페이지별 종합 문서 생성 (15개 섹션)
2. PROJECT_STRUCTURE.md 링크 추가

### 패턴 6: 개발 마무리 워크플로우 ⭐

```
@dev-finalize (4단계 자동 파이프라인)
```

1. **Quality Check** - TypeScript, ESLint, 빌드 검증
2. **Migration Cleanup** - 중복/오래된 마이그레이션 정리
3. **MD Cleanup** - 완료된 PLAN 문서 삭제
4. **Docs Update** - 수정된 페이지 docs 업데이트

**사용법:**
```
@dev-finalize
또는
개발 마무리
```

## 에이전트 선택 가이드

| 작업 유형 | 추천 에이전트 | 비고 |
|----------|--------------|------|
| 문서 업데이트 | docs-manager | 모든 .md 파일 관리 |
| REST API 추가 | api-developer | Express, Supabase |
| MQTT 토픽 추가 | realtime-engineer | MQTT, WebSocket |
| 화면 개발 | ui-components | React, Tailwind |
| 타입 에러 수정 | type-safety | TypeScript |
| 번역 추가 | i18n-manager | i18next |
| 빌드 오류 | quality-checker | Lint, Type check |
| iOS/Android 배포 | mobile-builder | Capacitor, Xcode |
| 페이지 문서화 | page-documenter | 15개 섹션 구조 |
| **개발 마무리** | **dev-finalize** | 4단계 자동 파이프라인 ⭐ |

## 주의사항

1. **에이전트 간 충돌 방지**: 같은 파일을 동시에 수정하는 에이전트를 병렬 실행하지 마세요
2. **의존성 순서**: 타입 정의가 필요한 컴포넌트는 type-safety → ui-components 순서로
3. **문서는 마지막**: 기능 구현 후 docs-manager를 실행하세요
4. **품질 검사**: 배포 전 반드시 quality-checker를 실행하세요

## 버전

- **Version**: 1.1.0
- **Last Updated**: 2026-01-12
- **Compatible with**: FACTOR UI v1.2.0
