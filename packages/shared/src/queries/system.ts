/*
  기대값

  - useSystemInfo()
    data: SystemInfo  // { version: string, uptimeSec: number, printers: number }

  - useSystemHealth()
    data: { status: string, connected: boolean, timestamp: number }
*/
import { useQuery } from "@tanstack/react-query";
import { systemAPI } from "../api/system";

export function useSystemInfo() {
  return useQuery({
    queryKey: ["system-info"],
    queryFn: () => systemAPI.info(),
    staleTime: 30_000,
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ["system-health"],
    queryFn: () => systemAPI.health(),
    refetchInterval: 5_000,
  });
}


