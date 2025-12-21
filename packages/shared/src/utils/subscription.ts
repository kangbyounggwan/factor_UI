import { supabase } from '../integrations/supabase/client';
import { SubscriptionPlan, SubscriptionPlanInfo, UsageLimitCheck, USAGE_TYPES } from '../types/subscription';

// ============================================
// 플랜 정보 캐시 (DB 호출 최소화)
// ============================================
let planCache: Map<string, SubscriptionPlanInfo> | null = null;
let planCacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분 캐시

/**
 * DB에서 모든 플랜 정보 로드 (캐시 사용)
 */
export async function loadPlansFromDB(): Promise<Map<string, SubscriptionPlanInfo>> {
  const now = Date.now();

  // 캐시가 유효하면 반환
  if (planCache && (now - planCacheTimestamp) < CACHE_TTL) {
    return planCache;
  }

  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[Subscription] Error loading plans from DB:', error);
    // 캐시가 있으면 반환 (에러 시 기존 캐시 사용)
    if (planCache) return planCache;
    return new Map();
  }

  planCache = new Map();
  for (const plan of data || []) {
    planCache.set(plan.plan_code, plan as SubscriptionPlanInfo);
  }
  planCacheTimestamp = now;

  return planCache;
}

/**
 * 특정 플랜 정보 조회 (DB 기반)
 */
export async function getPlanInfo(planCode: SubscriptionPlan | string): Promise<SubscriptionPlanInfo | null> {
  // 'basic'은 'free'와 동일하게 취급 (레거시 지원)
  const normalizedPlan = planCode === 'basic' ? 'free' : planCode;

  const plans = await loadPlansFromDB();
  return plans.get(normalizedPlan) || plans.get('free') || null;
}

/**
 * 캐시 강제 갱신
 */
export function invalidatePlanCache(): void {
  planCache = null;
  planCacheTimestamp = 0;
}

// ============================================
// 사용량 체크 함수들 (DB 기반)
// ============================================

/**
 * 사용자의 현재 사용량 조회 (DB에서)
 */
export async function getUserUsage(userId: string): Promise<{
  ai_model_generation: number;
  ai_image_generation: number;
  printer_count: number;
  storage_bytes: number;
  api_calls: number;
} | null> {
  const { data, error } = await supabase
    .rpc('get_user_usage', { p_user_id: userId });

  if (error) {
    console.error('[Subscription] Error getting user usage:', error);
    return null;
  }

  return data;
}

/**
 * 사용량 한도 체크 (DB 함수 호출)
 */
export async function checkUsageLimit(
  userId: string,
  usageType: string
): Promise<UsageLimitCheck | null> {
  const { data, error } = await supabase
    .rpc('check_usage_limit', {
      p_user_id: userId,
      p_usage_type: usageType
    });

  if (error) {
    console.error('[Subscription] Error checking usage limit:', error);
    return null;
  }

  return data as UsageLimitCheck;
}

/**
 * 사용자가 프린터를 추가할 수 있는지 확인 (DB 기반)
 */
export async function canAddPrinterAsync(userId: string): Promise<boolean> {
  const result = await checkUsageLimit(userId, USAGE_TYPES.PRINTER_COUNT);
  return result?.can_use ?? false;
}

/**
 * 사용자가 AI 모델을 생성할 수 있는지 확인 (DB 기반)
 */
export async function canGenerateAiModelAsync(userId: string): Promise<boolean> {
  const result = await checkUsageLimit(userId, USAGE_TYPES.AI_MODEL_GENERATION);
  return result?.can_use ?? false;
}

/**
 * 사용량 증가 (DB 함수 호출)
 */
export async function incrementUsage(
  userId: string,
  usageType: string,
  delta: number = 1
): Promise<number> {
  const { data, error } = await supabase
    .rpc('increment_usage', {
      p_user_id: userId,
      p_usage_type: usageType,
      p_delta: delta
    });

  if (error) {
    console.error('[Subscription] Error incrementing usage:', error);
    return -1;
  }

  return data ?? 0;
}

// ============================================
// 동기 함수들 (캐시된 플랜 정보 사용 - 사전 로드 필요)
// ============================================

/**
 * 플랜 정보로 프린터 추가 가능 여부 확인
 * planInfo를 미리 로드해서 전달해야 함
 */
export function canAddPrinterWithPlanInfo(
  planInfo: SubscriptionPlanInfo | null,
  currentPrinterCount: number
): boolean {
  if (!planInfo) return false;
  if (planInfo.max_printers === -1) return true; // unlimited
  return currentPrinterCount < planInfo.max_printers;
}

/**
 * 플랜 정보로 AI 모델 생성 가능 여부 확인
 * planInfo를 미리 로드해서 전달해야 함
 */
export function canGenerateAiModelWithPlanInfo(
  planInfo: SubscriptionPlanInfo | null,
  currentMonthlyUsage: number
): boolean {
  if (!planInfo) return false;
  if (planInfo.ai_generation_limit === -1) return true; // unlimited
  return currentMonthlyUsage < planInfo.ai_generation_limit;
}

/**
 * 최대 프린터 수 조회
 */
