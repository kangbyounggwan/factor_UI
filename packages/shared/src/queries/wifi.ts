/*
  기대값

  - useWifiScan(enabled)
    data: { success: boolean, networks: Array<{ ssid: string, signal?: number, encrypted?: boolean }>, trace_id?: string }

  - useWifiStatus()
    data: { connected: boolean, ssid?: string, bluetooth_available: boolean, trace_id: string }
*/
import { useQuery } from "@tanstack/react-query";
import { wifiAPI } from "../api/wifi";

export function useWifiScan(enabled = true) {
  return useQuery({
    queryKey: ["wifi-scan"],
    queryFn: () => wifiAPI.scan(),
    enabled,
    refetchInterval: enabled ? 10_000 : false,
  });
}

export function useWifiStatus() {
  return useQuery({
    queryKey: ["wifi-status"],
    queryFn: () => wifiAPI.status(),
    refetchInterval: 5_000,
  });
}


