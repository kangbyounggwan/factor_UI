# AI 모델 백그라운드 처리 개발 계획

## 📋 목표

사용자가 AI 모델 생성을 요청한 후, 앱을 닫거나 다른 작업을 해도 백그라운드에서 모델이 계속 생성되고, 완료되면 푸시 알림을 받을 수 있도록 구현

---

## 🏗️ 현재 구조 분석

### ✅ 이미 구현된 기능
1. **AI 서비스 비동기 모드 지원** (`packages/shared/src/services/aiService.ts`)
   - `asyncMode` 파라미터로 즉시 `task_id` 반환
   - `pollTaskUntilComplete()` 함수로 진행률 폴링

2. **데이터베이스 스키마** (`ai_generated_models` 테이블)
   - `status`: 'pending' | 'processing' | 'completed' | 'failed'
   - `progress`: 0-100 (진행률)
   - `metadata`: JSON (task_id 저장 가능)

3. **푸시 알림 인프라**
   - FCM 토큰 관리
   - `user_device_tokens` 테이블
   - `send-push-notification` Edge Function

### ⚠️ 현재 문제점
1. **프론트엔드 의존성**: AI 생성이 프론트엔드에서 폴링하는 동안만 진행
2. **앱 종료 시 중단**: 사용자가 앱을 닫으면 폴링이 중단되어 진행률 업데이트가 안 됨
3. **알림 미연동**: AI 생성 완료 시 푸시 알림이 전송되지 않음

---

## 🎯 해결 방안

### 방법 1: Supabase Edge Function으로 백그라운드 폴링 (권장)

#### 장점
- ✅ 프론트엔드와 독립적으로 동작
- ✅ 앱을 닫아도 계속 진행
- ✅ Supabase 인프라 활용 (별도 서버 불필요)
- ✅ 완료 시 자동으로 푸시 알림 전송

#### 단점
- ⚠️ Edge Function 실행 시간 제한 (10분)
  - **해결**: Edge Function에서 폴링을 시작만 하고 즉시 반환, 백그라운드에서 계속 폴링

#### 구현 단계

##### 1단계: Supabase Edge Function 생성
- **함수 이름**: `generate-ai-model-background`
- **역할**:
  1. AI 모델 생성 요청을 AI Python 서버에 전달 (`async_mode=true`)
  2. 반환된 `task_id`를 DB에 저장
  3. 백그라운드에서 `task_id`를 폴링하여 진행률 업데이트
  4. 완료 시:
     - GLB 파일을 Supabase Storage에 업로드
     - DB 상태를 `completed`로 업데이트
     - 푸시 알림 전송

##### 2단계: 프론트엔드 수정
- **Mobile & Web `AI.tsx`**:
  1. ~~기존: AI 서비스 직접 호출 + 프론트엔드 폴링~~
  2. **신규**: Edge Function 호출만 하고 즉시 리스트 페이지로 이동
  3. 생성 중인 모델은 리스트에서 진행률 표시
  4. 실시간 진행률 업데이트 (Supabase Realtime 구독)

##### 3단계: 실시간 진행률 구독
- **Supabase Realtime**:
  ```typescript
  supabase
    .channel('ai-model-progress')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'ai_generated_models',
      filter: `id=eq.${modelId}`
    }, (payload) => {
      // 진행률 업데이트
    })
    .subscribe();
  ```

##### 4단계: 푸시 알림 연동
- Edge Function에서 완료 시 자동으로 호출:
  ```typescript
  await supabase.functions.invoke('send-push-notification', {
    body: {
      userId,
      title: 'AI 모델 생성 완료',
      body: `'${modelName}' 모델이 성공적으로 생성되었습니다.`,
      data: { type: 'ai_model_complete', related_id: modelId }
    }
  });
  ```

---

### 방법 2: AI Python 서버에서 Webhook으로 완료 알림 (대안)

#### 장점
- ✅ AI 서버에서 직접 완료 알림
- ✅ Edge Function 실행 시간 제한 문제 없음

#### 단점
- ⚠️ AI Python 서버 수정 필요
- ⚠️ Supabase 인증 토큰 관리 필요
- ⚠️ 네트워크 에러 처리 복잡

#### 구현 단계
1. AI Python 서버에 Supabase Webhook URL 전달
2. 완료 시 Python 서버가 Webhook 호출
3. Supabase Edge Function이 Webhook 수신하여 DB 업데이트 + 푸시 알림

**결론**: 방법 1이 더 간단하고 안정적

---

## 📝 상세 구현 계획 (방법 1 기준)

### Phase 1: Edge Function 구현 ✅ (완료)

#### 파일: `packages/web/supabase/functions/generate-ai-model-background/index.ts`

