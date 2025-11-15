# App Store Review - Guidelines 3.1.1 & 3.1.3(c) 해결 리포트

**리젝 가이드라인**: 3.1.1 - In-App Purchase & 3.1.3(c) - Enterprise Services
**제출 ID**: 7eea269d-1536-4d79-b7f6-0a0156ee4aa9
**검토 날짜**: 2025년 11월 15일
**버전**: 1.0

---

## 📋 리젝 내용

앱이 조직이나 직원/학생 그룹에게 직접 판매되는 엔터프라이즈 서비스를 제공하지만, 동일한 서비스가 In-App Purchase 없이 개인 사용자, 소비자 또는 가족용으로도 판매됨.

**Apple의 규칙**:
- 조직/그룹에게 엔터프라이즈 서비스를 판매할 때는 IAP 불필요
- 개인 사용자/소비자/가족용으로 판매할 때는 IAP 사용 필수
- 미국 스토어프런트에서는 외부 링크를 통한 결제 가능 (특정 조건)
- 다른 스토어프런트에서는 IAP 필수

**해결 방법**:
1. 앱을 조직 및 직원/학생 그룹에게만 서비스 제공하도록 수정
2. 개인 사용자에게는 IAP를 통한 구매 옵션 제공

---

## 🔍 현재 상태 분석

### 현재 구독/결제 시스템 확인

**검토한 파일**:
- `packages/mobile/src/pages/Subscription.tsx`
- `packages/mobile/src/pages/PaymentCheckout.tsx`

### Factor 앱의 현재 모델

**대상 사용자**:
- ✅ 개인 3D 프린터 사용자
- ✅ 취미가 (Hobbyists)
- ✅ 메이커 (Makers)
- ❌ 엔터프라이즈/조직 (없음)

**결제 시스템**:
- Supabase를 통한 결제 처리로 추정
- Apple In-App Purchase 미사용 가능성

**문제점**:
- 개인 사용자 대상이지만 IAP를 사용하지 않을 수 있음
- 외부 결제 시스템(웹 결제 등)을 사용하고 있을 가능성

---

## ✅ 해결 방법

### 방법 1: Apple In-App Purchase 구현 (권장)

**난이도**: 🔴 어려움
**개발 소요**: 1-2주
**타입**: ✅ 개발 필요

개인 사용자를 위한 모든 구독을 Apple IAP로 전환합니다.

#### 구현 단계

**1. App Store Connect에서 IAP 상품 생성**

1. App Store Connect → My Apps → FACTOR 선택
2. In-App Purchases 탭
3. Auto-Renewable Subscriptions 생성

**구독 플랜 예시**:
```
- Basic Plan (월 $9.99)
  - Product ID: com.byeonggwan.factor.basic.monthly
  - 최대 3개 프린터 관리
  - 기본 알림

- Pro Plan (월 $19.99)
  - Product ID: com.byeonggwan.factor.pro.monthly
  - 무제한 프린터
  - AI 기능
  - 고급 분석

- Premium Plan (월 $29.99)
  - Product ID: com.byeonggwan.factor.premium.monthly
  - Pro 기능 전체
  - 우선 지원
```

**2. Capacitor IAP 플러그인 설치**

```bash
npm install @capgo/capacitor-purchases
npx cap sync
```

**3. RevenueCat 또는 직접 구현**

**옵션 A: RevenueCat 사용 (권장)**

RevenueCat은 IAP 구현을 단순화해주는 서비스:

```bash
npm install react-native-purchases
```

**파일**: `packages/shared/src/services/purchases.ts` (새 파일)

```typescript
import Purchases from 'react-native-purchases';

const REVENUECAT_API_KEY = process.env.VITE_REVENUECAT_API_KEY || '';

export class PurchaseService {
  static async initialize(userId: string) {
    await Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
      appUserID: userId,
    });
  }

  static async getOfferings() {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error) {
      console.error('Error fetching offerings:', error);
      return null;
    }
  }

  static async purchasePackage(packageToPurchase: any) {
    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    } catch (error: any) {
      if (error.userCancelled) {
        console.log('User cancelled purchase');
      } else {
        console.error('Purchase error:', error);
      }
      throw error;
    }
  }

  static async restorePurchases() {
    try {
      const customerInfo = await Purchases.restorePurchases();
      return customerInfo;
    } catch (error) {
      console.error('Error restoring purchases:', error);
      throw error;
    }
  }

  static async getCustomerInfo() {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('Error getting customer info:', error);
      return null;
    }
  }
}
```

