/**
 * Paddle Payment Service
 *
 * Paddle.js를 사용한 결제 처리 서비스
 * - Overlay checkout (권장): 페이지 위에 모달로 표시
 * - Inline checkout: 페이지 내에 임베드
 *
 * @see https://developer.paddle.com/paddlejs/overview
 */

import { initializePaddle, Paddle } from '@paddle/paddle-js';

// Paddle 환경 설정
const PADDLE_CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN || '';
const PADDLE_ENVIRONMENT = import.meta.env.VITE_PADDLE_ENVIRONMENT || 'sandbox';

// 가격 ID 설정
export const PADDLE_PRICES = {
  starter: {
    monthly: import.meta.env.VITE_PADDLE_PRICE_STARTER_MONTHLY || '',
    yearly: import.meta.env.VITE_PADDLE_PRICE_STARTER_YEARLY || '',
  },
  pro: {
    monthly: import.meta.env.VITE_PADDLE_PRICE_PRO_MONTHLY || '',
    yearly: import.meta.env.VITE_PADDLE_PRICE_PRO_YEARLY || '',
  },
  enterprise: {
    monthly: '', // Contact Sales
    yearly: '', // Contact Sales
  },
};

// Paddle 인스턴스 캐싱
let paddleInstance: Paddle | null = null;
let initializationPromise: Promise<Paddle | null> | null = null;

/**
 * 결제 체크아웃 이벤트 타입
 */
export interface CheckoutEventData {
  transactionId?: string;
  status?: string;
  customer?: {
    email?: string;
    id?: string;
  };
  items?: Array<{
    priceId: string;
    quantity: number;
  }>;
}

/**
 * Paddle 초기화 옵션
 */
export interface PaddleInitOptions {
  onCheckoutComplete?: (data: CheckoutEventData) => void;
  onCheckoutClose?: () => void;
  onCheckoutError?: (error: Error) => void;
}

/**
 * Paddle.js 초기화
 *
 * @param options - 초기화 옵션
 * @returns Paddle 인스턴스
 */
export const initializePaddleService = async (
  options: PaddleInitOptions = {}
): Promise<Paddle | null> => {
  // 이미 초기화 중이면 기존 Promise 반환
  if (initializationPromise) {
    return initializationPromise;
  }

  // 이미 초기화된 인스턴스가 있으면 반환
  if (paddleInstance) {
    return paddleInstance;
  }

  if (!PADDLE_CLIENT_TOKEN) {
    console.error('[Paddle] Client token not configured');
    return null;
  }

  initializationPromise = initializePaddle({
    environment: PADDLE_ENVIRONMENT as 'sandbox' | 'production',
    token: PADDLE_CLIENT_TOKEN,
    eventCallback: (event) => {
      console.log('[Paddle] Event:', event.name, event.data);

      switch (event.name) {
        case 'checkout.completed':
          options.onCheckoutComplete?.(event.data as CheckoutEventData);
          break;
        case 'checkout.closed':
          options.onCheckoutClose?.();
          break;
        case 'checkout.error':
          options.onCheckoutError?.(new Error('Checkout error'));
          break;
      }
    },
  }).then((paddle) => {
    if (paddle) {
      paddleInstance = paddle;
      console.log('[Paddle] Initialized successfully');
    }
    return paddle;
  }).catch((error) => {
    console.error('[Paddle] Initialization failed:', error);
    initializationPromise = null;
    return null;
  });

  return initializationPromise;
};

/**
 * Paddle 인스턴스 가져오기
 */
export const getPaddleInstance = (): Paddle | null => {
  return paddleInstance;
};

/**
 * 체크아웃 열기 옵션
 */
export interface OpenCheckoutOptions {
  priceId: string;
  quantity?: number;
  customerEmail?: string;
  customerId?: string;
  locale?: string;
  successUrl?: string;
  discountCode?: string;
  customData?: Record<string, string>;
  variant?: 'one-page' | 'multi-page';
}

