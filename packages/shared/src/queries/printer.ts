/*
  기대값 (REST 응답 스키마 요약)

  - usePrinterSnapshot(enabled)
    data: {
      printer_status: any,
      temperature_info: any,
      position: any,
      progress: any,
      system_info: any,
      connected: boolean,
      timestamp: number
      
    }

  - usePrinterStatus(enabled)
    data: PrinterStatus

  - usePrinterTemperature(enabled)
    data: TemperatureInfo

  - usePrinterPosition(enabled)
    data: PositionData

  - usePrinterProgress(enabled)
    data: Progress
*/
import { useQuery } from "@tanstack/react-query";
import { PrinterAPI } from "../api/printer";

export function usePrinterSnapshot(enabled = true) {
  return useQuery({
    queryKey: ["printer-snapshot"],
    queryFn: () => PrinterAPI.getSnapshot(),
    enabled,
    refetchInterval: enabled ? 2_000 : false,
  });
}

export function usePrinterStatus(enabled = true) {
  return useQuery({
    queryKey: ["printer-status"],
    queryFn: () => PrinterAPI.getStatus(),
    enabled,
    refetchInterval: enabled ? 2_000 : false,
  });
}

export function usePrinterTemperature(enabled = true) {
  return useQuery({
    queryKey: ["printer-temperature"],
    queryFn: () => PrinterAPI.getTemperature(),
    enabled,
    refetchInterval: enabled ? 2_000 : false,
  });
}

export function usePrinterPosition(enabled = true) {
  return useQuery({
    queryKey: ["printer-position"],
    queryFn: () => PrinterAPI.getPosition(),
    enabled,
    refetchInterval: enabled ? 2_000 : false,
  });
}

export function usePrinterProgress(enabled = true) {
  return useQuery({
    queryKey: ["printer-progress"],
    queryFn: () => PrinterAPI.getProgress(),
    enabled,
    refetchInterval: enabled ? 2_000 : false,
  });
}


