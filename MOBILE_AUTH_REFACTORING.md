# 모바일 OAuth 인증 구조 리팩토링 계획

## 현재 문제점

### 1. 복잡하고 불명확한 책임 분리
- `useDeepLinkHandler`가 토큰 추출, setSession 호출, 네비게이션까지 모두 담당
- AuthContext와 딥링크 핸들러 사이 타이밍 동기화 문제
- localStorage 직접 조작, window.location.href 등 임시방편 코드

### 2. 타이밍 이슈
- setSession API 호출이 응답하지 않음 (singleTask 모드 앱 재시작 환경)
- navigate() 실행 시점에 AuthContext가 아직 세션을 인식 못함
- ProtectedRoute가 `user === null`로 판단하여 로그인 페이지로 리다이렉트

### 3. 에러 처리 불명확
- 실패 시 어디서 어떻게 처리할지 일관성 없음
- 재시도 로직 없음
- 디버깅이 어려움

---

## 리팩토링 목표

### 핵심 원칙
1. **단일 책임 원칙**: 각 컴포넌트는 하나의 명확한 역할만
2. **단일 진실 공급원**: AuthContext가 모든 인증 상태 관리
3. **명확한 데이터 흐름**: 딥링크 → AuthContext → ProtectedRoute
4. **타이밍 보장**: setSession 완료 전까지 loading 상태 유지

---

## 새로운 구조 설계

### 1. AuthContext (단일 진실 공급원)
**역할**: 모든 인증 상태 관리

**상태**:
- `user: User | null` - 현재 사용자
- `loading: boolean` - 인증 상태 로딩 중 여부
- `session: Session | null` - 현재 세션

**핵심 로직**:
```typescript
// 초기화
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    // SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED 등 이벤트 처리
    setUser(session?.user ?? null);
    setSession(session);
    setLoading(false);
  });

  // 초기 세션 체크
  supabase.auth.getSession().then(({ data: { session } }) => {
    setUser(session?.user ?? null);
    setSession(session);
    setLoading(false);
  });
});
```

**새로 추가할 함수**:
```typescript
setSessionFromDeepLink: async (accessToken: string, refreshToken: string) => {
  setLoading(true); // 세션 설정 중 로딩 상태

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data?.session) {
    setLoading(false);
    return { error };
  }

  // onAuthStateChange가 자동으로 user/session 업데이트
  // loading은 onAuthStateChange에서 false로 변경
  return { error: null };
}
```

---

### 2. useDeepLinkHandler (토큰 추출 전담)
**역할**: 딥링크 URL에서 토큰 추출하고 AuthContext에 전달

**단순화된 로직**:
```typescript
const processDeepLink = async (rawUrl: string) => {
  // 1. 브라우저 닫기
  await Browser.close();

  // 2. URL 파싱
  const url = new URL(rawUrl);
  const params = new URLSearchParams(url.hash.substring(1) || url.search.substring(1));

  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");

  if (!access_token || !refresh_token) {
    console.error("[DeepLink] No tokens found");
    return;
  }

  // 3. AuthContext에 전달 (끝)
  const { error } = await setSessionFromDeepLink(access_token, refresh_token);

  if (error) {
    console.error("[DeepLink] Failed to set session:", error);
  }

  // 네비게이션 안 함! ProtectedRoute와 App 라우팅이 알아서 처리
};
```

**제거할 것**:
- ❌ navigate() 호출
- ❌ localStorage 직접 조작
- ❌ window.location.href
- ❌ setSession 직접 호출
- ❌ 타임아웃 로직

---

### 3. ProtectedRoute (변경 없음)
**역할**: AuthContext 상태 기반 라우팅

```typescript
if (loading) {
  return <div>Loading...</div>; // 또는 스피너
}

if (!user) {
  return <Navigate to="/" replace />;
}

return <>{children}</>;
```

**동작 보장**:
- `loading === true` 동안: 로딩 화면 표시
- setSession 완료 후 `loading === false` + `user !== null`: 자식 컴포넌트 렌더링
- 실패 시 `loading === false` + `user === null`: 로그인 페이지로 리다이렉트

---

### 4. App 라우팅
**역할**: URL 기반 라우팅

```typescript
<Routes>
  <Route path="/" element={<LoginPage />} />
  <Route path="/dashboard" element={
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  } />
</Routes>
```

**OAuth 성공 플로우**:
1. 딥링크 처리 → setSessionFromDeepLink 호출 → loading: true
2. setSession 완료 → onAuthStateChange 발동 → user 업데이트, loading: false
3. 사용자가 `/dashboard`로 이동 시도 (또는 자동 이동)
4. ProtectedRoute: loading === false && user !== null → 통과
5. DashboardPage 렌더링 ✅

**OAuth 실패 플로우**:
1. 딥링크 처리 → setSessionFromDeepLink 호출 → loading: true
2. setSession 실패 → error 로깅, loading: false
3. 사용자가 `/dashboard`로 이동 시도
4. ProtectedRoute: loading === false && user === null → `/`로 리다이렉트
5. LoginPage에서 재시도 가능

---

## 플로우 다이어그램

### 성공 케이스
```
1. 사용자 Google 로그인 버튼 클릭
   ↓
2. signInWithGoogle() → Browser.open(OAuth URL)
   ↓
3. 외부 브라우저에서 Google 로그인
   ↓
4. com.factor.app://auth/callback#access_token=xxx&refresh_token=yyy
   ↓
5. MainActivity → JavaScript 이벤트 발송
   ↓
6. useDeepLinkHandler: 토큰 추출
   ↓
7. setSessionFromDeepLink(access_token, refresh_token)
   - AuthContext: loading = true
   ↓
8. supabase.auth.setSession() 완료
   ↓
9. onAuthStateChange("SIGNED_IN", session)
   - AuthContext: user = session.user, loading = false
   ↓
10. 앱이 /dashboard에 있다면:
    - ProtectedRoute: loading=false, user!=null → 통과
    - DashboardPage 렌더링 ✅

    앱이 /에 있다면:
    - LoginPage에서 useEffect: user가 있으면 /dashboard로 이동
```

