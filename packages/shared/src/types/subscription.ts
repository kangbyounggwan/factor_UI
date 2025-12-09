// ============================================
// Subscription Plan Constants (공통 상수)
// DB, Frontend, Backend 모두에서 동일하게 사용
// ============================================

// Plan codes - DB의 plan_code와 일치해야 함
export const PLAN_CODES = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

// Subscription status - DB의 status와 일치해야 함
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  TRIALING: 'trialing',
} as const;

// Billing cycle - DB의 billing_cycle과 일치해야 함
export const BILLING_CYCLE = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

// Usage types - DB의 usage_type과 일치해야 함
export const USAGE_TYPES = {
  AI_MODEL_GENERATION: 'ai_model_generation',
  AI_IMAGE_GENERATION: 'ai_image_generation',
  PRINTER_COUNT: 'printer_count',
  STORAGE_BYTES: 'storage_bytes',
  API_CALLS: 'api_calls',
} as const;

// Plan display names (i18n key 매핑용)
export const PLAN_DISPLAY_KEYS = {
  [PLAN_CODES.FREE]: 'subscription.plans.free',
  [PLAN_CODES.PRO]: 'subscription.plans.pro',
  [PLAN_CODES.ENTERPRISE]: 'subscription.plans.enterprise',
} as const;

// Type definitions
export type SubscriptionPlan = typeof PLAN_CODES[keyof typeof PLAN_CODES];
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS];
export type BillingCycle = typeof BILLING_CYCLE[keyof typeof BILLING_CYCLE];
export type UsageType = typeof USAGE_TYPES[keyof typeof USAGE_TYPES];

export interface SubscriptionFeatures {
  maxPrinters: number | 'unlimited';
  webcamStreaming: {
    enabled: boolean;
    reconnectInterval?: number; // in minutes, undefined means unlimited
  };
  aiModelGeneration: number | 'unlimited'; // monthly AI model generation limit
  analytics: boolean;
  pushNotifications: boolean;
  apiAccess: boolean;
  aiAssistant: boolean;
  erpMesIntegration: boolean;
  communitySupport: boolean;
  prioritySupport: boolean;
  dedicatedSupport: boolean;
}

export const PLAN_FEATURES: Record<SubscriptionPlan, SubscriptionFeatures> = {
  free: {
    maxPrinters: 1,
    webcamStreaming: {
      enabled: true,
      reconnectInterval: undefined, // unlimited (기본 기능)
    },
    aiModelGeneration: 20, // 20 AI model generations per month for free plan
    analytics: false,
    pushNotifications: true,
    apiAccess: false,
    aiAssistant: false,
    erpMesIntegration: false,
    communitySupport: true,
    prioritySupport: false,
    dedicatedSupport: false,
  },
  pro: {
    maxPrinters: 5,
    webcamStreaming: {
      enabled: true,
      reconnectInterval: undefined, // unlimited
    },
    aiModelGeneration: 50, // 50 AI model generations per month
    analytics: true,
    pushNotifications: true,
    apiAccess: true,
    aiAssistant: false,
    erpMesIntegration: false,
    communitySupport: true,
    prioritySupport: true,
    dedicatedSupport: false,
  },
  enterprise: {
    maxPrinters: 'unlimited',
    webcamStreaming: {
      enabled: true,
      reconnectInterval: undefined, // unlimited
    },
    aiModelGeneration: 'unlimited', // unlimited AI model generations
    analytics: true,
    pushNotifications: true,
    apiAccess: true,
    aiAssistant: true,
    erpMesIntegration: true,
    communitySupport: true,
    prioritySupport: true,
    dedicatedSupport: true,
  },
};

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id?: string;  // subscription_plans 테이블 참조
  plan_name: SubscriptionPlan;
  status: SubscriptionStatus;
  billing_cycle?: BillingCycle;
  provider?: 'paddle' | 'toss';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  cancelled_at?: string;
  trial_start?: string;
  trial_end?: string;
  paddle_subscription_id?: string;
  paddle_customer_id?: string;
  created_at: string;
  updated_at: string;
}

// Subscription plan info from DB (subscription_plans 테이블)
export interface SubscriptionPlanInfo {
  id: string;
  plan_code: SubscriptionPlan;
  display_name: string;
  display_name_ko: string;
  description?: string;
  price_monthly: number;
  price_yearly: number;
  paddle_price_id_monthly?: string;
  paddle_price_id_yearly?: string;
  max_printers: number;  // -1 = unlimited
  ai_generation_limit: number;  // -1 = unlimited
  storage_limit_gb: number;  // -1 = unlimited
  webcam_reconnect_interval?: number;  // null = unlimited
  has_analytics: boolean;
  has_push_notifications: boolean;
  has_api_access: boolean;
  has_ai_assistant: boolean;
  has_erp_mes_integration: boolean;
  has_community_support: boolean;
  has_priority_support: boolean;
  has_dedicated_support: boolean;
  sort_order: number;
  is_active: boolean;
}

// Usage tracking (user_usage 테이블) - 유저당 1개 row
export interface UserUsage {
  id: string;
  user_id: string;
  period_year: number;
  period_month: number;
  // AI 사용량 (월별 리셋)
  ai_model_generation: number;
  ai_image_generation: number;
  // 프린터 (누적)
  printer_count: number;
  // 스토리지 (누적, 바이트)
  storage_bytes: number;
  // API 호출 (월별 리셋)
  api_calls: number;
  // 메타데이터
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

// 사용량 한도 체크 결과
export interface UsageLimitCheck {
  plan_code: SubscriptionPlan;
  usage_type: UsageType;
  current_usage: number;
  limit: number;  // -1 = unlimited
  remaining: number;  // -1 = unlimited
  can_use: boolean;
}

// Helper functions
export function isUnlimited(value: number): boolean {
  return value === -1;
}

export function getPlanLimit(plan: SubscriptionPlanInfo, limitType: 'printers' | 'ai' | 'storage'): number | 'unlimited' {
  switch (limitType) {
    case 'printers':
      return isUnlimited(plan.max_printers) ? 'unlimited' : plan.max_printers;
    case 'ai':
      return isUnlimited(plan.ai_generation_limit) ? 'unlimited' : plan.ai_generation_limit;
    case 'storage':
      return isUnlimited(plan.storage_limit_gb) ? 'unlimited' : plan.storage_limit_gb;
  }
}