**주요 기능**:
1. AI 모델 생성 요청 접수
2. AI Python 서버에 `async_mode=true`로 요청
3. `task_id` 저장
4. 백그라운드 폴링 시작
5. 진행률을 DB에 업데이트
6. 완료 시:
   - GLB 파일 다운로드 → Supabase Storage 업로드
   - DB 업데이트 (`status: 'completed'`)
   - 푸시 알림 전송

**Edge Function 제한 사항 해결**:
- Edge Function은 10분 제한이 있지만, 폴링은 **백그라운드 Promise**로 실행
- 함수는 즉시 `task_id` 반환하고 종료
- 백그라운드 폴링은 계속 실행 (Deno의 비동기 특성 활용)

---

### Phase 2: 프론트엔드 수정

#### 2.1. AI 생성 플로우 변경

**Before** (현재):
```typescript
// 사용자가 생성 버튼 클릭
→ AI 서비스 직접 호출 (async_mode=false)
→ 프론트엔드에서 폴링 (앱이 열려있어야 함)
→ 완료 시 결과 표시
```

**After** (신규):
```typescript
// 사용자가 생성 버튼 클릭
→ Edge Function 호출 (백그라운드 생성 시작)
→ 즉시 리스트 페이지로 이동
→ 리스트에서 "생성 중..." 표시
→ Realtime으로 진행률 업데이트
→ 완료 시 푸시 알림 수신
```

#### 2.2. AI.tsx 수정 사항

**Mobile**: `packages/mobile/src/pages/AI.tsx`
**Web**: `packages/web/src/pages/AI.tsx`

```typescript
// 기존 코드 (제거):
const result = await aiService.postTextTo3D(payload, false);
await aiService.pollTaskUntilComplete(taskId, onProgress);

// 신규 코드:
// 1. DB에 모델 먼저 생성 (status: 'pending')
const model = await createAIModel(supabase, modelData, userId);

// 2. Edge Function 호출 (백그라운드 생성 시작)
const { data } = await supabase.functions.invoke('generate-ai-model-background', {
  body: {
    modelId: model.id,
    userId,
    generationType: 'text', // 'text' | 'image'
    payload: payload, // AI 서버에 전달할 데이터
  }
});

// 3. 즉시 리스트 페이지로 이동
navigate('/ai-models');
toast({ title: 'AI 모델 생성 시작', description: '백그라운드에서 생성 중입니다.' });
```

#### 2.3. AI 모델 리스트 화면 수정

**표시 내용**:
- ✅ 완료된 모델: 썸네일 + 이름
- 🔄 생성 중: 로딩 애니메이션 + 진행률 바 (0-100%)
- ❌ 실패: 에러 메시지

**Realtime 구독**:
```typescript
useEffect(() => {
  const channel = supabase
    .channel('ai-models-realtime')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'ai_generated_models',
      filter: `user_id=eq.${userId}`
    }, (payload) => {
      // 진행률 업데이트
      const updatedModel = payload.new;
      setModels(prev => prev.map(m =>
        m.id === updatedModel.id ? updatedModel : m
      ));
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);
```

---

### Phase 3: 데이터베이스 마이그레이션 (필요 시)

현재 `ai_generated_models` 테이블에 필요한 컬럼들이 이미 있는지 확인:
- ✅ `status`: TEXT
- ✅ `progress`: INTEGER (0-100)
- ✅ `metadata`: JSONB (`task_id` 저장용)
- ✅ `error_message`: TEXT

**추가 필요한 컬럼** (없다면):
- `completed_at`: TIMESTAMPTZ (완료 시간)

---

### Phase 4: 푸시 알림 연동

#### 4.1. Edge Function에서 자동 전송
```typescript
// generate-ai-model-background 함수 내부
await supabase.functions.invoke('send-push-notification', {
  body: {
    userId,
    title: 'AI 모델 생성 완료',
    body: `'${modelName}' 모델이 성공적으로 생성되었습니다.`,
    data: {
      type: 'ai_model_complete',
      related_id: modelId,
      related_type: 'ai_model',
    },
    priority: 'high',
  }
});
```

#### 4.2. 모바일 앱에서 알림 클릭 시 처리
- 이미 구현됨! (`pushNotificationService.ts`)
- `ai_model_complete` 타입 → `/ai/${model_id}` 이동

---

## 🚀 구현 순서

### 1단계: Edge Function 배포 ✅
```bash
cd packages/web
npx supabase functions deploy generate-ai-model-background
```

### 2단계: 환경 변수 설정
Supabase Dashboard → Edge Functions → Environment variables:
```
AI_PYTHON_URL=http://your-ai-server:7000
```

### 3단계: 프론트엔드 수정
- [x] `AI.tsx` - 백그라운드 생성 모드로 변경
- [ ] AI 모델 리스트 - Realtime 구독 추가
- [ ] 진행률 표시 UI 개선

