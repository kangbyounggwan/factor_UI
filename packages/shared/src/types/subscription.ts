// ============================================
// Subscription Plan Constants (공통 상수)
// DB, Frontend, Backend 모두에서 동일하게 사용
// ============================================

// Plan codes - DB의 plan_code와 일치해야 함
export const PLAN_CODES = {
  FREE: 'free',
  STARTER: 'starter',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

// Subscription status - DB의 status와 일치해야 함
// 트라이얼 기간 없음 - 바로 결제
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  PAST_DUE: 'past_due', // 결제 실패 (재시도 중)
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
  TROUBLESHOOT_ADVANCED: 'troubleshoot_advanced', // 고급 문제진단 (일별 5회, 무료 사용자용)
  PREMIUM_MODEL_TRIAL: 'premium_model_trial', // 유료 모델 체험 (일별 3회, 무료 사용자용)
} as const;

// Plan display names (i18n key 매핑용)
export const PLAN_DISPLAY_KEYS = {
  [PLAN_CODES.FREE]: 'subscription.plans.free',
  [PLAN_CODES.STARTER]: 'subscription.plans.starter',
  [PLAN_CODES.PRO]: 'subscription.plans.pro',
  [PLAN_CODES.ENTERPRISE]: 'subscription.plans.enterprise',
} as const;

// Type definitions
export type SubscriptionPlan = typeof PLAN_CODES[keyof typeof PLAN_CODES];
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS];
export type BillingCycle = typeof BILLING_CYCLE[keyof typeof BILLING_CYCLE];
export type UsageType = typeof USAGE_TYPES[keyof typeof USAGE_TYPES];

// 지원 타입
export type SupportType = 'community' | 'email' | 'dedicated';

// AI 모델 타입
export type AiModelType = 'basic' | 'advanced';

// ============================================
// 플랜 기능은 DB (subscription_plans 테이블)에서 관리됩니다
// PLAN_FEATURES 하드코딩 제거됨 - DB 값 사용
// ============================================

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id?: string;  // subscription_plans 테이블 참조
  plan_name: SubscriptionPlan;
  status: SubscriptionStatus;
  billing_cycle?: BillingCycle;
  provider?: 'paddle';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  cancelled_at?: string;
  // 트라이얼 기간 없음 - 바로 결제
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
  premium_model_daily_limit: number;  // -1 = unlimited (일일 유료 모델 체험 한도)
  troubleshoot_daily_limit: number;  // -1 = unlimited (일일 고급 문제진단 한도)
  storage_limit_gb: number;  // -1 = unlimited
  webcam_reconnect_interval?: number;  // null = unlimited
  anomaly_detection_interval: number;  // 이상 감지 간격 (분), 0 = 실시간
  support_type: SupportType;  // 지원 방식
  has_slack_channel: boolean;  // 전용 Slack 채널
  ai_model_type: AiModelType;  // AI 모델 타입
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
  // 고급 문제진단 (일별 리셋 - 무료 사용자용 5회/일)
  troubleshoot_advanced_today: number;
  troubleshoot_advanced_date: string; // YYYY-MM-DD 형식
  // 유료 모델 체험 (일별 리셋 - 무료 사용자용 3회/일)
  premium_model_trial_today: number;
  premium_model_trial_date: string; // YYYY-MM-DD 형식
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
