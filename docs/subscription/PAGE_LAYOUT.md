# 페이지별 레이아웃 구성

## 개요

각 페이지에서 사용하는 `AppSidebar`, `AppHeader`, 그리고 사이드바 컨텐츠 컴포넌트 정리입니다.

## SidebarContent 컴포넌트 목록

| 컴포넌트 | 파일 경로 | 용도 |
|----------|----------|------|
| `ChatSidebarContent` | `components/sidebar/ChatSidebarContent.tsx` | AI 채팅 세션 목록, G-code 보고서 아카이브 |
| `DashboardSidebarContent` | `components/sidebar/DashboardSidebarContent.tsx` | 프린터 퀵 메뉴, 그룹 필터 |
| `SettingsSidebarContent` | `components/sidebar/SettingsSidebarContent.tsx` | 설정 탭 네비게이션 |
| `PrinterDetailSidebarContent` | `components/sidebar/PrinterDetailSidebarContent.tsx` | 프린터 상세 탭 네비게이션 |
| `CommunitySidebarContent` | `components/sidebar/CommunitySidebarContent.tsx` | 커뮤니티 통계, 내 활동 |
| `AdminSidebarContent` | `components/sidebar/AdminSidebarContent.tsx` | 관리자 메뉴 네비게이션 |
| `CreateSidebarContent` | `components/sidebar/CreateSidebarContent.tsx` | AI 3D 모델 아카이브 |

---

## 페이지별 구성

### 1. Dashboard (`/dashboard`)

**파일**: `pages/Dashboard.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ✅ | `DashboardSidebarContent` |
| userPlan | ✅ | `useUserPlan` 훅 사용 |

```tsx
import { DashboardSidebarContent } from "@/components/sidebar";
import { useUserPlan } from "@shared/hooks/useUserPlan";

const { plan: userPlan } = useUserPlan(user?.id);

<AppSidebar userPlan={userPlan}>
  <DashboardSidebarContent
    printers={quickPrinters}
    activePrinterId={activePrinterId}
    onPrinterClick={handlePrinterClick}
    groups={groups}
    selectedGroupId={selectedGroupId}
    onGroupSelect={setSelectedGroupId}
    onResetFilter={() => setSelectedGroupId(null)}
  />
</AppSidebar>
```

---

### 2. AI Chat (`/ai/chat`)

**파일**: `pages/AIChat.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ✅ | `ChatSidebarContent` |
| userPlan | ✅ | `useUserPlan` 훅 사용 |

```tsx
import { ChatSidebarContent } from "@/components/sidebar";
import { useUserPlan } from "@shared/hooks/useUserPlan";

const { plan: userPlan } = useUserPlan(user?.id);

<AppSidebar userPlan={userPlan}>
  <ChatSidebarContent
    chatSessions={chatSessions}
    currentSessionId={currentSessionId}
    onSessionSelect={handleSessionSelect}
    onNewChat={handleNewChat}
    onDeleteSession={handleDeleteSession}
    reportArchive={reportArchive}
    onReportSelect={handleReportSelect}
    currentReportId={currentReportId}
  />
</AppSidebar>
```

---

### 3. G-code Analytics (`/ai/gcode-analytics`)

**파일**: `pages/GCodeAnalytics.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ✅ | `ChatSidebarContent` |
| userPlan | ✅ | `useUserPlan` 훅 사용 |

```tsx
import { ChatSidebarContent } from "@/components/sidebar";
import { useUserPlan } from "@shared/hooks/useUserPlan";

const { plan: userPlan } = useUserPlan(user?.id);

<AppSidebar userPlan={userPlan}>
  <ChatSidebarContent ... />
</AppSidebar>
```

---

### 4. AI Create (`/ai/create`)

**파일**: `pages/AI.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ❌ | 별도 AIModelArchiveSidebar 사용 |
| userPlan | ❌ | 미사용 (별도 구독 체크 로직) |

> 주의: 이 페이지는 `AppSidebar` 대신 `AIModelArchiveSidebar`를 사용합니다.

---

### 5. User Settings (`/user-settings`)

