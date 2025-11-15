# App Store 리젝 종합 해결 리포트

**제출 ID**: 7eea269d-1536-4d79-b7f6-0a0156ee4aa9
**검토 날짜**: 2025년 11월 15일
**리젝된 버전**: 1.0
**리포트 작성일**: 2024-11-16

---

## 📊 리젝 사항 요약

총 **5개 가이드라인 위반**으로 리젝되었습니다.

| # | 가이드라인 | 심각도 | 개발 필요 | 예상 소요 | 상세 리포트 |
|---|-----------|-------|----------|----------|-----------|
| 1 | 4.8 - Sign in with Apple | 🔴 High | ✅ Yes | 2-3일 | [01_guideline_4.8_sign_in_with_apple.md](01_guideline_4.8_sign_in_with_apple.md) |
| 2 | 2.3.6 - Age Rating | 🟢 Low | ❌ No | 5분 | [02_guideline_2.3.6_age_rating.md](02_guideline_2.3.6_age_rating.md) |
| 3 | 3.1.1 - Business Account | 🟡 Medium | ❌ No* | 즉시-1일 | [03_guideline_3.1.1_business_registration.md](03_guideline_3.1.1_business_registration.md) |
| 4 | 5.1.1(v) - Account Deletion | 🔴 High | ✅ Yes | 2-3일 | [04_guideline_5.1.1v_account_deletion.md](04_guideline_5.1.1v_account_deletion.md) |
| 5 | 3.1.1 & 3.1.3(c) - IAP | 🔴 High | ✅ Yes | 1-2주 | [05_guideline_3.1.1_3.1.3c_enterprise.md](05_guideline_3.1.1_3.1.3c_enterprise.md) |

\* 개발 불필요 (App Review에 해명 답변만 필요)

---

## 🎯 우선순위별 해결 계획

### Phase 1: 즉시 해결 가능 (1일 이내)

#### ✅ 메타데이터 수정 (개발 불필요)

**1. Age Rating 수정** (5분)
- App Store Connect → Age Rating
- "Age Assurance" → "None"으로 변경
- 저장 및 재제출

**2. Business Account 해명** (즉시)
- App Review에 답변 제출
- 앱에 비즈니스 계정 기능이 없음을 설명
- [03번 리포트](03_guideline_3.1.1_business_registration.md) 참조

---

### Phase 2: 단기 개발 (1주 이내)

#### 🔴 필수 구현 1: Sign in with Apple (2-3일)

**담당**: api-developer, mobile-builder, ui-components

**작업 목록**:
- [x] Supabase Apple 프로바이더 활성화 (완료)
- [ ] Capacitor Apple Sign In 플러그인 설치
- [ ] iOS Xcode capability 추가
- [ ] AuthContext에 signInWithApple 구현
- [ ] Auth.tsx UI 업데이트 (Apple 버튼 추가)
- [ ] 번역 추가 (한국어, 영어)
- [ ] 실제 iOS 디바이스 테스트

**상세**: [01_guideline_4.8_sign_in_with_apple.md](01_guideline_4.8_sign_in_with_apple.md)

---

#### 🔴 필수 구현 2: 계정 삭제 기능 (2-3일)

**담당**: api-developer, ui-components, type-safety

**작업 목록**:
- [ ] Supabase delete_user 함수 생성
- [ ] AccountAPI.deleteAccount 구현
- [ ] React Query 훅 생성
- [ ] DeleteAccountDialog 컴포넌트 생성
- [ ] UserSettings에 계정 삭제 메뉴 추가
- [ ] 번역 추가 (한국어, 영어)
- [ ] 테스트 (데이터 완전 삭제 확인)

**상세**: [04_guideline_5.1.1v_account_deletion.md](04_guideline_5.1.1v_account_deletion.md)

---

### Phase 3: 중기 개발 (1-2주)

#### 🔴 필수 구현 3: Apple In-App Purchase (1-2주)

**담당**: api-developer, mobile-builder, ui-components

**작업 목록**:
- [ ] App Store Connect IAP 상품 생성
- [ ] RevenueCat 계정 및 설정
- [ ] Capacitor Purchases 플러그인 설치
- [ ] PurchaseService 구현
- [ ] Subscription 페이지 리팩토링
- [ ] 외부 결제 제거
- [ ] Sandbox 테스트
- [ ] TestFlight 베타 테스트

**상세**: [05_guideline_3.1.1_3.1.3c_enterprise.md](05_guideline_3.1.1_3.1.3c_enterprise.md)

---

## 📋 개발 vs 비개발 분류

### ❌ 개발 불필요 (메타데이터/답변만)

