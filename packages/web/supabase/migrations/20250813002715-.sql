-- Fix security vulnerability: Remove public access to profiles table
-- Current policy allows ANYONE (even unauthenticated users) to view all user profiles
-- This exposes display names, roles, and can help attackers identify admin accounts

-- Drop the problematic policy that allows public access to all profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create a more secure policy that only allows authenticated users to view profiles
-- This prevents public access while still allowing legitimate app functionality
CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

-- Alternative: If you want even stricter security, users can only view their own profile
-- Uncomment the line below and comment out the above policy if preferred:
-- CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);