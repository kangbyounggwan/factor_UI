# AuthContext 리팩토링 계획

## 현재 문제점 분석

### 1. onAuthStateChange 핸들러 과부하
- **문제**: 이벤트 핸들러 안에서 너무 많은 작업 수행
  - 프로필 체크
  - Role 로딩
  - MQTT 구독
  - Mobile push 초기화
  - profileCheckComplete 관리
  - setTimeout / Promise.race 등
- **결과**: PKCE + 토큰 리프레시 + 멀티탭 상황에서 이벤트가 여러 번 들어오면 로직 중첩

### 2. 공격적인 세션 에러 처리
- **문제**: 에러 발생 시 전역 signOut + localStorage 전체 삭제
```typescript
// 현재 코드 - 위험한 패턴
Object.keys(localStorage)
  .filter((k) => k.startsWith("sb-"))
  .forEach((k) => localStorage.removeItem(k));
await supabase.auth.signOut({ scope: 'global' });
```
- **결과**: 한 탭에서 에러 → 모든 탭/디바이스 세션 삭제 → 다른 탭도 에러 → 무한 로그아웃 루프

### 3. 중복 세션 동기화
- **문제**: Supabase multiTab 기능 + 커스텀 storage 이벤트 리스너 중복
- **결과**: 불필요한 getSession 호출, 상태 불일치

### 4. 복잡한 초기화 로직
- **문제**: sessionKickTimer, authEventReceivedRef 등 복잡한 타이밍 제어
- **결과**: 디버깅 어려움, 엣지 케이스 대응 힘듦

---

## 리팩토링 목표

1. **단순화**: onAuthStateChange는 세션/유저 상태만 관리
2. **분리**: 부가 로직(프로필, MQTT)은 별도 useEffect로 분리
3. **안전화**: 에러 처리 시 전역 영향 최소화
4. **신뢰**: Supabase 내장 기능(multiTab) 활용

---

## 리팩토링 단계

### Phase 1: onAuthStateChange 단순화

#### Before (현재)
```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    // 50줄 이상의 복잡한 로직
    // - 프로필 체크
    // - Role 로딩
    // - MQTT 구독
    // - 에러 처리
    // - 등등...
  });

  // sessionKickTimer 로직...

  return () => subscription.unsubscribe();
}, []);
```

#### After (개선)
```typescript
// 1. 순수하게 auth 상태만 관리
useEffect(() => {
  console.log('[Auth] Setting up auth state listener');

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    console.log('[Auth] State change:', event);

    // 로그아웃 이벤트만 특별 처리
    if (event === 'SIGNED_OUT') {
      setUser(null);
      setSession(null);
      setUserRole(null);
      setNeedsProfileSetup(false);
      setProfileCheckComplete(true);
      setLoading(false);
      return;
    }

    // 나머지는 단순히 상태 업데이트
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);
  });

  return () => {
    console.log('[Auth] Cleaning up auth state listener');
    subscription.unsubscribe();
  };
}, []);
```

### Phase 2: 부가 로직 분리

```typescript
// 2. user.id가 바뀔 때 프로필/Role 처리
useEffect(() => {
  if (!user?.id) {
    setUserRole(null);
    setNeedsProfileSetup(false);
    setProfileCheckComplete(true);
    return;
  }

  const loadUserData = async () => {
    setProfileCheckComplete(false);

    try {
      // 프로필 체크
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, phone, role')
        .eq('user_id', user.id)
        .maybeSingle();

      setNeedsProfileSetup(!profile?.display_name || !profile?.phone);
      setUserRole(profile?.role || 'user');
    } catch (err) {
      console.error('[Auth] Error loading user data:', err);
      setNeedsProfileSetup(false);
      setUserRole('user');
    } finally {
      setProfileCheckComplete(true);
    }
  };

  loadUserData();
}, [user?.id]);

// 3. user.id가 바뀔 때 MQTT 처리
useEffect(() => {
  if (!user?.id) {
    teardownSubscriptions();
    return;
  }

  const setupMqtt = async () => {
    try {
      await ensureSubscriptions(user.id);
    } catch (err) {
      console.warn('[Auth] MQTT setup failed:', err);
    }
  };

  setupMqtt();

  return () => {
    teardownSubscriptions();
  };
}, [user?.id]);
```

### Phase 3: 에러 처리 완화

#### Before (위험)
```typescript
if (msg.includes("Invalid Refresh Token")) {
  // 전역 삭제 - 모든 탭/디바이스 영향
  Object.keys(localStorage)
    .filter((k) => k.startsWith("sb-"))
    .forEach((k) => localStorage.removeItem(k));
  await supabase.auth.signOut({ scope: 'global' });
}
```

#### After (안전)
```typescript
if (msg.includes("Invalid Refresh Token") || msg.includes("Refresh Token Not Found")) {
  console.log('[Auth] Session expired, clearing local state only');

  // 로컬 상태만 초기화 (다른 탭 영향 없음)
  // signOut 호출 안 함 - 이미 토큰이 invalid라 Supabase도 쓸 토큰 없음
  // 상태만 비우고 로그인 페이지로 보내는 게 부작용 최소화
  setUser(null);
  setSession(null);
  setUserRole(null);
  setNeedsProfileSetup(false);
  setProfileCheckComplete(true);
  setLoading(false);

  // 라우팅은 ProtectedRoute가 자동으로 처리하므로 여기서 안 해도 됨
  return;
}
```

