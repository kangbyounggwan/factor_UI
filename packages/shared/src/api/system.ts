import { httpGet } from "./http";
import type { SystemInfo } from "../types/systemType";

export const systemAPI = {
  info: () => httpGet<SystemInfo>("/system/info"),
  health: () => httpGet<{ status: string; connected: boolean; timestamp: number }>("/health"),
};
