# iOS Apple Sign-In 신규 사용자 체크 로직 수정 계획

## 문제 분석

### 현재 문제점
현재 `AuthContext.tsx`의 `signInWithApple` 함수에서 iOS 신규 사용자 체크 시 **잘못된 ID 매칭**을 하고 있음:

```typescript
// 현재 코드 (lines 652-681)
const payload = JSON.parse(atob(identityToken.split('.')[1]));
const userId = payload.sub;  // ❌ Apple 계정의 고유 ID

const { data: profile } = await supabase
  .from('profiles')
  .select('user_id')
  .eq('user_id', userId)  // ❌ Supabase UUID와 비교 - 항상 매칭 실패!
  .maybeSingle();
```

**핵심 문제:**
- `identityToken.sub` = Apple 계정의 고유 ID (예: `000123.abc456def...`)
- `profiles.user_id` = Supabase가 생성한 UUID (예: `123e4567-e89b-12d3-a456-426614174000`)
- **이 두 값은 완전히 다른 형식이므로 절대 매칭되지 않음**

### 발생하는 증상
1. 웹에서 Apple 로그인으로 이미 가입한 기존 유저도 iOS에서 로그인 시 **항상 신규 유저로 판단됨**
2. "기존 사용자도 로그인 안 되고, 신규 막는 메시지만 뜨는" 증상

---

## 해결 방안

### 선택 1: iOS에서 Apple Sign-In 신규 가입 완전 차단 (간단)

**개념:** iOS에서는 Apple Sign-In 자체를 막고, 웹에서 먼저 가입하도록 안내

**장점:**
- 구현이 간단함
- JWT decode, 프로필 조회 등 위험한 로직 제거
- 확실하게 동작함

**단점:**
- 기존 사용자도 iOS에서 Apple 로그인 불가
- UX 제한

**구현:**
```typescript
const signInWithApple = async () => {
  const isNativeMobile = Capacitor.isNativePlatform();

  if (isNativeMobile && Capacitor.getPlatform() === 'ios') {
    return {
      error: {
        message: 'iosAppleSignInNotAllowed',
        isNewUser: false
      }
    };
  }
  // ... 기존 로직
};
```

---

### 선택 2: 로그인 먼저 → 프로필로 신규 여부 판단 (권장)

**개념:** Supabase 로그인을 먼저 수행하고, `user.id`로 프로필 조회 후 신규 유저 판단

**장점:**
- 기존 사용자는 iOS에서도 Apple 로그인 가능
- 정확한 신규 유저 판단 (Supabase `user.id` 기준)
- 웹에서 가입한 사용자와 일관된 경험

**단점:**
- 신규 유저인 경우 Supabase에 유저가 생성된 후 삭제/로그아웃 처리 필요
- 약간 복잡한 구현

**구현 흐름:**
```
1. Apple Native Sign-In 수행 → identityToken 획득
2. Supabase signInWithIdToken() 호출 → 세션/유저 생성
3. session.user.id로 profiles 테이블 조회
4. 프로필이 없으면 (신규 유저):
   - iOS인 경우: signOut 후 에러 반환
   - 웹인 경우: ProfileSetup으로 이동
5. 프로필이 있으면 (기존 유저): 정상 로그인 완료
```

---

## 선택 2 상세 구현 계획

### 수정 파일
1. `packages/shared/src/contexts/AuthContext.tsx` - `signInWithApple` 함수

### 코드 변경