**파일**: `pages/UserSettings.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ✅ | `SettingsSidebarContent` |
| userPlan | ✅ | `useUserPlan` 훅 사용 |

```tsx
import { SettingsSidebarContent } from "@/components/sidebar";
import { useUserPlan } from "@shared/hooks/useUserPlan";

const { plan: userPlan } = useUserPlan(user?.id);

<AppSidebar userPlan={userPlan}>
  <SettingsSidebarContent
    activeTab={activeTab}
    onTabChange={setActiveTab}
    user={user}
    userPlan={userPlan}
  />
</AppSidebar>
```

---

### 6. Printer Detail (`/printer/:id`)

**파일**: `pages/PrinterDetail.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ✅ | `PrinterDetailSidebarContent` |
| userPlan | ✅ | `useUserPlan` 훅 사용 |

```tsx
import { PrinterDetailSidebarContent } from "@/components/sidebar";
import { useUserPlan } from "@shared/hooks/useUserPlan";

const { plan: userPlan } = useUserPlan(user?.id);

<AppSidebar userPlan={userPlan}>
  <PrinterDetailSidebarContent
    activeTab={activeTab}
    onTabChange={setActiveTab}
    printer={printer}
    onBackToDashboard={() => navigate('/dashboard')}
  />
</AppSidebar>
```

---

### 7. Community (`/community`)

**파일**: `pages/Community.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ✅ | `CommunitySidebarContent` |
| userPlan | ✅ | `useUserPlan` 훅 사용 |

```tsx
import { CommunitySidebarContent } from "@/components/sidebar";
import { useUserPlan } from "@shared/hooks/useUserPlan";

const { plan: userPlan } = useUserPlan(user?.id);

<AppSidebar userPlan={userPlan}>
  <CommunitySidebarContent
    stats={stats}
    recentPosts={myRecentPosts}
    recentComments={myRecentComments}
    onNavigateToPost={handleNavigateToPost}
    onWritePost={() => navigate('/community/create')}
  />
</AppSidebar>
```

---

### 8. Community Post (`/community/:postId`)

**파일**: `pages/CommunityPost.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ✅ | `CommunitySidebarContent` |
| userPlan | ✅ | `useUserPlan` 훅 사용 |

```tsx
import { CommunitySidebarContent } from "@/components/sidebar";
import { useUserPlan } from "@shared/hooks/useUserPlan";

const { plan: userPlan } = useUserPlan(user?.id);

<AppSidebar userPlan={userPlan}>
  <CommunitySidebarContent ... />
</AppSidebar>
```

---

### 9. Create Post (`/community/create`)

**파일**: `pages/CreatePost.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ✅ | `CommunitySidebarContent` |
| userPlan | ✅ | `useUserPlan` 훅 사용 |

```tsx
import { CommunitySidebarContent } from "@/components/sidebar";
import { useUserPlan } from "@shared/hooks/useUserPlan";

const { plan: userPlan } = useUserPlan(user?.id);

<AppSidebar userPlan={userPlan}>
  <CommunitySidebarContent ... />
</AppSidebar>
```

---

### 10. Edit Post (`/community/edit/:postId`)

**파일**: `pages/EditPost.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ✅ | `CommunitySidebarContent` |
| userPlan | ✅ | `useUserPlan` 훅 사용 |

```tsx
import { CommunitySidebarContent } from "@/components/sidebar";
import { useUserPlan } from "@shared/hooks/useUserPlan";

const { plan: userPlan } = useUserPlan(user?.id);

<AppSidebar userPlan={userPlan}>
  <CommunitySidebarContent ... />
</AppSidebar>
```

---

### 11. Admin (`/admin`)

**파일**: `pages/Admin.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ✅ | `AdminSidebarContent` |
| userPlan | ❌ | 관리자 페이지 (플랜 표시 불필요) |

```tsx
import { AdminSidebarContent } from "@/components/sidebar";

<AppSidebar>
  <AdminSidebarContent
    activeSection={activeSection}
    onSectionChange={setActiveSection}
  />
</AppSidebar>
```

---

### 12. Admin AI Analytics (`/admin/ai-analytics`)

**파일**: `pages/AdminAIAnalytics.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ✅ | `AdminSidebarContent` |
| userPlan | ❌ | 관리자 페이지 |

