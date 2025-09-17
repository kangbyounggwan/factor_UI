import { supabase } from "../integrations/supabase/client";

export type WebSocketStatus = "idle" | "connecting" | "open" | "closing" | "closed";

export interface WebSocketClientOptions {
  url?: string;
  tokenProvider?: () => Promise<string | null>;
  reconnect?: boolean;
  maxRetries?: number;
  heartbeatIntervalMs?: number;
  debug?: boolean;
}

type EventHandler = (payload: any) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private status: WebSocketStatus = "idle";
  private url: string;
  private options: Required<Omit<WebSocketClientOptions, "url" | "tokenProvider">> & {
    tokenProvider?: WebSocketClientOptions["tokenProvider"];
  };
  private retryCount = 0;
  private heartbeatTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();

  constructor(opts: WebSocketClientOptions = {}) {
    const envUrl = (import.meta as any).env?.VITE_WEBSOCKET_URL as string | undefined;
    this.url = (opts.url || envUrl || "").trim();
    this.options = {
      reconnect: opts.reconnect ?? true,
      maxRetries: opts.maxRetries ?? 5,
      heartbeatIntervalMs: opts.heartbeatIntervalMs ?? 25_000,
      debug: opts.debug ?? false,
      tokenProvider: opts.tokenProvider,
    };
  }

  getStatus(): WebSocketStatus {
    return this.status;
  }

  on(type: string, handler: EventHandler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.off(type, handler);
  }

  off(type: string, handler: EventHandler) {
    this.handlers.get(type)?.delete(handler);
  }

  private emit(type: string, payload: any) {
    this.handlers.get(type)?.forEach((fn) => {
      try {
        fn(payload);
      } catch {}
    });
    this.handlers.get("__all__")?.forEach((fn) => {
      try {
        fn({ type, payload });
      } catch {}
    });
  }

  private log(...args: any[]) {
    if (this.options.debug) console.log("[WS]", ...args);
  }

  private async buildUrlWithToken(): Promise<string> {
    let finalUrl = this.url;
    if (!finalUrl) throw new Error("Missing VITE_WEBSOCKET_URL");

    if (this.options.tokenProvider) {
      try {
        const token = await this.options.tokenProvider();
        if (token) {
          const u = new URL(finalUrl);
          u.searchParams.set("token", token);
          finalUrl = u.toString();
        }
      } catch {}
    }
    return finalUrl;
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      this.safeSend({ type: "ping", ts: Date.now() });
    }, this.options.heartbeatIntervalMs) as unknown as number;
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer != null) {
      clearInterval(this.heartbeatTimer as unknown as number);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (!this.options.reconnect) return;
    if (this.retryCount >= this.options.maxRetries) return;

    const delay = Math.min(30_000, 1_000 * 2 ** this.retryCount);
    this.retryCount += 1;
    this.log(`reconnect in ${delay}ms (#${this.retryCount})`);

    this.reconnectTimer = window.setTimeout(() => {
      this.connect().catch(() => {});
    }, delay) as unknown as number;
  }

  private clearReconnect() {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer as unknown as number);
      this.reconnectTimer = null;
    }
  }

  async connect(): Promise<void> {
    if (this.ws && (this.status === "open" || this.status === "connecting")) {
      this.log("already connected/connecting");
      return;
    }

    const wsUrl = await this.buildUrlWithToken();
    this.status = "connecting";
    this.clearReconnect();

    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.status = "open";
          this.retryCount = 0;
          this.startHeartbeat();
          this.log("open");
          resolve();
        };

        this.ws.onmessage = (ev) => {
          try {
            const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
            if (data?.type) this.emit(data.type, data);
            else this.emit("__all__", data);
          } catch (e) {
            this.emit("__all__", ev.data);
          }
        };

        this.ws.onerror = (e) => {
          this.log("error", e);
        };

        this.ws.onclose = () => {
          this.status = "closed";
          this.stopHeartbeat();
          this.log("closed");
          this.scheduleReconnect();
        };
      } catch (e) {
        this.status = "closed";
        this.scheduleReconnect();
        reject(e);
      }
    });
  }

  async disconnect(code?: number, reason?: string) {
    this.options.reconnect = false;
    this.clearReconnect();
    this.stopHeartbeat();
    if (this.ws && (this.status === "open" || this.status === "connecting")) {
      this.status = "closing";
      this.ws.close(code, reason);
    }
    this.status = "closed";
    this.ws = null;
  }

  sendRaw(text: string) {
    if (this.ws && this.status === "open") this.ws.send(text);
  }

  safeSend(payload: any) {
    try {
      if (this.ws && this.status === "open") this.ws.send(JSON.stringify(payload));
    } catch {}
  }
}

async function getSupabaseToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export function createSharedWebSocketClient(options: WebSocketClientOptions = {}) {
  return new WebSocketClient({
    reconnect: true,
    debug: false,
    ...options,
    tokenProvider: options.tokenProvider ?? getSupabaseToken,
  });
}