### 4단계: 테스트
1. ✅ Edge Function 단독 테스트 (Postman/curl)
2. ✅ 프론트엔드에서 Edge Function 호출
3. ✅ Realtime 진행률 업데이트 확인
4. ✅ 푸시 알림 수신 확인
5. ✅ 앱 종료 후 백그라운드 완료 확인

---

## 📊 사용자 플로우

### Before (현재)
```
사용자: AI 생성 버튼 클릭
  ↓
앱: "생성 중..." 로딩 화면 (앱이 열려있어야 함)
  ↓ (5-10분 대기)
앱: 완료! 결과 표시
```

**문제**: 앱을 닫으면 생성 중단

### After (신규)
```
사용자: AI 생성 버튼 클릭
  ↓
앱: "생성 시작됨! 리스트에서 확인하세요" (즉시 리스트로 이동)
  ↓
사용자: 앱을 닫거나 다른 작업 가능
  ↓ (백그라운드에서 계속 진행)
서버: 모델 생성 완료
  ↓
푸시 알림: "AI 모델 생성 완료!"
  ↓
사용자: 알림 클릭
  ↓
앱: 완성된 모델 표시
```

**장점**:
- ✅ 사용자가 기다릴 필요 없음
- ✅ 앱을 닫아도 계속 진행
- ✅ 완료 시 푸시 알림으로 즉시 확인

---

## 🔧 기술 스택

| 구성 요소 | 기술 |
|---------|------|
| 백그라운드 작업 | Supabase Edge Functions (Deno) |
| 실시간 업데이트 | Supabase Realtime (WebSocket) |
| 푸시 알림 | Firebase Cloud Messaging (FCM) |
| AI 서버 | Python FastAPI (`async_mode` 지원) |
| 스토리지 | Supabase Storage (GLB 파일) |
| 데이터베이스 | PostgreSQL (Supabase) |

---

## ⚠️ 주의사항

### 1. Edge Function 실행 시간 제한
- Supabase Edge Function은 최대 10분 실행 제한
- **해결**: 폴링 로직을 백그라운드 Promise로 실행하고 함수는 즉시 반환

### 2. AI 서버 다운 시 처리
- 폴링 중 AI 서버가 응답하지 않으면?
  - 10회 연속 실패 시 모델을 `failed` 상태로 변경
  - 사용자에게 재시도 옵션 제공

### 3. 중복 생성 방지
- 동일한 모델에 대해 중복 생성 요청 방지
- DB에서 `modelId`로 중복 체크

### 4. 비용 고려
- Edge Function 실행 횟수: 모델 1개당 1회 (폴링은 1회 실행에서 처리)
- Realtime 연결: 사용자가 리스트 페이지 볼 때만 연결
- Storage: GLB 파일 저장 비용

---

## 📈 예상 효과

| 항목 | Before | After |
|-----|--------|-------|
| 사용자 대기 시간 | 5-10분 (앱 열어둬야 함) | 0초 (즉시 리스트 이동) |
| 백그라운드 처리 | ❌ 불가능 | ✅ 가능 |
| 완료 알림 | ❌ 없음 | ✅ 푸시 알림 |
| 앱 종료 영향 | ❌ 생성 중단 | ✅ 계속 진행 |
| 사용자 경험 | 😐 대기 필요 | 😊 자유롭게 사용 |

---

## 📋 체크리스트

### 구현
- [x] Edge Function 생성 (`generate-ai-model-background`)
- [ ] Edge Function 배포
- [ ] 환경 변수 설정 (`AI_PYTHON_URL`)
- [ ] `AI.tsx` 수정 (백그라운드 모드)
- [ ] 리스트 화면 Realtime 구독 추가
- [ ] 진행률 표시 UI 개선

### 테스트
- [ ] Edge Function 단독 테스트
- [ ] 프론트엔드 통합 테스트
- [ ] Realtime 업데이트 동작 확인
- [ ] 푸시 알림 수신 확인
- [ ] 앱 종료 후 백그라운드 완료 확인
- [ ] 에러 케이스 테스트 (AI 서버 다운, 타임아웃 등)

---

## 🎉 다음 단계

1. **즉시 시작 가능**:
   - Edge Function 배포
   - `AI.tsx` 수정

2. **추가 개선 사항** (향후):
   - 여러 모델 동시 생성 큐 관리
   - 생성 우선순위 설정 (유료 사용자 우선 등)
   - 생성 취소 기능
   - 생성 이력 대시보드

---

이 계획대로 진행하면 사용자가 AI 모델 생성을 요청한 후 앱을 닫아도 백그라운드에서 계속 진행되고, 완료되면 푸시 알림을 받을 수 있습니다! 🚀