**4. Subscription 페이지 리팩토링**

**파일**: `packages/mobile/src/pages/Subscription.tsx`

```tsx
import { useState, useEffect } from 'react';
import { PurchaseService } from '@shared/services/purchases';
import { useAuth } from '@shared/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Check } from 'lucide-react';

const Subscription = () => {
  const { user } = useAuth();
  const [offerings, setOfferings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [activeSubscription, setActiveSubscription] = useState<string | null>(null);

  useEffect(() => {
    initializePurchases();
  }, [user]);

  const initializePurchases = async () => {
    if (!user?.id) return;

    try {
      await PurchaseService.initialize(user.id);
      const offerings = await PurchaseService.getOfferings();
      setOfferings(offerings);

      const customerInfo = await PurchaseService.getCustomerInfo();
      if (customerInfo?.activeSubscriptions.length > 0) {
        setActiveSubscription(customerInfo.activeSubscriptions[0]);
      }
    } catch (error) {
      console.error('Failed to initialize purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg: any) => {
    setPurchasing(true);
    try {
      const customerInfo = await PurchaseService.purchasePackage(pkg);
      if (customerInfo?.activeSubscriptions.length > 0) {
        setActiveSubscription(customerInfo.activeSubscriptions[0]);
        toast({
          title: t('subscription.purchaseSuccess'),
          description: t('subscription.purchaseSuccessMessage'),
        });
      }
    } catch (error: any) {
      if (!error.userCancelled) {
        toast({
          title: t('subscription.purchaseError'),
          description: error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const customerInfo = await PurchaseService.restorePurchases();
      if (customerInfo?.activeSubscriptions.length > 0) {
        setActiveSubscription(customerInfo.activeSubscriptions[0]);
        toast({
          title: t('subscription.restoreSuccess'),
          description: t('subscription.restoreSuccessMessage'),
        });
      } else {
        toast({
          title: t('subscription.restoreError'),
          description: t('subscription.noSubscriptionFound'),
        });
      }
    } catch (error: any) {
      toast({
        title: t('subscription.restoreError'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t('subscription.title')}</h1>

      <div className="grid gap-4">
        {offerings?.availablePackages.map((pkg: any) => (
          <Card key={pkg.identifier} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{pkg.product.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {pkg.product.description}
                </p>
                <p className="text-2xl font-bold mt-2">
                  {pkg.product.priceString}
                </p>
              </div>

              {activeSubscription === pkg.identifier ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  <span>{t('subscription.active')}</span>
                </div>
              ) : (
                <Button
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing}
                >
                  {purchasing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('subscription.subscribe')}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Button variant="outline" onClick={handleRestore} className="w-full">
        {t('subscription.restore')}
      </Button>
    </div>
  );
};

export default Subscription;
```

**5. 결제 페이지 제거 또는 수정**

**파일**: `packages/mobile/src/pages/PaymentCheckout.tsx`

외부 결제 페이지는 제거하거나 IAP 전용으로 변경:

```tsx
// 이 페이지를 제거하거나
// IAP 구매 완료 후 확인 화면으로만 사용
```

**6. 번역 추가**

**파일**: `packages/shared/src/i18n/locales/ko/common.json`
```json
{
  "subscription": {
    "title": "구독 관리",
    "subscribe": "구독하기",
    "active": "활성",
    "restore": "구매 복원",
    "purchaseSuccess": "구독 성공",
    "purchaseSuccessMessage": "구독이 활성화되었습니다.",
    "purchaseError": "구독 실패",
    "restoreSuccess": "복원 성공",
    "restoreSuccessMessage": "구독이 복원되었습니다.",
    "restoreError": "복원 실패",
    "noSubscriptionFound": "복원할 구독이 없습니다."
  }
}
```

---

### 방법 2: 엔터프라이즈 전용 앱으로 변경 (비권장)

**난이도**: 🟡 중간
**개발 소요**: 1주
**타입**: ✅ 개발 필요

앱을 조직/기업 전용으로 변경하여 IAP 요구사항 회피

**단점**:
- 개인 사용자 배제 (시장 축소)
- 복잡한 기업 계정 관리 필요
- Factor의 타겟 시장과 맞지 않음

---

### 방법 3: 외부 링크 사용 (미국 스토어프런트만)

**난이도**: 🟡 중간
**개발 소요**: 1주
**타입**: ✅ 개발 필요
**제한사항**: 미국 App Store만 가능

미국 스토어프런트에서만 외부 브라우저 링크를 통한 결제 가능