export function getMaxPrintersFromPlanInfo(planInfo: SubscriptionPlanInfo | null): number | 'unlimited' {
  if (!planInfo) return 1;
  return planInfo.max_printers === -1 ? 'unlimited' : planInfo.max_printers;
}

/**
 * AI 생성 한도 조회
 */
export function getAiGenerationLimitFromPlanInfo(planInfo: SubscriptionPlanInfo | null): number | 'unlimited' {
  if (!planInfo) return 5;
  return planInfo.ai_generation_limit === -1 ? 'unlimited' : planInfo.ai_generation_limit;
}

/**
 * 남은 AI 생성 횟수 조회
 */
export function getRemainingAiGenerationsFromPlanInfo(
  planInfo: SubscriptionPlanInfo | null,
  currentMonthlyUsage: number
): number | 'unlimited' {
  if (!planInfo) return 0;
  if (planInfo.ai_generation_limit === -1) return 'unlimited';
  return Math.max(0, planInfo.ai_generation_limit - currentMonthlyUsage);
}

// ============================================
// 플랜 비교 및 기타 유틸리티
// ============================================

/**
 * 플랜 순서 비교 (-1, 0, 1)
 */
export function comparePlans(plan1: SubscriptionPlan, plan2: SubscriptionPlan): number {
  const planOrder: SubscriptionPlan[] = ['free', 'starter', 'pro', 'enterprise'];
  const index1 = planOrder.indexOf(plan1);
  const index2 = planOrder.indexOf(plan2);

  if (index1 < index2) return -1;
  if (index1 > index2) return 1;
  return 0;
}

/**
 * 플랜 업그레이드가 필요한지 확인
 */
