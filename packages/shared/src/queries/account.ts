/**
 * Account Queries
 *
 * React Query hooks for account management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountAPI } from '../api/account';

/**
 * Hook to delete user account
 *
 * Usage:
 * ```tsx
 * const deleteAccount = useDeleteAccount();
 * await deleteAccount.mutateAsync(userId);
 * ```
 */
export const useDeleteAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => AccountAPI.deleteAccount(userId),
    onSuccess: () => {
      // Clear all queries after account deletion
      queryClient.clear();
    },
  });
};

/**
 * Hook to get account deletion summary
 *
 * Shows what data will be deleted before user confirms
 *
 * Usage:
 * ```tsx
 * const { data: summary } = useAccountDeletionSummary(userId);
 * ```
 */
export const useAccountDeletionSummary = (userId: string, enabled = true) => {
  return useQuery({
    queryKey: ['account-deletion-summary', userId],
    queryFn: () => AccountAPI.getAccountDeletionSummary(userId),
    enabled: !!userId && enabled,
  });
};
