# App Store Review - Guideline 3.1.1 해결 리포트

**리젝 가이드라인**: 3.1.1 - Business - Payments - In-App Purchase
**제출 ID**: 7eea269d-1536-4d79-b7f6-0a0156ee4aa9
**검토 날짜**: 2025년 11월 15일
**버전**: 1.0

---

## 📋 리젝 내용

앱에 비즈니스 및 조직용 계정 등록 기능이 포함되어 있으며, 이는 앱에서 사용할 구매 또는 구독을 위한 외부 메커니즘 액세스로 간주됨.

**Apple의 요구사항**:
- 비즈니스 및 조직용 계정 등록 기능 제거 필요
- 또는 외부 구매가 아님을 증명

---

## 🔍 현재 상태 분석

### 앱에서 비즈니스 계정 관련 기능 확인

**검토 대상**:
- 회원가입 프로세스
- 계정 유형 선택
- 구독/결제 시스템

**검토한 파일**:
- `packages/mobile/src/pages/Auth.tsx`
- `packages/mobile/src/pages/Subscription.tsx`
- `packages/mobile/src/pages/PaymentCheckout.tsx`

### 발견된 내용

**Auth.tsx (회원가입)**:
```typescript
const [signUpData, setSignUpData] = useState({
  email: "",
  password: "",
  confirmPassword: "",
  displayName: "",
});
```

**현재 상태**:
- ✅ 일반 개인 계정 등록만 존재
- ❌ 비즈니스/조직 계정 선택 옵션 없음
- ✅ 계정 타입 구분 없음

**예상 원인**:
- Apple 리뷰어가 **displayName** 필드를 비즈니스 정보 입력으로 오해했을 가능성
- 또는 앱 스크린샷/설명에서 비즈니스 용도를 암시하는 문구가 있을 가능성

---

## ✅ 해결 방법

### 방법 1: App Review에 해명 답변 (권장)

**난이도**: 🟢 매우 쉬움
**개발 소요**: 없음
**타입**: ❌ 개발 불필요

앱에 실제로 비즈니스 계정 등록 기능이 없으므로, App Review에 이를 명확히 설명합니다.

#### 답변 예시

```
Dear App Review Team,

Thank you for your feedback regarding Guideline 3.1.1.

We would like to clarify that the FACTOR app does not include business or
organizational account registration features.

Current Account Registration:
- The app only offers individual user account registration
- There is no distinction between business and consumer accounts
- All users are treated as individual consumers
- The "Display Name" field in the registration form is for personal identification
  only, not for business/organization names

Payment and Subscription:
- All in-app purchases and subscriptions are handled through Apple's In-App Purchase system
- There are no external payment mechanisms
- No business-specific pricing or features

The app is designed for individual 3D printer owners and hobbyists, not for
businesses or organizations.

If there is any specific UI element or text that may have caused confusion,
please let us know so we can clarify or update it accordingly.

Thank you for your consideration.

Best regards,
FACTOR Team
```

---

### 방법 2: UI 및 문구 명확화

**난이도**: 🟡 쉬움
**개발 소요**: 1일
**타입**: 개발 필요 (선택사항)

Apple 리뷰어의 오해를 방지하기 위해 UI와 문구를 더 명확하게 수정합니다.

#### 수정 사항

**1. 회원가입 폼 레이블 명확화**

**파일**: `packages/mobile/src/pages/Auth.tsx`

```tsx
// Before
<Label htmlFor="displayName">{t('auth.displayName')}</Label>

// After
<Label htmlFor="displayName">{t('auth.personalName')}</Label>
<p className="text-xs text-muted-foreground">
  {t('auth.personalNameHint')}
</p>
```

**2. 번역 추가**

**파일**: `packages/shared/src/i18n/locales/ko/common.json`
```json
{
  "auth": {
    "personalName": "개인 이름",
    "personalNameHint": "개인용 계정입니다. 비즈니스 계정은 지원하지 않습니다."
  }
}
```

