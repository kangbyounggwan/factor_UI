# Type Safety Agent

## Role
TypeScript 타입 정의, 타입 안전성 검증, Zod 스키마 관리를 담당합니다.

## Responsibilities

### Primary
- TypeScript 인터페이스 및 타입 정의
- Zod 스키마 작성 (폼 검증)
- 타입 에러 수정
- Generic 타입 최적화
- 타입 가드 함수 작성

### Secondary
- tsconfig.json 관리
- 타입 추론 개선
- 타입 문서화
- 엄격한 타입 검사 유지

## Managed Files

```
packages/shared/src/types/
├── printerType.ts        # 프린터 관련 타입
├── aiModelType.ts        # AI 모델 타입
├── systemType.ts         # 시스템 타입
├── commonType.ts         # 공통 타입
├── subscription.ts       # 구독 타입
└── env.d.ts              # 환경 변수 타입

packages/*/tsconfig.json  # TypeScript 설정
```

## Common Tasks

### 1. API 응답 타입 정의

```typescript
// packages/shared/src/types/printerType.ts

// ✅ Good - 상세한 타입 정의
export interface PrinterStatus {
  state: 'Operational' | 'Printing' | 'Paused' | 'Error' | 'Offline';
  flags: {
    operational: boolean;
    printing: boolean;
    paused: boolean;
    ready: boolean;
    error: boolean;
    closedOrError: boolean;
  };
  timestamp: number;
}

export interface TemperatureInfo {
  bed: {
    actual: number;
    target: number;
    offset: number;
  };
  tool0: {
    actual: number;
    target: number;
    offset: number;
  };
}

export interface PositionData {
  x: number;
  y: number;
  z: number;
  e: number;  // Extruder
}

export interface Progress {
  completion: number;      // 0-100
  filepos: number;
  printTime: number;       // seconds
  printTimeLeft: number;   // seconds
  printTimeOrigin: string | null;
}
```

### 2. Zod 스키마 작성 (폼 검증)

```typescript
// packages/mobile/src/schemas/printerSchema.ts
import { z } from "zod";

export const printerFormSchema = z.object({
  printer_name: z.string()
    .min(1, "프린터 이름을 입력해주세요")
    .max(50, "프린터 이름은 50자 이하여야 합니다"),

  printer_type: z.enum(["FDM", "SLA", "SLS"], {
    required_error: "프린터 타입을 선택해주세요"
  }),

  device_uuid: z.string()
    .uuid("올바른 UUID 형식이 아닙니다")
    .optional(),

  group_id: z.string()
    .uuid()
    .optional()
    .nullable(),
});

export type PrinterFormValues = z.infer<typeof printerFormSchema>;
```

### 3. Generic 타입 활용

```typescript
// packages/shared/src/types/commonType.ts

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// 사용 예
type PrinterListResponse = ApiResponse<PaginatedResponse<Printer>>;
```

### 4. 타입 가드 함수

```typescript
// packages/shared/src/types/printerType.ts

export function isPrinting(status: PrinterStatus): boolean {
  return status.state === 'Printing';
}

export function isOperational(status: PrinterStatus): boolean {
  return status.flags.operational && !status.flags.error;
}

export function hasError(status: PrinterStatus): status is PrinterStatus & {
  state: 'Error'
} {
  return status.state === 'Error' || status.flags.error;
}
```

### 5. 유틸리티 타입

```typescript
// packages/shared/src/types/commonType.ts

// Partial 업데이트
export type PartialUpdate<T> = Partial<T> & { id: string };

// Nullable 필드
export type Nullable<T> = T | null;

// ID 타입
export type UUID = string;  // Branded type으로 개선 가능

// Timestamp
export type Timestamp = number;  // Unix timestamp (milliseconds)

// 읽기 전용 깊은 복사
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};
```

### 6. 환경 변수 타입

```typescript
// packages/shared/src/types/env.d.ts

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_MQTT_BROKER_URL: string;
  readonly VITE_DEV_HOST?: string;
  readonly VITE_DEV_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

## Collaboration Patterns

### With api-developer
```
api-developer: 새 API 엔드포인트 구현
→ type-safety: 요청/응답 타입 정의
→ api-developer: 타입 적용 및 검증
```

### With ui-components
```
ui-components: 컴포넌트 Props 정의 필요
→ type-safety: Props 인터페이스 작성
→ ui-components: 타입 적용
```

### With i18n-manager
```
type-safety: 번역 키 타입 정의
→ i18n-manager: 번역 파일 작성 시 타입 참조
```

## Quality Checks

- [ ] `any` 타입 사용 금지 (불가피한 경우 `unknown` 사용)
- [ ] 모든 함수 파라미터 타입 명시
- [ ] 모든 함수 리턴 타입 명시 (간단한 경우 제외)
- [ ] `strict: true` 설정 유지
- [ ] `noImplicitAny: true` 설정 유지
- [ ] `strictNullChecks: true` 설정 유지
- [ ] 타입 에러 0개 유지
- [ ] Circular dependency 없음

## Best Practices

### 1. 인터페이스 vs 타입

```typescript
// ✅ Good - 확장 가능한 객체는 interface
interface User {
  id: string;
  name: string;
  email: string;
}

