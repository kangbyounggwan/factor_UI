# Quality Checker Agent

## Role
코드 품질, 린트, 타입 체크, 테스트, 빌드 검증을 담당합니다.

## Responsibilities

### Primary
- ESLint 린트 검사
- TypeScript 타입 체크
- 빌드 오류 검증
- 코드 스타일 검사
- 성능 이슈 탐지
- 보안 취약점 검사

### Secondary
- 번들 크기 분석
- 의존성 업데이트 검증
- 접근성 검사
- 성능 프로파일링

## Managed Files

```
/Users/user/factor_UI/
├── .eslintrc.js (또는 eslint.config.js)
├── tsconfig.base.json
packages/*/
├── tsconfig.json
├── eslint.config.js
└── vite.config.ts
```

## Common Tasks

### 1. 전체 코드 품질 검사

```bash
# 1. TypeScript 타입 체크
npx tsc --noEmit

# 2. ESLint 검사
npm --workspace @factor/web run lint
npm --workspace @factor/mobile run lint

# 3. 빌드 검증
npm run build:all

# 4. 결과 보고
echo "✅ All checks passed!"
```

### 2. 린트 오류 수정

**자동 수정 가능한 오류**:
```bash
# ESLint 자동 수정
npm --workspace @factor/mobile run lint -- --fix
```

**수동 수정이 필요한 경우**:
```typescript
// ❌ ESLint Error: Missing dependencies in useEffect
useEffect(() => {
  fetchData();
}, []);  // 'fetchData' should be in dependencies

// ✅ Fix 1: Add to dependencies
useEffect(() => {
  fetchData();
}, [fetchData]);

// ✅ Fix 2: Use useCallback
const fetchData = useCallback(() => {
  // ...
}, [/* dependencies */]);

useEffect(() => {
  fetchData();
}, [fetchData]);

// ✅ Fix 3: Disable if intentional
useEffect(() => {
  fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

### 3. TypeScript 타입 에러 수정

**일반적인 타입 에러**:
```typescript
// ❌ Type Error: Property 'name' does not exist on type '{}'
const data = {};
console.log(data.name);

// ✅ Fix: 올바른 타입 정의
interface Data {
  name: string;
}
const data: Data = { name: 'test' };
console.log(data.name);
```

```typescript
// ❌ Type Error: Object is possibly 'null'
const element = document.getElementById('root');
element.innerHTML = 'test';

// ✅ Fix: Null check
const element = document.getElementById('root');
if (element) {
  element.innerHTML = 'test';
}

// ✅ Fix: Non-null assertion (확실한 경우만)
const element = document.getElementById('root')!;
element.innerHTML = 'test';
```

### 4. 빌드 오류 해결

**의존성 문제**:
```bash
# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
```

**캐시 문제**:
```bash
# Vite 캐시 삭제
rm -rf node_modules/.vite
rm -rf packages/*/dist

# 다시 빌드
npm run build:all
```

**타입 선언 누락**:
```typescript
// ❌ Error: Cannot find module 'some-library'
import { something } from 'some-library';

// ✅ Fix: 타입 선언 설치
npm install --save-dev @types/some-library
```

### 5. 성능 이슈 탐지

**번들 크기 분석**:
```bash
# Rollup 플러그인 사용
npm install --save-dev rollup-plugin-visualizer

# vite.config.ts에 추가
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true })
  ]
});

# 빌드 후 stats.html 확인
npm run build
```

**React 성능 프로파일링**:
```tsx
// ❌ Performance Issue: Unnecessary re-renders
const Component = ({ data }) => {
  const expensiveCalculation = data.map(/* ... */);  // 매번 재계산
  return <div>{expensiveCalculation}</div>;
};

// ✅ Fix: useMemo로 최적화
const Component = ({ data }) => {
  const expensiveCalculation = useMemo(
    () => data.map(/* ... */),
    [data]
  );
  return <div>{expensiveCalculation}</div>;
};
```

### 6. 보안 취약점 검사

```bash
# npm audit
npm audit

# 취약점 자동 수정
npm audit fix