**요구사항**:
- 명확한 공개 및 동의 절차
- 외부 웹사이트로 이동함을 사용자에게 고지
- 미국 외 지역에서는 IAP 필수

---

## 📊 권장 사항

### ✅ 권장: 방법 1 (Apple IAP 구현)

**이유**:
1. **Apple 정책 완벽 준수**: 모든 스토어프런트에서 동작
2. **사용자 경험 향상**: 앱 내에서 완결, Apple 결제 보안
3. **구독 관리 자동화**: Apple이 자동 갱신 처리
4. **환불 및 고객 지원**: Apple이 대행
5. **글로벌 시장**: 전 세계 어디서나 판매 가능

### 구현 우선순위

**Phase 1: RevenueCat 설정** (1-2일)
1. RevenueCat 계정 생성
2. App Store Connect와 연동
3. 구독 상품 설정

**Phase 2: 코드 구현** (3-4일)
1. PurchaseService 클래스 생성
2. Subscription 페이지 리팩토링
3. 구독 상태 확인 로직
4. 외부 결제 제거

**Phase 3: 테스트** (2-3일)
1. Sandbox 테스트
2. TestFlight 베타 테스트
3. 구매, 복원, 취소 시나리오 테스트

---

## 🎯 Action Items

### api-developer
- [ ] PurchaseService 클래스 구현
- [ ] Supabase에 구독 상태 동기화 로직
- [ ] 외부 결제 API 제거

### mobile-builder
- [ ] App Store Connect IAP 상품 생성
- [ ] RevenueCat 설정
- [ ] Capacitor 플러그인 설치

### ui-components
- [ ] Subscription 페이지 리팩토링
- [ ] 구독 상태 표시 UI
- [ ] 복원 버튼 추가

### type-safety
- [ ] IAP 관련 타입 정의
- [ ] 구독 상태 타입

### quality-checker
- [ ] Sandbox 구매 테스트
- [ ] 복원 기능 테스트
- [ ] 구독 갱신 테스트

### docs-manager
- [ ] IAP 구현 가이드 문서화
- [ ] API_REFERENCE에 구독 API 추가

---

## 📝 App Store Connect 답변 예시

IAP 구현 완료 후:

```
Dear App Review Team,

Thank you for your feedback regarding Guidelines 3.1.1 and 3.1.3(c).

We have updated the FACTOR app to use Apple In-App Purchase for all individual
user subscriptions.

Changes Made:
1. Implemented Apple In-App Purchase for all subscription plans
2. Removed external payment mechanisms for individual users
3. All digital content and services are now purchased through IAP

The app is designed for individual 3D printer owners and hobbyists, not for
enterprise or organizational use. All users purchase subscriptions through
Apple's In-App Purchase system.

App Store Connect has been configured with the following auto-renewable
subscription products:
- Basic Plan: com.byeonggwan.factor.basic.monthly
- Pro Plan: com.byeonggwan.factor.pro.monthly
- Premium Plan: com.byeonggwan.factor.premium.monthly

Thank you for your consideration.

Best regards,
FACTOR Team
```

---

## ⚠️ 주의사항

### IAP 수수료

- Apple은 IAP를 통한 모든 거래에서 15-30% 수수료 부과
- 연간 $1M 이하 매출: 15%
- 연간 $1M 초과 매출: 30%

### 외부 결제 완전 제거

다음 요소를 앱에서 제거해야 함:
- ❌ 외부 웹사이트 결제 링크
- ❌ "웹에서 구매" 버튼
- ❌ 외부 구독 안내
- ❌ Stripe, PayPal 등 third-party 결제

### 구독 관리

- 구독 취소/환불은 Apple이 처리
- 사용자는 iOS 설정 → Apple ID → 구독에서 관리
- 앱 내에서는 구독 상태만 표시

---

## 📚 참고 자료

- [In-App Purchase Programming Guide](https://developer.apple.com/in-app-purchase/)
- [App Store Review Guideline 3.1.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)
- [App Store Review Guideline 3.1.3(c)](https://developer.apple.com/app-store/review/guidelines/#enterprise-services)
- [RevenueCat Documentation](https://docs.revenuecat.com/)

---

**작성일**: 2024-11-16
**담당 에이전트**: api-developer, mobile-builder, ui-components
**우선순위**: 🔴 High (필수 구현)
**예상 완료**: 1-2주
**타입**: 개발 필요
**비용 영향**: Apple IAP 수수료 15-30%
