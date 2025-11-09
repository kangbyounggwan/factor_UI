// Subscription plan types
export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';

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
    aiModelGeneration: 0, // no AI model generation
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
  plan_name: SubscriptionPlan;
  status: 'active' | 'cancelled' | 'expired' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}