export async function needsUpgradeForFeature(
  userId: string,
  feature: 'analytics' | 'api_access' | 'ai_assistant' | 'erp_mes_integration'
): Promise<boolean> {
  // 사용자의 현재 플랜 조회
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('plan_name, plan_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!subscription) return true;

  const planInfo = await getPlanInfo(subscription.plan_name);
  if (!planInfo) return true;

  switch (feature) {
    case 'analytics':
      return !planInfo.has_analytics;
    case 'api_access':
      return !planInfo.has_api_access;
    case 'ai_assistant':
      return !planInfo.has_ai_assistant;
    case 'erp_mes_integration':
      return !planInfo.has_erp_mes_integration;
    default:
      return false;
  }
}

// ============================================
// 레거시 호환 함수들 (deprecated - 마이그레이션 완료 후 제거)
// ============================================

/**
 * @deprecated DB 기반으로 전환됨. canAddPrinterAsync() 또는 canAddPrinterWithPlanInfo() 사용
 */
export function canAddPrinter(plan: SubscriptionPlan, currentPrinterCount: number): boolean {
  console.warn('[Subscription] canAddPrinter() is deprecated. Use canAddPrinterAsync() instead.');
  // 폴백: 하드코딩된 기본값 사용
  const defaultLimits: Record<string, number> = { free: 1, starter: 2, pro: 5, enterprise: -1 };
  const limit = defaultLimits[plan] ?? 1;
  if (limit === -1) return true;
  return currentPrinterCount < limit;
}

/**
 * @deprecated DB 기반으로 전환됨. getMaxPrintersFromPlanInfo() 사용
 */
export function getMaxPrinters(plan: SubscriptionPlan): number | 'unlimited' {
  console.warn('[Subscription] getMaxPrinters() is deprecated. Use getMaxPrintersFromPlanInfo() instead.');
  const defaultLimits: Record<string, number> = { free: 1, starter: 2, pro: 5, enterprise: -1 };
  const limit = defaultLimits[plan] ?? 1;
  return limit === -1 ? 'unlimited' : limit;
}

/**
 * @deprecated DB 기반으로 전환됨. getAiGenerationLimitFromPlanInfo() 사용
 */
export function getAiGenerationLimit(plan: SubscriptionPlan): number | 'unlimited' {
  console.warn('[Subscription] getAiGenerationLimit() is deprecated. Use getAiGenerationLimitFromPlanInfo() instead.');
  const defaultLimits: Record<string, number> = { free: 5, starter: -1, pro: 50, enterprise: -1 };
  const limit = defaultLimits[plan] ?? 5;
  return limit === -1 ? 'unlimited' : limit;
}

/**
 * @deprecated DB 기반으로 전환됨. canGenerateAiModelAsync() 또는 canGenerateAiModelWithPlanInfo() 사용
 */
export function canGenerateAiModel(plan: SubscriptionPlan, currentMonthlyUsage: number): boolean {
  console.warn('[Subscription] canGenerateAiModel() is deprecated. Use canGenerateAiModelAsync() instead.');
  const limit = getAiGenerationLimit(plan);
  if (limit === 'unlimited') return true;
  return currentMonthlyUsage < limit;
}

/**
 * @deprecated DB 기반으로 전환됨. getRemainingAiGenerationsFromPlanInfo() 사용
 */
export function getRemainingAiGenerations(plan: SubscriptionPlan, currentMonthlyUsage: number): number | 'unlimited' {
  console.warn('[Subscription] getRemainingAiGenerations() is deprecated. Use getRemainingAiGenerationsFromPlanInfo() instead.');
  const limit = getAiGenerationLimit(plan);
  if (limit === 'unlimited') return 'unlimited';
  return Math.max(0, limit - currentMonthlyUsage);
}

/**
 * 플랜에 따른 웹캠 재연결 간격(ms) 반환
 * 무료 플랜은 더 긴 간격, 유료 플랜은 짧은 간격
 */
export function getWebcamReconnectInterval(plan: SubscriptionPlan): number {
  switch (plan) {
    case 'enterprise':
      return 1000; // 1초
    case 'pro':
      return 2000; // 2초
    case 'starter':
      return 3000; // 3초
    case 'free':
    default:
      return 5000; // 5초
  }
}

// ============================================
// 고급 문제진단 (Troubleshoot Advanced) 관련 함수
// 무료 사용자: 1일 5회 사용 가능
// ============================================

const FREE_USER_TROUBLESHOOT_DAILY_LIMIT = 5;

/**
 * 고급 문제진단 사용량 체크 (일별 리셋)
 */
export async function checkTroubleshootAdvancedUsage(
  userId: string
): Promise<{ canUse: boolean; remaining: number; isFreePlan: boolean }> {
  // 사용자의 현재 플랜 조회
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('plan_name')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle();

  const planName = subscription?.plan_name || 'free';

  // 유료 플랜 (starter, pro, enterprise)은 무제한
  if (planName !== 'free') {
    return { canUse: true, remaining: -1, isFreePlan: false };
  }

  // 무료 사용자: DB에서 오늘 사용량 체크
  const { data, error } = await supabase
    .rpc('check_troubleshoot_advanced_usage', { p_user_id: userId });

  if (error) {
    console.error('[Subscription] Error checking troubleshoot usage:', error);
    // 에러 시 사용 불가 처리
    return { canUse: false, remaining: 0, isFreePlan: true };
  }

  const todayUsage = data?.today_usage ?? 0;
  const remaining = Math.max(0, FREE_USER_TROUBLESHOOT_DAILY_LIMIT - todayUsage);

  return {
    canUse: remaining > 0,
    remaining,
    isFreePlan: true,
  };
}

/**
 * 고급 문제진단 사용량 증가
 */
export async function incrementTroubleshootAdvancedUsage(
  userId: string
): Promise<{ success: boolean; newCount: number }> {
  const { data, error } = await supabase
    .rpc('increment_troubleshoot_advanced_usage', { p_user_id: userId });

  if (error) {
    console.error('[Subscription] Error incrementing troubleshoot usage:', error);
    return { success: false, newCount: -1 };
  }

  return { success: true, newCount: data ?? 0 };
}

/**
 * 사용자가 고급 문제진단을 사용할 수 있는지 확인 (간편 함수)
 */
export async function canUseTroubleshootAdvanced(userId: string): Promise<boolean> {
  const result = await checkTroubleshootAdvancedUsage(userId);
  return result.canUse;
}

// ============================================
// 유료 모델 체험 (Premium Model Trial) 관련 함수
// 무료 사용자: 1일 3회 사용 가능 (Gemini 3.0 Flash)
// ============================================

const FREE_USER_PREMIUM_MODEL_DAILY_LIMIT = 3;

/**
 * 유료 모델 체험 사용량 체크 (일별 리셋)
 */
export async function checkPremiumModelTrialUsage(
  userId: string
): Promise<{ canUse: boolean; remaining: number; isFreePlan: boolean }> {
  // 사용자의 현재 플랜 조회
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('plan_name')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle();

  const planName = subscription?.plan_name || 'free';

  // 유료 플랜 (starter, pro, enterprise)은 무제한
  if (planName !== 'free') {
    return { canUse: true, remaining: -1, isFreePlan: false };
  }

  // 무료 사용자: DB에서 오늘 사용량 체크
  const { data, error } = await supabase
    .rpc('check_premium_model_trial_usage', { p_user_id: userId });

  if (error) {
    console.error('[Subscription] Error checking premium model trial usage:', error);
    // 에러 시에도 사용 허용 (DB 함수가 아직 없을 수 있음)
    return { canUse: true, remaining: FREE_USER_PREMIUM_MODEL_DAILY_LIMIT, isFreePlan: true };
  }

  const todayUsage = data?.today_usage ?? 0;
  const remaining = Math.max(0, FREE_USER_PREMIUM_MODEL_DAILY_LIMIT - todayUsage);

  return {
    canUse: remaining > 0,
    remaining,
    isFreePlan: true,
  };
}

/**
 * 유료 모델 체험 사용량 증가
 */
export async function incrementPremiumModelTrialUsage(
  userId: string
): Promise<{ success: boolean; newCount: number }> {
  const { data, error } = await supabase
    .rpc('increment_premium_model_trial_usage', { p_user_id: userId });

  if (error) {
    console.error('[Subscription] Error incrementing premium model trial usage:', error);
    return { success: false, newCount: -1 };
  }

  return { success: true, newCount: data ?? 0 };
}