> **참고**: `signOut()` 호출을 하지 않는 이유
> - 이미 토큰이 invalid 상태라 Supabase도 사용할 토큰이 없음
> - 클라이언트 상태만 비워두면 ProtectedRoute가 자동으로 로그인 페이지로 리다이렉트
> - 멀티탭 안정성을 위해 "상태만 비우고 끝내기"가 부작용 최소화

### Phase 4: signOut 함수 개선

#### Before
```typescript
const signOut = async () => {
  // 전역 localStorage 삭제
  Object.keys(localStorage)
    .filter((k) => k.startsWith("sb-"))
    .forEach((k) => localStorage.removeItem(k));

  // 전역 로그아웃
  await supabase.auth.signOut({ scope: 'global' });
};
```

#### After
```typescript
const signOut = async (options?: { global?: boolean }) => {
  try {
    // 로컬 상태 먼저 정리
    setUser(null);
    setSession(null);
    setUserRole(null);
    setNeedsProfileSetup(false);
    setProfileCheckComplete(true);

    // MQTT 정리
    await teardownSubscriptions();

    // Supabase 로그아웃 (기본: local)
    const scope = options?.global ? 'global' : 'local';
    await supabase.auth.signOut({ scope });

    console.log('[Auth] Sign out complete, scope:', scope);
  } catch (err) {
    console.error('[Auth] Sign out error:', err);
  }
};
```

### Phase 5: storage 이벤트 리스너 제거

```typescript
// 제거할 코드 (Supabase multiTab이 이미 처리함)
useEffect(() => {
  const handleStorageChange = async (event: StorageEvent) => {
    if (event.key && event.key.includes('auth-token')) {
      // 이 코드 제거
    }
  };

  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, []);
```

### Phase 6: Supabase 클라이언트 설정 확인

```typescript
// client.ts
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,  // AuthCallback에서 수동 처리
    flowType: 'pkce',
    // storageKey, storage 커스텀 하지 않음 (기본값 사용)
  },
});
```

---

## 리팩토링 후 구조

```
AuthContext
├── useEffect #1: onAuthStateChange (세션/유저만)
│   └── SIGNED_OUT → 상태 초기화
│   └── 기타 → session/user 업데이트
│
├── useEffect #2: user.id 변경 시 프로필/Role 로드
│   └── profiles 테이블 조회
│   └── needsProfileSetup, userRole 설정
│
├── useEffect #3: user.id 변경 시 MQTT 설정
│   └── ensureSubscriptions()
│   └── cleanup: teardownSubscriptions()
│
├── signIn() - 이메일/비밀번호 로그인
├── signUp() - 회원가입 (프로필 생성 포함)
├── signInWithGoogle() - Google OAuth
├── signInWithApple() - Apple OAuth
├── signOut() - 로그아웃 (scope: local 기본)
└── checkProfileSetup() - 프로필 재확인
```

---

## 테스트 체크리스트

### 기본 기능
- [ ] 이메일 로그인 → 대시보드 이동
- [ ] Google 로그인 → 프로필 체크 → 적절한 페이지 이동
- [ ] Apple 로그인 → 프로필 체크 → 적절한 페이지 이동
- [ ] 로그아웃 → 로그인 페이지 이동
- [ ] 회원가입 → 이메일 확인 → 로그인

### 멀티탭 시나리오
- [ ] 탭 A 로그인 → 탭 B 새로고침 → 로그인 상태 유지
- [ ] 탭 A 로그아웃 → 탭 B 새로고침 → 로그아웃 상태
- [ ] 탭 A, B 동시 사용 → 둘 다 정상 동작
- [ ] 탭 전환 시 세션 유지

### 에러 시나리오
- [ ] 토큰 만료 → 자동 갱신 (autoRefreshToken)
- [ ] 네트워크 에러 → 재시도 또는 graceful degradation
- [ ] 서버 에러 → 적절한 에러 메시지

### OAuth 콜백
- [ ] PKCE 흐름 (code 파라미터) → 정상 처리
- [ ] Implicit 흐름 (access_token 해시) → 정상 처리
- [ ] 에러 응답 → 에러 메시지 표시

---

## 마이그레이션 순서

1. **백업**: 현재 AuthContext.tsx 백업
2. **Phase 1**: onAuthStateChange 단순화
3. **테스트**: 기본 로그인/로그아웃 확인
4. **Phase 2**: 부가 로직 분리
5. **테스트**: 프로필 체크, MQTT 확인
6. **Phase 3-4**: 에러 처리, signOut 개선
7. **테스트**: 멀티탭 시나리오
8. **Phase 5**: storage 리스너 제거
9. **최종 테스트**: 전체 체크리스트

---

## 예상 효과

| 항목 | Before | After |
|------|--------|-------|
| onAuthStateChange 핸들러 크기 | ~100줄 | ~20줄 |
| 멀티탭 안정성 | 낮음 | 높음 |
| 디버깅 난이도 | 높음 | 낮음 |
| 에러 전파 범위 | 전역 | 로컬 |
| Supabase 기능 활용 | 부분적 | 완전 |

---

## 참고 자료

- [Supabase Auth - JavaScript Client](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Supabase Auth - PKCE Flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Supabase Auth - Multi-tab Support](https://supabase.com/docs/reference/javascript/initializing#auth-options)
