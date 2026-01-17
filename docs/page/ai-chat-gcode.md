# AI Chat G-code 분석 흐름

## 개요

AI Chat 페이지에서 G-code 파일 분석 및 보고서 생성 흐름입니다.

## 파일 위치

| 구분 | 경로 |
|------|------|
| 페이지 | `packages/web/src/pages/AIChat.tsx` |
| G-code 컨트롤러 | `packages/web/src/features/ai-chat/hooks/useGcodeController.ts` |
| 폴링 훅 | `packages/web/src/features/ai-chat/hooks/useGcodePolling.ts` |
| 보고서 컴포넌트 | `packages/web/src/components/ai/GCodeAnalytics/GCodeAnalysisReport.tsx` |
| 채팅 메시지 | `packages/web/src/components/ai/ChatMessage.tsx` |
| DB 서비스 | `packages/shared/src/services/supabaseService/chat.ts` |

---

## 전체 흐름 다이어그램

```
┌─────────────────┐
│  사용자가 G-code │
│  파일 업로드     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  sendChat() 호출│
│  (API 요청)     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  API 응답: analysisId, fileName 포함     │
│  → gcode.startAnalysis() 호출            │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  useGcodePolling: 분석 상태 폴링          │
│  (세그먼트 추출 → LLM 분석 진행 중)        │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  분석 완료: onReportCardReady 콜백       │
│  1. chatMessages.updateMessageReportCard │
│  2. DB metadata에 reportCard 저장        │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ 보고서 패널 표시 │     │ 채팅 메시지에    │
│ (GCodeAnalysis  │     │ 보고서 카드 표시 │
│  Report)        │     │                 │
└─────────────────┘     └─────────────────┘
```

---

## 상세 흐름

### 1. G-code 파일 업로드

```typescript
// AIChat.tsx - 파일 업로드 핸들러
const fileUpload = useFileUpload();

<input
  ref={fileUpload.gcodeInputRef}
  type="file"
  accept=".gcode,.gco,.gc,.g,.nc,.ngc"
  onChange={fileUpload.handleGcodeUpload}
/>
```

### 2. API 요청 및 분석 시작

```typescript
// AIChat.tsx - sendChat 내부
const result = await sendChat({ ... });

if (apiResult.analysisId) {
  // G-code 분석 시작
  gcode.startAnalysis({
    analysisId: apiResult.analysisId,
    fileName: apiResult.fileName,
    messageId: assistantMessage.id,
    dbMessageId: savedDbMessageId,
    sessionId,
    gcodeContent: currentGcodeContent,

    // 분석 완료 시 콜백
    onReportCardReady: async (reportCard, messageId) => {
      // 1. 메시지 상태에 reportCard 추가
      if (messageId) {
        chatMessages.updateMessageReportCard(messageId, reportCard);
      }

      // 2. DB에 reportCard 저장
      if (savedDbMessageId) {
        await supabase
          .from('chat_messages')
          .update({
            metadata: {
              tool: 'gcode',
              reportCard: reportCard,
            }
          })
          .eq('id', savedDbMessageId);
      }
    },
  });
}
```

### 3. 분석 폴링 (useGcodePolling)

```typescript
// useGcodeController.ts
const startAnalysis = useCallback((params) => {
  panel.openReportPanel();

  polling.startPolling({
    ...params,
    onReportCardReady: (reportCard) => {
      // 보고서 아카이브에 추가
      setReportArchive(prev => [...]);

      // 콜백 호출
      params.onReportCardReady?.(reportCard, params.messageId);
    },
  });
}, [...]);
```

### 4. 보고서 카드 데이터 구조

```typescript
// chat.ts - ChatMessageMetadata
interface ReportCard {
  reportId: string;      // 분석 보고서 ID
  fileName: string;      // G-code 파일명
  overallScore?: number; // 품질 점수 (0-100)
  overallGrade?: string; // 등급 (A, B, C, D, F)
  totalIssues?: number;  // 발견된 이슈 수
  layerCount?: number;   // 레이어 수
  printTime?: string;    // 예상 출력 시간
}
```

### 5. DB 저장 구조

```sql
-- chat_messages 테이블
{
  id: "message-uuid",
  session_id: "session-uuid",
  user_id: "user-uuid",
  type: "assistant",
  content: "G-code 분석 시작! ...",
  metadata: {
    tool: "gcode",
    reportCard: {
      reportId: "report-uuid",
      fileName: "model.gcode",
      overallScore: 95,
      overallGrade: "A",
      totalIssues: 3,
      layerCount: 149,
      printTime: "01:42:02"
    }
  }
}
```

---

## 대화 불러오기 시 흐름

### handleLoadSession

