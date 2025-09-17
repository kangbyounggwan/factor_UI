import { httpGet, httpPost } from "./http";

export const bluetoothAPI = {
  status: () => httpGet<any>(`/bluetooth/status`),
  scan: () => httpGet<{ success: boolean; devices: Array<{ id?: string; mac_address?: string; name?: string }> }>(`/bluetooth/scan`),
  pair: (mac_address: string) => httpPost<{ success: boolean; message?: string; trace_id: string }>(`/bluetooth/pair`, { mac_address }),
  connect: (mac_address: string) => httpPost<{ success: boolean; message?: string; trace_id: string }>(`/bluetooth/connect`, { mac_address }),
  disconnect: (mac_address: string) => httpPost<{ success: boolean; message?: string; trace_id: string }>(`/bluetooth/disconnect`, { mac_address }),
};


