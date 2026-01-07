# AIChat.tsx 리팩토링 계획

## 현재 상태 분석

### 파일 크기
- **AIChat.tsx**: ~2,280 라인 (너무 큼)
- 단일 컴포넌트가 너무 많은 책임을 가짐

### 현재 AIChat.tsx의 책임 (문제점)

| 영역 | 책임 | 라인 수 (추정) |
|------|------|---------------|
| **상태 관리** | 30+ useState, 5+ useRef | ~100 |
| **세션 관리** | 로드/생성/삭제/전환 | ~150 |
| **메시지 처리** | 생성/저장/렌더링 | ~200 |
| **API Orchestration** | handleSend, callChatAPI | ~350 |
| **G-code 분석** | 폴링/보고서/에디터/패치 | ~400 |
| **AI 해결하기** | 시작/완료/에러 핸들러 | ~150 |
| **파일 업로드** | 이미지/G-code 처리 | (useFileUpload로 분리됨) |
| **권한/사용량** | 플랜 체크, 한도 체크 | ~100 |
| **UI 렌더링** | 레이아웃, 모달, 조건부 렌더링 | ~600 |
| **이벤트 핸들러** | 클릭, 드래그, 공유 등 | ~200 |

---

## 기존 분리된 훅 (재사용)

```
/hooks/chat/
├── index.ts              # 내보내기
├── useChatUtils.ts       # 순수 유틸리티 함수 ✅
├── useChatSession.ts     # 세션 관리 (미사용 상태)
├── useChatPersistence.ts # 메시지 저장 (미사용 상태)
├── useChatGcodeAnalysis.ts # G-code 후처리 (미사용 상태)
├── useFileUpload.ts      # 파일 업로드 ✅ 사용중
└── useChatSharing.ts     # 대화 공유 ✅ 사용중
```

### 문제점
- `useChatSession`, `useChatPersistence`, `useChatGcodeAnalysis`가 정의되어 있지만 AIChat.tsx에서 직접 사용하지 않음
- 훅들이 있어도 AIChat.tsx 내부에 로직이 중복되어 있음

---

## 리팩토링 목표

### 핵심 원칙
1. **UI 컴포넌트는 렌더링만** - 상태와 로직은 훅으로
2. **하나의 훅 = 하나의 책임** - 단일 책임 원칙
3. **상태 덩어리는 Reducer 또는 Context** - 복잡한 상태 관리
4. **테스트 가능한 구조** - 순수 함수와 훅 분리

### 목표 라인 수
- **AIChatPage.tsx**: ~300 라인 (렌더링 + 조립만)
- **각 훅**: ~100-200 라인

---

## 추천 아키텍처 (FACTOR 프로세스 맞춤)

```
/pages/
└── AIChat.tsx                    ← 페이지 컴포넌트 (조립만)

/features/ai-chat/
├── components/
│   ├── ChatLayout.tsx            ← 전체 레이아웃 (사이드바 + 메인 + 패널)
│   ├── ChatMessageList.tsx       ← 메시지 목록 렌더링
│   ├── ChatInputArea.tsx         ← 입력 영역 (기존 ChatInput 래핑)
│   ├── ChatReportPanel.tsx       ← G-code 보고서 패널
│   └── ChatWelcomeView.tsx       ← 초기 화면 (기존 WelcomeScreen 래핑)
│
├── hooks/
│   ├── useChatController.ts      ⭐ 핵심: 전체 흐름 제어
│   ├── useChatMessages.ts        ← 메시지 상태 관리
│   ├── useChatSessions.ts        ← 세션 CRUD
│   ├── useChatPermissions.ts     ← 권한/사용량 체크
│   ├── useChatComposer.ts        ← 입력 상태 (input, files, tool)
│   └── useChatUIState.ts         ← UI 상태 (모달, 패널, 탭)
│
├── hooks/gcode/
│   ├── useGcodeController.ts     ⭐ G-code 전체 흐름
│   ├── useGcodePolling.ts        ← 분석 폴링 (기존 useGcodeAnalysisPolling)
│   ├── useGcodeEditor.ts         ← 에디터 상태 + 패치 관리
│   └── useGcodeReport.ts         ← 보고서 상태 + 아카이브
│
├── services/
│   ├── chatOrchestrator.ts       ⭐ 비즈니스 로직 (API 호출 흐름)
│   ├── chatRequestBuilder.ts     ← 도구별 요청 빌드
│   ├── chatResponseParser.ts     ← 응답 파싱 + 포맷팅
│   └── chatPermissionService.ts  ← 권한 체크 로직
│
├── types/
│   └── chat.types.ts             ← 모든 타입 정의
│
└── context/
    └── ChatContext.tsx           ← (선택) 전역 상태 공유
```

---

## 단계별 리팩토링 계획

### Phase 1: 타입 정리 및 서비스 분리 (1일)

