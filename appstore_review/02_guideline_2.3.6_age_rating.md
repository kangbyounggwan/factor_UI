# App Store Review - Guideline 2.3.6 해결 리포트

**리젝 가이드라인**: 2.3.6 - Performance - Accurate Metadata
**제출 ID**: 7eea269d-1536-4d79-b7f6-0a0156ee4aa9
**검토 날짜**: 2025년 11월 15일
**버전**: 1.0

---

## 📋 리젝 내용

앱의 Age Rating 설정에서 "In-App Controls"가 선택되어 있지만, 앱에서 Parental Controls 또는 Age Assurance 메커니즘을 찾을 수 없음.

**Apple의 요구사항**:
- Age Rating이 정확해야 함
- 실제로 구현되지 않은 기능을 선택하면 안 됨

---

## 🔍 현재 상태 분석

### Age Rating 설정 문제점

**App Store Connect → App Information → Age Rating**
- ❌ "Age Assurance" 또는 "In-App Controls"가 잘못 선택됨
- ✅ 앱에 실제로 부모 제어 기능이 없음

### 앱 기능 확인

**검토한 파일**:
- `packages/mobile/src/pages/Settings.tsx`
- `packages/mobile/src/pages/UserSettings.tsx`
- `packages/mobile/src/pages/NotificationSettings.tsx`

**확인 결과**:
- 부모 제어(Parental Controls) 기능 없음
- 연령 확인(Age Assurance) 기능 없음
- 사용자 설정은 일반적인 앱 설정만 존재

---

## ✅ 해결 방법

### 방법 1: App Store Connect에서 메타데이터 수정 (권장)

**난이도**: 🟢 매우 쉬움
**개발 소요**: 5분
**타입**: ❌ 개발 불필요 (메타데이터만 수정)

#### 수정 단계

1. **App Store Connect 접속**
   - https://appstoreconnect.apple.com 로그인
   - 앱 선택

2. **Age Rating 수정**
   - App Information 탭 클릭
   - Age Rating 섹션 찾기
   - "Edit" 버튼 클릭

3. **In-App Controls 설정 변경**
   - "Age Assurance" 항목 찾기
   - **"None"으로 선택**
   - 저장

4. **재제출**
   - 변경 사항 저장 후 앱 재제출

---

### 방법 2: 실제 기능 구현 (불필요)

**난이도**: 🔴 어려움
**개발 소요**: 1-2주
**타입**: 개발 필요
**권장하지 않음**: Factor 앱의 성격상 불필요한 기능

이 앱은 3D 프린터 관리 도구로, 부모 제어나 연령 확인 기능이 필요하지 않습니다.

---

## 📊 권장 사항

### ✅ 권장: 방법 1 (메타데이터만 수정)

**이유**:
1. **가장 빠른 해결**: 5분 이내 완료
2. **개발 불필요**: 코드 변경 없음
3. **정확한 정보**: 앱의 실제 기능과 일치
4. **Apple 정책 준수**: Guideline 2.3.6 요구사항 충족

### Age Rating 권장 설정

Factor 앱의 특성상 다음과 같이 설정 권장:

- **Age Assurance**: None
- **In-App Controls**: None
- **Unrestricted Web Access**: No (앱 내 브라우저 없음)
- **User Generated Content**: No
- **Gambling**: No
- **Contests**: No

---

## 📝 App Store Connect 답변 예시

메타데이터 수정 후 App Review에 답변:

```
Dear App Review Team,

Thank you for your feedback regarding Guideline 2.3.6.

We have reviewed the Age Rating selections in App Store Connect and corrected the issue.
The "Age Assurance" option has been updated to "None" as our app does not include
Parental Controls or Age Assurance mechanisms.

The FACTOR app is a 3D printer management tool designed for adult users and does not
require age verification or parental control features.

The Age Rating selections have been updated to accurately reflect the app's content
and features.

Thank you for your consideration.

Best regards,
FACTOR Team
```

---

## 🎯 Action Items

### App Store Connect 작업 (개발자/관리자)

- [ ] App Store Connect 로그인
- [ ] App Information → Age Rating 이동
- [ ] Age Assurance를 "None"으로 변경
- [ ] In-App Controls 관련 모든 항목 "None" 확인
- [ ] 변경 사항 저장
- [ ] App Review에 답변 제출

### docs-manager
- [ ] PROJECT_DOCUMENTATION.md에 Age Rating 설정 가이드 추가
- [ ] App Store 제출 체크리스트에 Age Rating 검증 항목 추가

---

## ⚠️ 주의사항

### 절대 하지 말아야 할 것

❌ **실제로 없는 기능을 Age Rating에 선택하지 마세요**
- Apple은 메타데이터와 실제 기능의 일치를 매우 엄격하게 검토합니다
- 잘못된 선택은 리젝 또는 앱 삭제로 이어질 수 있습니다

### 향후 제출 시 체크리스트

- [ ] Age Rating이 앱의 실제 기능과 일치하는지 확인
- [ ] 스크린샷이 최신 앱 화면을 반영하는지 확인
- [ ] 앱 설명(Description)이 실제 기능을 정확히 설명하는지 확인

---

## 📚 참고 자료

- [Age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/age-ratings)
- [App Review Guideline 2.3.6](https://developer.apple.com/app-store/review/guidelines/#accurate-metadata)

---

**작성일**: 2024-11-16
**담당**: App Store Connect 관리자
**우선순위**: 🟢 Low (개발 불필요)
**예상 완료**: 즉시 (5분)
**타입**: 메타데이터 수정
