/**
 * 사용자 구독 플랜 조회 훅
 */
import { useState, useEffect } from 'react';
import { getUserPlan } from '../services/supabaseService/subscription';
import type { SubscriptionPlan } from '../types/subscription';

export function useUserPlan(userId: string | undefined | null): {
  plan: SubscriptionPlan;
  isLoading: boolean;
} {
  const [plan, setPlan] = useState<SubscriptionPlan>('free');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchPlan = async () => {
      if (!userId) {
        setPlan('free');
        return;
      }

      setIsLoading(true);
      try {
        const userPlan = await getUserPlan(userId);
        setPlan(userPlan);
      } catch (error) {
        console.error('[useUserPlan] Failed to fetch user plan:', error);
        setPlan('free');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlan();
  }, [userId]);

  return { plan, isLoading };
}

export default useUserPlan;
