import { supabase } from "../../integrations/supabase/client";

export async function getUserPrinterGroups(userId: string) {
  const { data, error } = await supabase
    .from('printer_groups')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function getUserPrintersWithGroup(userId: string) {
  const { data, error } = await supabase
    .from('printers')
    .select(`
      *,
      group:printer_groups(*)
    `)
    .eq('user_id', userId)
    .order('model');
  if (error) throw error;
  return data || [];
}


