import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Wifi, WifiOff, Camera, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
 // 대시보드와 동일한 실시간 반영을 위해 상세 내부 카드로 대체
import { IoTDevicePanel } from "@/components/IoTDevicePanel";
import { PrinterControlPad } from "@/components/PrinterControlPad";
import { GCodeUpload } from "@/components/GCodeUpload";
import { WebSocketStatus } from "@/components/WebSocketStatus";
import { useAuth } from "@shared/contexts/AuthContext";
import { supabase } from "@shared/integrations/supabase/client"
import { onDashStatusMessage, mqttConnect, mqttPublish, mqttSubscribe, mqttUnsubscribe } from "@shared/services/mqttService";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

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
    } catch {}
  }, [key, state]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setState(JSON.parse(e.newValue) as T);
        } catch {}
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
    flags?: Record<string, any>;
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
  const storageKey = `printer:detail:${id ?? 'unknown'}`;
  const hasSnapshot = typeof window !== 'undefined' ? !!localStorage.getItem(storageKey) : false;
  const [data, setData] = usePersistentState<MonitoringData>(storageKey, defaultData);
  const [iotDevices, setIoTDevices] = useState<PrinterIoTDevice[]>(defaultIoTDevices);
  const [loading, setLoading] = useState(!hasSnapshot);
  const { user } = useAuth();
  const { toast } = useToast();
  const [deviceUuid, setDeviceUuid] = useState<string | null>(null);
  const [printerName, setPrinterName] = useState<string>('Printer');
  const [streamUrl, setStreamUrl] = usePersistentState<string | null>(
    `printer:stream:${id ?? 'unknown'}`,
    null
  );
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [webrtcUrl, setWebrtcUrl] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'offline' | 'starting' | 'online' | 'error'>('offline');
  const videoRef = useRef<HTMLVideoElement>(null);
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
  

  // 페이지 진입 시 스크롤 초기화 (메인 스크롤 컨테이너가 우선)
  useEffect(() => {
    const appScroll = document.getElementById('app-scroll');
    const before = {
      scrollY: appScroll ? appScroll.scrollTop : window.scrollY,
      scrollX: appScroll ? appScroll.scrollLeft : window.scrollX,
      bodyOverflow: document.body.style.overflow,
      timestamp: new Date().toISOString()
    };
    console.log('[PrinterDetail] 페이지 진입 - 스크롤 초기화 전:', before);

    if (appScroll) {
      appScroll.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } else {
      window.scrollTo(0, 0);
    }

    const after = {
      current_scrollY: appScroll ? appScroll.scrollTop : window.scrollY,
      current_scrollX: appScroll ? appScroll.scrollLeft : window.scrollX,
      success: appScroll ? appScroll.scrollTop === 0 && appScroll.scrollLeft === 0 : (window.scrollY === 0 && window.scrollX === 0),
      timestamp: new Date().toISOString()
    };
    console.log('[PrinterDetail] 스크롤 초기화 직후 (current 위치):', after);

    // 스크롤이 실제로 초기화되었는지 확인 (비동기 처리를 위한 setTimeout)
    setTimeout(() => {
      const check = {
        current_scrollY: appScroll ? appScroll.scrollTop : window.scrollY,
        current_scrollX: appScroll ? appScroll.scrollLeft : window.scrollX,
        success: appScroll ? appScroll.scrollTop === 0 && appScroll.scrollLeft === 0 : (window.scrollY === 0 && window.scrollX === 0),
        bodyOverflow: document.body.style.overflow,
        timestamp: new Date().toISOString()
      };
      console.log('[PrinterDetail] 스크롤 초기화 후 100ms (current 위치):', check);
    }, 100);
  }, []);

  // 프린터 ID 변경 시에도 스크롤 초기화
  useEffect(() => {
    const appScroll = document.getElementById('app-scroll');
    if (appScroll) {
      appScroll.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [id]);

  // 화살표 힌트 - 1~2초 점멸 후 사라짐
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSwipeHint(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // 스크롤 이벤트 모니터링 - 디버깅용
  useEffect(() => {
    const handleScroll = () => {
      console.log('[PrinterDetail] 스크롤 이벤트 - current 위치:', {
        current_scrollY: window.scrollY,
        current_scrollX: window.scrollX,
        timestamp: new Date().toISOString()
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // MQTT 카메라 상태 구독
  useEffect(() => {
    if (!deviceUuid) return;

    let unsub: (() => Promise<void>) | null = null;

    (async () => {
      try {
        await mqttConnect();
        const topic = `camera/${deviceUuid}/state`;
        const handler = (_t: string, payload: any) => {
          try {
            const msg = typeof payload === 'string' ? JSON.parse(payload) : payload;
            const running = !!(msg?.running);
            setCameraStatus(running ? 'online' : 'offline');

            const wurl =
              msg?.webrtc?.play_url_webrtc ||
              msg?.play_url_webrtc ||
              (typeof msg?.url === 'string' && !msg.url.endsWith('.m3u8') ? msg.url : null);
            if (wurl) setWebrtcUrl(wurl);
          } catch (e) {
            console.warn('[CAM][STATE] parse error', e);
          }
        };
        await mqttSubscribe(topic, handler, 1);
        unsub = async () => { try { await mqttUnsubscribe(topic, handler); } catch {} };
      } catch (e) {
        console.warn('[CAM][MQTT] subscribe failed', e);
      }
    })();

    return () => { if (unsub) unsub(); };
  }, [deviceUuid]);

  // 스트리밍 시작
  const startStreaming = async () => {
    if (!data.printerStatus.connected || !deviceUuid) {
      toast({
        title: t('camera.serverConnectionRequired'),
        variant: "destructive"
      });
      return;
    }

    setIsStreaming(true);
    setCameraStatus('starting');

    try {
      await mqttConnect();

      if (!streamUrl) {
        toast({
          title: t('camera.inputNotFound'),
          variant: "destructive"
        });
        setIsStreaming(false);
        setCameraStatus('error');
        return;
      }

      const RTSP_BASE = import.meta.env?.VITE_MEDIA_RTSP_BASE || 'rtsp://factor.io.kr:8554';
      const WEBRTC_BASE = import.meta.env?.VITE_MEDIA_WEBRTC_BASE || 'https://factor.io.kr/webrtc';

      const topic = `camera/${deviceUuid}/cmd`;
      const payload = {
        type: 'camera',
        action: 'start',
        options: {
          name: `cam-${deviceUuid}`,
          input: streamUrl,
          fps: 20,
          width: 1280,
          height: 720,
          bitrateKbps: 1800,
          encoder: 'libx264',
          forceMjpeg: true,
          lowLatency: true,
          rtsp_base: RTSP_BASE,
          webrtc_base: WEBRTC_BASE
        }
      };

      await mqttPublish(topic, payload, 1, false);

      toast({
        title: t('camera.startStreaming'),
        description: t('camera.streamPreparation')
      });
    } catch (e) {
      console.error('[CAM][MQTT] start error', e);
      toast({
        title: t('camera.startFailed'),
        variant: "destructive"
      });
      setCameraStatus('error');
      setIsStreaming(false);
    }
  };

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
        console.error('Error loading printer:', error);
        return;
      }

      // 기존 스냅샷에 병합만 수행(초기화 금지)
      // 스냅샷이 있을 경우, 서버의 상태값으로 덮어쓰지 않음 → 깜빡임 방지
      setData((prev) => {
        if (hasSnapshot) return prev;
        return {
          ...prev,
          printerStatus: {
            ...prev.printerStatus,
            state: (printer.status as any) ?? prev.printerStatus.state,
            timestamp: Date.now(),
            connected: (printer.status !== 'disconnected' && printer.status !== 'disconnect') ?? prev.printerStatus.connected,
            printing: (printer.status === 'printing') || prev.printProgress.active === true,
          },
        };
      });

      // 상세 페이지 실시간 반영을 위한 device_uuid 저장
      const device_uuid = (printer as any)?.device_uuid ?? null;
      setDeviceUuid(device_uuid);

      // 프린터 이름 설정 (name 우선, fallback은 model)
      setPrinterName(printer?.name || printer?.model || 'Printer');

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
        setStreamUrl((cam as any)?.stream_url ?? null);
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
        setStreamUrl((cam as any)?.stream_url ?? null);
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
              printerProfile: (conn as any).profile_name || ci.printerProfile,
            }));
          } catch {}
        }
        const bed = payload?.temperature_info?.bed;
        const toolAny = payload?.temperature_info?.tool;
        const tool = toolAny?.tool0 ?? toolAny;
        const flags = payload?.printer_status?.flags as any;
        const nextState = flags?.ready === true
          ? 'operational'
          : (payload?.printer_status?.state ?? prev.printerStatus.state);
        return {
          ...prev,
          printerStatus: {
            state: nextState as any,
            timestamp: Date.now(),
            connected: Boolean(flags && (flags.operational || flags.printing || flags.paused || flags.ready || flags.error)),
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
      const ce = e as CustomEvent<{ deviceSerial: string; result: any }>;
      const detail = ce?.detail;
      if (!detail || !deviceUuid || detail.deviceSerial !== deviceUuid) return;
      const res = detail.result || {};

      // SD 카드: 우선 sdcard 배열, fallback files 배열
      if (Array.isArray(res.sdcard)) {
        setSdFiles(
          res.sdcard.map((f: any) => ({
            name: String(f.name ?? f.display ?? ''),
            size: Number(f.size) || 0,
          }))
        );
      } else if (Array.isArray(res.files)) {
        setSdFiles(
          res.files.map((f: any) => ({
            name: String(f.name ?? f.display ?? ''),
            size: Number(f.size) || 0,
          }))
        );
      } else {
        setSdFiles([]);
      }

      // 로컬: local이 객체(키-값 딕셔너리)
      if (res.local && typeof res.local === 'object' && !Array.isArray(res.local)) {
        const entries = Object.entries(res.local);
        const parsed: LocalFile[] = entries.map(([key, val]: [string, any]) => {
          const v = val || {};
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
      const ce = e as CustomEvent<{ deviceSerial: string; result: any }>;
      const detail = ce?.detail;
      if (!detail || !deviceUuid || detail.deviceSerial !== deviceUuid) return;
      const result = detail.result || {};
      const action: string = result.action || 'control';
      const labelMap: Record<string, string> = {
        home: '홈 이동',
        pause: '일시 정지',
        resume: '재개',
        cancel: '완전 취소',
      };
      const label = labelMap[action] || '제어';
      if (result.ok) {
        toast({ title: `${label} 성공`, description: result.message ?? undefined });
      } else {
        toast({ title: `${label} 실패`, description: result.message ?? '오류가 발생했습니다.', variant: 'destructive' });
      }
    };
    window.addEventListener('control_result', onControlResult as EventListener);
    return () => window.removeEventListener('control_result', onControlResult as EventListener);
  }, [deviceUuid, toast]);

  // 상세 화면용 카드 컴포넌트들
  const PrinterStatusCard = () => {
    const completionPercent = Math.round((data.printProgress.completion || 0) * 100);
    const formatTime = (seconds: number): string => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return h > 0 ? `${h}${t('printerDetail.hours')} ${m}${t('printerDetail.minutes')} ${s}${t('printerDetail.seconds')}` : `${m}${t('printerDetail.minutes')} ${s}${t('printerDetail.seconds')}`;
    };

    // 상태 라벨 결정
    const flags: any = data.printerStatus?.flags || {};
    const status = data.printerStatus.state;
    let label = t('printerDetail.disconnected');
    if (flags?.error) label = t('printerDetail.error');
    else if (flags?.printing) label = t('printer.statusPrinting');
    else if (flags?.paused) label = t('printerDetail.paused');
    else if (flags?.ready || flags?.operational) label = t('printerDetail.idle');
    else if (status === 'connecting') label = t('printerDetail.connecting');

    // 상태별 뱃지 색상
    const getStatusBadgeClass = () => {
      if (flags?.error) return 'bg-warning/40 text-warning-foreground';
      if (flags?.printing) return 'bg-success text-success-foreground';
      if (flags?.paused) return 'bg-warning text-warning-foreground';
      if (flags?.ready || flags?.operational) return 'bg-success/40 text-success-foreground';
      if (status === 'connecting') return 'bg-primary text-primary-foreground';
      return 'bg-destructive/40 text-destructive-foreground'; // disconnected
    };

    const isConnected = Boolean(flags?.operational || flags?.printing || flags?.paused || flags?.ready || flags?.error);
    const printingStatus = flags?.printing ? t('printerDetail.inProgress') : (flags?.paused ? t('printerDetail.pausing') : t('printerDetail.stopped'));

    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="text-base font-medium">{t('printerDetail.printerStatus')}</div>
          <div className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusBadgeClass()}`}>
            {label}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Connection & Printing Status */}
          <div className="text-sm text-muted-foreground space-y-1">
            <div>{t('printerDetail.connection')}: {isConnected ? t('printerDetail.connected') : t('printerDetail.disconnected')}</div>
            <div>{t('printer.statusPrinting')}: {printingStatus}</div>
          </div>

          {/* Overall Progress */}
          <div className="pt-2 border-t space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('printerDetail.overallProgress')}</span>
              <span className="text-xl font-bold text-primary">{completionPercent}%</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          {/* Time Information */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">{t('printerDetail.elapsedTime')}</div>
              <div className="font-medium">{formatTime(data.printProgress.print_time || 0)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t('printerDetail.remainingTime')}</div>
              <div className="font-medium">{formatTime(data.printProgress.print_time_left || 0)}</div>
            </div>
          </div>

          {/* Temperature Monitoring */}
          <div className="pt-2 border-t space-y-2">
            <div className="text-sm font-medium">{t('printerDetail.temperatureMonitoring')}</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('printerDetail.extruder')}</span>
                <span className="font-mono">{(data.temperature.tool.actual || 0).toFixed(1)}°C / {(data.temperature.tool.target || 0).toFixed(1)}°C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('printerDetail.heatingBed')}</span>
                <span className="font-mono">{(data.temperature.bed.actual || 0).toFixed(1)}°C / {(data.temperature.bed.target || 0).toFixed(1)}°C</span>
              </div>
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
    <div className="bg-background min-h-screen">
      {/* 상단 헤더 - 고정 */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="h-9 w-9 p-0">
              <Link to="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-base font-bold">{printerName}</h1>
              <p className={`text-xs font-medium ${(() => {
                  const flags = data.printerStatus?.flags as any;
                  const state = data.printerStatus.state;

                  if (!data.printerStatus.connected && (state === 'disconnected' || state === 'disconnect')) {
                    return 'text-destructive';
                  }
                  if (flags?.printing || data.printerStatus.printing) {
                    return 'text-success';
                  }
                  if (flags?.paused) {
                    return 'text-warning';
                  }
                  if (flags?.error) {
                    return 'text-warning';
                  }
                  if (flags?.operational || flags?.ready || state === 'operational' || state === 'idle') {
                    return 'text-success';
                  }
                  if (state === 'connecting') {
                    return 'text-primary';
                  }
                  return 'text-destructive';
                })()}`}>
                {(() => {
                  const flags = data.printerStatus?.flags as any;
                  const state = data.printerStatus.state;

                  if (!data.printerStatus.connected && (state === 'disconnected' || state === 'disconnect')) {
                    return t('dashboard.status.disconnected');
                  }
                  if (flags?.printing || data.printerStatus.printing) {
                    return t('dashboard.status.printing');
                  }
                  if (flags?.paused) {
                    return t('dashboard.status.paused');
                  }
                  if (flags?.error) {
                    return t('dashboard.status.error');
                  }
                  if (flags?.operational || flags?.ready || state === 'operational' || state === 'idle') {
                    return t('dashboard.status.idle');
                  }
                  if (state === 'connecting') {
                    return t('dashboard.status.connecting');
                  }
                  return t('dashboard.status.disconnected');
                })()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t('printer.progress')}</p>
            <p className="text-base font-bold">
              <span className="text-primary">{Math.round((data.printProgress.completion || 0) * 100)}%</span>
              <span className="text-muted-foreground"> / 100%</span>
            </p>
          </div>
        </div>
      </div>

      {/* 카메라 피드 - 헤더 바로 아래, 패딩 없음 */}
      <div className="relative w-full aspect-video bg-black">
        {isStreaming && webrtcUrl ? (
          <>
            {/* WebRTC 스트림 */}
            <iframe
              ref={videoRef as any}
              src={`${webrtcUrl}?autoplay=1&muted=1`}
              className="w-full h-full"
              allow="autoplay; fullscreen"
              allowFullScreen
              title="webrtc-player"
            />
            {/* 영상 송출 버튼 (우측 상단) */}
            <div className="absolute top-3 right-3">
              <Button
                variant="secondary"
                size="sm"
                className="gap-1 bg-black/50 hover:bg-black/70 text-white border-0 h-8 px-3"
                disabled={!data.printerStatus.connected}
              >
                <span className="text-sm">📡 {t('camera.broadcast')}</span>
              </Button>
            </div>
            {/* 상태 뱃지 */}
            <div className="absolute top-3 left-3">
              <div className="px-2 py-1 rounded-md text-xs font-medium bg-red-500 text-white">
                {cameraStatus === 'online' ? 'LIVE' : cameraStatus.toUpperCase()}
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <div className="text-center px-4">
              <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">{t('camera.cameraStreaming')}</h3>
              <p className="text-sm text-gray-300 mb-4">
                {isStreaming && cameraStatus === 'starting'
                  ? t('camera.streamPreparation')
                  : t('camera.startStreamingDesc')}
              </p>
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90"
                onClick={startStreaming}
                disabled={!data.printerStatus.connected || isStreaming}
              >
                <span className="mr-2">▶</span>
                {isStreaming ? t('camera.streamPreparation') : t('camera.startStreaming')}
              </Button>
            </div>
          </div>
        )}

        {/* 연결 끊김 시 비활성화 오버레이 */}
        {!data.printerStatus.connected && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
            <div className="text-center text-white">
              <WifiOff className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">{t('camera.serverConnectionRequired')}</p>
            </div>
          </div>
        )}
      </div>

      {/* 메인 콘텐츠 - 스와이프 네비게이션 */}
      <div className="pb-20 relative">
        {/* 스와이프 컨테이너 */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            scrollSnapType: 'x mandatory',
            scrollBehavior: 'smooth'
          }}
          onScroll={(e) => {
            const container = e.currentTarget;
            const scrollLeft = container.scrollLeft;
            const cardWidth = container.offsetWidth;
            const index = Math.round(scrollLeft / cardWidth);
            setCurrentCardIndex(index);

            // 사용자가 스와이프하면 힌트 숨김
            if (showSwipeHint) {
              setShowSwipeHint(false);
            }
          }}
        >
          <div className="flex">
            {/* 1. 프린터 원격 제어 */}
            <div className="min-w-full snap-center p-4" style={{ scrollSnapAlign: 'center' }}>
              <div className="relative">
                <PrinterControlPad
                  isConnected={data.printerStatus.connected}
                  isPrinting={data.printerStatus.printing}
                  deviceUuid={deviceUuid}
                  printerState={data.printerStatus.state}
                  flags={data.printerStatus.flags}
                />
                {!data.printerStatus.connected && (
                  <div className="absolute inset-0 rounded-lg bg-muted/90 text-muted-foreground flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-sm font-medium">{t('printerDetail.noConnection')}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. G-code 파일 관리 */}
            <div className="min-w-full snap-center p-4" style={{ scrollSnapAlign: 'center' }}>
              <GCodeUpload deviceUuid={deviceUuid} />
            </div>

            {/* 3. 프린터 스테이터스 */}
            <div className="min-w-full snap-center p-4" style={{ scrollSnapAlign: 'center' }}>
              <PrinterStatusCard />
            </div>
          </div>
        </div>

        {/* 스와이프 힌트 화살표 (1~2초 점멸 후 사라짐) */}
        {showSwipeHint && currentCardIndex === 0 && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none animate-pulse">
            <div className="flex items-center gap-2 bg-primary/90 text-primary-foreground px-3 py-2 rounded-full shadow-lg">
              <span className="text-sm font-medium">{t('printerDetail.swipeHint')}</span>
              <ChevronRight className="h-5 w-5" />
            </div>
          </div>
        )}

        {/* 인디케이터 */}
        <div className="flex justify-center gap-2 mt-4">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all ${
                index === currentCardIndex
                  ? 'w-8 bg-primary'
                  : 'w-2 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PrinterDetail;