/**
 * Overlay 체크아웃 열기
 *
 * GPT, Gemini, Notion, Linear 등 대기업 스타일의 간결한 결제 모달
 * - 이메일 입력 → 결제 수단 선택 → 완료
 *
 * @param options - 체크아웃 옵션
 */
export const openPaddleCheckout = async (
  options: OpenCheckoutOptions
): Promise<void> => {
  const paddle = paddleInstance;

  if (!paddle) {
    throw new Error('Paddle not initialized. Call initializePaddleService first.');
  }

  const {
    priceId,
    quantity = 1,
    customerEmail,
    customerId,
    locale,
    successUrl,
    discountCode,
    customData,
    variant = 'one-page',
  } = options;

  try {
    paddle.Checkout.open({
      items: [{ priceId, quantity }],
      customer: customerEmail ? { email: customerEmail } : undefined,
      customData,
      settings: {
        displayMode: 'overlay',
        variant,
        locale: locale || 'en',
        successUrl: successUrl || `${window.location.origin}/payment/success?provider=paddle`,
        allowLogout: !customerId,
        showAddDiscounts: true,
        showAddTaxId: true,
        theme: 'light',
      },
      ...(discountCode && { discountCode }),
    });
  } catch (error) {
    console.error('[Paddle] Checkout open failed:', error);
    throw error;
  }
};

/**
 * 플랜별 가격 ID 가져오기
 *
 * @param planId - 플랜 ID (basic, pro, enterprise)
 * @param isYearly - 연간 결제 여부
 * @returns 가격 ID
 */
export const getPaddlePriceId = (
  planId: string,
  isYearly: boolean
): string | null => {
  const plan = PADDLE_PRICES[planId as keyof typeof PADDLE_PRICES];

  if (!plan) {
    return null;
  }

  return isYearly ? plan.yearly : plan.monthly;
};

/**
 * 금액 포맷팅 (USD)
 */
export const formatUSD = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

/**
 * 금액 포맷팅 (KRW)
 */
export const formatKRW = (amount: number): string => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(amount);
};

/**
 * 플랜별 가격 정보
 * Paddle은 가격을 플랫폼에서 관리하므로 표시용 가격만 정의
 */
export const PLAN_DISPLAY_PRICES = {
  free: {
    monthly: 0,
    yearly: 0,
    currency: 'USD',
  },
  starter: {
    monthly: 7,
    yearly: 70, // 연간 결제 시 2개월 무료
    currency: 'USD',
  },
  pro: {
    monthly: 15,
    yearly: 150, // 연간 결제 시 2개월 무료
    currency: 'USD',
  },
  enterprise: {
    monthly: -1, // Contact Sales
    yearly: -1,
    currency: 'USD',
  },
};

/**
 * 플랜 가격 가져오기 (표시용)
 */
export const getPlanDisplayPrice = (
  planId: string,
  isYearly: boolean
): number => {
  const plan = PLAN_DISPLAY_PRICES[planId as keyof typeof PLAN_DISPLAY_PRICES];

  if (!plan) {
    return 0;
  }

  return isYearly ? plan.yearly : plan.monthly;
};

/**
 * 플랜 이름
 */
export const getPlanName = (planId: string): string => {
  const planNames: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };

  return planNames[planId] || 'Unknown Plan';
};

/**
 * 구독 관리 포털 열기
 *
 * Paddle의 Customer Portal을 통해 구독 관리
 * - 결제 수단 변경
 * - 구독 취소
 * - 인보이스 확인
 */
export const openCustomerPortal = async (customerId: string): Promise<void> => {
  // Paddle Customer Portal URL은 API를 통해 생성해야 함
  // 이 기능은 서버 사이드에서 처리하는 것을 권장
  console.log('[Paddle] Customer portal requires server-side implementation');
  throw new Error('Customer portal requires server-side implementation');
};

export type { Paddle };
