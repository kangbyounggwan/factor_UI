# App Store Review - Guideline 4.8 해결 리포트

**리젝 가이드라인**: 4.8 - Design - Login Services
**제출 ID**: 7eea269d-1536-4d79-b7f6-0a0156ee4aa9
**검토 날짜**: 2025년 11월 15일
**버전**: 1.0

---

## 📋 리젝 내용

앱이 third-party 로그인 서비스를 사용하지만, 다음 요구사항을 모두 충족하는 동등한 로그인 옵션을 제공하지 않음:

- 사용자 이름과 이메일 주소만 수집
- 사용자가 계정 설정 시 이메일 주소를 비공개로 유지 가능
- 동의 없이 광고 목적으로 앱 상호작용 데이터를 수집하지 않음

**참고**: Sign in with Apple이 위 요구사항을 모두 충족하는 로그인 서비스임

---

## 🔍 현재 상태 분석

### 현재 구현된 로그인 방법

**파일 위치**: `packages/mobile/src/pages/Auth.tsx`

1. **이메일/비밀번호 로그인** (Supabase)
   - `signIn(email, password)` - 라인 53
   - 자체 인증 시스템

2. **Google 소셜 로그인**
   - `signInWithGoogle()` - 라인 135
   - Third-party 로그인 서비스

### 문제점

- Google 로그인만 있고, Apple의 요구사항을 충족하는 Sign in with Apple이 없음
- Guideline 4.8에 따르면 third-party 로그인(Google)을 사용하는 경우 반드시 동등한 로그인 옵션(Sign in with Apple) 필요

---

## ✅ 해결 방법

### 방법 1: Sign in with Apple 추가 (권장)

**난이도**: 🟡 중간
**개발 소요**: 2-3일
**타입**: 개발 필요

#### 구현 단계

1. **Capacitor 플러그인 설치**
   ```bash
   npm install @capacitor-community/apple-sign-in
   npx cap sync
   ```

2. **iOS 설정**
   - Xcode에서 Sign in with Apple capability 활성화
   - Apple Developer Console에서 Sign in with Apple 설정
   - Bundle ID에 Sign in with Apple 활성화

3. **Supabase 설정**
   - Supabase Dashboard → Authentication → Providers
   - Apple 프로바이더 활성화
   - Services ID 및 Key ID 설정

4. **코드 구현**

   **파일**: `packages/shared/src/contexts/AuthContext.tsx`
   ```typescript
   import { SignInWithApple } from '@capacitor-community/apple-sign-in';

   const signInWithApple = async () => {
     try {
       const result = await SignInWithApple.authorize({
         clientId: 'com.byeonggwan.factor',
         redirectURI: 'https://your-project.supabase.co/auth/v1/callback',
         scopes: 'email name',
       });

       const { data, error } = await supabase.auth.signInWithIdToken({
         provider: 'apple',
         token: result.response.identityToken,
       });

       return { data, error };
     } catch (error) {
       return { data: null, error };
     }
   };
   ```

5. **UI 업데이트**

   **파일**: `packages/mobile/src/pages/Auth.tsx` (라인 130 이후)
   ```tsx
   const handleAppleSignIn = async () => {
     setIsSubmitting(true);
     setError("");

     try {
       const { error } = await signInWithApple();

       if (error) {
         setError(error.message);
         toast({
           title: t('auth.loginError'),
           description: error.message,
           variant: "destructive",
         });
       }
     } catch (err) {
       setError(t('auth.loginError'));
     } finally {
       setIsSubmitting(false);
     }
   };

   // UI에 버튼 추가
   <Button
     onClick={handleAppleSignIn}
     variant="outline"
     className="w-full"
     disabled={isSubmitting}
   >
     <Apple className="mr-2 h-5 w-5" />
     {t('auth.signInWithApple')}
   </Button>
   ```

6. **번역 추가**

   **파일**: `packages/shared/src/i18n/locales/ko/common.json`
   ```json
   {
     "auth": {
       "signInWithApple": "Apple로 계속하기"
     }
   }
   ```

   **파일**: `packages/shared/src/i18n/locales/en/common.json`
   ```json
   {
     "auth": {
       "signInWithApple": "Continue with Apple"
     }
   }
   ```

#### 테스트 체크리스트

- [ ] iOS 실제 기기에서 Sign in with Apple 테스트
- [ ] 이메일 숨기기 옵션 동작 확인
- [ ] Supabase에 사용자 정보 제대로 저장되는지 확인
- [ ] MQTT 구독이 정상 작동하는지 확인

---

### 방법 2: Google 로그인 제거

**난이도**: 🟢 쉬움
**개발 소요**: 1일
**타입**: 개발 필요

이메일/비밀번호 로그인만 남기고 Google 로그인 제거

#### 구현

**파일**: `packages/mobile/src/pages/Auth.tsx`
- `handleGoogleSignIn` 함수 제거 (라인 130-150)
- Google 로그인 버튼 UI 제거

**장점**: 빠른 해결
**단점**: 사용자 편의성 감소

---

## 📊 권장 사항

### ✅ 권장: 방법 1 (Sign in with Apple 추가)

**이유**:
1. **사용자 경험 향상**: 다양한 로그인 옵션 제공
2. **애플 정책 준수**: Guideline 4.8 완전 충족
3. **미래 대비**: iOS 사용자에게 필수 기능
4. **보안 강화**: Apple의 강력한 프라이버시 보호

### 구현 우선순위

1. **High Priority** (필수):
   - iOS Sign in with Apple 구현
   - AuthContext에 signInWithApple 함수 추가
   - Auth.tsx UI 업데이트

2. **Medium Priority** (중요):
   - 에러 핸들링 강화
   - 번역 추가
   - 테스트 케이스 작성

3. **Low Priority** (선택):
   - 분석 이벤트 추가
   - 성능 모니터링

---

## 📝 App Store Connect 답변 예시

Sign in with Apple을 추가한 후 App Review에 다음과 같이 답변:

```
Dear App Review Team,

Thank you for your feedback regarding Guideline 4.8.

We have updated the app to include Sign in with Apple as an equivalent login option.
This login service meets all the requirements specified in Guideline 4.8:

1. It limits data collection to the user's name and email address
2. It allows users to keep their email address private using Apple's "Hide My Email" feature
3. It does not collect interactions with the app for advertising purposes without consent

The Sign in with Apple button is now available on the authentication screen,
providing users with a privacy-focused login alternative alongside the existing options.

Please find the updated screenshots showing the Sign in with Apple button in the
app's metadata.

Thank you for your consideration.

Best regards,
FACTOR Team
```

---

## 🎯 Action Items

### docs-manager
- [ ] 이 문서를 PROJECT_DOCUMENTATION.md에 추가
- [ ] API_REFERENCE.md에 Sign in with Apple API 문서화

### api-developer
- [ ] AuthContext에 signInWithApple 함수 구현
- [ ] Supabase Apple 프로바이더 설정

### mobile-builder
- [ ] Xcode Sign in with Apple capability 추가
- [ ] Capacitor 플러그인 설치 및 동기화

### ui-components
- [ ] Auth.tsx에 Apple 로그인 버튼 추가
- [ ] 로딩 상태 및 에러 핸들링 UI

### i18n-manager
- [ ] 번역 키 추가 (한국어, 영어)

### quality-checker
- [ ] 실제 iOS 디바이스 테스트
- [ ] 타입 체크 및 린트 검사

---

**작성일**: 2024-11-16
**담당 에이전트**: api-developer, mobile-builder, ui-components
**우선순위**: 🔴 High
**예상 완료**: 3일
