import { httpGet, httpPost } from "./http";



export const wifiAPI = {
  scan: () => httpGet<{ networks: Array<{ ssid: string; rssi: number }> }>(`/wifi/scan`),
  connect: (ssid: string, password: string) => httpPost<{ connected: boolean }>(`/wifi/connect`, { ssid, password }),
  status: () => httpGet<{ connected: boolean; ssid?: string }>(`/wifi/status`),
};


