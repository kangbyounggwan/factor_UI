-- Supabase Function for Account Deletion
--
-- Purpose: Allow users to delete their own account and all associated data
--
-- IMPORTANT: This function must be created in Supabase SQL Editor
-- Instructions:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your project
-- 3. Click on "SQL Editor" in the left sidebar
-- 4. Click "New query"
-- 5. Paste this SQL code
-- 6. Click "Run" to execute
--
-- This function will:
-- - Delete all user-related data from the database
-- - Remove the user from auth.users table
-- - Ensure complete data cleanup

-- Create the delete_user function
CREATE OR REPLACE FUNCTION delete_user(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the user making the request is the same as the user being deleted
  -- This ensures users can only delete their own accounts
  IF auth.uid() != user_id THEN
    RAISE EXCEPTION 'You can only delete your own account';
  END IF;

  -- Delete from user_subscriptions table
  DELETE FROM user_subscriptions WHERE user_id = delete_user.user_id;

  -- Delete from user_notification_settings table
  DELETE FROM user_notification_settings WHERE user_id = delete_user.user_id;

  -- Delete from ai_training_images table
  DELETE FROM ai_training_images WHERE user_id = delete_user.user_id;

  -- Delete from cameras table
  DELETE FROM cameras WHERE user_id = delete_user.user_id;

  -- Delete from printers table
  DELETE FROM printers WHERE user_id = delete_user.user_id;

  -- Delete from clients table
  DELETE FROM clients WHERE user_id = delete_user.user_id;

  -- Delete from user_roles table
  DELETE FROM user_roles WHERE user_id = delete_user.user_id;

  -- Finally, delete the user from auth.users table
  -- This is the master table that controls authentication
  DELETE FROM auth.users WHERE id = user_id;

  -- Note: If you have additional tables with user data, add DELETE statements here
  -- Example:
  -- DELETE FROM user_custom_table WHERE user_id = delete_user.user_id;

END;
$$;

-- Grant execute permission to authenticated users
-- This allows logged-in users to call this function
GRANT EXECUTE ON FUNCTION delete_user(uuid) TO authenticated;

-- Revoke execute permission from anonymous users
-- This ensures only logged-in users can delete accounts
REVOKE EXECUTE ON FUNCTION delete_user(uuid) FROM anon;

-- Add a comment to the function for documentation
COMMENT ON FUNCTION delete_user(uuid) IS
'Allows authenticated users to delete their own account and all associated data.
Users can only delete their own account, not other users accounts.';
