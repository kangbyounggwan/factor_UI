# Sub Agent Usage Examples

실제 개발 시나리오별 서브 에이전트 활용 예시입니다.

## 시나리오 1: 새로운 API 엔드포인트 추가

### 요구사항
프린터를 일시정지하는 새로운 API 엔드포인트를 추가해야 합니다.

### 에이전트 워크플로우

#### Step 1: 타입 정의
```
@type-safety: Define printer pause API types

Required:
- Request type: { device_uuid: string }
- Response type: { success: boolean; message?: string }
- Error type: API error codes
```

**Result**:
```typescript
// packages/shared/src/types/printerType.ts
export interface PausePrintRequest {
  device_uuid: string;
}

export interface PausePrintResponse {
  success: boolean;
  message?: string;
}
```

#### Step 2: API 구현
```
@api-developer: Implement printer pause API

Tasks:
1. Add API client function in packages/shared/src/api/printer.ts
2. Create React Query hook in packages/shared/src/queries/printer.ts
3. Add Express route in packages/shared/server.js
```

**Result**:
```typescript
// API 클라이언트
export const PrinterAPI = {
  pausePrint: (deviceUuid: string) =>
    httpPost<PausePrintResponse>("/printer/pause", { device_uuid: deviceUuid })
};

// React Query 훅
export const usePausePrint = () => {
  return useMutation({
    mutationFn: PrinterAPI.pausePrint,
    onSuccess: () => {
      queryClient.invalidateQueries(['printer-status']);
    }
  });
};
```

#### Step 3: 문서 업데이트
```
@docs-manager: Update API documentation for pause endpoint

Add to API_REFERENCE.md:
- Endpoint: POST /api/printer/pause
- Request/response examples
- Error codes
```

## 시나리오 2: 새로운 설정 페이지 추가

### 요구사항
프린터 그룹 관리 페이지를 추가해야 합니다.

### 에이전트 워크플로우 (병렬 + 순차)

#### Phase 1: 타입과 API (병렬)
```
Run in parallel:

1. @type-safety: Define printer group types
   - Group interface
   - CRUD request/response types

2. @api-developer: Implement group management API
   - Create, Read, Update, Delete endpoints
   - React Query hooks
```

#### Phase 2: UI 개발 (순차)
```
1. @ui-components: Create PrinterGroupSettings page
   - List groups
   - Add/Edit/Delete buttons
   - Form components

2. @i18n-manager: Add translation keys
   - "settings.groups.title"
   - "settings.groups.addGroup"
   - "settings.groups.deleteConfirm"
   - etc.
```

#### Phase 3: 품질 검사 및 문서화 (순차)
```
1. @quality-checker: Run full quality check
   - TypeScript type check
   - ESLint
   - Build verification

2. @docs-manager: Document new feature
   - Update PROJECT_DOCUMENTATION.md
   - Add usage guide
   - Update screenshots
```

## 시나리오 3: iOS 앱 버전 업데이트 및 배포

### 요구사항
버그 수정 후 v1.2.0 Build 4를 App Store에 배포해야 합니다.

### 에이전트 워크플로우

#### Step 1: 품질 검사
```
@quality-checker: Full pre-deployment check

Tasks:
- TypeScript type check (all packages)
- ESLint check (all packages)
- Build verification (web + mobile)
- Bundle size check
- Security audit
```

#### Step 2: 모바일 빌드
```
@mobile-builder: Build and deploy iOS v1.2.0 Build 4

Tasks:
1. Update version in package.json
2. Update MARKETING_VERSION and CURRENT_PROJECT_VERSION
3. Build mobile package
4. Sync Capacitor
5. Create Xcode archive
6. Upload to App Store Connect
```

#### Step 3: 문서 업데이트
```
@docs-manager: Update version documentation

Tasks:
1. Add release notes to PROJECT_DOCUMENTATION.md
2. Update version in README.md
3. Update CLAUDE.md Recent Changes section
```

## 시나리오 4: MQTT 실시간 기능 추가

### 요구사항
카메라 스냅샷 실시간 업데이트 기능을 추가해야 합니다.

### 에이전트 워크플로우

#### Step 1: 토픽 설계
```
@realtime-engineer: Design MQTT topic for camera snapshots

Topic structure: camera/snapshot/{device_uuid}
Message format: {
  type: "snapshot_update",
  device_uuid: string,
  snapshot_url: string,
  timestamp: number
}
```

#### Step 2: 타입 정의
```
@type-safety: Define snapshot message types

Required:
- SnapshotMessage interface
- Topic pattern type
```

#### Step 3: 구독 및 핸들링
```
@realtime-engineer: Implement MQTT subscription

Tasks:
1. Add topic subscription in AuthContext
2. Add message handler
3. Integrate with React Query cache
```

