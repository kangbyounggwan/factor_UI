import { useCallback, useEffect, useRef, useState } from 'react';
import { onDashStatusMessage, createSharedMqttClient } from "../component/mqtt";
import { PrinterStatus, TemperatureData, PositionData, PrintProgressData } from "../types/printerType";

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>({
    status: 'disconnected',
    connected: false,
    printing: false,
    error_message: null,
  });
  const [temperature, setTemperature] = useState<TemperatureData>({
    tool: { current: 0, target: 0 },
    bed: { current: 0, target: 0 },
  });
  const [position, setPosition] = useState<PositionData>({ x: 0, y: 0, z: 0, e: 0 });
  const [printProgress, setPrintProgress] = useState<PrintProgressData>({
    completion: 0,
    file_position: 0,
    file_size: 0,
    print_time: 0,
    print_time_left: 0,
    filament_used: 0,
  });

  const lastMsgTsRef = useRef<number>(0);
  const heartbeatRef = useRef<number | null>(null);

  const connect = useCallback(async () => {
    await createSharedMqttClient().connect();
  }, []);

  const disconnect = useCallback(() => {
    createSharedMqttClient().disconnect().catch(() => {});
  }, []);

  const sendMessage = useCallback((_type: string, _data: any) => {
    // MQTT 기반으로 전환됨 – 이 훅에서는 직접 전송하지 않음
  }, []);

  useEffect(() => {
    // 연결 상태 추정: 최근 메시지 수신 여부 기반
    const tick = () => {
      const now = Date.now();
      const alive = now - (lastMsgTsRef.current || 0) < 10000; // 10s
      setIsConnected(alive);
      setConnectionState(alive ? 'open' : 'disconnected');
    };
    heartbeatRef.current = window.setInterval(tick, 1000) as unknown as number;

    // MQTT 대시 상태 구독 (전역 구독이 이미 시작돼 있어도 listener만 추가)
    const off = onDashStatusMessage((_uuid, payload: any) => {
      lastMsgTsRef.current = Date.now();
      // printer status
      const flags = payload?.printer_status?.flags || {};
      const status: PrinterStatus = {
        status: (payload?.printer_status?.state as any) ?? 'idle',
        connected: Boolean(payload?.connected),
        printing: Boolean(payload?.printer_status?.printing),
        error_message: payload?.printer_status?.error_message ?? null,
      };
      setPrinterStatus(status);

      // temperature
      const tInfo = payload?.temperature_info;
      const toolAny = tInfo?.tool; const tool = toolAny?.tool0 ?? toolAny;
      const nextTemp: TemperatureData = {
        tool: { current: Number(tool?.actual) || 0, target: Number(tool?.target) || 0 },
        bed: { current: Number(tInfo?.bed?.actual) || 0, target: Number(tInfo?.bed?.target) || 0 },
      } as any;
      setTemperature(nextTemp);

      // position
      if (payload?.position) setPosition(payload.position as PositionData);

      // print progress
      const p = payload?.progress || {};
      const nextProg: PrintProgressData = {
        completion: typeof p?.completion === 'number' ? p.completion : 0,
        file_position: p?.file_position ?? 0,
        file_size: p?.file_size ?? 0,
        print_time: p?.print_time ?? 0,
        print_time_left: p?.print_time_left ?? 0,
        filament_used: p?.filament_used ?? 0,
      } as any;
      setPrintProgress(nextProg);
    });

    connect().catch(() => {});

    return () => {
      if (heartbeatRef.current != null) clearInterval(heartbeatRef.current as unknown as number);
      off();
    };
  }, [connect]);

  return {
    isConnected,
    connectionState,
    printerStatus,
    temperature,
    position,
    printProgress,
    connect,
    disconnect,
    sendMessage,
  };
};