| 항목 | 해결 방법 | 소요 시간 |
|-----|----------|----------|
| Age Rating | App Store Connect 수정 | 5분 |
| Business Account | App Review 답변 | 즉시 |

**총 소요**: 5분

---

### ✅ 개발 필요

| 항목 | 난이도 | 소요 시간 | 우선순위 |
|-----|-------|----------|----------|
| Sign in with Apple | 🟡 중간 | 2-3일 | 🔴 High |
| 계정 삭제 | 🟡 중간 | 2-3일 | 🔴 High |
| In-App Purchase | 🔴 어려움 | 1-2주 | 🔴 High |

**총 소요**: 약 2-3주

---

## 🛠️ 서브 에이전트별 작업 배분

### api-developer

**Sign in with Apple**:
- AuthContext에 `signInWithApple()` 함수 구현
- Supabase Apple 프로바이더 연동 (완료)

**계정 삭제**:
- `AccountAPI.deleteAccount()` 구현
- Supabase `delete_user` 함수 생성
- 관련 데이터 cascade 삭제 로직

**IAP**:
- `PurchaseService` 클래스 구현
- Supabase 구독 상태 동기화
- 외부 결제 API 제거

---

### mobile-builder

**Sign in with Apple**:
- Xcode Sign in with Apple capability 추가
- Capacitor 플러그인 설치 및 동기화
- Apple Developer Console 설정

**IAP**:
- App Store Connect IAP 상품 생성
- RevenueCat 설정 및 연동
- TestFlight 배포 및 테스트

---

### ui-components

**Sign in with Apple**:
- Auth.tsx에 Apple 로그인 버튼 추가
- 로딩 상태 및 에러 핸들링 UI

**계정 삭제**:
- DeleteAccountDialog 컴포넌트 생성
- UserSettings에 계정 삭제 메뉴 추가
- 확인 다이얼로그 UI

**IAP**:
- Subscription 페이지 리팩토링
- 구독 상태 표시 UI
- 복원 버튼 추가

---

### type-safety

**계정 삭제**:
- 계정 삭제 API 타입 정의
- 데이터 요약 타입

**IAP**:
- IAP 관련 타입 정의
- 구독 상태 타입

---

### i18n-manager

**모든 기능**:
- Sign in with Apple 번역
- 계정 삭제 번역
- IAP 구독 번역
- 에러 메시지 번역

---

### quality-checker

**모든 기능**:
- 실제 iOS 디바이스 테스트
- 타입 체크 및 린트
- Sandbox 테스트 (IAP)
- 데이터베이스 삭제 확인

---

### docs-manager

**문서화**:
- API_REFERENCE.md 업데이트
- PROJECT_DOCUMENTATION.md 업데이트
- 사용자 가이드 작성

---

## 📅 타임라인

### Week 1

**Day 1-2: 즉시 해결 + Apple Sign In 시작**
- [ ] Age Rating 수정 (5분)
- [ ] Business Account 답변 (즉시)
- [ ] Apple Sign In 플러그인 설치
- [ ] AuthContext 구현 시작

**Day 3-4: Apple Sign In 완료 + 계정 삭제 시작**
- [ ] Apple Sign In UI 구현
- [ ] 테스트 및 검증
- [ ] 계정 삭제 API 구현 시작
- [ ] Supabase 함수 생성

**Day 5-7: 계정 삭제 완료 + IAP 시작**
- [ ] 계정 삭제 UI 구현
- [ ] 테스트 및 검증
- [ ] IAP 상품 생성
- [ ] RevenueCat 설정

---

### Week 2

**Day 8-10: IAP 핵심 구현**
- [ ] PurchaseService 구현
- [ ] Subscription 페이지 리팩토링
- [ ] 외부 결제 제거

**Day 11-14: IAP 테스트 및 마무리**
- [ ] Sandbox 테스트
- [ ] TestFlight 베타 테스트
- [ ] 버그 수정
- [ ] 문서화 완료

---

### Week 3 (버퍼)

**Day 15-21: 최종 검증 및 재제출**
- [ ] 전체 기능 통합 테스트
- [ ] App Store 스크린샷 업데이트
- [ ] App Review 답변 작성
- [ ] 앱 재제출

---

## 💰 비용 영향

### Apple IAP 수수료

- **연간 $1M 이하 매출**: 15% 수수료
- **연간 $1M 초과 매출**: 30% 수수료

### RevenueCat 비용 (선택사항)

- **Free Tier**: 월 $2,500 매출까지 무료
- **Starter**: 월 $299 (월 $10,000 매출까지)
- **Pro**: 월 $899 (월 $50,000 매출까지)

