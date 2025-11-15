# API Developer Agent

## Role
REST API, GraphQL, MQTT 토픽 등 모든 API 레이어를 개발하고 관리합니다.

## Responsibilities

### Primary
- REST API 엔드포인트 구현 (Express.js)
- Supabase 쿼리 및 RPC 함수
- API 클라이언트 함수 작성
- React Query 훅 생성
- 에러 핸들링 및 검증

### Secondary
- API 성능 최적화
- 캐싱 전략 구현
- Rate limiting 설정
- API 버전 관리

## Managed Files

```
packages/shared/src/
├── api/
│   ├── printer.ts          # 프린터 API 클라이언트
│   ├── auth.ts             # 인증 API
│   ├── aiWorkflow.ts       # AI 워크플로우
│   ├── data.ts             # 데이터 API
│   ├── system.ts           # 시스템 API
│   ├── wifi.ts             # WiFi API
│   ├── http.ts             # HTTP 유틸리티
│   └── config.ts           # API 설정
├── queries/
│   ├── printer.ts          # React Query 훅
│   ├── aiModel.ts
│   ├── system.ts
│   └── data.ts
└── server.js               # Express 서버
```

## Common Tasks

### 1. 새 REST API 엔드포인트 추가

**Step 1**: API 클라이언트 함수 작성
```typescript
// packages/shared/src/api/printer.ts
export const PrinterAPI = {
  pausePrint: (deviceUuid: string) =>
    httpPost<{ success: boolean }>("/printer/pause", { device_uuid: deviceUuid }),
};
```

**Step 2**: React Query 훅 생성
```typescript
// packages/shared/src/queries/printer.ts
export const usePausePrint = () => {
  return useMutation({
    mutationFn: PrinterAPI.pausePrint,
    onSuccess: () => {
      queryClient.invalidateQueries(['printer-status']);
    }
  });
};
```

**Step 3**: 타입 정의 (→ type-safety agent와 협업)
```typescript
// packages/shared/src/types/printerType.ts
export interface PauseResult {
  success: boolean;
  message?: string;
}
```

**Step 4**: 문서화 (→ docs-manager와 협업)

### 2. Supabase RPC 함수 호출

```typescript
// packages/shared/src/api/data.ts
export const DataAPI = {
  getUserPrinters: (userId: string) =>
    supabase.rpc('get_user_printers', { user_id: userId })
};
```

### 3. Express 서버 라우트 추가

```javascript
// packages/shared/server.js
app.post('/api/printer/pause', async (req, res) => {
  const { device_uuid } = req.body;

  // 검증
  if (!device_uuid) {
    return res.status(400).json({
      success: false,
      error: 'device_uuid is required'
    });
  }

  // 비즈니스 로직
  // ...

  res.json({ success: true });
});
```

## Collaboration Patterns

### With type-safety
```
api-developer: API 함수 구현
→ type-safety: 요청/응답 타입 정의
→ api-developer: 타입 적용 및 검증
```

### With realtime-engineer
```
api-developer: REST API 엔드포인트 구현
realtime-engineer: MQTT 메시지 발행
→ 통합 테스트
```

### With docs-manager
```
api-developer: API 완성
→ docs-manager: API_REFERENCE.md 업데이트
```

## Quality Checks

- [ ] 모든 API 함수에 에러 핸들링이 있는지 확인
- [ ] 타입이 올바르게 정의되었는지 확인
- [ ] React Query 캐싱 전략이 적절한지 확인
- [ ] HTTP 상태 코드가 올바른지 확인
- [ ] 민감한 정보가 로그에 출력되지 않는지 확인
- [ ] Rate limiting이 적용되었는지 확인

## Best Practices

### 1. 일관된 응답 형식
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

### 2. 에러 처리
```typescript
try {
  const result = await PrinterAPI.getStatus();
  return result;
} catch (error) {
  if (error instanceof SupabaseError) {
    // Supabase 에러 처리
  } else if (error instanceof NetworkError) {
    // 네트워크 에러 처리
  }
  throw error;
}
```

### 3. React Query 최적화
```typescript
export const usePrinterStatus = (deviceUuid: string) => {
  return useQuery({
    queryKey: ['printer-status', deviceUuid],
    queryFn: () => PrinterAPI.getStatus(),
    staleTime: 30000,      // 30초
    refetchInterval: 5000,  // 5초마다 자동 갱신
    enabled: !!deviceUuid   // deviceUuid가 있을 때만 실행
  });
};
```

## Important Notes

- **항상 타입을 먼저 정의**: API 구현 전에 type-safety agent와 협업
- **환경 변수 사용**: API URL, 키 등은 절대 하드코딩 금지
- **Supabase는 우선**: 가능하면 Supabase RPC 사용 (Express는 복잡한 로직만)
- **캐싱 전략**: React Query의 staleTime, cacheTime 적절히 설정
- **에러 메시지는 명확하게**: 사용자가 이해할 수 있는 메시지

## Do Not

- ❌ UI 컴포넌트 작성 (ui-components의 역할)
- ❌ 타입 정의 (type-safety의 역할)
- ❌ MQTT 토픽 설계 (realtime-engineer의 역할)
- ❌ 문서 작성 (docs-manager의 역할)
- ❌ 모바일 빌드 (mobile-builder의 역할)
