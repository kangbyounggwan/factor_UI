# AIChat.tsx 슬림화 리팩토링 계획

## 목표
- **현재**: 2,241줄 (30+ useState, 복잡한 비즈니스 로직 혼재)
- **목표**: 150~250줄 (레이아웃 + 이벤트 바인딩만)

## 핵심 원칙
> **AIChat.tsx는 "조립만" 담당**
> - 상태/로직 → 훅 + 서비스로 이동
> - 페이지에는 레이아웃 + 이벤트 바인딩만 남김

---

## 현재 AIChat.tsx 분석

### 상태 현황 (30+ useState)
| 카테고리 | 상태 변수 | 줄 수 |
|---------|----------|-------|
| 메시지/로딩 | messages, input, isLoading, chatMode | ~10줄 |
| 파일 업로드 | useFileUpload 훅 (기존 분리됨) | ~25줄 |
| 세션 관리 | chatSessions, currentSessionId, isLoadingSessions | ~10줄 |
| 권한/모달 | showLoginModal, showNewChatModal, planInfo | ~10줄 |
| G-code 분석 | useGcodeAnalysisPolling 훅 (기존) | ~20줄 |
| G-code 에디터 | editorContent, editorFixInfo, pendingPatches, resolvedLines | ~20줄 |
| 보고서 패널 | reportPanelOpen, reportPanelTab, archiveViewActive | ~10줄 |
| AI 해결하기 | isAIResolving | ~5줄 |
| 공유 | useChatSharing 훅 (기존 분리됨) | ~10줄 |

### 함수 현황 (~1,200줄)
| 함수명 | 줄 수 | 책임 |
|--------|-------|------|
| handleSend | ~270줄 | 메시지 전송 전체 흐름 |
| callChatAPI | ~280줄 | 도구별 API 요청 구성 |
| resolveGcodeIssue | ~30줄 | G-code 이슈 해결 |
| handleGcodeAnalysisStream | ~50줄 | 폴링 래퍼 |
| handleAIResolveStart/Complete/Error | ~100줄 | AI 해결 콜백 |
| loadSession | ~50줄 | 세션 로드 |
| handleNewChat | ~30줄 | 새 대화 시작 |
| deleteSession | ~20줄 | 세션 삭제 |
| handleToolSelect | ~50줄 | 도구 선택 |
| useEffect들 | ~150줄 | 초기화/사이드이펙트 |
| 이벤트 핸들러들 | ~100줄 | onRevert, onReportCardClick 등 |

### 렌더링 (~500줄)
- 사이드바 컨테이너
- 헤더
- 메시지 리스트 (ChatMessage 컴포넌트)
- 로딩/분석 진행률 UI
- 입력창 (ChatInput 컴포넌트)
- G-code 보고서 패널 (GCodeAnalysisReport)
- 모달들 (로그인, 새채팅, 공유)

---

## 이동 계획

### 1. useChatController (기존 구현 확장)
**이동 대상**: handleSend + callChatAPI 로직

```typescript
// 현재: handleSend 내부의 복잡한 로직
// → useChatController.sendMessage()로 통합

interface UseChatControllerReturn {
  // 상태
  messages, isLoading, isStreaming

  // 액션
  sendMessage: () => Promise<void>  // handleSend 전체 대체

  // 이미 구현된 것들
  addUserMessage, addAssistantMessage, updateMessage, ...
}
```

**handleSend에서 이동해야 할 것들**:
1. 권한 체크 (익명/로그인 분기)
2. 세션 생성/업데이트
3. 메시지 저장 (DB/localStorage)
4. callChatAPI 호출
5. 응답 처리 (참조이미지 저장 등)
6. G-code 분석 후처리
7. 사용량 증가
8. 에러 핸들링

### 2. useChatSessions (기존 구현 확장)
**이동 대상**: 세션 관련 useEffect + loadSession + deleteSession

