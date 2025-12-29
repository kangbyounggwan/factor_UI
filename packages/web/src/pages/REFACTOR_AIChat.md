# AIChat.tsx 리팩토링 계획

## 현재 상태 분석

### 파일 크기
- **총 라인 수**: 2,877줄
- **useState 훅**: 약 35개
- **useEffect 훅**: 10개
- **핸들러 함수**: 25개+
- **useCallback 훅**: 12개

### 주요 문제점

1. **God Component 안티패턴**
   - 하나의 컴포넌트가 너무 많은 책임을 가짐
   - 상태, 로직, UI가 모두 한 파일에 혼재

2. **상태 관리 복잡성**
   - 35개 이상의 useState로 상태 추적 어려움
   - 연관된 상태들이 분리되어 있음

3. **비즈니스 로직과 UI 결합**
   - 채팅 로직, G-code 분석, 파일 업로드 로직이 UI와 섞여있음

4. **테스트 어려움**
   - 거대한 컴포넌트로 인해 단위 테스트 불가능

---

## 파일 경로 구조

### 전체 경로 맵
```
packages/web/src/
├── pages/
│   └── AIChat.tsx                          # 메인 페이지 (리팩토링 대상)
├── hooks/
│   └── chat/
│       ├── index.ts                        # 훅 배럴 export
│       ├── useChatMessages.ts              # 메시지 상태 관리
│       ├── useChatSession.ts               # 세션 관리 (기존 확장)
│       ├── useFileUpload.ts                # 파일 업로드 관리
│       ├── useGcodeAnalysis.ts             # G-code 분석 (기존 확장)
│       ├── useChatSharing.ts               # 공유 기능
│       ├── useAIResolve.ts                 # AI 해결 기능
│       ├── useChatUtils.ts                 # 유틸리티 (기존)
│       └── useChatPersistence.ts           # 메시지 저장 (기존)
├── components/
│   └── ai/
│       └── Chat/
│           ├── index.ts                    # 컴포넌트 배럴 export
│           ├── AIChat.tsx                  # 메인 컨테이너 (축소됨)
│           ├── ChatInput/
│           │   ├── index.ts
│           │   ├── ChatInput.tsx
│           │   ├── FilePreview.tsx
│           │   ├── ToolSelector.tsx
│           │   └── ModelSelector.tsx
│           ├── ChatMessages/
│           │   ├── index.ts
│           │   ├── ChatMessageList.tsx
│           │   ├── ChatMessage.tsx
│           │   └── GcodeAnalysisProgress.tsx
│           ├── WelcomeScreen/
│           │   ├── index.ts
│           │   ├── WelcomeScreen.tsx
│           │   ├── ToolCards.tsx
│           │   └── SamplePrompts.tsx
│           ├── Modals/
│           │   ├── index.ts
│           │   ├── NewChatModal.tsx
│           │   ├── ShareModal.tsx
│           │   └── LoginPromptModal.tsx
│           └── ReportPanel/
│               ├── index.ts
│               ├── ReportPanel.tsx
│               ├── ReportTab.tsx
│               ├── ViewerTab.tsx
│               └── EditorTab.tsx
└── types/
    └── chat.ts                             # 채팅 관련 타입 정의
```

### 배럴 파일 (index.ts) 예시

#### hooks/chat/index.ts
```typescript
export { useChatMessages } from './useChatMessages';
export { useChatSession } from './useChatSession';
export { useFileUpload } from './useFileUpload';
export { useGcodeAnalysis } from './useGcodeAnalysis';
export { useChatSharing } from './useChatSharing';
export { useAIResolve } from './useAIResolve';
export { useChatUtils } from './useChatUtils';
export { useChatPersistence } from './useChatPersistence';
```

#### components/ai/Chat/index.ts
```typescript
export { default as AIChat } from './AIChat';
export { ChatInput } from './ChatInput';
export { ChatMessageList } from './ChatMessages';
export { WelcomeScreen } from './WelcomeScreen';
export { ReportPanel } from './ReportPanel';
export * from './Modals';
```

---

## 리팩토링 전략

### Phase 1: 커스텀 훅으로 로직 분리

#### 1.1 `useChatMessages` - 메시지 상태 관리
```typescript
// hooks/chat/useChatMessages.ts
interface UseChatMessages {
  messages: Message[];
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
  loadMessages: (sessionId: string) => Promise<void>;
}
```

**분리할 상태:**
- `messages`
- `isLoading`
- 메시지 CRUD 로직

#### 1.2 `useChatSession` - 세션 관리
```typescript
// hooks/chat/useChatSession.ts
interface UseChatSession {
  sessions: ChatSession[];
  currentSessionId: string | null;
  createSession: (title: string, toolType: string) => Promise<string>;
  loadSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>;
}
```

**분리할 상태:**
- `chatSessions`
- `currentSessionId`
- `currentSessionToolType`
- 세션 관련 핸들러들

