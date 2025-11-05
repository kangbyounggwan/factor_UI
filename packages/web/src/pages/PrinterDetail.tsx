import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
 // 대시보드와 동일한 실시간 반영을 위해 상세 내부 카드로 대체
import { IoTDevicePanel } from "@/components/IoTDevicePanel";
import { CameraFeed } from "@/components/CameraFeed";
import { PrinterControlPad } from "@/components/PrinterControlPad";
import { GCodeUpload } from "@/components/GCodeUpload";
import { WebSocketStatus } from "@/components/WebSocketStatus";
import { useAuth } from "@shared/contexts/AuthContext";
import { supabase } from "@shared/integrations/supabase/client"
import { onDashStatusMessage } from "@shared/services/mqttService";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { getPrinterStatusInfo, isIdleState, type PrinterState, type PrinterStateFlags } from "@shared";
import { useWebSocket } from "@shared/hooks/useWebSocket";

// 로컬 스냅샷 퍼시스턴스 훅(한 파일 내 사용)
function usePersistentState<T>(key: string, fallback: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn('[PrinterDetail] Failed to save to localStorage:', error);
    }
  }, [key, state]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setState(JSON.parse(e.newValue) as T);
        } catch (error) {
          console.warn('[PrinterDetail] Failed to parse storage event:', error);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  return [state, setState] as const;
}

// 모니터링 데이터 타입 정의
interface MonitoringData {
  printerStatus: {
    state: "idle" | "printing" | "paused" | "error" | "connecting" | "disconnected" | "disconnect" | "operational";
    timestamp: number;
    error_message?: string;
    connected: boolean;
    printing: boolean;
    flags?: Record<string, unknown>;
  };
  temperature: {
    tool: { actual: number; target: number; offset?: number };
    bed: { actual: number; target: number; offset?: number };
    chamber?: { actual: number; target: number; offset?: number };
  };
  printProgress: {
    active: boolean;
    completion: number;
    file_position: number;
    file_size: number;
    print_time: number;
    print_time_left: number;
    filament_used: number;
  };
  settings: {
    feedrate: number;
    flowrate: number;
    fan_speed: number;
  };
}

// 샘플 데이터 제거 - 실제 데이터로 대체
const defaultData: MonitoringData = {
  printerStatus: {
    state: "disconnected",
    timestamp: Date.now(),
    connected: false,
    printing: false
  },
  temperature: {
    tool: { actual: 25, target: 0 },
    bed: { actual: 23, target: 0 }
  },
  printProgress: {
    active: false,
    completion: 0,
    file_position: 0,
    file_size: 0,
    print_time: 0,
    print_time_left: 0,
    filament_used: 0
  },
  settings: {
    feedrate: 100,
    flowrate: 100,
    fan_speed: 0
  }
};

// IoT 디바이스 타입 정의 (IoTDevicePanel과 호환되도록)
interface PrinterIoTDevice {
  id: string;
  name: string;
  type: "sensor" | "camera" | "controller";
  status: "connected" | "disconnected" | "error";
  lastSeen: string;
  batteryLevel?: number;
  signalStrength: number; // IoTDevicePanel에서 필수 필드
  sensorData?: {
    temperature?: number;
    humidity?: number;
    vibration?: number;
    pressure?: number;
  };
}

// IoT 디바이스 기본 데이터
const defaultIoTDevices: PrinterIoTDevice[] = [];

const PrinterDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const location = useLocation();
  const storageKey = `printer:detail:${id ?? 'unknown'}`;
  const hasSnapshot = typeof window !== 'undefined' ? !!localStorage.getItem(storageKey) : false;
  const [data, setData] = usePersistentState<MonitoringData>(storageKey, defaultData);
  const [iotDevices, setIoTDevices] = useState<PrinterIoTDevice[]>(defaultIoTDevices);
  const [loading, setLoading] = useState(!hasSnapshot);
  const { user } = useAuth();
  const { toast } = useToast();

  // MQTT WebSocket 연결 상태는 사용하지 않음 - 프린터의 connected 상태만 사용
  const [deviceUuid, setDeviceUuid] = useState<string | null>(null);

  // 프린터 연결 상태 (대시보드에서 전달받거나 MQTT로 업데이트됨)
  const printerConnected = data.printerStatus.connected;

  // 연결 상태 디버깅
  useEffect(() => {
    console.log('[웹 PrinterDetail] 연결 상태:', {
      printerConnected,
      status_state: data.printerStatus.state,
      status_connected: data.printerStatus.connected,
      status_printing: data.printerStatus.printing,
      deviceUuid,
      timestamp: new Date().toISOString()
    });
  }, [printerConnected, data.printerStatus.state, data.printerStatus.connected, data.printerStatus.printing, deviceUuid]);
  const [streamUrl, setStreamUrl] = usePersistentState<string | null>(
    `printer:stream:${id ?? 'unknown'}`,
    null
  );
  const [sdFiles, setSdFiles] = useState<Array<{ name: string; size: number }>>([]);
  // 로컬 파일 (MQTT sd_list_result의 local 객체)
  type LocalFile = {
    name: string;
    display?: string;
    size?: number;
    date?: string | null;
    hash?: string;
    user?: string;
  };
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  
  // 프린터 연결 정보 상태
  const [connectionInfo, setConnectionInfo] = useState({
    serialPort: '/dev/ttyUSB0',
    baudrate: '115200',
    printerProfile: 'ender3 evo',
    saveSettings: false,
    autoConnect: false
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [availablePorts, setAvailablePorts] = useState<string[]>(['/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyACM0']);
  const [availableProfiles, setAvailableProfiles] = useState<string[]>(['ender3 evo', 'prusa i3', 'cr-10', 'custom']);
  
  // 대시보드 스냅샷에서 즉시 상태 부트스트랩 (연결 지연 제거)
  useEffect(() => {
    try {
      // 1) 라우팅 state 우선 사용(향후 대시보드에서 전달 시 활용)
      // Dashboard에서 전달하는 printer 객체는 PrinterOverview 타입
      const locationState = location?.state as { printer?: { id?: string; state?: string; connected?: boolean; printing?: boolean; device_uuid?: string } } | null;
      const fromRoute = locationState?.printer || null;
      const routeMatch = fromRoute && String(fromRoute.id || '') === String(id || '');
      const candidate = routeMatch ? fromRoute : null;

      console.log('[웹 PrinterDetail] 부트스트랩 - location.state:', locationState);
      console.log('[웹 PrinterDetail] 부트스트랩 - routeMatch:', routeMatch, 'candidate:', candidate);

      // 2) 없으면 로컬 스냅샷에서 조회
      const local = candidate ? null : localStorage.getItem('web:dashboard:printers');
      const list: Array<{ id?: string; device_uuid?: string; state?: string; connected?: boolean; printing?: boolean }> = local ? JSON.parse(local) : [];
      const fromLocal = candidate ? null : list.find((p) => String(p?.id || '') === String(id || ''));

      console.log('[웹 PrinterDetail] 부트스트랩 - localStorage 프린터 리스트:', list);
      console.log('[웹 PrinterDetail] 부트스트랩 - fromLocal:', fromLocal);

      const snap = candidate || fromLocal;
      if (snap) {
        console.log('[웹 PrinterDetail] 부트스트랩 - 스냅샷 사용:', {
          connected: snap.connected,
          state: snap.state,
          printing: snap.printing,
          device_uuid: snap.device_uuid
        });
        setData((prev) => ({
          ...prev,
          printerStatus: {
            ...prev.printerStatus,
            connected: Boolean(snap.connected),
            state: (snap.state as MonitoringData['printerStatus']['state']) ?? prev.printerStatus.state,
            printing: Boolean(snap.printing ?? prev.printerStatus.printing),
            timestamp: Date.now(),
          },
        }));
        if (!deviceUuid && snap.device_uuid) {
          setDeviceUuid(String(snap.device_uuid));
        }
      } else {
        console.log('[웹 PrinterDetail] 부트스트랩 - 스냅샷 없음');
      }
    } catch (err) { console.warn('[웹 PrinterDetail] 부트스트랩 실패:', err); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 실제 프린터 데이터 로드
  useEffect(() => {
    if (id && user) {
      loadPrinterData(!hasSnapshot);
    }
  }, [id, user]);

  // 프린터 연결/연결끊기 함수들
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // TODO: 실제 프린터 연결 API 호출
      await new Promise(resolve => setTimeout(resolve, 2000)); // 시뮬레이션
      
      setData(prev => ({
        ...prev,
        printerStatus: {
          ...prev.printerStatus,
          connected: true,
          state: 'idle'
        }
      }));
      
      toast({
        title: t('printerDetail.connectSuccess'),
        description: t('printerDetail.connectSuccessDesc', { port: connectionInfo.serialPort }),
      });
    } catch (error) {
      toast({
        title: t('printerDetail.connectFailed'),
        description: t('printerDetail.connectFailedDesc'),
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      // TODO: 실제 프린터 연결 해제 API 호출
      await new Promise(resolve => setTimeout(resolve, 1000)); // 시뮬레이션
      
      setData(prev => ({
        ...prev,
        printerStatus: {
          ...prev.printerStatus,
          connected: false,
          state: 'disconnected'
        }
      }));
      
      toast({
        title: t('printerDetail.disconnectSuccess'),
        description: t('printerDetail.disconnectSuccessDesc'),
      });
    } catch (error) {
      toast({
        title: t('printerDetail.disconnectFailed'),
        description: t('printerDetail.disconnectFailedDesc'),
        variant: "destructive",
      });
    }
  };

  const refreshPorts = async () => {
    try {
      // TODO: 실제 시리얼 포트 스캔 API 호출
      await new Promise(resolve => setTimeout(resolve, 1000)); // 시뮬레이션
      toast({
        title: t('printerDetail.portRefresh'),
        description: t('printerDetail.portRefreshDesc'),
      });
    } catch (error) {
      toast({
        title: t('printerDetail.portScanFailed'),
        description: t('printerDetail.portScanFailedDesc'),
        variant: "destructive",
      });
    }
  };

  const loadPrinterData = async (showSpinner?: boolean) => {
    try {
      if (showSpinner ?? !hasSnapshot) setLoading(true);

      // 프린터 기본 정보 로드
      const { data: printer, error } = await supabase
        .from('printers')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('[웹 PrinterDetail] Supabase 로드 에러:', error);
        return;
      }

      console.log('[웹 PrinterDetail] Supabase에서 로드한 프린터 데이터:', {
        id: printer.id,
        status: printer.status,
        hasSnapshot
      });

      // 기존 스냅샷에 병합만 수행(초기화 금지)
      // 스냅샷이 있을 경우, 서버의 상태값으로 덮어쓰지 않음 → 깜빡임 방지
      setData((prev) => {
        if (hasSnapshot) {
          console.log('[웹 PrinterDetail] localStorage 스냅샷 있음 - Supabase 데이터 무시');
          return prev;
        }
        console.log('[웹 PrinterDetail] localStorage 스냅샷 없음 - Supabase 데이터 사용:', {
          prevConnected: prev.printerStatus.connected,
          newState: printer.status
        });
        return {
          ...prev,
          printerStatus: {
            ...prev.printerStatus,
            state: (printer.status as MonitoringData['printerStatus']['state']) ?? prev.printerStatus.state,
            timestamp: Date.now(),
            // 연결 여부는 대시보드 스냅샷/라우트에서만 결정(지연 제거)
            connected: prev.printerStatus.connected,
            printing: (printer.status === 'printing') || prev.printProgress.active === true,
          },
        };
      });

      // 상세 페이지 실시간 반영을 위한 device_uuid 저장
      const printerWithUuid = printer as typeof printer & { device_uuid?: string };
      const device_uuid = printerWithUuid?.device_uuid ?? null;
      setDeviceUuid(device_uuid);

      // cameras.stream_url 조회 및 퍼시스트 저장
      if (device_uuid) {
        const { data: cam, error: camErr } = await supabase
          .from('cameras')
          .select('stream_url')
          .eq('device_uuid', device_uuid)
          .maybeSingle();
        if (camErr) {
          console.warn('[CAM][DB] stream_url 조회 실패:', camErr.message);
        }
        const camWithUrl = cam as { stream_url?: string } | null;
        setStreamUrl(camWithUrl?.stream_url ?? null);
      } else {
        setStreamUrl(null);
      }

    } catch (error) {
      console.error('Error loading printer data:', error);
    } finally {
      if (showSpinner ?? !hasSnapshot) setLoading(false);
    }
  };

  // MQTT dash_status 수신 → 상세 데이터에 반영
  // deviceUuid 변경 시 cameras.stream_url 재조회
  useEffect(() => {
    (async () => {
      if (!deviceUuid) {
        setStreamUrl(null);
        return;
      }
      try {
        const { data: cam, error: camErr } = await supabase
          .from('cameras')
          .select('stream_url')
          .eq('device_uuid', deviceUuid)
          .maybeSingle();
        if (camErr) {
          console.warn('[CAM][DB] stream_url 재조회 실패:', camErr.message);
          return;
        }
        const camWithUrl = cam as { stream_url?: string } | null;
        setStreamUrl(camWithUrl?.stream_url ?? null);
      } catch (e) {
        console.warn('[CAM][DB] stream_url 재조회 예외:', e);
      }
    })();
  }, [deviceUuid]);

  // MQTT dash_status 수신 → 상세 데이터에 반영
  useEffect(() => {
    if (!deviceUuid) return;
    const off = onDashStatusMessage((uuid, payload) => {
      if (uuid !== deviceUuid) return;

      console.log('[웹 PrinterDetail] MQTT dash_status 수신:', {
        uuid,
        printerStatus: payload?.printer_status,
        connection: payload?.connection,
        flags: payload?.printer_status?.flags
      });

      setData((prev) => {
        // connection 배열([state, port, baudrate]) 기반 UI 상태 동기화
        const conn = payload?.connection;
        if (conn && typeof conn.port === 'string') {
          try {
            setConnectionInfo((ci) => ({
              ...ci,
              serialPort: conn.port || ci.serialPort,
              baudrate: String(conn.baudrate ?? ci.baudrate),
              // 요청사항: Printer Profile은 connection[3].name을 사용 (매핑: connection.profile_name)
              printerProfile: (conn as typeof conn & { profile_name?: string }).profile_name || ci.printerProfile,
            }));
          } catch (err) { console.warn('[웹 PrinterDetail] 연결 정보 업데이트 실패:', err); }
        }
        const bed = payload?.temperature_info?.bed;
        const toolAny = payload?.temperature_info?.tool;
        const tool = toolAny?.tool0 ?? toolAny;
        const flags = payload?.printer_status?.flags as Record<string, unknown>;
        const nextState = flags?.ready === true
          ? 'operational'
          : (payload?.printer_status?.state ?? prev.printerStatus.state);

        console.log('[웹 PrinterDetail] MQTT 업데이트 후 상태:', {
          prevConnected: prev.printerStatus.connected,
          newState: nextState,
          flags
        });

        return {
          ...prev,
          printerStatus: {
            state: nextState as MonitoringData['printerStatus']['state'],
            timestamp: Date.now(),
            // 연결 여부는 대시보드에서 전달된 값 유지(초기 활성화 지연 방지)
            connected: prev.printerStatus.connected,
            printing: Boolean(payload?.printer_status?.printing ?? prev.printerStatus.printing),
            error_message: payload?.printer_status?.error_message ?? prev.printerStatus.error_message,
            flags: flags || prev.printerStatus.flags,
          },
          temperature: {
            tool: {
              actual: typeof tool?.actual === 'number' ? tool.actual : prev.temperature.tool.actual,
              target: typeof tool?.target === 'number' ? tool.target : prev.temperature.tool.target,
              offset: typeof tool?.offset === 'number' ? tool.offset : prev.temperature.tool.offset,
            },
            bed: {
              actual: typeof bed?.actual === 'number' ? bed.actual : prev.temperature.bed.actual,
              target: typeof bed?.target === 'number' ? bed.target : prev.temperature.bed.target,
              offset: typeof bed?.offset === 'number' ? bed.offset : prev.temperature.bed.offset,
            },
            chamber: prev.temperature.chamber,
          },
          printProgress: {
            active: Boolean(payload?.progress?.active ?? prev.printProgress.active),
            completion: typeof payload?.progress?.completion === 'number' ? payload.progress.completion : prev.printProgress.completion,
            file_position: payload?.progress?.file_position ?? prev.printProgress.file_position,
            file_size: payload?.progress?.file_size ?? prev.printProgress.file_size,
            print_time: payload?.progress?.print_time ?? prev.printProgress.print_time,
            print_time_left: payload?.progress?.print_time_left ?? prev.printProgress.print_time_left,
            filament_used: payload?.progress?.filament_used ?? prev.printProgress.filament_used,
          },
          settings: {
            feedrate: payload?.settings?.feedrate ?? prev.settings.feedrate,
            flowrate: payload?.settings?.flowrate ?? prev.settings.flowrate,
            fan_speed: payload?.settings?.fan_speed ?? prev.settings.fan_speed,
          },
        };
      });
    });
    return () => { off(); };
  }, [deviceUuid]);


  // SD/로컬 결과 수신 이벤트로 리스트 갱신 (포맷 구분: local=object, sdcard=array, files=array)
  useEffect(() => {
    const onSdList = (e: Event) => {
      const ce = e as CustomEvent<{ deviceSerial: string; result: { sdcard?: unknown[]; files?: unknown[]; local?: Record<string, unknown> } }>;
      const detail = ce?.detail;
      if (!detail || !deviceUuid || detail.deviceSerial !== deviceUuid) return;
      const res = detail.result || {};

      // SD 카드: 우선 sdcard 배열, fallback files 배열
      if (Array.isArray(res.sdcard)) {
        setSdFiles(
          res.sdcard.map((f: unknown) => {
            const file = f as { name?: string; display?: string; size?: number };
            return {
            name: String(file.name ?? file.display ?? ''),
            size: Number(file.size) || 0,
          };
          })
        );
      } else if (Array.isArray(res.files)) {
        setSdFiles(
          res.files.map((f: unknown) => {
            const file = f as { name?: string; display?: string; size?: number };
            return {
            name: String(file.name ?? file.display ?? ''),
            size: Number(file.size) || 0,
          };
          })
        );
      } else {
        setSdFiles([]);
      }

      // 로컬: local이 객체(키-값 딕셔너리)
      if (res.local && typeof res.local === 'object' && !Array.isArray(res.local)) {
        const entries = Object.entries(res.local);
        const parsed: LocalFile[] = entries.map(([key, val]: [string, unknown]) => {
          const v = (val as { name?: string; display?: string; size?: number; date?: string | null; hash?: string; user?: string }) || {};
          return {
            name: String(v.name ?? key),
            display: v.display ? String(v.display) : undefined,
            size: v.size != null ? Number(v.size) : undefined,
            date: v.date ?? null,
            hash: v.hash,
            user: v.user,
          };
        });
        setLocalFiles(parsed);
      } else {
        setLocalFiles([]);
      }
    };
    window.addEventListener('sd_list_result', onSdList as EventListener);
    return () => window.removeEventListener('sd_list_result', onSdList as EventListener);
  }, [deviceUuid]);

  // control_result 토스트 알림 (글로벌 이벤트 수신 → 현재 디바이스만 처리)
  useEffect(() => {
    const onControlResult = (e: Event) => {
      const ce = e as CustomEvent<{ deviceSerial: string; result: { action?: string; ok?: boolean; message?: string } }>;
      const detail = ce?.detail;
      if (!detail || !deviceUuid || detail.deviceSerial !== deviceUuid) return;
      const result = detail.result || {};
      const action: string = result.action || 'control';
      const labelMap: Record<string, string> = {
        home: t('printerDetail.homeMove'),
        pause: t('printerDetail.pause'),
        resume: t('printerDetail.resume'),
        cancel: t('printerDetail.cancel'),
      };
      const label = labelMap[action] || t('printerDetail.control');
      if (result.ok) {
        toast({ title: t('printerDetail.controlSuccess', { action: label }), description: result.message ?? undefined });
      } else {
        toast({ title: t('printerDetail.controlFailed', { action: label }), description: result.message ?? t('printerDetail.controlError'), variant: 'destructive' });
      }
    };
    window.addEventListener('control_result', onControlResult as EventListener);
    return () => window.removeEventListener('control_result', onControlResult as EventListener);
  }, [deviceUuid, toast, t]);

  // 상세 화면용 카드 컴포넌트들
  const PrintProgressCard = () => {
    const completionPercent = Math.round((data.printProgress.completion || 0) * 100);
    const formatTime = (seconds: number): string => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return h > 0 ? `${h}${t('printerDetail.hours')} ${m}${t('printerDetail.minutes')} ${s}${t('printerDetail.seconds')}` : `${m}${t('printerDetail.minutes')} ${s}${t('printerDetail.seconds')}`;
    };
    const formatFileSize = (bytes: number): string => {
      if (!bytes) return '0 B';
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    };
    const fileProgress = data.printProgress.file_size > 0
      ? (data.printProgress.file_position / data.printProgress.file_size) * 100
      : 0;

    // 진행상황 카드 상단 상태 배지 (파랑=대기중, 초록=출력중, 빨강=연결없음)
    // 상태 매핑 규칙
    // - 연결없음: printerStatus.state === 'disconnect' | 'disconnected'
    // - 대기중:   printerStatus.state === 'operational'
    // - 출력중:   printProgress.active === true
    const isPrinting = !!data.printProgress.active;
    const stateStr = (data.printerStatus.state || '').toString();
    const isDisconnected = stateStr === 'disconnect' || stateStr === 'disconnected';
    const isOperational = stateStr === 'operational';

    let stateLabel = t('printerDetail.noConnection');
    let stateClass = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-destructive/40 text-destructive-foreground hover:bg-destructive/50';

    if (isPrinting) {
      stateLabel = t('printerDetail.printing');
      stateClass = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-success/40 text-success-foreground hover:bg-success/50';
    } else if (isOperational) {
      stateLabel = t('printerDetail.standby');
      stateClass = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/40 text-primary-foreground hover:bg-primary/50';
    }
    return (
      <div className="h-full rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="text-sm font-medium">{t('printerDetail.printProgress')}</div>
          <span className={stateClass}>{stateLabel}</span>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{t('printerDetail.overallProgress')}</span>
              <span className="text-2xl font-bold text-primary">{completionPercent}%</span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full">
              <div className="h-3 bg-primary rounded-full" style={{ width: `${completionPercent}%` }} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{t('printerDetail.fileProgress')}</span>
              <span className="text-sm text-muted-foreground">{formatFileSize(data.printProgress.file_position)} / {formatFileSize(data.printProgress.file_size)}</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full">
              <div className="h-2 bg-primary rounded-full" style={{ width: `${fileProgress}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><div className="text-muted-foreground">{t('printerDetail.elapsedTime')}</div><div className="font-medium">{formatTime(data.printProgress.print_time || 0)}</div></div>
            <div><div className="text-muted-foreground">{t('printerDetail.remainingTime')}</div><div className="font-medium">{formatTime(data.printProgress.print_time_left || 0)}</div></div>
          </div>
          <div className="pt-2 border-t">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t('printerDetail.filamentUsed')}</span>
              <span className="font-medium">{((data.printProgress.filament_used || 0) / 1000).toFixed(2)}m</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const PrinterStatusCard = () => {
    // shared 유틸리티를 사용하여 상태 정보 가져오기
    const statusInfo = getPrinterStatusInfo(
      data.printerStatus.state as PrinterState,
      data.printerStatus.flags as PrinterStateFlags,
      {
        idle: t('printerDetail.idle'),
        printing: t('printer.statusPrinting'),
        paused: t('printerDetail.paused'),
        error: t('printerDetail.error'),
        connecting: t('printerDetail.connecting'),
        disconnected: t('printerDetail.disconnected')
      }
    );
    const label = statusInfo.label;
    return (
      <div className="h-full rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-6 border-b"><div className="text-sm font-medium">{t('printerDetail.printerStatus')}</div></div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="inline-flex items-center px-2 py-1 text-xs rounded-md bg-muted">{label}</div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                {t('printerDetail.connection')}: {(data.printerStatus?.flags?.operational || data.printerStatus?.flags?.printing || data.printerStatus?.flags?.paused || data.printerStatus?.flags?.ready || data.printerStatus?.flags?.error) ? t('printerDetail.connected') : t('printerDetail.disconnected')}
              </div>
              <div>{t('printer.statusPrinting')}: {data.printerStatus?.flags?.printing ? t('printerDetail.inProgress') : (data.printerStatus?.flags?.paused ? t('printerDetail.pausing') : t('printerDetail.stopped'))}</div>
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t">
            <div className="text-xs font-medium mb-2">{t('printerDetail.temperatureMonitoring')}</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('printerDetail.extruder')}</span><span className="font-mono">{(data.temperature.tool.actual || 0).toFixed(1)}°C / {(data.temperature.tool.target || 0).toFixed(1)}°C</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('printerDetail.heatingBed')}</span><span className="font-mono">{(data.temperature.bed.actual || 0).toFixed(1)}°C / {(data.temperature.bed.target || 0).toFixed(1)}°C</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const PrinterConnectionCard = () => {
    return (
      <div className="h-full rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {data.printerStatus.connected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <div className="text-sm font-medium">{t('printerDetail.connectionSettings')}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshPorts}
              className="h-4 w-6 p-0"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="p-6 space-y-5 text-sm">
          {/* Serial Port */}
          <div className="space-y-2">
            <Label htmlFor="serial-port" className="text-sm font-medium">{t('printerDetail.serialPort')}</Label>
            <Select
              value={connectionInfo.serialPort}
              onValueChange={(value) => setConnectionInfo(prev => ({ ...prev, serialPort: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('printerDetail.selectPort')} />
              </SelectTrigger>
              <SelectContent>
                {availablePorts.map((port) => (
                  <SelectItem key={port} value={port}>
                    {port}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Baudrate */}
          <div className="space-y-2">
            <Label htmlFor="baudrate" className="text-sm font-medium">{t('printerDetail.baudrate')}</Label>
            <Select
              value={connectionInfo.baudrate}
              onValueChange={(value) => setConnectionInfo(prev => ({ ...prev, baudrate: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('printerDetail.selectBaudrate')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="9600">9600</SelectItem>
                <SelectItem value="19200">19200</SelectItem>
                <SelectItem value="38400">38400</SelectItem>
                <SelectItem value="57600">57600</SelectItem>
                <SelectItem value="115200">115200</SelectItem>
                <SelectItem value="230400">230400</SelectItem>
                <SelectItem value="460800">460800</SelectItem>
                <SelectItem value="921600">921600</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Printer Profile */}
          <div className="space-y-2">
            <Label htmlFor="printer-profile" className="text-sm font-medium">{t('printerDetail.printerProfile')}</Label>
            <Select
              value={connectionInfo.printerProfile}
              onValueChange={(value) => setConnectionInfo(prev => ({ ...prev, printerProfile: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('printerDetail.selectProfile')} />
              </SelectTrigger>
              <SelectContent>
                {availableProfiles.map((profile) => (
                  <SelectItem key={profile} value={profile}>
                    {profile}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Checkboxes */}
          <div className="space-y-4 pt-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="save-settings"
                checked={connectionInfo.saveSettings}
                onCheckedChange={(checked) => setConnectionInfo(prev => ({ ...prev, saveSettings: !!checked }))}
              />
              <Label htmlFor="save-settings" className="text-sm">{t('printerDetail.saveConnectionSettings')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="auto-connect"
                checked={connectionInfo.autoConnect}
                onCheckedChange={(checked) => setConnectionInfo(prev => ({ ...prev, autoConnect: !!checked }))}
              />
              <Label htmlFor="auto-connect" className="text-sm">{t('printerDetail.autoConnectOnStartup')}</Label>
            </div>
          </div>

          {/* Connect/Disconnect Button */}
          <div className="pt-3 pb-4">
            {data.printerStatus.connected ? (
              <Button
                onClick={handleDisconnect}
                variant="outline"
                className="w-full"
                disabled={isConnecting}
              >
                {t('printerDetail.disconnect')}
              </Button>
            ) : (
              <Button
                onClick={handleConnect}
                className="w-full"
                disabled={isConnecting}
              >
                {isConnecting ? t('printerDetail.connecting') : t('printerDetail.connect')}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 뒤로가기 버튼 */}
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t('printerDetail.backToDashboard')}
            </Link>
          </Button>
        </div>


        <div className="grid grid-cols-1 gap-6">
          {/* 카메라 피드와 컨트롤 패드 */}
          <div className="grid grid-cols-10 gap-6 mb-6">
            <div className="col-span-7">
              <div className="relative h-[600px]">
                <CameraFeed
                  cameraId={deviceUuid || 'unknown'}
                  isConnected={printerConnected}
                  resolution="1280x720"
                />
                {!printerConnected && (() => {
                  console.log('[웹 PrinterDetail] 카메라 피드 오버레이 표시:', {
                    printerConnected,
                    status: data.printerStatus.state,
                    connected: data.printerStatus.connected
                  });
                  return (
                    <div className="absolute inset-0 rounded-lg bg-muted/90 text-muted-foreground flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <div className="text-lg font-medium">{t('printerDetail.noConnection')}</div>
                        <div className="text-xs mt-1">{t('printerDetail.noConnectionDesc')}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="col-span-3">
              <div className="relative h-[600px]">
                <PrinterControlPad
                  isConnected={printerConnected}
                  isPrinting={data.printerStatus.printing}
                  deviceUuid={deviceUuid}
                  printerState={data.printerStatus.state}
                  flags={data.printerStatus.flags}
                />
                {!printerConnected && (() => {
                  console.log('[웹 PrinterDetail] 프린터 원격 제어 오버레이 표시:', {
                    printerConnected,
                    status: data.printerStatus.state,
                    connected: data.printerStatus.connected
                  });
                  return (
                    <div className="absolute inset-0 rounded-lg bg-muted/90 text-muted-foreground flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <div className="text-lg font-medium">{t('printerDetail.noConnection')}</div>
                        <div className="text-xs mt-1">{t('printerDetail.noConnectionDesc')}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* 프린트 진행상황과 G-code 파일 관리 (실시간 반영 카드) */}
          <div className="grid grid-cols-10 gap-6">
            <div className="col-span-7">
              <div className="h-[400px]">
                <PrintProgressCard />
              </div>
            </div>
            <div className="col-span-3">
              <div className="relative h-[400px] space-y-3 overflow-y-auto">
                <GCodeUpload deviceUuid={deviceUuid} isConnected={printerConnected} />
                {!printerConnected && (
                  <div className="absolute inset-0 rounded-lg bg-muted/90 text-muted-foreground flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-lg font-medium">{t('printerDetail.noConnection')}</div>
                      <div className="text-xs mt-1">{t('printerDetail.noConnectionDesc')}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 프린터 상태와 위치 및 설정 (실시간 반영 카드) */}
          <div className="grid grid-cols-10 gap-6">
            <div className="col-span-7">
              <div className="h-[300px]">
                <PrinterStatusCard />
              </div>
              <div className="h-[250px] mt-6">
                <IoTDevicePanel devices={iotDevices} />
              </div>
            </div>
            <div className="col-span-3">
              <div className="h-[523px]">
                <PrinterConnectionCard />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PrinterDetail;