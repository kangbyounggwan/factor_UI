# Dev Finalize Agent (개발 마무리 파이프라인)

## Role
개발 완료 후 코드 품질 검증, 마이그레이션 정리, 문서 업데이트를 자동으로 수행하는 통합 파이프라인입니다.

## 트리거
```
@dev-finalize
```
또는
```
개발 마무리
```

---

## 파이프라인 4단계

### Step 1: Quality Check (품질 검사)

**목적**: Git에서 수정된 파일의 부모 페이지 기준으로 품질 검사 수행

**절차**:

```bash
# 1. 수정된 파일 목록 확인
git status --porcelain | grep -E "^\s*[MAD]" | awk '{print $2}'

# 또는 최근 커밋 이후 변경 파일
git diff --name-only HEAD~1

# 2. 수정된 파일에서 부모 페이지 추출
# pages/*.tsx 파일이 있으면 해당 페이지
# components/*.tsx 파일이면 해당 컴포넌트를 사용하는 페이지 찾기
```

**품질 검사 항목** (quality-checker.md 기준):

```bash
# 1. TypeScript 타입 체크
npx tsc --noEmit

# 2. ESLint 검사
npm --workspace @factor/web run lint
npm --workspace @factor/mobile run lint

# 3. 빌드 검증
npm run build:all

# 4. 영향도 분석 (수정된 함수 사용처 확인)
rg "함수명" --type ts --type tsx -l
```

**체크리스트**:
- [ ] TypeScript 타입 에러 0개
- [ ] ESLint 에러 0개
- [ ] 빌드 성공
- [ ] 미사용 import 제거
- [ ] 미사용 변수/함수 제거

---

### Step 2: Migration Cleanup (마이그레이션 정리)

**목적**: 중복 마이그레이션 삭제 및 최신화 확인

**위치**: `packages/shared/supabase/migrations/`

**검사 항목**:

```bash
# 1. 마이그레이션 파일 목록 확인
ls -la packages/shared/supabase/migrations/

# 2. 중복 검사 (동일 타임스탬프)
ls packages/shared/supabase/migrations/ | cut -d'_' -f1 | sort | uniq -d

# 3. 최신 스키마 참조 확인
cat packages/shared/supabase/migrations/00000000000000_schema_reference.sql | head -50
```

**정리 기준**:

| 상태 | 조치 |
|------|------|
| schema_reference보다 오래된 스냅샷 | 삭제 |
| 생성 후 drop된 테이블 마이그레이션 | 삭제 |
| 주석 처리된 가이드 문서 | 삭제 |
| packages/mobile 중복 | packages/shared로 통합 후 삭제 |

**체크리스트**:
- [ ] 중복 마이그레이션 없음
- [ ] 모든 마이그레이션이 packages/shared에 통합됨
- [ ] schema_reference.sql이 최신 상태

---

### Step 3: MD File Cleanup (문서 정리)

**목적**: 완료된 계획 문서 및 불필요한 .md 파일 삭제

**검사 대상**:

```bash
# 프로젝트 루트의 모든 .md 파일 확인
find . -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*"
```

**삭제 기준**:

| 파일 유형 | 조치 |
|-----------|------|
| `PLAN_*.md` (완료된 계획) | 삭제 |
| `*_COMPLETE.md` (완료 기록) | 삭제 |
| `*_REFACTORING_PLAN.md` (완료된 리팩토링) | 삭제 |
| `*_OPTIMIZATION.md` (완료된 최적화) | 삭제 |
| 중복 문서 (다른 .md와 내용 동일) | 삭제 |
| 오래된 버전 문서 (V1 → V2 존재 시 V1) | 삭제 |

**보존 기준**:

