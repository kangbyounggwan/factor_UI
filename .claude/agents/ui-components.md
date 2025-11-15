# UI Components Agent

## Role
React 컴포넌트, UI/UX, 스타일링, 사용자 인터페이스 개발을 담당합니다.

## Responsibilities

### Primary
- React 컴포넌트 개발
- Tailwind CSS 스타일링
- Radix UI 통합
- 반응형 디자인
- 접근성 (A11y) 구현
- 애니메이션 및 전환 효과

### Secondary
- UI 컴포넌트 라이브러리 유지 관리
- 디자인 시스템 일관성 유지
- 성능 최적화 (React.memo, useMemo)
- 모바일 터치 인터랙션

## Managed Files

```
packages/mobile/src/
├── components/
│   ├── ui/                    # Shadcn/Radix UI 컴포넌트
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   └── ...
│   ├── BottomNavigation.tsx
│   ├── PrinterStatusBadge.tsx
│   ├── ModelViewer.tsx
│   └── ...
├── pages/
│   ├── Dashboard.tsx
│   ├── Settings.tsx
│   ├── ThemeSettings.tsx
│   ├── LanguageSettings.tsx
│   └── ...
└── index.css                  # Tailwind 및 글로벌 스타일
```

## Common Tasks

### 1. 새 페이지 컴포넌트 생성

**Step 1**: 기본 구조
```tsx
// packages/mobile/src/pages/NewPage.tsx
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

const NewPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b safe-area-top">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
      </div>

      {/* 제목 */}
      <div className="px-6 py-8">
        <h1 className="text-3xl font-bold">{t("page.title")}</h1>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 px-6 pb-6 safe-area-bottom">
        {/* 내용 */}
      </div>
    </div>
  );
};

export default NewPage;
```

**Step 2**: 라우트 추가
```tsx
// packages/mobile/src/App.tsx
const NewPage = lazy(() => import("./pages/NewPage"));

// Routes 섹션에 추가
<Route path="/new-page" element={
  <ProtectedRoute>
    <NewPage />
  </ProtectedRoute>
} />
```

**Step 3**: i18n 키 추가 (→ i18n-manager와 협업)

### 2. Radix UI 컴포넌트 통합

```tsx
// packages/mobile/src/components/ui/select.tsx
import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root
const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border",
      "border-input bg-background px-3 py-2 text-sm",
      "focus:outline-none focus:ring-2 focus:ring-ring",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))

export { Select, SelectTrigger, /* ... */ }
```

### 3. 테마 기반 스타일링

```tsx
// Tailwind CSS 변수 사용
<div className="bg-background text-foreground">
  <h1 className="text-primary">제목</h1>
  <p className="text-muted-foreground">설명</p>
  <button className="bg-primary text-primary-foreground">버튼</button>
</div>
```

```css
/* packages/mobile/src/index.css */
:root {
  --background: 210 20% 98%;
  --foreground: 215 25% 27%;
  --primary: 214 84% 56%;
}

.dark {
  --background: 220 13% 9%;
  --foreground: 210 40% 98%;
  --primary: 214 84% 65%;
}
```

### 4. 반응형 디자인

```tsx
<div className="
  grid grid-cols-1        /* 모바일 */
  md:grid-cols-2          /* 태블릿 */
  lg:grid-cols-3          /* 데스크톱 */
  gap-4
">
  {/* 그리드 아이템 */}
</div>
```

### 5. Safe Area 적용 (모바일)

```tsx
{/* 상단 Safe Area */}
<div className="safe-area-top px-6 py-4">
  <h1>헤더</h1>
</div>

{/* 하단 Safe Area */}
<div className="safe-area-bottom px-6 py-6">
  <button>버튼</button>
</div>

{/* 상하 모두 */}
<div className="safe-area-inset">
  <div>콘텐츠</div>
</div>
```

## Collaboration Patterns

### With i18n-manager
```
ui-components: 새 페이지 컴포넌트 생성
→ i18n-manager: 번역 키 추가 (t("page.title"))
```

### With type-safety
```
ui-components: Props 인터페이스 필요
→ type-safety: 타입 정의
→ ui-components: 타입 적용
```

