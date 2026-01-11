# 페이지 문서화 파이프라인

이 문서는 Factor UI의 각 페이지/기능을 체계적으로 문서화하기 위한 가이드라인입니다.
AI 에이전트가 일관된 형식으로 문서를 생성할 수 있도록 표준 구조와 조사 방법을 정의합니다.

---

## 1. 문서화 대상 페이지 목록

| 페이지 | 경로 | 문서 파일 | 상태 |
|--------|------|-----------|------|
| 커뮤니티 | `/community/*` | `community.md` | ✅ 완료 |
| 대시보드 | `/dashboard` | `dashboard.md` | ⏳ 대기 |
| 프린터 관리 | `/printers/*` | `printers.md` | ⏳ 대기 |
| AI 분석 | `/ai/*` | `ai-analysis.md` | ⏳ 대기 |
| 설정 | `/settings/*` | `settings.md` | ⏳ 대기 |
| 인증 | `/login`, `/signup` | `auth.md` | ⏳ 대기 |
| 프로필 | `/profile/*` | `profile.md` | ⏳ 대기 |

---

## 2. 표준 문서 구조 (15개 섹션)

모든 페이지 문서는 다음 구조를 따릅니다:

```markdown
# [페이지명] 시스템 문서

## 목차
1. 개요
2. 프로젝트 구조
3. 라우팅 구조
4. 데이터베이스 스키마
5. API 서비스 함수
6. 컴포넌트 계층 구조
7. 주요 컴포넌트 상세
8. 페이지 컴포넌트
9. 상태 관리
10. 데이터 흐름
11. 스타일링 및 UI
12. 에러 처리
13. 보안 고려사항
14. 백엔드 로직 상세
15. 개선 가능 영역

## 1. 개요
- 기능 설명
- 주요 특징
- 사용 기술

## 2. 프로젝트 구조
- 관련 파일/폴더 트리
- 각 파일의 역할

## 3. 라우팅 구조
- URL 패턴
- 라우트 컴포넌트 매핑

## 4. 데이터베이스 스키마
- 테이블 구조
- 컬럼 정의
- 관계 (FK)
- RLS 정책

## 5. API 서비스 함수
- 함수 시그니처
- 매개변수
- 반환값
- Supabase 쿼리 패턴

## 6. 컴포넌트 계층 구조
- 컴포넌트 트리 (ASCII)
- 의존 관계

## 7. 주요 컴포넌트 상세
- Props 인터페이스
- 핵심 로직
- 사용 예시

## 8. 페이지 컴포넌트
- 각 페이지별 상세
- 데이터 로딩 로직
- 상태 관리

## 9. 상태 관리
- useState 사용
- Context 사용
- 전역 상태

## 10. 데이터 흐름
- 플로우차트
- 시퀀스 다이어그램

## 11. 스타일링 및 UI
- Tailwind 클래스
- 반응형 디자인
- 다크 모드

## 12. 에러 처리
- try-catch 패턴
- 에러 메시지
- 폴백 UI

## 13. 보안 고려사항
- RLS 정책
- 입력 검증
- XSS 방지

## 14. 백엔드 로직 상세
- AuthContext 사용
- CRUD 로직
- Storage 처리

## 15. 개선 가능 영역
- 성능 최적화
- 기능 추가
- 리팩토링
```

---

## 3. 조사 파이프라인

### 3.1 1단계: 파일 구조 파악

```
조사 대상:
1. packages/web/src/pages/[페이지명]*.tsx
2. packages/web/src/components/[관련폴더]/
3. packages/shared/src/services/supabaseService/[서비스].ts
4. packages/shared/src/types/[타입].ts
```

**사용할 명령:**
```bash
# 페이지 파일 찾기
Glob: packages/web/src/pages/*[페이지키워드]*.tsx

# 컴포넌트 폴더 찾기
Glob: packages/web/src/components/[관련폴더]/**/*.tsx

# 서비스 파일 찾기
Glob: packages/shared/src/services/**/*[키워드]*.ts
```

### 3.2 2단계: 데이터베이스 스키마 조사

```
조사 대상:
1. Supabase 마이그레이션 파일
2. 타입 정의 파일
3. 서비스 파일의 테이블 참조
```

**사용할 명령:**
```bash
# 마이그레이션 파일
Glob: supabase/migrations/*[테이블명]*.sql

# 타입 정의에서 테이블 구조 추출
Grep: "interface.*[테이블명]" in packages/shared/src/types/
```

### 3.3 3단계: API 서비스 분석

```
조사 대상:
1. 서비스 함수 시그니처
2. Supabase 쿼리 패턴
3. 에러 처리 로직
```

**분석 포인트:**
- export된 함수 목록
- 매개변수 타입
- 반환 타입
- .from() 쿼리 대상 테이블
- .select() 컬럼 목록
- .insert()/.update()/.delete() 패턴

### 3.4 4단계: 컴포넌트 분석

```
조사 대상:
1. Props 인터페이스
2. useState/useEffect 훅
3. 이벤트 핸들러
4. 자식 컴포넌트 import
```

**분석 포인트:**
- interface *Props 정의
- const [state, setState] 패턴
- async function handler 패턴
- <ComponentName 사용처

### 3.5 5단계: 데이터 흐름 추적

```
추적 순서:
1. 페이지 컴포넌트 → 데이터 로딩 (useEffect)
2. 서비스 함수 호출 → Supabase 쿼리
3. 응답 데이터 → 상태 저장
4. 상태 → Props 전달 → 자식 컴포넌트
5. 사용자 액션 → 핸들러 → 서비스 호출 → 상태 업데이트
```

