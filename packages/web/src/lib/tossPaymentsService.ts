import { loadPaymentWidget, PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk';

// 토스페이먼츠 클라이언트 키 (환경변수에서 로드 권장)
const CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';

// 결제 위젯 인스턴스 캐싱
let paymentWidgetInstance: PaymentWidgetInstance | null = null;

/**
 * 결제 위젯 초기화 (npm 패키지 방식)
 * @param customerKey 고객 고유 키 (회원: UUID, 비회원: "ANONYMOUS")
 * @returns Promise<PaymentWidgetInstance>
 *
 * @tosspayments/payment-widget-sdk 사용 방법:
 * 1. loadPaymentWidget으로 위젯 인스턴스 생성
 * 2. renderPaymentMethods(selector, amount, options)로 결제 UI 렌더링
 * 3. renderAgreement로 약관 UI 렌더링 (선택)
 * 4. requestPayment로 결제 요청
 */
export const initializePaymentWidget = async (customerKey: string): Promise<PaymentWidgetInstance> => {
  try {
    // V2 SDK: loadPaymentWidget으로 위젯 인스턴스 생성
    const paymentWidget = await loadPaymentWidget(CLIENT_KEY, customerKey);
    paymentWidgetInstance = paymentWidget;
    return paymentWidget;
  } catch (error) {
    console.error('결제 위젯 초기화 실패:', error);
    throw new Error('결제 위젯을 초기화하는데 실패했습니다.');
  }
};

/**
 * 결제 위젯 렌더링 파라미터
 */
export interface RenderPaymentWidgetParams {
  paymentWidget: PaymentWidgetInstance;
  amount: number;
  selector: string;
  variantKey?: string;
}

/**
 * 결제 위젯 렌더링 (npm 패키지 API 방식)
 * @tosspayments/payment-widget-sdk는 renderPaymentMethods에 amount를 직접 전달
 */
export const renderPaymentWidget = async (params: RenderPaymentWidgetParams) => {
  const { paymentWidget, amount, selector, variantKey = "DEFAULT" } = params;

  try {
    // npm 패키지 API: renderPaymentMethods(selector, amount, options)
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

/**
 * 결제 요청 파라미터
 */
export interface RequestPaymentParams {
  paymentWidget: PaymentWidgetInstance;
  orderId: string;
  orderName: string;
  customerName?: string;
  customerEmail?: string;
  successUrl?: string;
  failUrl?: string;
  windowTarget?: 'self' | 'iframe'; // 결제창 열기 방식 (self: 현재 창, iframe: iframe)
}

/**
 * 결제 요청
 */
export const requestPayment = async (params: RequestPaymentParams) => {
  try {
    const {
      paymentWidget,
      orderId,
      orderName,
      customerName,
      customerEmail,
      successUrl = `${window.location.origin}/payment/success`,
      failUrl = `${window.location.origin}/payment/fail`,
      windowTarget, // 선택적으로 결제창 열기 방식 지정 (기본값: 모바일은 self, PC는 iframe)
    } = params;

    // windowTarget이 제공된 경우에만 포함
    const paymentRequest: any = {
      orderId,
      orderName,
      successUrl,
      failUrl,
      customerEmail,
      customerName,
    };

    if (windowTarget) {
      paymentRequest.windowTarget = windowTarget;
    }

    await paymentWidget.requestPayment(paymentRequest);
  } catch (error) {
    console.error('결제 요청 실패:', error);
    throw error;
  }
};

/**
 * 주문 ID 생성 헬퍼 함수
 * @param prefix 주문 ID 접두사 (예: 'SUB', 'ORDER')
 * @param planName 플랜 이름 (예: 'basic', 'pro', 'enterprise')
 * @param billingCycle 결제 주기 (예: 'monthly', 'yearly')
 */
export const generateOrderId = (
  prefix = 'ORDER',
  planName?: string,
  billingCycle?: string
): string => {
  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).substring(2, 9);

  let orderId = `${prefix}`;

  if (planName) {
    orderId += `-${planName.toUpperCase()}`;
  }

  if (billingCycle) {
    orderId += `-${billingCycle.toUpperCase()}`;
  }

  orderId += `-${timestamp}-${random}`;

  return orderId;
};

/**
 * 금액 포맷팅 (원화)
 */
export const formatKRW = (amount: number): string => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(amount);
};

/**
 * 플랜 ID로 결제 금액 매핑
 */
export const getPlanAmount = (planId: string, isYearly = false): number => {
  const monthlyPrices: Record<string, number> = {
    basic: 0,
    pro: 19900,
    enterprise: 49900,
  };

  const monthlyPrice = monthlyPrices[planId] || 0;

  // 연간 결제시 10% 할인
  if (isYearly && monthlyPrice > 0) {
    return monthlyPrice * 12 * 0.9;
  }

  return monthlyPrice;
};

/**
 * 플랜 이름 한글 매핑
 */
export const getPlanName = (planId: string): string => {
  const planNames: Record<string, string> = {
    basic: 'Basic 플랜',
    pro: 'Pro 플랜',
    enterprise: 'Enterprise 플랜',
  };

  return planNames[planId] || '알 수 없는 플랜';
};