| 파일 유형 | 조치 |
|-----------|------|
| README.md | 보존 |
| CLAUDE.md | 보존 |
| PROJECT_DOCUMENTATION.md | 보존 |
| API_REFERENCE.md | 보존 |
| TECH_STACK.md | 보존 |
| docs/page/*.md (페이지 문서) | 보존 |
| .claude/agents/*.md (에이전트 문서) | 보존 |

**체크리스트**:
- [ ] 완료된 PLAN 문서 삭제
- [ ] 중복 문서 삭제
- [ ] 오래된 버전 문서 삭제
- [ ] 깨진 링크 수정

---

### Step 4: Docs Update (문서 업데이트)

**목적**: 수정된 함수의 부모 페이지 기준으로 docs 업데이트

**절차**:

```bash
# 1. 수정된 파일에서 페이지 식별
git diff --name-only HEAD~1 | grep -E "pages/.*\.tsx$"

# 2. 해당 페이지의 docs 파일 확인
ls docs/page/

# 3. 페이지 문서 업데이트 필요 여부 확인
```

**업데이트 대상**:

| 변경 유형 | 업데이트 내용 |
|-----------|---------------|
| 새 API 함수 추가 | API 함수 목록 업데이트 |
| 컴포넌트 수정 | 컴포넌트 구조 업데이트 |
| 타입 변경 | 타입 정의 섹션 업데이트 |
| 새 기능 추가 | 기능 설명 추가 |
| 버그 수정 | 알려진 이슈에서 제거 |

**docs-manager.md 기준 체크리스트**:
- [ ] 버전 정보 업데이트
- [ ] API 문서 최신화
- [ ] 변경 이력 추가
- [ ] 코드 예제 검증

---

## 실행 스크립트

### 전체 파이프라인 실행

```bash
#!/bin/bash
# scripts/dev-finalize.sh

echo "=========================================="
echo "  개발 마무리 파이프라인 시작"
echo "=========================================="

# Step 1: Quality Check
echo ""
echo "📋 Step 1/4: Quality Check"
echo "------------------------------------------"

echo "1.1 수정된 파일 확인..."
git status --porcelain

echo ""
echo "1.2 TypeScript 타입 체크..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
    echo "❌ TypeScript 에러 발견. 수정 후 다시 실행하세요."
    exit 1
fi
echo "✅ TypeScript 타입 체크 통과"

echo ""
echo "1.3 ESLint 검사..."
npm --workspace @factor/web run lint
if [ $? -ne 0 ]; then
    echo "❌ ESLint 에러 발견. 수정 후 다시 실행하세요."
    exit 1
fi
echo "✅ ESLint 검사 통과"

echo ""
echo "1.4 빌드 검증..."
npm run build:all
if [ $? -ne 0 ]; then
    echo "❌ 빌드 실패. 수정 후 다시 실행하세요."
    exit 1
fi
echo "✅ 빌드 성공"

# Step 2: Migration Cleanup
echo ""
echo "📋 Step 2/4: Migration Cleanup"
echo "------------------------------------------"

echo "2.1 마이그레이션 파일 수..."
MIGRATION_COUNT=$(ls packages/shared/supabase/migrations/*.sql 2>/dev/null | wc -l)
echo "   총 $MIGRATION_COUNT 개 마이그레이션 파일"

echo ""
echo "2.2 중복 타임스탬프 검사..."
DUPLICATES=$(ls packages/shared/supabase/migrations/ | cut -d'_' -f1 | sort | uniq -d)
if [ -n "$DUPLICATES" ]; then
    echo "⚠️  동일 타임스탬프 마이그레이션 발견:"
    echo "$DUPLICATES"
else
    echo "✅ 중복 타임스탬프 없음"
fi

# Step 3: MD File Cleanup
echo ""
echo "📋 Step 3/4: MD File Cleanup"
echo "------------------------------------------"

echo "3.1 PLAN 문서 검색..."
PLAN_FILES=$(find . -name "PLAN_*.md" -not -path "./node_modules/*" 2>/dev/null)
if [ -n "$PLAN_FILES" ]; then
    echo "⚠️  완료된 PLAN 문서 발견:"
    echo "$PLAN_FILES"
else
    echo "✅ PLAN 문서 없음"
fi

echo ""
echo "3.2 완료 기록 문서 검색..."
COMPLETE_FILES=$(find . -name "*_COMPLETE.md" -not -path "./node_modules/*" 2>/dev/null)
if [ -n "$COMPLETE_FILES" ]; then
    echo "⚠️  완료 기록 문서 발견:"
    echo "$COMPLETE_FILES"
else
    echo "✅ 완료 기록 문서 없음"
fi

# Step 4: Docs Update Check
echo ""
echo "📋 Step 4/4: Docs Update Check"
echo "------------------------------------------"

echo "4.1 수정된 페이지 확인..."
MODIFIED_PAGES=$(git diff --name-only HEAD~1 2>/dev/null | grep -E "pages/.*\.tsx$" || echo "")
if [ -n "$MODIFIED_PAGES" ]; then
    echo "   수정된 페이지:"
    echo "$MODIFIED_PAGES"

    echo ""
    echo "4.2 해당 페이지 문서 확인..."
    for page in $MODIFIED_PAGES; do
        PAGE_NAME=$(basename "$page" .tsx | tr '[:upper:]' '[:lower:]')
        DOC_FILE="docs/page/${PAGE_NAME}.md"
        if [ -f "$DOC_FILE" ]; then
            echo "   📄 $DOC_FILE 업데이트 필요"
        else
            echo "   ⚠️  $DOC_FILE 문서 없음 - 생성 필요"
        fi
    done
else
    echo "✅ 수정된 페이지 없음"
fi

echo ""
echo "=========================================="
echo "  개발 마무리 파이프라인 완료"
echo "=========================================="
```

---

## 수동 실행 가이드

### Claude에서 실행

```
@dev-finalize 개발 마무리 파이프라인 실행해줘
```

### 단계별 실행

```
# Step 1만 실행
@quality-checker 수정된 파일 품질 검사

# Step 2만 실행
마이그레이션 중복 정리

# Step 3만 실행
.md 파일 정리 (완료된 계획 삭제)

# Step 4만 실행
@docs-manager 수정된 페이지 문서 업데이트
```

---

## 파이프라인 체크리스트

### 실행 전 확인
- [ ] 모든 코드 변경 완료
- [ ] 기능 테스트 완료
- [ ] 커밋 준비 완료

### Step 1: Quality Check
- [ ] TypeScript 에러 0개
- [ ] ESLint 에러 0개
- [ ] 빌드 성공
- [ ] 미사용 코드 제거

### Step 2: Migration Cleanup
- [ ] 중복 마이그레이션 삭제
- [ ] packages/shared 통합 완료
- [ ] schema_reference 최신화

### Step 3: MD Cleanup
- [ ] 완료된 PLAN 문서 삭제
- [ ] 중복 문서 삭제
- [ ] 깨진 링크 수정

### Step 4: Docs Update
- [ ] 수정된 페이지 문서 업데이트
- [ ] API 문서 최신화
- [ ] 버전 정보 업데이트

### 실행 후 확인
- [ ] git status 깨끗함
- [ ] 모든 테스트 통과
- [ ] 커밋 메시지 작성

---

## 관련 에이전트

| 에이전트 | 역할 | 파이프라인 단계 |
|----------|------|----------------|
| quality-checker | 코드 품질 검사 | Step 1 |
| docs-manager | 문서 관리 | Step 4 |
| page-documenter | 페이지 문서화 | Step 4 (신규 페이지) |

---

## 주의사항

### Do
- ✅ 모든 코드 변경 후 실행
- ✅ 커밋 전 반드시 실행
- ✅ 에러 발생 시 즉시 수정
- ✅ 문서 업데이트 확인

### Don't
- ❌ 에러 무시하고 진행
- ❌ 문서 업데이트 생략
- ❌ 마이그레이션 정리 생략
- ❌ 품질 검사 건너뛰기

---

## 버전

- **Version**: 1.0.0
- **Created**: 2026-01-12
- **Compatible with**: FACTOR UI v1.2.0+