```typescript
interface UseChatSessionsReturn {
  // 기존
  sessions, currentSessionId, loadSessions, deleteSession, ...

  // 추가 필요
  loadSessionMessages: (sessionId: string) => Promise<Message[]>
  handleNewChat: () => void
  handleToolSelect: (toolId: string) => void
}
```

### 3. useAnonChat (새로 생성)
**이동 대상**: 비로그인 사용자 localStorage 로직

```typescript
interface UseAnonChatReturn {
  loadAnonMessages: () => Message[]
  saveAnonMessages: (messages: Message[]) => void
  clearAnonMessages: () => void
  isAnonymous: boolean
}
```

**관련 코드**:
- `loadAnonChat()` useEffect
- `saveAnonChat()` 호출부
- `clearAnonChat()` 호출부

### 4. useGcodeController (새로 생성)
**이동 대상**: G-code 분석/에디터/패치 관련 전체 로직

```typescript
interface UseGcodeControllerReturn {
  // 분석 상태 (기존 useGcodeAnalysisPolling 래핑)
  isAnalyzing, progress, reportData, segmentData, ...

  // 에디터 상태 (기존 useGcodeEditor 래핑)
  editorContent, editorFixInfo, pendingPatches, resolvedLines, ...

  // 패널 상태 (기존 useGcodeReportPanel 래핑)
  reportPanelOpen, reportPanelTab, archiveViewActive, ...

  // 핸들러 (새로 통합)
  handleGcodeAnalysisStream: (...) => void
  handleAIResolveStart: (info: AIResolveStartInfo) => void
  handleAIResolveComplete: (info: AIResolveCompleteInfo) => void
  handleAIResolveError: (error: string) => void
  handleViewCodeFix: (fix: CodeFix) => void
  handleApplyFix: (lineNumber, original, fixed) => void
  handleRevert: (lineNumber) => void
  handleSaveModifiedGCode: () => Promise<void>
  handleReportCardClick: (reportId: string) => Promise<void>
}
```

### 5. useChatPermissions (기존 구현 확장)
**이동 대상**: 권한 체크 + 사용량 증가 로직

```typescript
interface UseChatPermissionsReturn {
  // 기존
  showLoginModal, checkPermission, incrementUsage, ...

  // 추가 필요
  checkGcodePermission: () => Promise<PermissionResult>
  checkTroubleshootPermission: () => Promise<PermissionResult>
  checkModelingPermission: () => Promise<PermissionResult>
  checkAnonymousPermission: () => PermissionResult
}
```

---

## 리팩토링 단계

### Phase 1: useAnonChat 생성 (예상 -50줄)
1. `useAnonChat.ts` 생성
2. localStorage 관련 로직 이동
3. AIChat.tsx에서 교체

### Phase 2: useGcodeController 생성 (예상 -400줄)
1. `useGcodeController.ts` 생성
2. 기존 훅들 (useGcodeEditor, useGcodeReportPanel, useGcodeAnalysisPolling) 통합
3. 핸들러 함수들 이동:
   - handleGcodeAnalysisStream
   - handleAIResolveStart/Complete/Error
   - onViewCodeFix
   - onEditorApplyFix
   - onRevert
   - onSaveModifiedGCode
   - onReportCardClick

### Phase 3: useChatController 강화 (예상 -500줄)
1. `callChatAPI` 로직을 `chatOrchestrator.ts`로 이동 (이미 일부 구현됨)
2. `handleSend` 로직을 `useChatController.sendMessage()`로 통합
3. 세션 생성/메시지 저장 로직 통합

### Phase 4: useChatSessions 강화 (예상 -100줄)
1. `loadSession` 함수 이동
2. `handleNewChat` 함수 이동
3. `handleToolSelect` 함수 이동

### Phase 5: AIChat.tsx 최종 정리 (예상 150~250줄)
1. 불필요한 useState 제거
2. 불필요한 useEffect 제거
3. 불필요한 함수 제거
4. 순수 레이아웃 + 이벤트 바인딩만 유지

---

## 최종 AIChat.tsx 구조 (목표)