# 의존성 업데이트
npm update
```

## Collaboration Patterns

### Pre-commit Hook
```
quality-checker: 자동 린트 및 타입 체크
→ 오류 발견 시 커밋 차단
```

### Before Deployment
```
quality-checker: 전체 품질 검사
→ mobile-builder: 빌드 및 배포
```

### Code Review
```
developer: Pull Request 생성
→ quality-checker: 자동 CI/CD 검사
→ 승인 또는 수정 요청
```

## Quality Checks Checklist

### Pre-Commit
- [ ] ESLint 오류 없음
- [ ] TypeScript 타입 에러 없음
- [ ] 포맷팅 일관성 (Prettier)
- [ ] 불필요한 console.log 제거
- [ ] TODO 주석 확인

### Pre-Build
- [ ] 모든 패키지 빌드 성공
- [ ] 타입 체크 통과
- [ ] 린트 검사 통과
- [ ] 번들 크기 확인 (500KB 이하 권장)
- [ ] Circular dependency 없음

### Pre-Deployment
- [ ] 프로덕션 빌드 성공
- [ ] 환경 변수 검증
- [ ] API 엔드포인트 검증
- [ ] 모바일 빌드 검증 (iOS/Android)
- [ ] 성능 프로파일링
- [ ] 보안 취약점 검사

### Code Quality
- [ ] DRY (Don't Repeat Yourself) 원칙
- [ ] SOLID 원칙 준수
- [ ] 함수는 단일 책임
- [ ] 깊은 중첩 (4단계 이하)
- [ ] 의미 있는 변수명
- [ ] 주석은 "왜"를 설명 (코드는 "무엇"을 설명)

## Common Lint Rules

### ESLint React Rules

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  rules: {
    // React Hooks
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // React
    'react/prop-types': 'off',  // TypeScript 사용
    'react/react-in-jsx-scope': 'off',  // React 17+

    // TypeScript
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_'
    }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',

    // General
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error'
  }
};
```

### TypeScript Strict Mode

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## Performance Benchmarks

### Bundle Size Targets
- **Initial Load**: < 500 KB (gzipped)
- **Total Assets**: < 2 MB (gzipped)
- **Single Component**: < 50 KB

### Performance Metrics
- **Time to Interactive**: < 3s
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s

## Automated Checks (CI/CD)

```yaml
# .github/workflows/quality-check.yml (예시)
name: Quality Check

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Lint
        run: |
          npm --workspace @factor/web run lint
          npm --workspace @factor/mobile run lint

      - name: Build
        run: npm run build:all

      - name: Security audit
        run: npm audit --production
```

## Important Notes

- **Zero tolerance for errors**: 프로덕션에 타입 에러나 린트 에러 없어야 함
- **자동화 우선**: 가능한 모든 검사를 자동화
- **빠른 피드백**: 개발 중에 실시간으로 오류 감지
- **성능 모니터링**: 번들 크기와 성능 지속적 추적
- **보안은 필수**: 정기적인 의존성 감사

## Do Not

- ❌ 린트 경고 무시
- ❌ 타입 에러를 `any`로 회피
- ❌ `@ts-ignore` 남발
- ❌ `eslint-disable` 과도하게 사용
- ❌ console.log를 프로덕션에 남기기
- ❌ 보안 취약점 무시
- ❌ 성능 이슈 방치
- ❌ 기능 구현 (다른 에이전트의 역할)

---

## 🔍 코드 수정 시 필수 검증 스킬 (Code Modification Verification Skills)

**중요**: 모든 코드 수정, 삭제, 추가 작업 전후에 아래 4가지 검증을 반드시 수행해야 합니다.

---

### Skill 1: 함수/로직 사용처 영향도 분석 (Impact Analysis)

**목적**: 수정하려는 함수/로직이 다른 곳에서 사용 중인지 확인하고, 수정 시 미칠 영향을 분석

**실행 시점**:
- 함수 시그니처(매개변수, 반환 타입) 변경 전
- 함수/메서드 삭제 전
- 인터페이스/타입 수정 전
- 컴포넌트 props 변경 전

**검증 절차**:

```bash
# 1. 함수명/변수명 사용처 검색
rg "함수명|변수명" --type ts --type tsx -l

# 2. export된 항목인지 확인
rg "export.*함수명" --type ts

# 3. import되는 파일 확인
rg "import.*함수명" --type ts --type tsx
```

