-- Fix security vulnerability: Remove overly permissive RLS policy for edge_devices
-- This policy currently allows ANY user to view all edge devices including sensitive data
-- like IP addresses, API keys, and network configuration

-- Drop the problematic policy that allows all users to view edge devices
DROP POLICY IF EXISTS "Users can view edge devices" ON public.edge_devices;

-- The remaining "Admin can manage all edge devices" policy with has_role(auth.uid(), 'admin'::app_role) 
-- is sufficient and secure, ensuring only administrators can access edge device information