```typescript
// AIChat.tsx
const handleLoadSession = useCallback(async (session) => {
  const messages = await getChatMessages(sessionId);

  const formattedMessages = messages.map(m => ({
    id: m.id,
    role: m.type === 'user' ? 'user' : 'assistant',
    content: m.content,
    timestamp: new Date(m.created_at),
    // metadata에서 reportCard 추출
    reportCard: (m.metadata as any)?.reportCard,
    codeFixes: (m.metadata as any)?.codeFixes,
    // ... 기타 필드
  }));

  chatMessages.loadSessionMessages(formattedMessages);
}, [...]);
```

### ChatMessage 렌더링

```typescript
// ChatMessage.tsx
{message.reportCard && onReportCardClick && (
  <GCodeReportCard
    reportId={message.reportCard.reportId}
    fileName={message.reportCard.fileName}
    overallScore={message.reportCard.overallScore}
    overallGrade={message.reportCard.overallGrade}
    totalIssues={message.reportCard.totalIssues}
    layerCount={message.reportCard.layerCount}
    printTime={message.reportCard.printTime}
    onClick={() => onReportCardClick(message.reportCard!.reportId)}
  />
)}
```

---

## 주요 훅/함수

### useGcodeController

G-code 분석 관련 모든 상태와 액션을 통합 관리합니다.

| 반환값 | 타입 | 설명 |
|--------|------|------|
| `isAnalyzing` | boolean | 분석 진행 중 여부 |
| `reportData` | GCodeAnalysisData | 분석 결과 데이터 |
| `reportPanelOpen` | boolean | 보고서 패널 열림 상태 |
| `reportArchive` | ReportArchiveItem[] | 보고서 아카이브 목록 |
| `startAnalysis` | function | 분석 시작 |
| `closeReportPanel` | function | 보고서 패널 닫기 |

### useChatMessages

채팅 메시지 상태 관리 훅입니다.

| 함수 | 설명 |
|------|------|
| `addMessage` | 새 메시지 추가 |
| `updateMessage` | 메시지 업데이트 |
| `updateMessageReportCard` | 메시지에 reportCard 추가 |
| `loadSessionMessages` | 세션 메시지 로드 |

---

## 트러블슈팅

### 대화 불러올 때 보고서 카드가 비어있음

**원인**: `onReportCardReady` 콜백에서 DB에 reportCard를 저장하지 않음

**해결**: AIChat.tsx에서 `gcode.startAnalysis` 호출 시 `onReportCardReady` 콜백 추가

```typescript
gcode.startAnalysis({
  ...params,
  onReportCardReady: async (reportCard, messageId) => {
    // 메시지 상태 업데이트
    chatMessages.updateMessageReportCard(messageId, reportCard);

    // DB 저장
    await supabase
      .from('chat_messages')
      .update({ metadata: { tool: 'gcode', reportCard } })
      .eq('id', savedDbMessageId);
  },
});
```

### 보고서 패널과 헤더 레이아웃 이슈

**문제 1**: 보고서 패널이 헤더를 침범함
**문제 2**: 보고서 패널이 헤더와 형제 요소일 때 헤더가 찌그러짐

**해결**: 보고서 패널을 채팅 영역 내부(헤더 아래)에서 렌더링

```tsx
{/* 채팅 영역 */}
<div className="flex-1 flex flex-col min-w-0">
  {/* 헤더 - 전체 너비 유지 */}
  <AppHeader ... />

  {/* 채팅 + 보고서 패널 컨테이너 (헤더 아래 flex row) */}
  <div className="flex-1 flex min-h-0">
    {/* 채팅 메시지 영역 */}
    <div className={cn(
      "flex-1 flex flex-col min-w-0 transition-all duration-300",
      (gcode.isAnalyzing || gcode.reportPanelOpen) && "flex-[0_0_48%]"
    )}>
      <ScrollArea>...</ScrollArea>
      {/* 하단 입력창 */}
    </div>

    {/* G-code 보고서 패널 (채팅 영역 내부, 헤더 아래) */}
    {(gcode.isAnalyzing || gcode.reportPanelOpen) && (
      <div className="flex-[0_0_52%] flex flex-col min-w-0 bg-muted/20">
        <div className="flex-1 overflow-hidden pr-4 pb-4">
          <GCodeAnalysisReport ... />
        </div>
      </div>
    )}
  </div>
</div>
```

이렇게 하면:
- 헤더가 전체 너비를 유지
- 보고서 패널이 헤더를 침범하지 않음
- 채팅 영역과 보고서 패널이 헤더 아래에서 나란히 표시됨

---

## 관련 문서

- [PAGE_LAYOUT.md](../subscription/PAGE_LAYOUT.md) - 페이지별 레이아웃 구성
- [AI_TOOLS.md](../AI_TOOLS.md) - AI 도구 전체 구조

---

*마지막 업데이트: 2026-01-17*