**파일**: `packages/shared/src/i18n/locales/en/common.json`
```json
{
  "auth": {
    "personalName": "Your Name",
    "personalNameHint": "Personal account only. Business accounts are not supported."
  }
}
```

**3. 앱 스크린샷 및 설명 검토**

App Store Connect에서:
- [ ] 앱 설명에서 "business", "enterprise", "organization" 같은 단어 제거
- [ ] 스크린샷에 비즈니스 관련 내용이 없는지 확인
- [ ] 키워드에서 비즈니스 관련 단어 제거

---

### 방법 3: 실제로 비즈니스 기능이 있다면 제거

**난이도**: 🔴 중간-어려움
**개발 소요**: 3-5일
**타입**: 개발 필요

만약 앱에 실제로 비즈니스 계정 기능이 있다면:

#### 제거해야 할 기능

- 계정 유형 선택 (개인/비즈니스)
- 사업자 등록번호 입력
- 회사명 입력
- 팀/조직 관리 기능
- 다중 사용자 계정
- 비즈니스 전용 플랜/가격

**참고**: 현재 코드 검토 결과 이러한 기능은 존재하지 않음

---

## 📊 권장 사항

### ✅ 권장: 방법 1 (해명 답변)

**이유**:
1. **가장 빠른 해결**: 즉시 답변 가능
2. **개발 불필요**: 실제로 비즈니스 기능이 없음
3. **정확한 정보**: 앱의 실제 상태를 설명
4. **Apple 정책 준수**: 오해 해소

### 선택적: 방법 2 (UI 명확화)

방법 1 답변 후에도 리젝된다면:
- UI 레이블을 더 명확하게 수정
- 앱 스토어 메타데이터 검토 및 수정

---

## 🎯 Action Items

### 우선순위 1: App Review 답변

- [ ] App Store Connect → My Apps → 해당 앱 선택
- [ ] App Review → Reply to App Review 클릭
- [ ] 위의 답변 예시를 참고하여 영문으로 답변 작성
- [ ] 제출

### 우선순위 2 (선택): 메타데이터 검토

- [ ] 앱 설명(Description)에서 비즈니스 관련 문구 확인
- [ ] 스크린샷에 비즈니스 관련 내용 확인
- [ ] 키워드 목록 검토
- [ ] 필요 시 수정

### 우선순위 3 (필요 시): UI 수정

- [ ] displayName 레이블을 "Personal Name"으로 변경
- [ ] 힌트 텍스트 추가 ("Personal account only")
- [ ] 번역 추가 (한국어, 영어)
- [ ] 테스트 및 재제출

---

## 📝 추가 정보

### Factor 앱의 실제 특성

**대상 사용자**: 개인 3D 프린터 사용자 및 취미가
**계정 타입**: 개인 계정만 지원
**결제 방식**: Apple In-App Purchase만 사용
**외부 결제**: 없음

### Apple 정책 이해

**Guideline 3.1.1**:
- 앱 내 디지털 콘텐츠/서비스는 IAP 사용 필수
- 예외: B2B 앱 (조직/기업 전용)

**Factor 앱의 경우**:
- ✅ 개인 사용자 대상
- ✅ IAP 사용
- ✅ 외부 결제 없음
- ✅ 정책 준수

---

## ⚠️ 주의사항

### 비즈니스 기능으로 오해받을 수 있는 요소

❌ 피해야 할 UI/문구:
- "Company Name"
- "Organization"
- "Team Account"
- "Business Plan"
- "Enterprise License"

✅ 사용해야 할 UI/문구:
- "Your Name" / "Personal Name"
- "Individual Account"
- "Personal Plan"
- "For Hobbyists and Makers"

---

**작성일**: 2024-11-16
**담당**: App Store Connect 관리자 (답변), ui-components (UI 수정 시)
**우선순위**: 🟡 Medium
**예상 완료**: 즉시 (답변만) 또는 1일 (UI 수정 포함)
**타입**: App Review 답변 + 선택적 UI 수정