#### 1-1. 타입 통합 (`types/chat.types.ts`)
```typescript
// Message, ChatSession, CodeFixInfo, ReportCard 등 모든 타입 통합
export interface Message { ... }
export interface ChatSession { ... }
export interface ChatApiResult { ... }
export type ChatTool = 'general' | 'gcode' | 'troubleshoot' | 'modeling' | 'price_comparison';
```

#### 1-2. 서비스 분리 (`services/chatOrchestrator.ts`)
```typescript
// callChatAPI 로직을 서비스로 추출
export async function sendChatRequest(params: {
  message: string;
  files: ChatFiles;
  tool: ChatTool;
  context: ChatContext;
}): Promise<ChatApiResult> {
  // 1. 요청 빌드
  const request = buildChatRequest(params);
  // 2. API 호출
  const response = await sendChatMessage(request);
  // 3. 응답 파싱
  return parseChatResponse(response);
}
```

---

### Phase 2: 핵심 훅 구현 (2일)

#### 2-1. `useChatMessages.ts` - 메시지 상태 관리
```typescript
export function useChatMessages() {
  const [messages, setMessages] = useState<Message[]>([]);

  const addUserMessage = (content: string, files?: ChatFiles) => { ... };
  const addAssistantMessage = (result: ChatApiResult) => { ... };
  const updateMessageReportCard = (messageId: string, reportCard: ReportCard) => { ... };
  const loadSessionMessages = async (sessionId: string) => { ... };
  const clearMessages = () => { ... };

  return { messages, addUserMessage, addAssistantMessage, ... };
}
```

#### 2-2. `useChatSessions.ts` - 세션 관리 (기존 훅 활성화)
```typescript
export function useChatSessions(userId?: string) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const createSession = async (toolType: ChatTool) => { ... };
  const loadSession = async (sessionId: string) => { ... };
  const deleteSession = async (sessionId: string) => { ... };
  const updateSessionTitle = async (sessionId: string, title: string) => { ... };

  return { sessions, currentSessionId, createSession, loadSession, ... };
}
```

#### 2-3. `useChatPermissions.ts` - 권한 체크
```typescript
export function useChatPermissions(userId?: string, userPlan?: string) {
  const checkCanSend = async (tool: ChatTool): Promise<PermissionResult> => {
    // 익명 사용자 한도
    // 도구별 한도 (troubleshoot, modeling 등)
    // 플랜별 한도
  };

  const incrementUsage = async (tool: ChatTool) => { ... };

  return { checkCanSend, incrementUsage, planInfo };
}
```

#### 2-4. `useChatComposer.ts` - 입력 상태
```typescript
export function useChatComposer() {
  const [input, setInput] = useState('');
  const [selectedTool, setSelectedTool] = useState<ChatTool | null>(null);
  const [selectedModel, setSelectedModel] = useState<SelectedModel>({ ... });

  // useFileUpload 통합
  const fileUpload = useFileUpload();

  const canSend = useMemo(() => { ... }, [input, fileUpload.files]);
  const clearComposer = () => { ... };

  return { input, setInput, selectedTool, setSelectedTool, fileUpload, canSend, ... };
}
```

---

### Phase 3: G-code 훅 분리 (1일)

#### 3-1. `useGcodeController.ts` - G-code 전체 흐름
```typescript
export function useGcodeController() {
  const polling = useGcodePolling();
  const editor = useGcodeEditor();
  const report = useGcodeReport();

  const startAnalysis = async (analysisId: string, fileName: string) => {
    report.openPanel();
    polling.start({ analysisId, fileName, onComplete: report.setData });
  };

  const handleAIResolve = async (issue: GcodeIssue) => { ... };

  return { ...polling, ...editor, ...report, startAnalysis, handleAIResolve };
}
```

#### 3-2. `useGcodeEditor.ts` - 에디터 + 패치
```typescript
export function useGcodeEditor() {
  const [editorContent, setEditorContent] = useState<string>();
  const [pendingPatches, setPendingPatches] = useState<Map<number, Patch>>(new Map());
  const [resolvedLines, setResolvedLines] = useState<Set<number>>(new Set());

  const applyPatch = (lineNumber: number, patch: Patch) => { ... };
  const revertPatch = (lineNumber: number) => { ... };
  const saveModifiedGCode = async () => { ... };

  return { editorContent, pendingPatches, resolvedLines, applyPatch, ... };
}
```

---

### Phase 4: 컨트롤러 훅 + 컴포넌트 조립 (2일)

