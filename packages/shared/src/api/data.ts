import { httpGet, httpPost } from "./http";

export const dataAPI = {
  start: (settings: Record<string, any>) => httpPost<{ success: boolean; message: string }>(`/data/start`, settings),
  stop: () => httpPost<{ success: boolean; message: string }>(`/data/stop`, {}),
  getSettings: () => httpGet<{ settings: Record<string, any>; enabled: boolean }>(`/data/settings`),
  saveSettings: (settings: Record<string, any>) => httpPost<{ success: boolean; message: string }>(`/data/settings`, settings),
  stats: () => httpGet<{ total_records: number; active_sensors: number; data_size_mb: number; collection_rate: number }>(`/data/stats`),
  preview: () => httpGet<{ data: Record<string, any> }>(`/data/preview`),
  export: () => httpGet<{ data: any }>(`/data/export`),
  clear: () => httpPost<{ success: boolean; message: string }>(`/data/clear`, {}),
};


