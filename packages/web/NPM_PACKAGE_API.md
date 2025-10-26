# npm 패키지 API 가이드

## ⚠️ 중요: MCP 문서와 npm 패키지의 차이

토스페이먼츠 MCP로 조회한 공식 문서는 **브라우저 전역 SDK** (`<script>` 태그) 기준입니다.

하지만 이 프로젝트는 `@tosspayments/payment-widget-sdk` **npm 패키지**를 사용하며, API가 다릅니다!

## 📦 npm 패키지 올바른 사용법

### 설치
```bash
npm install @tosspayments/payment-widget-sdk
```

### 1. 위젯 초기화
```typescript
import { loadPaymentWidget } from '@tosspayments/payment-widget-sdk';

const paymentWidget = await loadPaymentWidget(
  'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm',
  'customer_key_123'
);
```

### 2. 결제 UI 렌더링 (✅ 올바른 방식)
```typescript
// npm 패키지: renderPaymentMethods(selector, amount, options)
await paymentWidget.renderPaymentMethods(
  "#payment-method",                    // selector: string
  { value: 50000, currency: "KRW" },   // amount: Amount | number
  { variantKey: "DEFAULT" }             // options: { variantKey? }
);
```

**중요**: npm 패키지는 **setAmount 메서드가 없습니다!**

### 3. 약관 UI 렌더링
```typescript
await paymentWidget.renderAgreement(
  "#agreement",
  { variantKey: "AGREEMENT" }
);
```

### 4. 결제 요청
```typescript
await paymentWidget.requestPayment({
  orderId: "ORDER_123",
  orderName: "상품명",
  successUrl: window.location.origin + "/payment/success",
  failUrl: window.location.origin + "/payment/fail",
  customerEmail: "test@example.com",
  customerName: "홍길동",
});
```

## 🚫 브라우저 SDK 방식 (npm 패키지에서 안 됨!)

```javascript
// ❌ 에러 발생: paymentWidget.setAmount is not a function
await paymentWidget.setAmount({
  currency: "KRW",
  value: 50000,
});

await paymentWidget.renderPaymentMethods({
  selector: "#payment-method",
  variantKey: "DEFAULT"
});
```

위 방식은 **브라우저 전역 SDK** (`<script src="https://js.tosspayments.com/v2/standard">`) 전용입니다.

## 📋 TypeScript 타입 정의

npm 패키지의 실제 타입 정의:

```typescript
interface PaymentWidget {
  renderPaymentMethods: (
    selector: string,
    amount: Amount | number,
    options?: RenderPaymentMethodsOptions
  ) => PaymentMethodsWidget;

  renderAgreement: (
    selector: string,
    options?: RenderAgreementOptions
  ) => AgreementWidget;

  requestPayment: (
    paymentInfo: PaymentInfo
  ) => Promise<RequestPaymentResult | void>;
}

interface Amount {
  value: number;
  currency?: 'KRW' | 'USD';
  country?: string;
}

interface RenderPaymentMethodsOptions {
  variantKey?: string;
}
```

**setAmount 메서드 없음!**

## 🔍 MCP 문서 vs 실제 구현

| 항목 | MCP 문서 (브라우저 SDK) | npm 패키지 | 이 프로젝트 |
|------|------------------------|------------|------------|
| **패키지** | `<script>` 태그 | `npm install` | ✅ npm 패키지 |
| **금액 설정** | `setAmount()` 분리 | renderPaymentMethods 인자 | ✅ 인자 전달 |
| **API 스타일** | 객체 파라미터 | 다중 인자 | ✅ 다중 인자 |

## ✅ 현재 프로젝트 구현

[tossPaymentsService.ts](src/lib/tossPaymentsService.ts):
```typescript
export const renderPaymentWidget = async (params: RenderPaymentWidgetParams) => {
  const { paymentWidget, amount, selector, variantKey = "DEFAULT" } = params;

  try {
    // ✅ npm 패키지 API: renderPaymentMethods(selector, amount, options)
    await paymentWidget.renderPaymentMethods(
      selector,
      {
        value: amount,
        currency: "KRW"
      },
      {
        variantKey
      }
    );
  } catch (error) {
    console.error('결제 위젯 렌더링 실패:', error);
    throw error;
  }
};
```

## 🎓 교훈

1. **MCP 문서는 브라우저 SDK 기준**: 항상 실제 패키지 타입 확인 필요
2. **npm 패키지는 API가 다름**: TypeScript 타입 정의 참고
3. **실제 에러로 발견**: `setAmount is not a function` 에러로 차이 확인

## 🔗 참고

- npm 패키지: https://www.npmjs.com/package/@tosspayments/payment-widget-sdk
- TypeScript 타입: `node_modules/@tosspayments/payment-widget__types/types/index.d.ts`
- 브라우저 SDK 문서: https://docs.tosspayments.com/sdk/v2/js (MCP로 조회 가능)