---

### 13. Admin Chat Analytics (`/admin/chat-analytics`)

**파일**: `pages/AdminChatAnalytics.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ✅ | `AdminSidebarContent` |
| userPlan | ❌ | 관리자 페이지 |

---

### 14. Admin Model Analytics (`/admin/model-analytics`)

**파일**: `pages/AdminModelAnalytics.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ✅ | `AdminSidebarContent` |
| userPlan | ❌ | 관리자 페이지 |

---

### 15. Admin Usage Analytics (`/admin/usage-analytics`)

**파일**: `pages/AdminUsageAnalytics.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ✅ | `AdminSidebarContent` |
| userPlan | ❌ | 관리자 페이지 |

---

### 16. Admin Users (`/admin/users`)

**파일**: `pages/AdminUsers.tsx`

| 구성요소 | 사용 여부 | 내용 |
|----------|----------|------|
| AppHeader | ✅ | 기본 헤더 |
| AppSidebar | ✅ | `AdminSidebarContent` |
| userPlan | ❌ | 관리자 페이지 |

---

## 요약 테이블

| 페이지 | 경로 | SidebarContent | userPlan |
|--------|------|----------------|----------|
| Dashboard | `/dashboard` | DashboardSidebarContent | ✅ |
| AI Chat | `/ai/chat` | ChatSidebarContent | ✅ |
| G-code Analytics | `/ai/gcode-analytics` | ChatSidebarContent | ✅ |
| AI Create | `/ai/create` | (별도 사이드바) | ❌ |
| User Settings | `/user-settings` | SettingsSidebarContent | ✅ |
| Printer Detail | `/printer/:id` | PrinterDetailSidebarContent | ✅ |
| Community | `/community` | CommunitySidebarContent | ✅ |
| Community Post | `/community/:postId` | CommunitySidebarContent | ✅ |
| Create Post | `/community/create` | CommunitySidebarContent | ✅ |
| Edit Post | `/community/edit/:postId` | CommunitySidebarContent | ✅ |
| Admin | `/admin` | AdminSidebarContent | ❌ |
| Admin AI Analytics | `/admin/ai-analytics` | AdminSidebarContent | ❌ |
| Admin Chat Analytics | `/admin/chat-analytics` | AdminSidebarContent | ❌ |
| Admin Model Analytics | `/admin/model-analytics` | AdminSidebarContent | ❌ |
| Admin Usage Analytics | `/admin/usage-analytics` | AdminSidebarContent | ❌ |
| Admin Users | `/admin/users` | AdminSidebarContent | ❌ |

---

## AppSidebar Props

`AppSidebar` 컴포넌트에 전달되는 주요 props:

| Prop | Type | 필수 | 설명 |
|------|------|------|------|
| `children` | ReactNode | ✅ | SidebarContent 컴포넌트 |
| `userPlan` | SubscriptionPlan | ❌ | 구독 플랜 (뱃지 표시용) |
| `onLogout` | () => void | ❌ | 로그아웃 핸들러 |

### userPlan 전달 패턴

```tsx
// 1. useUserPlan 훅으로 플랜 조회
const { plan: userPlan } = useUserPlan(user?.id);

// 2. AppSidebar에 전달
<AppSidebar userPlan={userPlan}>
  <SidebarContent ... />
</AppSidebar>
```

> **중요**: `userPlan`을 전달하지 않으면 기본값 `'free'`로 표시됩니다.

---

## AppHeader 구성

`AppHeader`는 모든 페이지에서 동일한 구조를 사용합니다.

| 요소 | 설명 |
|------|------|
| 로고 | FACTOR 로고 (홈 링크) |
| 네비게이션 | Dashboard, AI, Community 링크 |
| 사용자 메뉴 | 프로필, 설정, 로그아웃 |
| 플랜 뱃지 | 현재 구독 플랜 표시 |

### AppHeader 내부 구독 표시

`AppHeader`는 내부적으로 `useUserPlan` 훅을 호출하여 플랜을 표시합니다:

```tsx
// AppHeader.tsx 내부
const { plan: userPlan } = useUserPlan(user?.id);
```

---

*마지막 업데이트: 2026-01-17*
