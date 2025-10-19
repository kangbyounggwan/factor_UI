import { toast } from "@/hooks/use-toast";

export interface PrinterStatus {
  status: 'idle' | 'printing' | 'paused' | 'error' | 'connecting' | 'disconnected';
  connected: boolean;
  printing: boolean;
  error_message: string | null;
}

export interface TemperatureData {
  tool: { current: number; target: number };
  bed: { current: number; target: number };
  chamber?: { current: number; target: number };
}

export interface PositionData {
  x: number;
  y: number;
  z: number;
  e: number;
}

export interface PrintProgressData {
  completion: number;
  file_position: number;
  file_size: number;
  print_time: number;
  print_time_left: number;
  filament_used: number;
}

type MessageHandler = (data: unknown) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private isConnecting = false;

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        console.log('[WS][client] already open:', this.url);
        resolve();
        return;
      }

      if (this.isConnecting) {
        console.log('[WS][client] already connecting:', this.url);
        resolve();
        return;
      }

      this.isConnecting = true;

      try {
        console.log('[WS][client] connecting to:', this.url);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WS][client] open:', this.url);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          toast({
            title: "연결됨",
            description: "프린터와 실시간 연결이 설정되었습니다.",
          });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('메시지 파싱 오류:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('[WS][client] close:', this.url, event.code, event.reason);
          this.isConnecting = false;
          // 정상 종료(1000)일 땐 재연결하지 않음
          if (event.code === 1000) {
            return;
          }
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else {
            toast({
              title: "연결 끊김",
              description: "프린터와의 연결이 끊어졌습니다.",
              variant: "destructive"
            });
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WS][client] error:', this.url, error);
          this.isConnecting = false;
          reject(new Error('웹소켓 연결 오류'));
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error as Error);
      }
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WS][client] reconnect in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts}) to ${this.url}`);

    setTimeout(() => {
      if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
        return;
      }
      this.connect().catch(console.error);
    }, delay);
  }

  disconnect(): void {
    if (this.ws) {
      console.log('[WS][client] manual close:', this.url);
      this.ws.close(1000, '사용자 요청');
      this.ws = null;
    }
  }

  private handleMessage(message: { type?: string; data?: unknown }): void {
    const { type, data } = message;

    if (type && this.messageHandlers.has(type)) {
      const handlers = this.messageHandlers.get(type)!;
      handlers.forEach(handler => handler(data));
    }
  }

  on(messageType: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  off(messageType: string, handler: MessageHandler): void {
    if (this.messageHandlers.has(messageType)) {
      const handlers = this.messageHandlers.get(messageType)!;
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  send(type: string, data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = { type, data };
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WS][client] send skipped (not open):', this.url);
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): string {
    if (!this.ws) return 'disconnected';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }
}

// 싱글톤 인스턴스 생성
export const websocketService = new WebSocketService(
  import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3000'
);