#### Step 4: UI 통합
```
@ui-components: Display real-time camera snapshot

Tasks:
1. Create CameraSnapshot component
2. Subscribe to MQTT updates
3. Display loading/error states
```

## 시나리오 5: 다국어 지원 확장

### 요구사항
모든 새로운 기능에 대한 번역을 추가해야 합니다.

### 에이전트 워크플로우

```
@i18n-manager: Add translations for new features

Tasks:
1. Audit all hardcoded strings in new components
2. Create translation keys in common.json
3. Add Korean translations
4. Add English translations
5. Verify all t() calls are correct
```

**Before**:
```tsx
<h1>프린터 그룹</h1>
<button>추가</button>
```

**After**:
```tsx
<h1>{t("settings.groups.title")}</h1>
<button>{t("settings.groups.add")}</button>
```

## 시나리오 6: 성능 최적화

### 요구사항
앱 로딩 시간을 개선해야 합니다.

### 에이전트 워크플로우

#### Step 1: 성능 분석
```
@quality-checker: Analyze bundle size and performance

Tasks:
1. Run bundle size analysis
2. Identify large dependencies
3. Check for unnecessary re-renders
4. Profile React components
```

#### Step 2: 코드 최적화
```
@ui-components: Optimize React components

Tasks:
1. Add React.memo to heavy components
2. Implement useMemo for expensive calculations
3. Add useCallback for event handlers
4. Lazy load route components
```

#### Step 3: 검증
```
@quality-checker: Verify performance improvements

Metrics to check:
- Bundle size reduction
- Initial load time
- Time to Interactive
- Largest Contentful Paint
```

## 시나리오 7: 긴급 버그 수정

### 요구사항
iPad에서 버튼이 잘리는 긴급 버그를 수정해야 합니다.

### 에이전트 워크플로우 (빠른 순차 실행)

```
1. @mobile-builder: Fix iPad Safe Area issue
   - Add viewport-fit=cover
   - Update .safe-area-bottom padding
   - Test on actual iPad

2. @quality-checker: Quick verification
   - Type check
   - Build test

3. @mobile-builder: Deploy hotfix
   - Build v1.2.0 Build 5
   - Upload to TestFlight

4. @docs-manager: Update changelog
   - Add to Recent Changes
```

## 시나리오 8: 대규모 리팩토링

### 요구사항
프린터 상태 관리 로직을 Context에서 React Query로 마이그레이션해야 합니다.

### 에이전트 워크플로우

#### Phase 1: 계획 및 타입
```
1. @type-safety: Review and update printer types
   - Ensure all status types are correct
   - Add missing types

2. @api-developer: Audit existing API calls
   - List all printer-related API endpoints
   - Identify duplicate calls
```

#### Phase 2: 구현
```
3. @api-developer: Migrate to React Query
   - Replace Context with useQuery hooks
   - Implement proper caching
   - Add optimistic updates

4. @ui-components: Update all components
   - Replace Context consumers
   - Use new hooks
   - Update loading/error states
```

#### Phase 3: 검증 및 정리
```
5. @quality-checker: Full regression test
   - Test all printer features
   - Verify no TypeScript errors
   - Check for performance regressions

6. @docs-manager: Update architecture docs
   - Document new state management pattern
   - Update component examples
```

## 팁: 에이전트 선택 가이드

### 파일 변경 기준

| 변경할 파일 | 사용할 에이전트 |
|-----------|----------------|
| `*.md` | docs-manager |
| `api/*.ts` | api-developer |
| `components/*.tsx` | ui-components |
| `types/*.ts` | type-safety |
| `i18n/**/*.json` | i18n-manager |
| `mqtt.ts`, `websocket.ts` | realtime-engineer |
| `ios/`, `android/` | mobile-builder |
| ESLint, TypeScript 설정 | quality-checker |

### 작업 유형 기준

| 작업 유형 | 사용할 에이전트 |
|----------|----------------|
| 새 API 추가 | api-developer → type-safety → docs-manager |
| 새 화면 추가 | ui-components → i18n-manager |
| 버그 수정 | (해당 도메인 에이전트) → quality-checker |
| 성능 최적화 | quality-checker → ui-components |
| 빌드 문제 | quality-checker 또는 mobile-builder |
| 번역 누락 | i18n-manager |
| 타입 에러 | type-safety |
| MQTT 연결 문제 | realtime-engineer |

## 주의사항

1. **병렬 실행 시 파일 충돌 방지**: 같은 파일을 수정하는 에이전트는 병렬 실행하지 마세요
2. **의존성 순서 지키기**: 타입 정의 → API 구현 → UI 개발
3. **문서는 마지막**: 기능 완성 후 docs-manager 실행
4. **품질 검사는 필수**: 배포 전 반드시 quality-checker 실행