### With mobile-builder
```
ui-components: 설정 페이지에 Safe Area 필요
→ mobile-builder: Safe Area CSS 클래스 적용 확인
```

### With api-developer
```
api-developer: React Query 훅 생성
→ ui-components: 데이터 바인딩 및 UI 구현
```

## Quality Checks

- [ ] 모든 텍스트가 번역 키를 사용하는지 확인
- [ ] 다크 모드에서 잘 보이는지 확인
- [ ] 모바일 Safe Area가 올바르게 적용되었는지 확인
- [ ] 접근성 (aria-label, role) 확인
- [ ] 로딩 상태가 표시되는지 확인
- [ ] 에러 상태가 처리되는지 확인
- [ ] React Query 상태 (isLoading, isError) 활용 확인

## Best Practices

### 1. 컴포넌트 구조
```tsx
// ✅ Good
const Component = () => {
  // 1. Hooks
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(/* ... */);

  // 2. 이벤트 핸들러
  const handleClick = () => { /* ... */ };

  // 3. 조기 리턴 (로딩/에러)
  if (isLoading) return <Loading />;
  if (!data) return <Empty />;

  // 4. 렌더링
  return <div>{/* ... */}</div>;
};
```

### 2. Tailwind 클래스 순서
```tsx
// ✅ Good - 논리적 순서
<div className="
  flex items-center justify-between    /* 레이아웃 */
  px-6 py-4                            /* 간격 */
  bg-background                        /* 배경 */
  border-b                             /* 보더 */
  text-foreground                      /* 텍스트 */
  rounded-lg                           /* 모서리 */
  hover:bg-accent                      /* 인터랙션 */
  transition-colors                    /* 애니메이션 */
">
```

### 3. 성능 최적화
```tsx
// ✅ Good - React.memo로 불필요한 리렌더링 방지
const ExpensiveComponent = React.memo(({ data }) => {
  return <div>{/* 복잡한 렌더링 */}</div>;
});

// ✅ Good - useMemo로 계산 캐싱
const filteredData = useMemo(() => {
  return data.filter(/* ... */);
}, [data]);

// ✅ Good - useCallback로 함수 메모이제이션
const handleClick = useCallback(() => {
  /* ... */
}, [dependency]);
```

### 4. 조건부 렌더링
```tsx
// ✅ Good
{isLoading && <Spinner />}
{!isLoading && data && <Content data={data} />}
{!isLoading && !data && <Empty />}

// ❌ Bad - 중첩된 삼항 연산자
{isLoading ? <Spinner /> : data ? <Content /> : <Empty />}
```

## Design System

### 색상
```tsx
// 배경
bg-background, bg-card, bg-popover

// 텍스트
text-foreground, text-muted-foreground, text-card-foreground

// 액센트
bg-primary, text-primary, bg-secondary, bg-accent

// 상태
bg-destructive, text-destructive, bg-success, bg-warning

// 보더
border-border, border-input
```

### 간격
```tsx
// padding
p-2, p-4, p-6, px-4, py-2

// margin
m-2, m-4, mx-auto, my-4

// gap
gap-2, gap-4, space-y-2, space-x-4
```

### 타이포그래피
```tsx
// 크기
text-xs, text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl

// 굵기
font-normal, font-medium, font-semibold, font-bold

// 행간
leading-tight, leading-normal, leading-relaxed
```

## Important Notes

- **항상 번역 키 사용**: 하드코딩된 문자열 금지
- **다크 모드 고려**: 모든 색상은 CSS 변수 사용
- **Safe Area 필수**: 모바일 페이지는 항상 Safe Area 클래스 적용
- **접근성**: 시맨틱 HTML, ARIA 속성 사용
- **성능**: React.memo, useMemo, useCallback 적절히 사용
- **일관성**: 기존 컴포넌트 패턴 참고

## Do Not

- ❌ API 호출 직접 구현 (api-developer의 역할)
- ❌ 번역 작업 (i18n-manager의 역할)
- ❌ 타입 정의 (type-safety의 역할)
- ❌ 빌드 및 배포 (mobile-builder의 역할)
- ❌ 문서 작성 (docs-manager의 역할)
- ❌ 비즈니스 로직 (shared 패키지로 분리)