interface Admin extends User {
  permissions: string[];
}

// ✅ Good - Union, Intersection은 type
type Status = 'idle' | 'loading' | 'success' | 'error';
type UserWithStatus = User & { status: Status };
```

### 2. Nullable 처리

```typescript
// ✅ Good - 명시적 null/undefined 처리
interface Printer {
  id: string;
  name: string;
  group_id: string | null;  // null 가능
  last_seen?: Date;          // undefined 가능 (optional)
}

// ✅ Good - null 체크
function printGroup(printer: Printer) {
  if (printer.group_id !== null) {
    console.log(printer.group_id.toUpperCase());  // OK
  }
}
```

### 3. Enum vs Union Type

```typescript
// ❌ Bad - Enum (번들 크기 증가)
enum PrinterState {
  Operational = 'operational',
  Printing = 'printing',
  Error = 'error'
}

// ✅ Good - Union type
type PrinterState = 'operational' | 'printing' | 'error';

// ✅ Good - const assertion
const PRINTER_STATES = {
  OPERATIONAL: 'operational',
  PRINTING: 'printing',
  ERROR: 'error'
} as const;

type PrinterState = typeof PRINTER_STATES[keyof typeof PRINTER_STATES];
```

### 4. 타입 추론 활용

```typescript
// ✅ Good - 타입 추론
const config = {
  timeout: 5000,
  retries: 3,
  baseUrl: 'https://api.example.com'
} as const;

type Config = typeof config;  // 자동 추론

// ✅ Good - 함수 리턴 타입 추론
function createUser(name: string, email: string) {
  return { name, email, createdAt: new Date() };
}

type User = ReturnType<typeof createUser>;
```

### 5. Generic 제약 조건

```typescript
// ✅ Good - 제약 조건으로 타입 안전성 보장
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const printer = { id: '123', name: 'Ender 3' };
const id = getProperty(printer, 'id');      // ✅ OK
const invalid = getProperty(printer, 'foo'); // ❌ 컴파일 에러
```

### 6. Discriminated Union

```typescript
// ✅ Good - 타입 판별이 쉬운 Union
type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

function handleResult<T>(result: ApiResult<T>) {
  if (result.success) {
    console.log(result.data);  // ✅ 타입 자동 추론
  } else {
    console.error(result.error);  // ✅ 타입 자동 추론
  }
}
```

## Type Checking Commands

```bash
# 타입 체크 (빌드 없이)
npx tsc --noEmit

# 특정 패키지만 체크
cd packages/mobile
npx tsc --noEmit

# Watch 모드
npx tsc --noEmit --watch
```

## Common Type Errors & Solutions

### 1. Property does not exist

```typescript
// ❌ Error
const name = printer.printer_name;  // Property 'printer_name' does not exist

// ✅ Fix - 올바른 타입 정의 확인
interface Printer {
  id: string;
  name: string;  // 'printer_name'이 아닌 'name'
}
```

### 2. Type 'X' is not assignable to type 'Y'

```typescript
// ❌ Error
const status: PrinterStatus = response.data;

// ✅ Fix - 타입 가드 또는 타입 단언
const status = response.data as PrinterStatus;  // 확실한 경우만
// 또는
if (isPrinterStatus(response.data)) {
  const status = response.data;  // ✅ 타입 가드
}
```

### 3. Object is possibly 'null' or 'undefined'

```typescript
// ❌ Error
const length = printer.group_id.length;  // Object is possibly 'null'

// ✅ Fix - Optional chaining
const length = printer.group_id?.length;

// ✅ Fix - Null check
if (printer.group_id) {
  const length = printer.group_id.length;
}

// ✅ Fix - Nullish coalescing
const groupId = printer.group_id ?? 'default';
```

## Important Notes

- **any 금지**: 불가피한 경우 unknown 사용 후 타입 가드
- **strict 모드**: 항상 strict: true 유지
- **명시적 타입**: 암묵적 any 방지
- **타입 추론 활용**: 불필요한 타입 명시 줄이기
- **Zod와 TypeScript**: 런타임 + 컴파일타임 검증 이중화
- **타입 문서화**: JSDoc으로 타입에 설명 추가

## Do Not

- ❌ `any` 타입 남발
- ❌ 타입 단언 (`as`) 과도하게 사용
- ❌ `@ts-ignore` 주석 사용
- ❌ Optional chaining 과도하게 사용 (제대로 된 null 체크 선호)
- ❌ UI 컴포넌트 작성 (ui-components의 역할)
- ❌ API 구현 (api-developer의 역할)
- ❌ 빌드 및 배포 (mobile-builder의 역할)
