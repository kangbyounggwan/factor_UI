/**
 * Account API
 *
 * Handles account-related operations including account deletion
 */

import { supabase } from '../integrations/supabase/client';

export const AccountAPI = {
  /**
   * Delete user account and all associated data
   *
   * IMPORTANT: Before calling this function, ensure that:
   * 1. The delete_user function is created in Supabase (see supabase_delete_user_function.sql)
   * 2. The user has confirmed they want to delete their account
   * 3. You've warned the user this action is irreversible
   *
   * @param userId - The ID of the user to delete
   * @returns Success status and error (if any)
   */
  deleteAccount: async (userId: string): Promise<{ success: boolean; error: any }> => {
    try {
      // Call the Supabase function to delete the user
      const { data, error } = await supabase.rpc('delete_user', {
        user_id: userId
      });

      if (error) {
        console.error('[AccountAPI] Delete account error:', error);
        return { success: false, error };
      }

      console.log('[AccountAPI] Account deleted successfully');
      return { success: true, error: null };
    } catch (error: any) {
      console.error('[AccountAPI] Delete account exception:', error);
      return { success: false, error };
    }
  },

  /**
   * Get account deletion summary
   *
   * Shows the user what data will be deleted before they confirm
   *
   * @param userId - The ID of the user
   * @returns Counts of data that will be deleted
   */
  getAccountDeletionSummary: async (userId: string): Promise<{
    printersCount: number;
    clientsCount: number;
    aiImagesCount: number;
    camerasCount: number;
  }> => {
    try {
      // Get counts of all user data
      const [printersRes, clientsRes, aiImagesRes, camerasRes] = await Promise.all([
        supabase.from('printers').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('ai_training_images').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('cameras').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ]);

      return {
        printersCount: printersRes.count || 0,
        clientsCount: clientsRes.count || 0,
        aiImagesCount: aiImagesRes.count || 0,
        camerasCount: camerasRes.count || 0,
      };
    } catch (error) {
      console.error('[AccountAPI] Error fetching account summary:', error);
      return {
        printersCount: 0,
        clientsCount: 0,
        aiImagesCount: 0,
        camerasCount: 0,
      };
    }
  },
};