### 실패 케이스
```
1-6. (위와 동일)
   ↓
7. setSessionFromDeepLink(access_token, refresh_token)
   - AuthContext: loading = true
   ↓
8. supabase.auth.setSession() 실패
   - error 로깅
   - AuthContext: loading = false (user는 여전히 null)
   ↓
9. ProtectedRoute: loading=false, user=null → /로 리다이렉트
   ↓
10. LoginPage: 에러 메시지 표시 (옵션)
```

---

## 구현 단계

### Step 1: AuthContext에 setSessionFromDeepLink 추가
**파일**: `packages/shared/src/contexts/AuthContext.tsx`

```typescript
const setSessionFromDeepLink = async (accessToken: string, refreshToken: string) => {
  console.log('[Auth] setSessionFromDeepLink called');
  setLoading(true);

  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error || !data?.session) {
      console.error('[Auth] setSession failed:', error);
      setLoading(false);
      return { error: error || new Error('No session returned') };
    }

    console.log('[Auth] setSession success, waiting for onAuthStateChange...');
    // onAuthStateChange가 자동으로 user/session 업데이트하고 loading=false 설정
    return { error: null };
  } catch (e) {
    console.error('[Auth] setSession exception:', e);
    setLoading(false);
    return { error: e };
  }
};
```

**value에 추가**:
```typescript
const value: AuthContextType = {
  // ... 기존 속성들
  setSessionFromDeepLink,
};
```

---

### Step 2: useDeepLinkHandler 단순화
**파일**: `packages/mobile/src/hooks/useDeepLinkHandler.ts`

**변경 전** (100+ 줄):
- localStorage 조작
- window.location.href
- navigate() 호출
- 복잡한 에러 처리

**변경 후** (50줄 이하):
```typescript
import { useAuth } from "@shared/contexts/AuthContext";

export function useDeepLinkHandler() {
  const { setSessionFromDeepLink } = useAuth();

  const processDeepLink = async (rawUrl: string) => {
    if (!rawUrl) return;
    console.log("[DeepLink] Processing:", rawUrl);

    // 1. 브라우저 닫기
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.close();
    } catch {}

    // 2. URL 파싱
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      console.error("[DeepLink] Invalid URL");
      return;
    }

    const fragment = url.hash.substring(1);
    const params = new URLSearchParams(fragment || url.search.substring(1));

    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) {
      console.error("[DeepLink] No tokens found");
      return;
    }

    console.log("[DeepLink] Tokens extracted, calling setSessionFromDeepLink...");

    // 3. AuthContext에 전달
    const { error } = await setSessionFromDeepLink(access_token, refresh_token);

    if (error) {
      console.error("[DeepLink] Failed to set session:", error);
    } else {
      console.log("[DeepLink] Session set successfully");
    }
  };

  // 나머지 이벤트 리스너 로직은 동일
}
```

---

### Step 3: LoginPage 개선 (옵션)
**파일**: `packages/mobile/src/pages/LoginPage.tsx`

사용자가 이미 로그인되어 있으면 자동으로 대시보드로 이동:

```typescript
const { user, loading } = useAuth();

useEffect(() => {
  if (!loading && user) {
    navigate('/dashboard', { replace: true });
  }
}, [loading, user, navigate]);
```

---

## 예상 효과

### 1. 코드 복잡도 감소
- useDeepLinkHandler: 100+ 줄 → 50줄
- 명확한 책임 분리
- 디버깅 용이

### 2. 타이밍 이슈 해결
- setSession 완료 전까지 loading: true 보장
- ProtectedRoute가 loading 상태를 보고 대기
- onAuthStateChange가 자동으로 상태 업데이트

### 3. 에러 처리 개선
- setSession 실패 시 명확한 에러 로깅
- 사용자에게 재시도 기회 제공
- 예상 가능한 동작

### 4. 유지보수성 향상
- 각 컴포넌트 역할 명확
- 테스트 용이
- 확장 가능

---

## 검증 방법

### 테스트 시나리오 1: 성공 케이스
1. 앱 실행 → 로그인 페이지
2. Google 로그인 클릭
3. 외부 브라우저에서 로그인
4. 앱으로 돌아옴
5. **기대 결과**: 로딩 화면 → 대시보드 표시

### 테스트 시나리오 2: 재로그인
1. 대시보드에서 로그아웃
2. Google 로그인 클릭
3. 외부 브라우저에서 로그인
4. 앱으로 돌아옴
5. **기대 결과**: 로딩 화면 → 대시보드 표시

### 테스트 시나리오 3: 네트워크 실패
1. 네트워크 끊기
2. Google 로그인 클릭
3. 외부 브라우저에서 로그인
4. 앱으로 돌아옴 (딥링크 도착하지만 setSession 실패)
5. **기대 결과**: 에러 로그 + 로그인 페이지 유지

---

## 롤백 계획

만약 리팩토링 후 문제가 발생하면:

1. Git으로 이전 커밋으로 되돌리기
2. 단계별로 다시 적용 (AuthContext → useDeepLinkHandler → LoginPage)
3. 각 단계마다 테스트

---

## 다음 단계

1. ✅ 리팩토링 계획 문서 작성
2. ⏳ AuthContext에 setSessionFromDeepLink 구현
3. ⏳ useDeepLinkHandler 단순화
4. ⏳ 빌드 및 테스트
5. ⏳ 문제 발생 시 디버깅 및 수정
