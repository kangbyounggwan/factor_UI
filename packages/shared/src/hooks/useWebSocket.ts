import { useCallback, useEffect, useRef, useState } from 'react';
import { createSharedWebSocketClient } from "../component/websocket";
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

  const clientRef = useRef<ReturnType<typeof createSharedWebSocketClient> | null>(null);
  const heartbeatRef = useRef<number | null>(null);

  const ensureClient = () => {
    if (!clientRef.current) {
      clientRef.current = createSharedWebSocketClient({ reconnect: true });
    }
    return clientRef.current;
  };

  const connect = useCallback(async () => {
    const client = ensureClient();
    const status = client.getStatus?.();
    if (status === 'open' || status === 'connecting') return;
    await client.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const sendMessage = useCallback((type: string, data: any) => {
    ensureClient().safeSend({ type, payload: data });
  }, []);

  useEffect(() => {
    const client = ensureClient();

    const setConn = () => {
      const s = client.getStatus();
      setConnectionState(s);
      setIsConnected(s === 'open');
    };
    const id = window.setInterval(setConn, 1000) as unknown as number;

    const offStatus = client.on('printer_status', (msg) => setPrinterStatus(msg.payload as PrinterStatus));
    const offTemp = client.on('temperature_update', (msg) => setTemperature(msg.payload as TemperatureData));
    const offPos = client.on('position_update', (msg) => setPosition(msg.payload as PositionData));
    const offProg = client.on('print_progress', (msg) => setPrintProgress(msg.payload as PrintProgressData));

    connect();

    return () => {
      clearInterval(id as unknown as number);
      offStatus();
      offTemp();
      offPos();
      offProg();
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


