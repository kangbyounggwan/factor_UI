import { useEffect, useState } from "react";

export type DashboardSummary = {
  total: number;
  connected: number;
  printing: number;
  error: number;
  idle: number;
  updatedAt: number;
};

const STORAGE_KEY = "dashboard:summary";
const EVENT_NAME = "dashboard:summary";

const defaultSummary: DashboardSummary = {
  total: 0,
  connected: 0,
  printing: 0,
  error: 0,
  idle: 0,
  updatedAt: 0,
};

export function computeDashboardSummary(
  printers: Array<{ connected?: boolean; printing?: boolean; state?: string }>
): DashboardSummary {
  const total = printers.length;
  let connected = 0;
  let printing = 0;
  let error = 0;
  let idle = 0;
  for (const p of printers) {
    if (p.connected) connected += 1;
    if (p.printing || p.state === "printing") printing += 1;
    if (p.state === "error") error += 1;
    if (p.state === "idle") idle += 1;
  }
  return { total, connected, printing, error, idle, updatedAt: Date.now() };
}

export function publishDashboardSummary(summary: DashboardSummary) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(summary));
    // Same-tab
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: summary }));
    // Cross-tab
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel(EVENT_NAME);
      bc.postMessage(summary);
      bc.close();
    }
  } catch {}
}

function readSummary(): DashboardSummary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DashboardSummary) : defaultSummary;
  } catch {
    return defaultSummary;
  }
}

export function useDashboardSummary(initial?: DashboardSummary) {
  const [summary, setSummary] = useState<DashboardSummary>(() => initial ?? readSummary());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { setSummary(JSON.parse(e.newValue) as DashboardSummary); } catch {}
      }
    };
    const onCustom = (e: Event) => {
      const ce = e as CustomEvent<DashboardSummary>;
      if (ce?.detail) setSummary(ce.detail);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_NAME, onCustom as EventListener);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel(EVENT_NAME);
      bc.onmessage = (msg) => {
        if (msg?.data) setSummary(msg.data as DashboardSummary);
      };
    }

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_NAME, onCustom as EventListener);
      if (bc) bc.close();
    };
  }, []);

  return summary;
}