```tsx
const AIChat = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // 1. 통합 훅들 사용 (상태/로직 전부 위임)
  const chat = useChatController({ userId: user?.id, userPlan });
  const gcode = useGcodeController({ userId: user?.id });
  const anon = useAnonChat();
  const sidebar = useSidebarState();
  const share = useChatSharing({ userId: user?.id });

  // 2. 초기화 (useEffect 최소화)
  useEffect(() => {
    if (user?.id) {
      chat.loadSessions();
    } else {
      chat.loadSessionMessages(anon.loadAnonMessages());
    }
  }, [user?.id]);

  // 3. 순수 렌더링 (레이아웃 + 이벤트 바인딩)
  return (
    <div className="flex h-screen">
      {/* 사이드바 */}
      <AppSidebar
        sessions={chat.sessions}
        onSelectSession={chat.setCurrentSessionId}
        onDeleteSession={chat.deleteSession}
        onNewChat={chat.resetChat}
        {...sidebar}
      />

      {/* 메인 콘텐츠 */}
      <main className="flex-1 flex">
        {/* 채팅 영역 */}
        <div className="flex-1 flex flex-col">
          <AppHeader onToggleSidebar={sidebar.toggle} />

          {/* 메시지 리스트 */}
          <MessageList
            messages={chat.messages}
            isLoading={chat.isLoading}
            onReportCardClick={gcode.handleReportCardClick}
            onSuggestedAction={chat.handleSuggestedAction}
          />

          {/* 입력창 */}
          <ChatInputArea
            input={chat.input}
            onInputChange={chat.setInput}
            onSend={chat.sendMessage}
            canSend={chat.canSend()}
            {...chat.composer}
          />
        </div>

        {/* G-code 보고서 패널 */}
        {gcode.reportPanelOpen && (
          <GCodeReportPanel
            {...gcode}
            onClose={gcode.closeReportPanel}
          />
        )}
      </main>

      {/* 모달들 */}
      <LoginPromptModal open={chat.showLoginModal} />
      <ShareModal {...share} />
    </div>
  );
};
```

---

## 예상 결과

| 항목 | Before | After |
|------|--------|-------|
| 총 줄 수 | 2,241줄 | 150~250줄 |
| useState 개수 | 30+ | 0~3 (로컬 UI만) |
| useEffect 개수 | 10+ | 1~2 |
| 함수 개수 | 15+ | 0~2 (순수 렌더 헬퍼만) |
| 책임 | 모든 것 | 조립만 |

---

## 파일 구조 (최종)

```
packages/web/src/features/ai-chat/
├── index.ts
├── types/
│   └── chat.types.ts          # ✅ 완료
├── services/
│   ├── chatOrchestrator.ts    # ✅ 완료 (확장 필요)
│   ├── chatRequestBuilder.ts  # ✅ 완료
│   ├── chatResponseParser.ts  # ✅ 완료
│   └── chatPermissionService.ts # ✅ 완료
└── hooks/
    ├── useChatMessages.ts     # ✅ 완료
    ├── useChatSessions.ts     # ✅ 완료 (확장 필요)
    ├── useChatPermissions.ts  # ✅ 완료 (확장 필요)
    ├── useChatComposer.ts     # ✅ 완료
    ├── useGcodeEditor.ts      # ✅ 완료
    ├── useGcodeReportPanel.ts # ✅ 완료
    ├── useChatController.ts   # ✅ 완료 (확장 필요)
    ├── useAnonChat.ts         # 🔴 신규 생성 필요
    └── useGcodeController.ts  # 🔴 신규 생성 필요
```

---

## 우선순위

1. **useGcodeController** - 가장 많은 코드 제거 가능 (~400줄)
2. **useChatController 강화** - handleSend/callChatAPI 이동 (~500줄)
3. **useAnonChat** - 간단하지만 깔끔한 분리 (~50줄)
4. **useChatSessions 강화** - 세션 관련 정리 (~100줄)
5. **AIChat.tsx 최종 정리** - 순수 조립 코드만 남김