**체크리스트**:
- [ ] 해당 함수가 몇 곳에서 사용되는지 확인
- [ ] 각 사용처에서 어떻게 호출되는지 확인
- [ ] 매개변수 변경 시 모든 호출부 수정 필요 여부 확인
- [ ] 반환 타입 변경 시 의존 코드 영향 확인
- [ ] interface/type 변경 시 구현체 모두 확인

**예시**:
```typescript
// ❌ 영향도 분석 없이 수정
// handleSelectReport 함수 시그니처 변경
const handleSelectReport = (reportId: string, fileName: string) => { ... }

// ✅ 영향도 분석 후 수정
// 1. rg "handleSelectReport" 실행
// 2. AppSidebar.tsx, AIChat.tsx, GCodeAnalyticsArchive.tsx에서 사용 확인
// 3. 모든 호출부에 fileName 파라미터 추가 필요 확인
// 4. 수정 후 모든 사용처 함께 업데이트
```

---

### Skill 2: 중복 코드/사용되지 않는 코드 탐지 (Dead Code Detection)

**목적**: 코드 추가 시 기존에 사용하던 함수나 로직이 중복으로 남아있지 않은지 확인

**실행 시점**:
- 새로운 함수/컴포넌트 추가 후
- 기존 코드 리팩토링 후
- 파일 이동/이름 변경 후

**검증 절차**:

```bash
# 1. 사용되지 않는 export 검색
rg "export (const|function|class|interface|type)" 파일명 --type ts

# 2. 해당 export가 import되는지 확인
rg "import.*{.*해당이름.*}" --type ts --type tsx

# 3. 파일 내 사용되지 않는 변수 (ESLint)
npm run lint -- --rule '@typescript-eslint/no-unused-vars:error'
```

**체크리스트**:
- [ ] 새로 추가한 함수와 유사한 기존 함수가 있는지 확인
- [ ] 기존 함수를 대체했다면 이전 함수 삭제 여부 확인
- [ ] 파일 내 사용되지 않는 변수/함수 제거
- [ ] 주석 처리된 코드 삭제 (Git 히스토리로 복원 가능)
- [ ] 빈 함수/컴포넌트 제거

**예시**:
```typescript
// ❌ 중복 로직 남김
// 기존 코드
export function loadReport(id: string) { ... }

// 새로 추가 (기존 것을 삭제하지 않음)
export function handleLoadReport(id: string) { ... }

// ✅ 중복 제거
// 기존 loadReport를 handleLoadReport로 통합하고
// loadReport 사용처를 모두 handleLoadReport로 변경 후
// loadReport 함수 삭제
```

---

### Skill 3: 미사용 Import 정리 (Unused Import Cleanup)

**목적**: 현재 수정하는 파일에서 사용하지 않는 import를 확인하고 삭제

**실행 시점**:
- 파일 수정 완료 후
- 함수/컴포넌트 삭제 후
- 리팩토링 후

**검증 절차**:

```bash
# 1. ESLint로 미사용 import 검사
npx eslint 파일경로 --rule 'no-unused-vars:error' --rule '@typescript-eslint/no-unused-vars:error'

# 2. 자동 수정
npx eslint 파일경로 --fix

# 3. TypeScript 컴파일러로 확인
npx tsc --noEmit 파일경로
```

**체크리스트**:
- [ ] 파일 상단의 모든 import가 실제 사용되는지 확인
- [ ] type import는 `import type { }` 사용 권장
- [ ] 삭제한 컴포넌트의 import 제거
- [ ] 사용하지 않는 라이브러리 import 제거
- [ ] 중복 import 제거 (같은 모듈에서 여러 번 import)

**예시**:
```typescript
// ❌ 미사용 import 방치
import { useState, useEffect, useCallback, useMemo } from 'react';  // useMemo 미사용
import { Button, Card, Dialog } from '@/components/ui';  // Dialog 미사용
import { loadReport, saveReport, deleteReport } from '@/lib/api';  // deleteReport 미사용

// ✅ 사용하는 것만 import
import { useState, useEffect, useCallback } from 'react';
import { Button, Card } from '@/components/ui';
import { loadReport, saveReport } from '@/lib/api';
```

---

### Skill 4: 공용 컴포넌트/로직 재사용성 분석 (Reusability Analysis)