**대안**: RevenueCat 없이 직접 IAP 구현 가능 (개발 복잡도 증가)

---

## ⚠️ 주요 주의사항

### 절대 하지 말아야 할 것

❌ **Age Rating 실제와 다르게 설정**
- 리젝 또는 앱 삭제 위험

❌ **계정 삭제를 단순 비활성화로 처리**
- Apple은 실제 데이터 삭제 요구

❌ **외부 결제 링크/버튼 남기기**
- IAP 정책 위반, 즉시 리젝

❌ **비즈니스/조직 관련 문구 사용**
- "Company Name", "Enterprise" 등 피하기

---

## 📝 App Store Connect 최종 체크리스트

### 재제출 전 확인사항

- [ ] Sign in with Apple 버튼이 Auth 화면에 표시됨
- [ ] 계정 삭제 메뉴가 Settings에 있음
- [ ] 외부 결제 링크/버튼 완전 제거
- [ ] Apple IAP만 사용
- [ ] Age Rating이 "None"으로 설정됨
- [ ] 스크린샷 업데이트 (Apple 로그인 버튼 포함)
- [ ] TestFlight 테스트 완료
- [ ] App Review Information 작성

### App Review 답변 템플릿

```
Dear App Review Team,

Thank you for your feedback. We have addressed all the issues raised in the review:

1. Guideline 4.8 - Sign in with Apple:
   We have implemented Sign in with Apple as an equivalent login option.
   The feature is visible on the authentication screen.

2. Guideline 2.3.6 - Age Rating:
   We have updated the Age Rating to "None" for Age Assurance as the app does not
   include parental controls.

3. Guideline 3.1.1 - Business Account Registration:
   The app does not include business or organizational account registration features.
   All accounts are individual user accounts.

4. Guideline 5.1.1(v) - Account Deletion:
   We have implemented account deletion functionality. Users can now delete their
   accounts from Settings → Account → Delete Account.

5. Guidelines 3.1.1 & 3.1.3(c) - In-App Purchase:
   All subscriptions are now available through Apple In-App Purchase. External
   payment mechanisms have been removed.

All changes have been tested on physical iOS devices via TestFlight.

Thank you for your consideration.

Best regards,
FACTOR Team
```

---

## 📚 참고 문서

### 상세 리포트

1. [Guideline 4.8 - Sign in with Apple](01_guideline_4.8_sign_in_with_apple.md)
2. [Guideline 2.3.6 - Age Rating](02_guideline_2.3.6_age_rating.md)
3. [Guideline 3.1.1 - Business Account](03_guideline_3.1.1_business_registration.md)
4. [Guideline 5.1.1(v) - Account Deletion](04_guideline_5.1.1v_account_deletion.md)
5. [Guidelines 3.1.1 & 3.1.3(c) - IAP](05_guideline_3.1.1_3.1.3c_enterprise.md)

### Apple 공식 문서

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Sign in with Apple](https://developer.apple.com/sign-in-with-apple/)
- [In-App Purchase](https://developer.apple.com/in-app-purchase/)
- [Age Ratings](https://developer.apple.com/help/app-store-connect/reference/age-ratings)

### 프로젝트 문서

- [CLAUDE.md](../CLAUDE.md) - 개발 가이드
- [SUB_AGENTS.md](../SUB_AGENTS.md) - 서브 에이전트 시스템
- [PROJECT_DOCUMENTATION.md](../PROJECT_DOCUMENTATION.md) - 프로젝트 개요

---

## 🎯 다음 액션

### 즉시 실행

1. **Age Rating 수정** (5분)
   - App Store Connect 로그인
   - Age Rating → "None" 변경

2. **Business Account 답변** (즉시)
   - App Review에 해명 답변 제출

### 이번 주 시작

3. **Sign in with Apple 구현** (2-3일)
   - api-developer, mobile-builder, ui-components 협업

4. **계정 삭제 기능 구현** (2-3일)
   - api-developer, ui-components 협업

### 다음 주 시작

5. **IAP 구현** (1-2주)
   - 전체 팀 협업
   - RevenueCat 설정 먼저

---

**작성자**: docs-manager
**최종 업데이트**: 2024-11-16
**다음 검토**: 재제출 후

---

## 💡 성공을 위한 팁

1. **단계별 진행**: 한 번에 하나씩 구현하고 테스트
2. **TestFlight 활용**: 재제출 전 반드시 베타 테스트
3. **문서화**: 모든 변경사항 기록
4. **Apple 가이드라인 숙지**: 재발 방지
5. **서브 에이전트 활용**: 효율적인 분산 작업

---

**재제출 목표일**: 2024년 12월 초
**예상 승인일**: 2024년 12월 중순