---

## 4. 에이전트 프롬프트 템플릿

### 4.1 초기 조사 프롬프트

```
[페이지명] 페이지 문서화를 위해 다음을 조사해주세요:

1. 관련 파일 구조:
   - packages/web/src/pages/ 에서 [키워드] 관련 파일
   - packages/web/src/components/ 에서 관련 컴포넌트 폴더
   - packages/shared/src/services/ 에서 관련 서비스

2. 데이터베이스:
   - 사용하는 테이블 목록
   - 테이블 간 관계

3. 주요 기능:
   - CRUD 작업
   - 특수 기능
```

### 4.2 컴포넌트 분석 프롬프트

```
[컴포넌트명] 컴포넌트를 분석해주세요:

1. Props 인터페이스 전체
2. 내부 상태 (useState)
3. 부수 효과 (useEffect)
4. 이벤트 핸들러
5. 렌더링 로직
6. 자식 컴포넌트 사용
```

### 4.3 서비스 분석 프롬프트

```
[서비스파일].ts 를 분석해주세요:

1. export된 모든 함수 목록
2. 각 함수의 시그니처 (매개변수, 반환값)
3. 사용하는 Supabase 테이블
4. 쿼리 패턴 (.select, .insert 등)
5. 에러 처리 방식
```

### 4.4 데이터 흐름 분석 프롬프트

```
[기능명]의 데이터 흐름을 추적해주세요:

1. 시작점: 사용자 액션 또는 페이지 로드
2. 서비스 함수 호출
3. DB 쿼리 실행
4. 응답 처리
5. 상태 업데이트
6. UI 반영
```

---

## 5. 문서 작성 가이드라인

### 5.1 코드 블록 규칙

```typescript
// 타입 정의는 전체 포함
interface PostCardProps {
  post: CommunityPost;
  onLike: (postId: string) => void;
  // ... 모든 props
}

// 함수 시그니처는 완전히 기재
export async function createPost(
  input: CreatePostInput
): Promise<CommunityPost>
```

### 5.2 다이어그램 규칙

```
ASCII 아트 사용:
┌─────────────┐
│  Component  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Service   │
└─────────────┘

화살표: →, ←, ↑, ↓, ↔
박스: ┌ ┐ └ ┘ │ ─ ┬ ┴ ├ ┤ ┼
```

### 5.3 테이블 규칙

```markdown
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | uuid | PK |
| name | text | 이름 |
```

### 5.4 번호 매기기 규칙

```
대분류: 1, 2, 3
중분류: 1.1, 1.2, 1.3
소분류: 1.1.1, 1.1.2
```

---

## 6. 품질 체크리스트

문서 완성 후 다음을 확인:

### 6.1 완성도 체크

- [ ] 15개 섹션 모두 작성
- [ ] 모든 컴포넌트 문서화
- [ ] 모든 서비스 함수 문서화
- [ ] DB 스키마 완전히 기재
- [ ] 데이터 흐름 다이어그램 포함

### 6.2 정확성 체크

- [ ] 타입 정의가 실제 코드와 일치
- [ ] 함수 시그니처가 정확
- [ ] 테이블 컬럼이 실제와 일치
- [ ] import 경로가 정확

### 6.3 가독성 체크

- [ ] 목차가 링크로 연결
- [ ] 코드 블록에 언어 지정
- [ ] 일관된 용어 사용
- [ ] 한글/영어 혼용 최소화

---

## 7. 예시: 새 페이지 문서화 워크플로우

### 대시보드 페이지 문서화 예시

**Step 1: 파일 조사**
```
Glob: packages/web/src/pages/Dashboard*.tsx
Glob: packages/web/src/components/dashboard/**/*.tsx
Grep: "dashboard" in packages/shared/src/services/
```

**Step 2: 메인 페이지 읽기**
```
Read: packages/web/src/pages/Dashboard.tsx
- import 분석
- 컴포넌트 구조 파악
- 데이터 로딩 로직 확인
```

**Step 3: 서비스 분석**
```
Read: packages/shared/src/services/supabaseService/dashboard.ts
- 함수 목록 추출
- 쿼리 패턴 분석
```

**Step 4: 컴포넌트 분석**
```
각 컴포넌트 파일 읽기:
- Props 인터페이스 추출
- 상태 관리 패턴 파악
```

**Step 5: 문서 작성**
```
Write: docs/page/dashboard.md
- 15개 섹션 구조로 작성
- 코드 예시 포함
- 다이어그램 추가
```

---

## 8. 자동화 스크립트 (향후 구현)

```typescript
// docs/scripts/generate-page-doc.ts
interface PageDocConfig {
  pageName: string;
  pageDir: string;
  componentDir: string;
  serviceFile: string;
  outputFile: string;
}

async function generatePageDoc(config: PageDocConfig) {
  // 1. 파일 수집
  // 2. AST 분석
  // 3. 템플릿 채우기
  // 4. 마크다운 생성
}
```

---

## 9. 참고 자료

- [community.md](./community.md) - 완성된 문서 예시
- Supabase 공식 문서: https://supabase.com/docs
- React 공식 문서: https://react.dev
- TypeScript 공식 문서: https://www.typescriptlang.org/docs

---

## 버전 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2025-01-12 | 초기 버전 생성 |
