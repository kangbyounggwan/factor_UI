import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Wifi, WifiOff, Camera, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PrinterControlPad } from "@/components/PrinterControlPad";
import { GCodeUpload } from "@/components/GCodeUpload";
import { WebSocketStatus } from "@/components/WebSocketStatus";
import { useAuth } from "@shared/contexts/AuthContext";
import { supabase } from "@shared/integrations/supabase/client"
import { onDashStatusMessage, publishCameraStart, subscribeCameraState } from "@shared/services/mqttService";
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
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }, [key, state]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setState(JSON.parse(e.newValue) as T);
        } catch (error) {
          console.warn('Failed to parse storage event:', error);
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


const PrinterDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const location = useLocation();
  const storageKey = `printer:detail:${id ?? 'unknown'}`;
  const hasSnapshot = typeof window !== 'undefined' ? !!localStorage.getItem(storageKey) : false;
  const [data, setData] = usePersistentState<MonitoringData>(storageKey, defaultData);
  const [loading, setLoading] = useState(!hasSnapshot);
  const { user } = useAuth();
  const { toast } = useToast();

  // MQTT WebSocket 연결 상태는 사용하지 않음 - 프린터의 connected 상태만 사용
  const [deviceUuid, setDeviceUuid] = useState<string | null>(null);

  // 프린터 연결 상태 (대시보드에서 전달받거나 MQTT로 업데이트됨)
  const printerConnected = data.printerStatus.connected;

  // 디버깅: 연결 상태 로그
  useEffect(() => {
    console.log('[PrinterDetail] 연결 상태 디버깅:', {
      printerConnected,
      status: data.printerStatus.state,
      connected: data.printerStatus.connected,
      printing: data.printerStatus.printing,
      deviceUuid,
      timestamp: new Date().toISOString()
    });
  }, [printerConnected, data.printerStatus.state, data.printerStatus.connected, data.printerStatus.printing, deviceUuid]);
  const [printerName, setPrinterName] = useState<string>('Printer');
  const [streamUrl, setStreamUrl] = usePersistentState<string | null>(
    `printer:stream:${id ?? 'unknown'}`,
    null
  );
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [webrtcUrl, setWebrtcUrl] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'offline' | 'starting' | 'online' | 'error'>('offline');
  const videoRef = useRef<HTMLIFrameElement>(null);
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

  // 대시보드에서 전달받은 프린터 상태로 초기화 (지연 없는 즉시 반영)
  useEffect(() => {
    const routePrinter = (location.state as { printer?: Record<string, unknown> })?.printer;
    console.log('[PrinterDetail] location.state에서 받은 프린터 정보:', routePrinter);

    if (!routePrinter) {
      console.log('[PrinterDetail] location.state에 프린터 정보 없음');
      return;
    }

    console.log('[PrinterDetail] 대시보드에서 받은 연결 상태:', {
      connected: routePrinter.connected,
      state: routePrinter.state,
      printing: routePrinter.printing
    });

    // 타입 캐스팅을 위한 타입 정의
    type PrinterData = {
      state?: string;
      connected?: boolean;
      printing?: boolean;
      temperature?: {
        tool_actual?: number;
        tool_target?: number;
        bed_actual?: number;
        bed_target?: number;
      };
      completion?: number;
      print_time_left?: number;
      device_uuid?: string;
      name?: string;
      model?: string;
    };
    const printer = routePrinter as PrinterData;

    // 대시보드에서 받은 상태로 즉시 초기화
    setData((prev) => ({
      ...prev,
      printerStatus: {
        ...prev.printerStatus,
        state: (printer.state as MonitoringData['printerStatus']['state']) || prev.printerStatus.state,
        connected: printer.connected ?? prev.printerStatus.connected,
        printing: printer.printing ?? prev.printerStatus.printing,
        timestamp: Date.now(),
      },
      temperature: {
        tool: {
          actual: printer.temperature?.tool_actual ?? prev.temperature.tool.actual,
          target: printer.temperature?.tool_target ?? prev.temperature.tool.target,
        },
        bed: {
          actual: printer.temperature?.bed_actual ?? prev.temperature.bed.actual,
          target: printer.temperature?.bed_target ?? prev.temperature.bed.target,
        },
      },
      printProgress: {
        ...prev.printProgress,
        completion: printer.completion ?? prev.printProgress.completion,
        print_time_left: printer.print_time_left ?? prev.printProgress.print_time_left,
      },
    }));

    // device_uuid 설정
    if (printer.device_uuid && typeof printer.device_uuid === 'string') {
      setDeviceUuid(printer.device_uuid);
    }

    // 프린터 이름 설정
    if (typeof printer.name === 'string' || typeof printer.model === 'string') {
      setPrinterName(String(printer.name || printer.model || ''));
    }
  }, [location.state]);

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

  // 스와이프 핸들러 - 최소 50px 이동해야 페이지 전환
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50; // 최소 스와이프 거리 (픽셀)

    if (Math.abs(swipeDistance) < minSwipeDistance) {
      // 스와이프 거리가 부족하면 원래 위치로 복귀
      scrollToCard(currentCardIndex);
      return;
    }

    if (swipeDistance > 0) {
      // 왼쪽으로 스와이프 (다음 페이지)
      if (currentCardIndex < 2) {
        const newIndex = currentCardIndex + 1;
        setCurrentCardIndex(newIndex);
        scrollToCard(newIndex);
        if (showSwipeHint) {
          setShowSwipeHint(false);
        }
      } else {
        scrollToCard(currentCardIndex);
      }
    } else {
      // 오른쪽으로 스와이프 (이전 페이지)
      if (currentCardIndex > 0) {
        const newIndex = currentCardIndex - 1;
        setCurrentCardIndex(newIndex);
        scrollToCard(newIndex);
      } else {
        scrollToCard(currentCardIndex);
      }
    }
  };

  const scrollToCard = (index: number) => {
    if (scrollContainerRef.current) {
      const cardWidth = scrollContainerRef.current.offsetWidth;
      scrollContainerRef.current.scrollTo({
        left: cardWidth * index,
        behavior: 'smooth'
      });
    }
  };

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
        unsub = await subscribeCameraState(deviceUuid, ({ running, webrtcUrl, status }) => {
          setCameraStatus(status);
          if (webrtcUrl) setWebrtcUrl(webrtcUrl);
        });
      } catch (e) {
        console.warn('[CAM][MQTT] subscribe failed', e);
      }
    })();

    return () => { if (unsub) unsub(); };
  }, [deviceUuid]);

  // 스트리밍 시작
  const startStreaming = async () => {
    if (!printerConnected || !deviceUuid) {
      toast({
        title: t('camera.serverConnectionRequired'),
        variant: "destructive"
      });
      return;
    }

    setIsStreaming(true);
    setCameraStatus('starting');

    try {
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

      // shared 함수 사용
      await publishCameraStart({
        deviceUuid,
        streamUrl,
        fps: 20,
        width: 1280,
        height: 720,
        bitrateKbps: 1800,
        encoder: 'libx264',
        forceMjpeg: true,
        lowLatency: true,
        rtspBase: RTSP_BASE,
        webrtcBase: WEBRTC_BASE
      });

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
        console.log('[PrinterDetail] Supabase에서 로드한 프린터 상태:', {
          hasSnapshot,
          status: printer?.status,
          prevConnected: prev.printerStatus.connected,
          prevState: prev.printerStatus.state
        });

        if (hasSnapshot) {
          console.log('[PrinterDetail] localStorage 스냅샷 사용 - 서버 데이터 무시');
          return prev;
        }

        const printerData = printer as Record<string, unknown>;
        const newConnected = printerData.status !== 'disconnected' && printerData.status !== 'disconnect';
        console.log('[PrinterDetail] 새 연결 상태 계산:', { status: printerData.status, connected: newConnected });

        return {
          ...prev,
          printerStatus: {
            ...prev.printerStatus,
            state: (printerData.status as MonitoringData['printerStatus']['state']) ?? prev.printerStatus.state,
            timestamp: Date.now(),
            connected: newConnected,
            printing: (printerData.status === 'printing') || prev.printProgress.active === true,
          },
        };
      });

      // 상세 페이지 실시간 반영을 위한 device_uuid 저장
      const printerData = printer as { device_uuid?: string; name?: string; model?: string };
      const device_uuid = printerData.device_uuid ?? null;
      setDeviceUuid(device_uuid);

      // 프린터 이름 설정 (name 우선, fallback은 model)
      setPrinterName(printerData.name || printerData.model || 'Printer');

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
        const camData = cam as { stream_url?: string | null };
        setStreamUrl(camData?.stream_url ?? null);
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
        const camData = cam as { stream_url?: string | null };
        setStreamUrl(camData?.stream_url ?? null);
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
            const connData = conn as { port?: string; baudrate?: number; profile_name?: string };
            setConnectionInfo((ci) => ({
              ...ci,
              serialPort: connData.port || ci.serialPort,
              baudrate: String(connData.baudrate ?? ci.baudrate),
              // 요청사항: Printer Profile은 connection[3].name을 사용 (매핑: connection.profile_name)
              printerProfile: connData.profile_name || ci.printerProfile,
            }));
          } catch (error) {
            console.warn('Failed to update connection info:', error);
          }
        }
        const bed = payload?.temperature_info?.bed;
        const toolAny = payload?.temperature_info?.tool;
        const tool = toolAny?.tool0 ?? toolAny;
        const flags = (payload?.printer_status?.flags ?? {}) as Record<string, unknown>;
        const nextState = flags?.ready === true
          ? 'operational'
          : (payload?.printer_status?.state ?? prev.printerStatus.state);
        return {
          ...prev,
          printerStatus: {
            state: nextState as MonitoringData['printerStatus']['state'],
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
      const ce = e as CustomEvent<{ deviceSerial: string; result: Record<string, unknown> }>;
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
          const v = (val as Record<string, unknown>) || {};
          return {
            name: String(v.name ?? key),
            display: v.display ? String(v.display) : undefined,
            size: v.size != null ? Number(v.size) : undefined,
            date: (v.date as string | null) ?? null,
            hash: v.hash as string | undefined,
            user: v.user as string | undefined,
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
      const ce = e as CustomEvent<{ deviceSerial: string; result: Record<string, unknown> }>;
      const detail = ce?.detail;
      if (!detail || !deviceUuid || detail.deviceSerial !== deviceUuid) return;
      const result = detail.result || {};
      const action: string = (result.action as string) || 'control';
      const labelMap: Record<string, string> = {
        home: '홈 이동',
        pause: '일시 정지',
        resume: '재개',
        cancel: '완전 취소',
      };
      const label = labelMap[action] || '제어';
      if (result.ok) {
        toast({ title: `${label} 성공`, description: result.message ? String(result.message) : undefined });
      } else {
        toast({ title: `${label} 실패`, description: result.message ? String(result.message) : '오류가 발생했습니다.', variant: 'destructive' });
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

    // 상태 라벨 결정 (MQTT 연결 상태 우선 체크)
    const flags = (data.printerStatus?.flags || {}) as Record<string, unknown>;
    const status = data.printerStatus.state;
    let label = t('printerDetail.disconnected');

    // MQTT 연결이 끊긴 경우 무조건 "연결 없음"
    if (!data.printerStatus.connected && (status === 'disconnected' || status === 'disconnect')) {
      label = t('printerDetail.disconnected');
    }
    // MQTT 연결이 있는 경우에만 flags 기반으로 상태 결정
    else if (flags?.error) label = t('printerDetail.error');
    else if (flags?.printing) label = t('printer.statusPrinting');
    else if (flags?.paused) label = t('printerDetail.paused');
    else if (flags?.ready || flags?.operational) label = t('printerDetail.idle');
    else if (status === 'connecting') label = t('printerDetail.connecting');

    // 상태별 뱃지 색상 (MQTT 연결 상태 우선 체크)
    const getStatusBadgeClass = () => {
      // MQTT 연결이 끊긴 경우 무조건 연결 없음 표시
      if (!data.printerStatus.connected && (status === 'disconnected' || status === 'disconnect')) {
        return 'bg-destructive/40 text-destructive-foreground';
      }
      // MQTT 연결이 있는 경우에만 flags 기반으로 색상 결정
      if (flags?.error) return 'bg-warning/40 text-warning-foreground';
      if (flags?.printing) return 'bg-success text-success-foreground';
      if (flags?.paused) return 'bg-warning text-warning-foreground';
      if (flags?.ready || flags?.operational) return 'bg-success/40 text-success-foreground';
      if (status === 'connecting') return 'bg-primary text-primary-foreground';
      return 'bg-destructive/40 text-destructive-foreground'; // disconnected
    };

    // MQTT 연결 상태를 직접 사용 (flags 대신)
    const isConnected = data.printerStatus.connected;
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
      <div className="sticky top-0 z-10 bg-background border-b safe-area-top">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="h-9 w-9 p-0">
              <Link to="/dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-base font-bold">{printerName}</h1>
              <p className={`text-xs font-medium ${(() => {
                  const flags = (data.printerStatus?.flags || {}) as Record<string, unknown>;
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
                  const flags = (data.printerStatus?.flags || {}) as Record<string, unknown>;
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
              ref={videoRef}
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
              <div className={`px-2 py-1 rounded-md text-xs font-medium ${
                !printerConnected
                  ? 'bg-destructive text-white'
                  : cameraStatus === 'online'
                    ? 'bg-red-500 text-white'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {!printerConnected
                  ? t('printerDetail.disconnected')
                  : cameraStatus === 'online'
                    ? 'LIVE'
                    : cameraStatus.toUpperCase()}
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            {/* 상태 뱃지 (스트리밍 전에도 표시) */}
            <div className="absolute top-3 left-3">
              <div className={`px-2 py-1 rounded-md text-xs font-medium ${
                !printerConnected
                  ? 'bg-destructive text-white'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {!printerConnected
                  ? t('printerDetail.disconnected')
                  : t('camera.cameraDisconnected')}
              </div>
            </div>
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
                disabled={!printerConnected || isStreaming}
              >
                <span className="mr-2">▶</span>
                {isStreaming ? t('camera.streamPreparation') : t('camera.startStreaming')}
              </Button>
            </div>
          </div>
        )}

        {/* 연결 끊김 시 비활성화 오버레이 */}
        {!printerConnected && (() => {
          console.log('[PrinterDetail] 카메라 피드 오버레이 표시:', { printerConnected, status: data.printerStatus.state });
          return (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
              <div className="text-center text-white">
                <WifiOff className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">{t('camera.serverConnectionRequired')}</p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 메인 콘텐츠 - 스와이프 네비게이션 */}
      <div className="pb-20 relative">
        {/* 스와이프 컨테이너 */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-hidden snap-x snap-mandatory scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            scrollSnapType: 'x mandatory',
            scrollBehavior: 'smooth'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex">
            {/* 1. 프린터 원격 제어 */}
            <div className="min-w-full snap-center p-4" style={{ scrollSnapAlign: 'center' }}>
              <div className="relative">
                <PrinterControlPad
                  isConnected={printerConnected}
                  isPrinting={data.printerStatus.printing}
                  deviceUuid={deviceUuid}
                  printerState={data.printerStatus.state}
                  flags={data.printerStatus.flags}
                />
                {!printerConnected && (() => {
                  console.log('[PrinterDetail] 프린터 원격 제어 오버레이 표시:', { printerConnected, status: data.printerStatus.state });
                  return (
                    <div className="absolute inset-0 rounded-lg bg-muted/90 text-muted-foreground flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <div className="text-sm font-medium">{t('printerDetail.noConnection')}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* 2. G-code 파일 관리 */}
            <div className="min-w-full snap-center p-4" style={{ scrollSnapAlign: 'center' }}>
              <div className="relative">
                <GCodeUpload deviceUuid={deviceUuid} isConnected={printerConnected} />
                {!printerConnected && (
                  <div className="absolute inset-0 rounded-lg bg-muted/90 text-muted-foreground flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-sm font-medium">{t('printerDetail.noConnection')}</div>
                    </div>
                  </div>
                )}
              </div>
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