#### 1.3 `useFileUpload` - 파일 업로드 관리
```typescript
// hooks/chat/useFileUpload.ts
interface UseFileUpload {
  images: string[];
  imageFiles: File[];
  gcodeFile: File | null;
  gcodeContent: string | null;
  uploadImage: (file: File) => void;
  uploadGcode: (file: File) => Promise<void>;
  removeImage: (index: number) => void;
  clearFiles: () => void;
  handleDrop: (e: React.DragEvent) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
}
```

**분리할 상태:**
- `uploadedImages`
- `imageFiles`
- `gcodeFile`
- `gcodeFileContent`
- 드래그/드롭/붙여넣기 핸들러

#### 1.4 `useGcodeAnalysis` - G-code 분석 상태 (기존 훅 확장)
```typescript
// hooks/chat/useGcodeAnalysis.ts
// 기존 useGcodeAnalysisPolling 확장
interface UseGcodeAnalysis {
  // 폴링 상태
  isAnalyzing: boolean;
  progress: number;
  timeline: TimelineStep[];

  // 보고서 상태
  reportData: GCodeAnalysisData | null;
  reportPanelOpen: boolean;
  activeReportId: string | null;

  // 에디터 상태
  editorContent: string | undefined;
  editorFixInfo: CodeFixInfo | undefined;
  pendingPatches: Map<number, Patch>;

  // 액션
  startAnalysis: (file: File) => Promise<void>;
  openReport: (reportId: string) => Promise<void>;
  closeReport: () => void;
  applyPatch: (lineNumber: number, patch: Patch) => void;
  savePatches: () => Promise<void>;
}
```

**분리할 상태:**
- G-code 분석 폴링 관련 상태 (기존)
- `reportPanelOpen`, `reportPanelTab`
- `editorContent`, `editorFixInfo`
- `pendingPatches`, `resolvedLines`, `revertLineNumber`

#### 1.5 `useChatSharing` - 공유 기능
```typescript
// hooks/chat/useChatSharing.ts
interface UseChatSharing {
  isSharing: boolean;
  shareUrl: string | null;
  showShareModal: boolean;
  shareChat: (messages: Message[]) => Promise<string>;
  copyShareUrl: () => Promise<void>;
  closeShareModal: () => void;
}
```

**분리할 상태:**
- `isSharing`
- `shareUrl`
- `showShareModal`

#### 1.6 `useAIResolve` - AI 해결하기 기능
```typescript
// hooks/chat/useAIResolve.ts
interface UseAIResolve {
  isResolving: boolean;
  startResolve: (info: AIResolveStartInfo) => Promise<void>;
  handleResolveComplete: (info: AIResolveCompleteInfo) => void;
  handleResolveError: (error: string) => void;
}
```

**분리할 상태:**
- `isAIResolving`
- AI 해결 관련 핸들러

---

### Phase 2: 컴포넌트 분리

#### 2.1 디렉토리 구조
```
components/ai/Chat/
├── index.ts                    # 메인 export
├── AIChat.tsx                  # 메인 컨테이너 (축소됨)
├── ChatInput/
│   ├── ChatInput.tsx          # 입력 영역 컴포넌트
│   ├── FilePreview.tsx        # 파일 미리보기 (기존 FilePreviewList)
│   ├── ToolSelector.tsx       # 도구 선택 드롭다운
│   └── ModelSelector.tsx      # 모델 선택 드롭다운
├── ChatMessages/
│   ├── ChatMessageList.tsx    # 메시지 목록 컨테이너
│   ├── ChatMessage.tsx        # 개별 메시지 (기존)
│   └── GcodeAnalysisProgress.tsx # G-code 분석 진행 표시
├── WelcomeScreen/
│   ├── WelcomeScreen.tsx      # 초기 화면
│   ├── ToolCards.tsx          # 도구 카드들
│   └── SamplePrompts.tsx      # 샘플 프롬프트
├── Modals/
│   ├── NewChatModal.tsx       # 새 채팅 유도 모달
│   ├── ShareModal.tsx         # 공유 모달
│   └── LoginPromptModal.tsx   # 로그인 유도 모달 (기존)
└── ReportPanel/
    ├── ReportPanel.tsx        # 보고서 패널 컨테이너
    ├── ReportTab.tsx          # 보고서 탭
    ├── ViewerTab.tsx          # 3D 뷰어 탭
    └── EditorTab.tsx          # 에디터 탭
```

