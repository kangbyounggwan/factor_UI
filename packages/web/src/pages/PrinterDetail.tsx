import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
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
  const { id } = useParams();
  const storageKey = `printer:detail:${id ?? 'unknown'}`;
  const hasSnapshot = typeof window !== 'undefined' ? !!localStorage.getItem(storageKey) : false;
  const [data, setData] = usePersistentState<MonitoringData>(storageKey, defaultData);
  const [iotDevices, setIoTDevices] = useState<PrinterIoTDevice[]>(defaultIoTDevices);
  const [loading, setLoading] = useState(!hasSnapshot);
  const { user } = useAuth();
  const { toast } = useToast();
  const [deviceUuid, setDeviceUuid] = useState<string | null>(null);
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
        title: "연결 성공",
        description: `프린터가 ${connectionInfo.serialPort}에 연결되었습니다.`,
      });
    } catch (error) {
      toast({
        title: "연결 실패",
        description: "프린터 연결에 실패했습니다. 설정을 확인해주세요.",
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
        title: "연결 해제",
        description: "프린터 연결이 해제되었습니다.",
      });
    } catch (error) {
      toast({
        title: "연결 해제 실패",
        description: "프린터 연결 해제에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const refreshPorts = async () => {
    try {
      // TODO: 실제 시리얼 포트 스캔 API 호출
      await new Promise(resolve => setTimeout(resolve, 1000)); // 시뮬레이션
      toast({
        title: "포트 새로고침",
        description: "사용 가능한 포트를 다시 스캔했습니다.",
      });
    } catch (error) {
      toast({
        title: "포트 스캔 실패",
        description: "포트 스캔에 실패했습니다.",
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
      setDeviceUuid((printer as any)?.device_uuid ?? null);

    } catch (error) {
      console.error('Error loading printer data:', error);
    } finally {
      if (showSpinner ?? !hasSnapshot) setLoading(false);
    }
  };

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
            connected: payload?.connected ?? prev.printerStatus.connected,
            printing: payload?.printer_status?.printing ?? prev.printerStatus.printing,
            error_message: payload?.printer_status?.error_message ?? prev.printerStatus.error_message,
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
  const PrintProgressCard = () => {
    const completionPercent = Math.round((data.printProgress.completion || 0) * 100);
    const formatTime = (seconds: number): string => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return h > 0 ? `${h}시간 ${m}분 ${s}초` : `${m}분 ${s}초`;
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

    let stateLabel = '연결없음';
    let stateClass = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80';

    if (isPrinting) {
      stateLabel = '출력중';
      stateClass = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-success text-success-foreground hover:bg-success/80';
    } else if (isOperational) {
      stateLabel = '대기중';
      stateClass = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80';
    }
    return (
      <div className="h-full rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="text-sm font-medium">프린트 진행상황</div>
          <span className={stateClass}>{stateLabel}</span>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">전체 진행률</span>
              <span className="text-2xl font-bold text-primary">{completionPercent}%</span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full">
              <div className="h-3 bg-primary rounded-full" style={{ width: `${completionPercent}%` }} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">파일 진행률</span>
              <span className="text-sm text-muted-foreground">{formatFileSize(data.printProgress.file_position)} / {formatFileSize(data.printProgress.file_size)}</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full">
              <div className="h-2 bg-primary rounded-full" style={{ width: `${fileProgress}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><div className="text-muted-foreground">경과 시간</div><div className="font-medium">{formatTime(data.printProgress.print_time || 0)}</div></div>
            <div><div className="text-muted-foreground">남은 시간</div><div className="font-medium">{formatTime(data.printProgress.print_time_left || 0)}</div></div>
          </div>
          <div className="pt-2 border-t">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">사용된 필라멘트</span>
              <span className="font-medium">{((data.printProgress.filament_used || 0) / 1000).toFixed(2)}m</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const PrinterStatusCard = () => {
    const map: any = {
      idle: { label: '대기' },
      printing: { label: '프린팅' },
      paused: { label: '일시정지' },
      error: { label: '오류' },
      connecting: { label: '연결중' },
      disconnected: { label: '연결끊김' },
    };
    const status = data.printerStatus.state as keyof typeof map;
    const label = map[status]?.label || '알수없음';
    return (
      <div className="h-full rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-6 border-b"><div className="text-sm font-medium">프린터 상태</div></div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="inline-flex items-center px-2 py-1 text-xs rounded-md bg-muted">{label}</div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>연결: {data.printerStatus.connected ? '연결됨' : '연결끊김'}</div>
              <div>프린팅: {data.printerStatus.printing ? '진행중' : '중지'}</div>
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t">
            <div className="text-xs font-medium mb-2">온도 모니터링</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">익스트루더</span><span className="font-mono">{(data.temperature.tool.actual || 0).toFixed(1)}°C / {(data.temperature.tool.target || 0).toFixed(1)}°C</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">히팅베드</span><span className="font-mono">{(data.temperature.bed.actual || 0).toFixed(1)}°C / {(data.temperature.bed.target || 0).toFixed(1)}°C</span></div>
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
              <div className="text-sm font-medium">Connection</div>
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
            <Label htmlFor="serial-port" className="text-sm font-medium">Serial Port</Label>
            <Select
              value={connectionInfo.serialPort}
              onValueChange={(value) => setConnectionInfo(prev => ({ ...prev, serialPort: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="포트를 선택하세요" />
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
            <Label htmlFor="baudrate" className="text-sm font-medium">Baudrate</Label>
            <Select
              value={connectionInfo.baudrate}
              onValueChange={(value) => setConnectionInfo(prev => ({ ...prev, baudrate: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="보드레이트를 선택하세요" />
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
            <Label htmlFor="printer-profile" className="text-sm font-medium">Printer Profile</Label>
            <Select
              value={connectionInfo.printerProfile}
              onValueChange={(value) => setConnectionInfo(prev => ({ ...prev, printerProfile: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="프로필을 선택하세요" />
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
              <Label htmlFor="save-settings" className="text-sm">Save connection settings</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="auto-connect"
                checked={connectionInfo.autoConnect}
                onCheckedChange={(checked) => setConnectionInfo(prev => ({ ...prev, autoConnect: !!checked }))}
              />
              <Label htmlFor="auto-connect" className="text-sm">Auto-connect on server startup</Label>
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
                Disconnect
              </Button>
            ) : (
              <Button
                onClick={handleConnect}
                className="w-full"
                disabled={isConnecting}
              >
                {isConnecting ? "Connecting..." : "Connect"}
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
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              전체 현황으로 돌아가기
            </Link>
          </Button>
        </div>


        <div className="grid grid-cols-1 gap-6">
          {/* 카메라 피드와 컨트롤 패드 */}
          <div className="grid grid-cols-10 gap-6 mb-6">
            <div className="col-span-7">
              <div className="h-[600px]">
                <CameraFeed
                  cameraId="CAM-001"
                  isConnected={true}
                  resolution="1920x1080"
                />
              </div>
            </div>
            <div className="col-span-3">
              <div className="h-[600px]">
                <PrinterControlPad
                  isConnected={data.printerStatus.connected}
                  isPrinting={data.printerStatus.printing}
                  deviceUuid={deviceUuid}
                />
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
              <div className="h-[400px] space-y-3 overflow-y-auto">
                <GCodeUpload deviceUuid={deviceUuid} />
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