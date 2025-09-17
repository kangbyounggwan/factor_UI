import { supabase } from "../../integrations/supabase/client";

export type EdgeDevice = {
  id: string;
  device_uuid: string;
  device_name: string;
  device_type: string;
  status: string;
  ip_address?: string | null;
  port: number;
  last_seen?: string | null;
  registered_at: string;
};

export type AdminStats = {
  totalDevices: number;
  activeDevices: number;
  totalUsers: number;
  adminUsers: number;
};

export async function getEdgeDevices(): Promise<EdgeDevice[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as EdgeDevice[];
}

export async function getUserRoles(): Promise<Array<{ user_id: string; role: 'admin'|'user' }>> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id, role');
  if (error) throw error;
  return (data || []) as Array<{ user_id: string; role: 'admin'|'user' }>;
}

export async function fetchAdminData(): Promise<{ devices: EdgeDevice[]; stats: AdminStats }> {
  const [devices, roles] = await Promise.all([
    getEdgeDevices(),
    getUserRoles(),
  ]);

  const activeDeviceCount = devices.filter(d => d.status === 'active').length;
  const adminCount = roles.filter(r => r.role === 'admin').length;

  const stats: AdminStats = {
    totalDevices: devices.length,
    activeDevices: activeDeviceCount,
    totalUsers: roles.length,
    adminUsers: adminCount,
  };

  return { devices, stats };
}


