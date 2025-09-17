import { httpGet, httpPost, httpUpload } from "./http";
import type { TemperatureInfo, Progress, PrinterStatus, PositionData } from "../types/printerType";

export const PrinterAPI = {
  // 통합 스냅샷
  getSnapshot: () => httpGet<{
    printer_status: any;
    temperature_info: any;
    position: any;
    progress: any;
    system_info: any;
    connected: boolean;
    timestamp: number;
    equipment_uuid?: string | null;
  }>("/status"),

  // 단일 섹션
  getStatus: () => httpGet<PrinterStatus>("/printer/status"),
  getTemperature: () => httpGet<TemperatureInfo>("/printer/temperature"),
  getPosition: () => httpGet<PositionData>("/printer/position"),
  getProgress: () => httpGet<Progress>("/printer/progress"),

  // 제어/관리
  sendGcode: (command: string) => httpPost<{ success: boolean; command?: string }>("/printer/command", { command }),
  reconnect: () => httpPost<{ success: boolean; message?: string }>("/printer/reconnect", {}),

  // 메타/확장
  getType: () => httpGet<any>("/printer/type"),
  getCapabilities: () => httpGet<any>("/printer/capabilities"),
  getExtendedData: () => httpGet<any>("/printer/extended-data"),
  clearQueue: () => httpPost<{ success: boolean }>("/printer/queue/clear", {}),
  getTxWindow: () => httpGet<{ window_size: number; inflight: any[]; pending_next: any[] }>("/printer/tx-window"),
  getPhase: () => httpGet<{ phase: string; since: number }>("/printer/phase"),

  // SD 관련
  listSdFiles: () => httpGet<{ success: boolean; files: Array<{ name: string; size?: number }>; last_update: number }>("/printer/sd/list"),
  sdPrint: (name: string) => httpPost<{ success: boolean }>("/printer/sd/print", { name }),
  sdCancel: (params: { mode?: "pause" | "cancel"; wait_finish?: boolean; park?: boolean; cooldown?: boolean }) =>
    httpPost<{ success: boolean }>("/printer/sd/cancel", params),
  sdUpload: (file: File, name?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (name) form.append("name", name);
    return httpUpload<{ success: boolean; name: string; lines: number; bytes: number; closed: boolean }>("/printer/sd/upload", form);
  },
};