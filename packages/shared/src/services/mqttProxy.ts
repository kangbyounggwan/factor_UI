// MQTT Proxy Client
// 기존 mqtt.js를 대체하는 경량 WebSocket 클라이언트

export type MessageHandler = (topic: string, payload: any) => void;

export interface MqttProxyOptions {
  serverUrl?: string;
  token: string;
  reconnectPeriodMs?: number;
  debug?: boolean;
}

export class MqttProxy {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private connected = false;
  private reconnectTimer?: NodeJS.Timeout;
  private pendingSubscriptions = new Set<string>();
  private options: Required<MqttProxyOptions>;

  // 성능 측정
  private latencyStats = {
    messages: [] as number[],
    avgLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
  };

  constructor(opts: MqttProxyOptions) {
    this.options = {
      serverUrl: opts.serverUrl || (import.meta as any).env?.VITE_WEBSOCKET_URL || 'ws://localhost:5000',
      token: opts.token,
      reconnectPeriodMs: opts.reconnectPeriodMs ?? 3000,
      debug: opts.debug ?? false,
    };

    this.connect();
  }

  private log(...args: any[]) {
    if (this.options.debug) {
      console.log('[MqttProxy]', ...args);
    }
  }

  private connect() {
    const url = `${this.options.serverUrl}/mqtt-proxy?token=${this.options.token}`;

    this.log('Connecting to', url);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected = true;
      this.log('Connected');

      // 재연결 시 보류된 구독 복원
      this.pendingSubscriptions.forEach(topic => {
        this.ws?.send(JSON.stringify({ type: 'subscribe', topic }));
      });
      this.pendingSubscriptions.clear();

      // 기존 구독 복원
      this.handlers.forEach((_, topic) => {
        this.ws?.send(JSON.stringify({ type: 'subscribe', topic }));
      });
    };

    this.ws.onmessage = (event) => {
      const receiveTime = performance.now();
      const msg = JSON.parse(event.data);

      if (msg.type === 'message') {
        // 레이턴시 측정
        if (msg.timestamp) {
          const latency = receiveTime - msg.timestamp;
          this.recordLatency(latency);
        }

        const handlers = this.handlers.get(msg.topic);
        if (handlers) {
          const payload = typeof msg.payload === 'string'
            ? JSON.parse(msg.payload)
            : msg.payload;

          handlers.forEach(handler => {
            try {
              handler(msg.topic, payload);
            } catch (err) {
              console.error('[MqttProxy] Handler error:', err);
            }
          });
        }
      } else if (msg.type === 'subscribed') {
        this.log('Subscribed to', msg.topic);
      } else if (msg.type === 'error') {
        console.error('[MqttProxy] Error:', msg.message);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[MqttProxy] WebSocket error:', err);
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.log('Disconnected, reconnecting in', this.options.reconnectPeriodMs, 'ms');

      // 자동 재연결
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, this.options.reconnectPeriodMs);
    };
  }

  private recordLatency(latency: number) {
    this.latencyStats.messages.push(latency);

    // 최근 100개 메시지만 유지
    if (this.latencyStats.messages.length > 100) {
      this.latencyStats.messages.shift();
    }

    // 통계 업데이트
    const messages = this.latencyStats.messages;
    this.latencyStats.avgLatency = messages.reduce((a, b) => a + b, 0) / messages.length;
    this.latencyStats.minLatency = Math.min(...messages);
    this.latencyStats.maxLatency = Math.max(...messages);
  }

  public getLatencyStats() {
    return { ...this.latencyStats };
  }

  subscribe(topic: string, handler: MessageHandler) {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());

      // 서버에 구독 요청
      if (this.connected) {
        this.ws?.send(JSON.stringify({ type: 'subscribe', topic }));
      } else {
        this.pendingSubscriptions.add(topic);
      }
    }

    this.handlers.get(topic)!.add(handler);
  }

  unsubscribe(topic: string, handler?: MessageHandler) {
    if (handler) {
      this.handlers.get(topic)?.delete(handler);

      // 핸들러가 없으면 구독 취소
      if (this.handlers.get(topic)?.size === 0) {
        this.handlers.delete(topic);
        this.ws?.send(JSON.stringify({ type: 'unsubscribe', topic }));
      }
    } else {
      this.handlers.delete(topic);
      this.ws?.send(JSON.stringify({ type: 'unsubscribe', topic }));
    }
  }

  publish(topic: string, payload: any) {
    const timestamp = performance.now();

    this.ws?.send(JSON.stringify({
      type: 'publish',
      topic,
      payload,
      timestamp, // 레이턴시 측정용
    }));
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.ws?.close();
    this.handlers.clear();
    this.pendingSubscriptions.clear();
    this.connected = false;
  }
}

// Singleton 인스턴스
let proxyInstance: MqttProxy | null = null;

export function createMqttProxy(token: string, options?: Partial<MqttProxyOptions>): MqttProxy {
  if (!proxyInstance) {
    proxyInstance = new MqttProxy({
      token,
      ...options,
      debug: true,
    });
  }
  return proxyInstance;
}

export function getMqttProxy(): MqttProxy | null {
  return proxyInstance;
}