#### 2.2 메인 AIChat.tsx 구조 (리팩토링 후)
```tsx
const AIChat = () => {
  // 커스텀 훅 사용
  const { messages, addMessage, updateMessage, isLoading } = useChatMessages();
  const { sessions, currentSessionId, createSession, loadSession } = useChatSession();
  const { images, gcodeFile, uploadImage, uploadGcode, handleDrop } = useFileUpload();
  const { reportData, reportPanelOpen, openReport, closeReport } = useGcodeAnalysis();
  const { shareChat, shareUrl, showShareModal } = useChatSharing();
  const { isResolving, startResolve } = useAIResolve();

  const isMobile = useIsMobile();

  // 메시지 전송 핸들러 (조합된 로직)
  const handleSend = useCallback(async () => {
    // 훅에서 가져온 함수들 조합
  }, [/* deps */]);

  return (
    <div className="h-screen bg-background flex">
      {/* 사이드바 */}
      {!isMobile && <AppSidebar {...sidebarProps} />}

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col">
        <AppHeader {...headerProps} />

        {messages.length === 0 ? (
          <WelcomeScreen onToolSelect={handleToolSelect} />
        ) : (
          <ChatMessageList
            messages={messages}
            isLoading={isLoading}
            onReportClick={openReport}
          />
        )}

        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          files={{ images, gcodeFile }}
          onDrop={handleDrop}
        />
      </div>

      {/* 보고서 패널 */}
      {reportPanelOpen && (
        <ReportPanel
          data={reportData}
          onClose={closeReport}
        />
      )}

      {/* 모달들 */}
      <NewChatModal {...newChatModalProps} />
      <ShareModal {...shareModalProps} />

      {/* 모바일 네비게이션 */}
      {isMobile && <SharedBottomNavigation />}
    </div>
  );
};
```

---

### Phase 3: 상태 관리 개선

#### 3.1 Context 도입 검토
```typescript
// contexts/ChatContext.tsx
interface ChatContextValue {
  // 메시지 상태
  messages: Message[];

  // 세션 상태
  currentSession: ChatSession | null;

  // 분석 상태
  analysisState: AnalysisState;

  // 액션
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  // ...
}
```

#### 3.2 Zustand 또는 Jotai 도입 검토 (선택적)
- 복잡한 상태 관리가 필요한 경우
- 전역 상태와 로컬 상태 분리 필요 시

---

### Phase 4: 타입 개선

#### 4.1 타입 파일 분리
```typescript
// types/chat.ts
export interface Message {
  id: string;
  dbMessageId?: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: string[];
  files?: FileInfo[];
  reportCard?: ReportCardData;
  codeFixes?: CodeFixInfo[];
  references?: Reference[];
  suggestedActions?: SuggestedAction[];
  referenceImages?: ReferenceImageData;
}

export interface ChatSession {
  id: string;
  title: string;
  toolType: ChatToolType;
  createdAt: Date;
  lastMessageAt: Date;
}

export type ChatToolType = 'general' | 'troubleshoot' | 'gcode' | 'modeling';
export type ChatMode = 'general' | 'troubleshoot' | 'gcode' | 'modeling';
```

---

## 구현 우선순위

### 높음 (즉시)
1. `useFileUpload` 훅 분리 - 가장 독립적
2. `useChatSharing` 훅 분리 - 기능이 명확히 분리됨
3. 타입 파일 분리

### 중간 (2주 내)
4. `useChatSession` 훅 분리
5. `useChatMessages` 훅 분리
6. `WelcomeScreen` 컴포넌트 분리
7. `ChatInput` 컴포넌트 분리

### 낮음 (1달 내)
8. `useGcodeAnalysis` 훅 확장
9. `useAIResolve` 훅 분리
10. `ReportPanel` 컴포넌트 분리
11. Context 도입 검토

---

## 예상 결과

### 파일 크기 변화
| 항목 | 현재 | 리팩토링 후 |
|------|------|-------------|
| AIChat.tsx | 2,877줄 | ~500줄 |
| 커스텀 훅 (6개) | 0줄 | ~1,200줄 |
| 분리된 컴포넌트 | 0줄 | ~800줄 |
| 타입 파일 | 0줄 | ~200줄 |

### 장점
- 각 모듈 단위 테스트 가능
- 코드 재사용성 향상
- 유지보수 용이
- 새로운 개발자 온보딩 시간 단축
- 버그 추적 용이

### 위험 요소
- 리팩토링 중 기능 회귀 가능성
- 상태 의존성 파악 오류 가능
- 일시적인 개발 속도 저하

---

## 마이그레이션 전략

1. **브랜치 전략**: `refactor/aichat-split` 브랜치에서 작업
2. **점진적 마이그레이션**: 기능별로 하나씩 분리
3. **테스트 작성**: 분리 전 통합 테스트 작성 → 분리 후 단위 테스트 추가
4. **코드 리뷰**: 각 PR마다 철저한 리뷰

---

## 참고: 기존 리팩토링 시도

파일 상단 주석에 따르면 이미 일부 리팩토링이 진행됨:
```
* 리팩토링된 구조:
* - useChatUtils: 순수 유틸리티 함수 (detectToolType, createMessage 등)
* - useChatSession: 세션 관리 로직
* - useChatPersistence: 메시지 저장 로직
* - useChatGcodeAnalysis: G-code 분석 후처리
```

`@/hooks/chat`에서 유틸리티 함수들이 이미 분리되어 있음. 이를 기반으로 확장 진행.