```typescript
const signInWithApple = async () => {
  const isNativeMobile = Capacitor.isNativePlatform();

  if (isNativeMobile) {
    try {
      // 1) nonce 생성
      const rawNonce = Math.random().toString(36).substring(2, 15);
      const hashedNonce = sha256(rawNonce);

      // 2) Apple Native Sign-In
      const result = await SignInWithApple.authorize({
        clientId: 'com.byeonggwan.factor',
        redirectURI: 'https://ecmrkjwsjkthurwljhvp.supabase.co/auth/v1/callback',
        scopes: 'email name',
        nonce: hashedNonce,
      });

      const identityToken = result.response.identityToken;
      if (!identityToken) {
        throw new Error('No identity token returned from Apple');
      }

      // 3) Supabase 로그인 먼저 수행
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
        nonce: rawNonce,
      });

      if (error) {
        return { error };
      }

      const session = data.session;
      const user = session?.user;

      if (!user) {
        return { error: { message: 'noUserInSession' } };
      }

      // 4) Supabase user.id로 프로필 조회 (정확한 매칭!)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)  // ✅ Supabase UUID로 조회
        .maybeSingle();

      // 5) 프로필 없으면 신규 유저 → iOS에서 차단
      if (!profile) {
        const platform = Capacitor.getPlatform();
        if (platform === 'ios') {
          // 신규 유저: 세션 정리 후 에러 반환
          await supabase.auth.signOut({ scope: 'local' });
          return {
            error: {
              message: 'newUserNotAllowed',
              isNewUser: true
            }
          };
        }
      }

      // 6) 기존 유저 또는 Android/웹: 정상 로그인
      return { error: null };

    } catch (err: any) {
      // 에러 처리 (기존 코드 유지)
      // ...
    }
  } else {
    // 웹 OAuth 로직 (기존 코드 유지)
    // ...
  }
};
```

### App.tsx 딥링크 처리 (Google 로그인용)

`App.tsx`의 딥링크 처리도 동일한 문제가 있을 수 있음. 현재 코드 확인:

```typescript
// lines 163-172 - JWT에서 sub 추출
const payload = JSON.parse(atob(access_token.split('.')[1]));
const userId = payload.sub;

const { data: profile } = await supabase
  .from('profiles')
  .select('user_id')
  .eq('user_id', userId)
  .maybeSingle();
```

**Google OAuth의 경우:**
- Supabase가 발급한 `access_token`의 `sub` 값은 **Supabase user.id**임 (Apple과 다름)
- 따라서 App.tsx의 현재 로직은 Google 로그인에서는 정상 작동함
- Apple Sign-In은 Native SDK를 사용하므로 딥링크를 타지 않음

**결론:** App.tsx는 수정 불필요

---

## 추가 고려사항

### 1. 신규 유저가 iOS에서 로그인 시도 후 상태

선택 2 구현 시, Supabase에 유저가 생성된 후 `signOut`하므로:
- `auth.users` 테이블에 유저 row가 생성됨
- `profiles` 테이블에는 row가 없음 (트리거가 없다면)
- 이후 웹에서 같은 계정으로 가입하면 이미 `auth.users`에 있으므로 로그인 처리됨

**이 동작이 의도한 것인지 확인 필요:**
- OK: 웹에서 가입 시 프로필만 생성하면 됨
- 문제: 유저가 웹에서 "회원가입"을 시도하면 이미 계정이 있다고 나올 수 있음

### 2. Android 처리

현재 코드는 iOS만 신규 유저 차단. Android도 차단해야 하는지?
- 현재: Android는 신규 유저도 Apple Sign-In 허용
- 필요 시: `platform === 'ios' || platform === 'android'` 조건으로 변경

---

## 테스트 계획

### 테스트 케이스

1. **iOS 기존 사용자 (웹에서 Apple 로그인으로 가입)**
   - 예상: iOS에서 Apple 로그인 성공
   - 확인: 대시보드로 정상 이동

2. **iOS 신규 사용자**
   - 예상: "아이폰에서는 신규 회원가입이 불가합니다" 알럿
   - 확인: 로그인 화면 유지, 세션 없음

3. **웹 Apple 로그인**
   - 예상: 기존대로 동작 (신규/기존 모두 가능)
   - 확인: 웹 기능에 영향 없음

4. **iOS Google 로그인**
   - 예상: App.tsx 딥링크 로직대로 동작
   - 확인: 기존 사용자 로그인 성공, 신규 사용자 차단

---

## 구현 순서

1. [ ] `AuthContext.tsx`의 `signInWithApple` 함수 수정
2. [ ] `Auth.tsx`에서 `newUserNotAllowed` 에러 처리 확인
3. [ ] iOS 빌드 및 테스트
4. [ ] 웹에서 기존 기능 영향 없는지 확인

---

## 참고: 현재 파일 위치

- Deep link 처리: `/packages/mobile/src/App.tsx` (lines 119-231)
- Apple Sign-In: `/packages/shared/src/contexts/AuthContext.tsx` (lines 619-748)
- Auth 페이지: `/packages/mobile/src/pages/Auth.tsx`
