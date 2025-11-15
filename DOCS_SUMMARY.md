# FACTOR UI - 문서 구조 요약

## 📚 문서 계층 구조

### ⭐ 시작점
- **[README.md](README.md)** - 프로젝트 소개, 빠른 시작, 기본 명령어

### 📖 핵심 문서 (개발 필수)

#### 1. 프로젝트 이해
- **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** - 프로젝트 개요, 아키텍처, 주요 특징
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - 상세 구조, 컴포넌트, 함수 위치
- **[TECH_STACK.md](TECH_STACK.md)** - 기술 스택 및 라이브러리 요약

#### 2. 개발 가이드
- **[CLAUDE.md](CLAUDE.md)** - AI 개발 가이드, 규칙, 워크플로우
- **[SUB_AGENTS.md](SUB_AGENTS.md)** - 8개 전문 서브 에이전트 시스템

#### 3. API 문서
- **[API_REFERENCE.md](API_REFERENCE.md)** - 완전한 API 레퍼런스 (Supabase, REST, MQTT, WebSocket)
- **[API_mqtt-registration-payloads.md](API_mqtt-registration-payloads.md)** - MQTT 디바이스 등록 페이로드 스펙

### 📋 기능별 가이드

#### 파일 업로드 & 렌더링
- **[GUIDE_stl-upload.md](GUIDE_stl-upload.md)** - STL 파일 업로드 및 썸네일 생성
- **[TECH_stl-rendering-performance.md](TECH_stl-rendering-performance.md)** - STL 렌더링 성능 최적화

#### 알림 시스템
- **[GUIDE_notification-setup.md](GUIDE_notification-setup.md)** - 알림 시스템 설정 및 테스트

#### 성능 최적화
- **[TECH_bundle-optimization.md](TECH_bundle-optimization.md)** - 번들 크기 최적화 전략 및 결과

### 🚀 로드맵
- **[ROADMAP_native-viewer.md](ROADMAP_native-viewer.md)** - Native 3D 뷰어 구현 계획

---

## 🎯 작업별 참조 문서

### 신규 개발자 온보딩
1. [README.md](README.md) - 프로젝트 설정
2. [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) - 전체 개요
3. [TECH_STACK.md](TECH_STACK.md) - 기술 스택 파악
4. [CLAUDE.md](CLAUDE.md) - 개발 규칙 학습

### 새로운 기능 개발
1. [CLAUDE.md](CLAUDE.md) - 개발 워크플로우 확인
2. [SUB_AGENTS.md](SUB_AGENTS.md) - 적절한 서브 에이전트 선택
3. [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - 기존 패턴 파악
4. [API_REFERENCE.md](API_REFERENCE.md) - API 사용법 확인

### API 통합
1. [API_REFERENCE.md](API_REFERENCE.md) - API 스펙 확인
2. [API_mqtt-registration-payloads.md](API_mqtt-registration-payloads.md) - MQTT 페이로드
3. **서브 에이전트**: `api-developer`, `realtime-engineer`

### UI 컴포넌트 개발
1. [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - 기존 컴포넌트 구조
2. [TECH_STACK.md](TECH_STACK.md) - UI 라이브러리 확인
3. **서브 에이전트**: `ui-components`

### 모바일 개발
1. [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) - Capacitor 구조
2. [ROADMAP_native-viewer.md](ROADMAP_native-viewer.md) - Native 기능 계획
3. **서브 에이전트**: `mobile-builder`

### 성능 최적화
1. [TECH_bundle-optimization.md](TECH_bundle-optimization.md) - 번들 최적화
2. [TECH_stl-rendering-performance.md](TECH_stl-rendering-performance.md) - 렌더링 최적화
3. **서브 에이전트**: 원격 CLAUDE.md의 `Performance Optimizer` 참조

### 문서 업데이트
1. [CLAUDE.md](CLAUDE.md) - 문서 관리 규칙
2. **서브 에이전트**: `docs-manager`

---

## 📂 문서 카테고리

### 접두사 명명 규칙

| 접두사 | 용도 | 예시 |
|--------|------|------|
| `README` | 프로젝트 소개 | README.md |
| `PROJECT_` | 프로젝트 전반 | PROJECT_DOCUMENTATION.md, PROJECT_STRUCTURE.md |
| `API_` | API 스펙 | API_REFERENCE.md, API_mqtt-registration-payloads.md |
| `GUIDE_` | 사용자 가이드 | GUIDE_stl-upload.md, GUIDE_notification-setup.md |
| `TECH_` | 기술 문서 | TECH_STACK.md, TECH_bundle-optimization.md |
| `ROADMAP_` | 로드맵 | ROADMAP_native-viewer.md |
| `SUB_AGENTS` | 서브 에이전트 | SUB_AGENTS.md |
| `CLAUDE` | AI 개발 가이드 | CLAUDE.md |

---

## 🔄 문서 동기화 규칙

### 코드 변경 시 업데이트 필요 문서

| 변경 사항 | 업데이트 문서 |
|----------|-------------|
| 새 패키지 추가 | PROJECT_STRUCTURE.md, PROJECT_DOCUMENTATION.md |
| 새 라우트 추가 | PROJECT_STRUCTURE.md (섹션 2) |
| 새 컴포넌트 추가 | PROJECT_STRUCTURE.md (섹션 3) |
| 새 API 추가 | API_REFERENCE.md, PROJECT_STRUCTURE.md (섹션 4) |
| MQTT 토픽 변경 | API_mqtt-registration-payloads.md, API_REFERENCE.md |
| 기술 스택 변경 | TECH_STACK.md, PROJECT_STRUCTURE.md (섹션 7) |
| 성능 최적화 | TECH_bundle-optimization.md 또는 TECH_stl-rendering-performance.md |
| 서브 에이전트 추가/변경 | SUB_AGENTS.md, .claude/agents/ |

### 자동 업데이트 워크플로우

1. **코드 변경 완료**
2. **서브 에이전트 `docs-manager` 호출**
3. **관련 문서 자동 업데이트**
4. **CLAUDE.md 참조 리스트 확인**

---

## 💡 문서 활용 팁

### 빠른 검색

**프로젝트 구조 찾기**:
```bash
# 특정 컴포넌트 위치 찾기
grep -r "PrinterCard" PROJECT_STRUCTURE.md

# API 엔드포인트 찾기
grep -r "POST /api" API_REFERENCE.md
```

**서브 에이전트 선택**:
```bash
# 작업 유형별 에이전트 확인
cat SUB_AGENTS.md | grep "파일 변경 기준"
```

### 문서 네비게이션

- **시작**: README.md → PROJECT_DOCUMENTATION.md
- **개발**: CLAUDE.md → SUB_AGENTS.md → PROJECT_STRUCTURE.md
- **API**: API_REFERENCE.md → API_mqtt-registration-payloads.md
- **최적화**: TECH_bundle-optimization.md, TECH_stl-rendering-performance.md

---

## 📌 중요 사항

1. **개발 전 필독**: CLAUDE.md, SUB_AGENTS.md
2. **코드 변경 시**: 관련 문서 동시 업데이트
3. **새 기능 추가**: PROJECT_STRUCTURE.md 반드시 갱신
4. **API 변경**: API_REFERENCE.md 업데이트 필수
5. **서브 에이전트 활용**: 효율적인 분업 작업

---

**최종 업데이트**: 2024년 11월 16일
**문서 버전**: 2.0
**총 문서 수**: 13개
