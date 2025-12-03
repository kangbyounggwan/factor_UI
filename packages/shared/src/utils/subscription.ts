import { SubscriptionPlan, PLAN_FEATURES, SubscriptionFeatures } from '../types/subscription';

/**
 * Get features for a specific plan
 * Falls back to 'free' features if plan is not recognized (e.g., 'basic')
 */
export function getPlanFeatures(plan: SubscriptionPlan | string): SubscriptionFeatures {
  // 'basic'은 'free'와 동일하게 취급 (레거시 지원)
  const normalizedPlan = plan === 'basic' ? 'free' : plan;
  return PLAN_FEATURES[normalizedPlan as SubscriptionPlan] || PLAN_FEATURES['free'];
}

/**
 * Check if user can add more printers
 */
export function canAddPrinter(plan: SubscriptionPlan, currentPrinterCount: number): boolean {
  const features = getPlanFeatures(plan);

  if (features.maxPrinters === 'unlimited') {
    return true;
  }

  return currentPrinterCount < features.maxPrinters;
}

/**
 * Get maximum number of printers allowed
 */
export function getMaxPrinters(plan: SubscriptionPlan): number | 'unlimited' {
  const features = getPlanFeatures(plan);
  return features.maxPrinters;
}

/**
 * Check if user has access to analytics features
 */
export function hasAnalyticsAccess(plan: SubscriptionPlan): boolean {
  const features = getPlanFeatures(plan);
  return features.analytics;
}

/**
 * Check if user has API access
 */
export function hasApiAccess(plan: SubscriptionPlan): boolean {
  const features = getPlanFeatures(plan);
  return features.apiAccess;
}

/**
 * Check if user has AI assistant access
 */
export function hasAiAssistantAccess(plan: SubscriptionPlan): boolean {
  const features = getPlanFeatures(plan);
  return features.aiAssistant;
}

/**
 * Check if user has ERP/MES integration access
 */
export function hasErpMesAccess(plan: SubscriptionPlan): boolean {
  const features = getPlanFeatures(plan);
  return features.erpMesIntegration;
}

/**
 * Get webcam streaming reconnect interval (in minutes)
 * Returns undefined for unlimited streaming
 */
export function getWebcamReconnectInterval(plan: SubscriptionPlan): number | undefined {
  const features = getPlanFeatures(plan);
  return features.webcamStreaming.reconnectInterval;
}

/**
 * Check if plan has unlimited webcam streaming
 */
export function hasUnlimitedWebcamStreaming(plan: SubscriptionPlan): boolean {
  const features = getPlanFeatures(plan);
  return features.webcamStreaming.reconnectInterval === undefined;
}

/**
 * Get the minimum required plan for a feature
 */
export function getRequiredPlanForFeature(feature: keyof SubscriptionFeatures): SubscriptionPlan | null {
  const plans: SubscriptionPlan[] = ['free', 'pro', 'enterprise'];

  for (const plan of plans) {
    const features = getPlanFeatures(plan);
    const featureValue = features[feature];

    // Handle different feature types
    if (typeof featureValue === 'boolean' && featureValue === true) {
      return plan;
    }
    if (typeof featureValue === 'object' && featureValue !== null) {
      // For webcamStreaming type features
      if ('enabled' in featureValue && featureValue.enabled) {
        return plan;
      }
    }
  }

  return null;
}

/**
 * Compare two plans (returns -1, 0, or 1)
 */
export function comparePlans(plan1: SubscriptionPlan, plan2: SubscriptionPlan): number {
  const planOrder: SubscriptionPlan[] = ['free', 'pro', 'enterprise'];
  const index1 = planOrder.indexOf(plan1);
  const index2 = planOrder.indexOf(plan2);

  if (index1 < index2) return -1;
  if (index1 > index2) return 1;
  return 0;
}

/**
 * Check if plan upgrade is needed for a feature
 */
export function needsUpgradeFor(
  currentPlan: SubscriptionPlan,
  feature: keyof SubscriptionFeatures
): boolean {
  const requiredPlan = getRequiredPlanForFeature(feature);

  if (!requiredPlan) return false;

  return comparePlans(currentPlan, requiredPlan) < 0;
}

/**
 * Get AI model generation limit for a plan
 */
export function getAiGenerationLimit(plan: SubscriptionPlan): number | 'unlimited' {
  const features = getPlanFeatures(plan);
  return features.aiModelGeneration;
}

/**
 * Check if user can generate more AI models this month
 */
export function canGenerateAiModel(
  plan: SubscriptionPlan,
  currentMonthlyUsage: number
): boolean {
  const limit = getAiGenerationLimit(plan);

  if (limit === 'unlimited') {
    return true;
  }

  return currentMonthlyUsage < limit;
}

/**
 * Get remaining AI model generations for the month
 */
export function getRemainingAiGenerations(
  plan: SubscriptionPlan,
  currentMonthlyUsage: number
): number | 'unlimited' {
  const limit = getAiGenerationLimit(plan);

  if (limit === 'unlimited') {
    return 'unlimited';
  }

  return Math.max(0, limit - currentMonthlyUsage);
}