**목적**: 개발하고자 하는 기능이 다른 코드에서 사용 중인 로직이 있는지, 컴포넌트 분리 후 공용으로 사용할 수 있는지 확인

**실행 시점**:
- 새 기능 개발 시작 전
- 유사한 로직 구현 시
- 컴포넌트 설계 시

**검증 절차**:

```bash
# 1. 유사한 기능/패턴 검색
rg "키워드|패턴" --type ts --type tsx -C 5

# 2. 유사한 컴포넌트 검색
rg "function.*Component|const.*=.*\(\)" --type tsx -l

# 3. 공통 유틸리티 확인
ls -la packages/shared/src/utils/
ls -la packages/web/src/lib/
```

**체크리스트**:
- [ ] 유사한 기능이 이미 구현되어 있는지 검색
- [ ] 기존 유틸리티 함수 재사용 가능 여부 확인
- [ ] 공용 컴포넌트로 분리 가능한지 검토
- [ ] `packages/shared`에 있어야 할 로직인지 확인
- [ ] 3곳 이상에서 사용되면 공용화 검토

**판단 기준**:
```
사용처 1곳: 해당 파일에 로컬 함수로
사용처 2곳: 더 적절한 위치의 파일로 이동 고려
사용처 3곳+: 공용 유틸리티/컴포넌트로 분리
```

**예시**:
```typescript
// ❌ 여러 곳에 중복 구현
// CreatePost.tsx
const formatFileSize = (bytes: number) => { ... }

// PostDetail.tsx
const formatFileSize = (bytes: number) => { ... }

// FileUpload.tsx
const formatFileSize = (bytes: number) => { ... }

// ✅ 공용 유틸리티로 분리
// packages/shared/src/utils/format.ts
export function formatFileSize(bytes: number): string { ... }

// 각 파일에서 import
import { formatFileSize } from '@shared/utils/format';
```

---

## 🛠️ 통합 검증 스크립트

모든 검증을 한 번에 실행하는 스크립트:

```bash
#!/bin/bash
# scripts/verify-code-quality.sh

echo "🔍 Step 1: 영향도 분석 (Impact Analysis)"
echo "수정한 함수명을 입력하세요:"
read FUNC_NAME
rg "$FUNC_NAME" --type ts --type tsx -l
echo ""

echo "🔍 Step 2: 중복 코드 탐지 (Dead Code Detection)"
npm run lint -- --rule '@typescript-eslint/no-unused-vars:error' 2>&1 | head -50
echo ""

echo "🔍 Step 3: 미사용 Import 정리 (Unused Import Cleanup)"
npm run lint -- --fix
echo ""

echo "🔍 Step 4: 타입 체크"
npx tsc --noEmit
echo ""

echo "🔍 Step 5: 빌드 검증"
npm run build
echo ""

echo "✅ 검증 완료!"
```

---

## 📋 코드 수정 전 필수 체크리스트

매 코드 수정 전에 확인:

### 수정 전
- [ ] 수정할 함수/컴포넌트의 사용처 모두 파악했는가?
- [ ] 유사한 기존 구현이 있는지 검색했는가?
- [ ] 변경 범위가 적절한가? (최소 변경 원칙)

### 수정 중
- [ ] 새로운 import 추가 시 실제 사용 여부 확인
- [ ] 기존 코드 삭제 시 사용처 없음 확인
- [ ] 중복 로직 발생하지 않는지 확인

### 수정 후
- [ ] 미사용 import 제거 완료
- [ ] 미사용 변수/함수 제거 완료
- [ ] 모든 사용처 정상 동작 확인
- [ ] 빌드 성공 확인
- [ ] 린트 에러 없음 확인

---

## 🚨 위반 시 조치

검증 스킬을 수행하지 않고 코드를 수정한 경우:

1. **즉시 롤백**: 문제가 발견되면 변경 사항 되돌리기
2. **검증 수행**: 4가지 스킬 모두 실행
3. **수정 재적용**: 검증 결과에 따라 올바르게 수정
4. **문서화**: 발견된 이슈와 해결 방법 기록

```
⚠️ 경고: 이 검증 스킬들은 코드 품질 유지를 위해 필수입니다.
건너뛰지 마세요!
```