#### 4-1. `useChatController.ts` - 핵심 Orchestrator
```typescript
export function useChatController() {
  const { user } = useAuth();
  const { plan } = useUserPlan(user?.id);

  const messages = useChatMessages();
  const sessions = useChatSessions(user?.id);
  const permissions = useChatPermissions(user?.id, plan);
  const composer = useChatComposer();
  const gcode = useGcodeController();
  const ui = useChatUIState();

  const handleSend = async () => {
    // 1. 권한 체크
    const canSend = await permissions.checkCanSend(composer.selectedTool);
    if (!canSend.allowed) {
      ui.showToast(canSend.message);
      return;
    }

    // 2. 세션 확보
    const sessionId = await sessions.ensureSession(composer.selectedTool);

    // 3. 사용자 메시지 추가
    messages.addUserMessage(composer.input, composer.fileUpload.files);

    // 4. 입력 초기화
    composer.clearComposer();

    // 5. API 호출
    const result = await sendChatRequest({ ... });

    // 6. 응답 처리
    messages.addAssistantMessage(result);

    // 7. 후처리 (G-code 분석, 사용량 증가 등)
    if (result.analysisId) {
      gcode.startAnalysis(result.analysisId, result.fileName);
    }
    await permissions.incrementUsage(composer.selectedTool);
  };

  return {
    // 상태
    messages: messages.messages,
    sessions: sessions.sessions,
    currentSessionId: sessions.currentSessionId,
    isLoading: ui.isLoading,

    // 액션
    handleSend,
    handleNewChat: () => { messages.clear(); sessions.reset(); },
    handleLoadSession: sessions.loadSession,

    // 하위 훅
    composer,
    gcode,
    ui,
  };
}
```

#### 4-2. `AIChatPage.tsx` - 최종 페이지 컴포넌트
```typescript
const AIChatPage = () => {
  const chat = useChatController();

  return (
    <ChatLayout
      sidebar={<ChatSidebar {...chat.sessions} />}
      header={<ChatHeader onShare={chat.ui.share} />}
    >
      {chat.messages.length === 0 ? (
        <ChatWelcomeView
          onToolSelect={chat.composer.setSelectedTool}
          onSend={chat.handleSend}
        />
      ) : (
        <>
          <ChatMessageList
            messages={chat.messages}
            onReportCardClick={chat.gcode.openReport}
          />
          <ChatInputArea
            composer={chat.composer}
            onSend={chat.handleSend}
          />
        </>
      )}

      {chat.gcode.reportOpen && (
        <ChatReportPanel
          report={chat.gcode.report}
          editor={chat.gcode.editor}
          onClose={chat.gcode.closeReport}
        />
      )}

      <ChatModals ui={chat.ui} />
    </ChatLayout>
  );
};
```

---

## 마이그레이션 전략

### 점진적 마이그레이션 (권장)
1. 새 훅을 `/features/ai-chat/hooks/`에 생성
2. AIChat.tsx에서 하나씩 훅으로 교체
3. 테스트 후 다음 훅으로 진행
4. 모든 훅 완성 후 컴포넌트 분리

### 롤백 안전장치
- 각 단계마다 git commit
- 기존 코드는 주석 처리 후 삭제 (즉시 삭제 X)
- 기능별 브랜치 사용

---

## 예상 일정

| Phase | 작업 | 예상 시간 |
|-------|------|----------|
| 1 | 타입 정리 + 서비스 분리 | 4시간 |
| 2 | 핵심 훅 구현 (4개) | 8시간 |
| 3 | G-code 훅 분리 (3개) | 4시간 |
| 4 | 컨트롤러 + 조립 | 6시간 |
| 5 | 테스트 + 버그 수정 | 4시간 |
| **Total** | | **~26시간** (3-4일) |

---

## 우선순위 추천

### 가장 효과 큰 순서
1. **`chatOrchestrator.ts`** - callChatAPI 분리 (복잡도 감소)
2. **`useChatMessages.ts`** - 메시지 상태 분리
3. **`useGcodeController.ts`** - G-code 관련 400줄 분리
4. **`useChatPermissions.ts`** - 권한 로직 분리
5. **컴포넌트 분리** - UI 레이어

### 1단계만 해도 효과 있음
- `callChatAPI` → `chatOrchestrator.ts`로 분리만 해도 ~350줄 감소
- 테스트 가능한 비즈니스 로직 확보

---

## 주의사항

1. **기존 훅 활용** - `useChatSession`, `useChatPersistence` 등 이미 정의된 훅들 활용
2. **Context 최소화** - 필요한 경우에만 Context 사용 (props drilling이 2-3단계면 OK)
3. **타입 일관성** - 분리 시 타입 import/export 주의
4. **테스트 작성** - 서비스 함수는 유닛 테스트 필수

---

## 참고: 현재 사용 중인 외부 훅

- `useAuth()` - 인증 상태
- `useUserPlan()` - 구독 플랜
- `useToast()` - 토스트 알림
- `useSidebarState()` - 사이드바 상태
- `useIsMobile()` - 모바일 감지
- `useGcodeAnalysisPolling()` - G-code 폴링
- `useFileUpload()` - 파일 업로드 ✅
- `useChatSharing()` - 대화 공유 ✅
