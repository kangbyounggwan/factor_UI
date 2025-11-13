import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PrinterStatusBadge } from "@/components/PrinterStatusBadge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Monitor, LogIn, Plus, Thermometer, ChevronDown, ChevronUp, Layers, Settings as SettingsIcon, Bell, Loader2, Play } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { onDashStatusMessage, mqttPublish, publishCameraStart, subscribeCameraState } from "@shared/services/mqttService";
import { getUserPrinterGroups, getUserPrintersWithGroup } from "@shared/services/supabaseService/printerList";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { supabase } from "@shared/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { computeDashboardSummary, publishDashboardSummary, useDashboardSummary } from "@shared/component/dashboardSummary";

// 로컬 스냅샷 퍼시스턴스 훅
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

// 프린터 그룹 타입
interface PrinterGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at: string;
  updated_at: string;
}

interface PrinterOverview {
  id: string;
  name: string; // 프린터 이름 (사용자 지정)
  model: string; // 제조사 모델명
  group_id?: string;
  group?: PrinterGroup;
  state: "idle" | "printing" | "paused" | "error" | "connecting" | "disconnected";
  connected: boolean;
  printing: boolean;
  pending?: boolean; // MQTT 최초 수신 대기 중
  completion?: number;
  temperature: {
    tool_actual: number;
    tool_target: number;
    bed_actual: number;
    bed_target: number;
  };
  print_time_left?: number;
  current_file?: string;
  device_uuid?: string;
  manufacture_id?: string; // 제조사 정보 ID
  stream_url?: string | null; // 카메라 스트림 URL
  stream_start_time?: number | null; // 스트리밍 시작 시간 (15분 타임아웃용)
}

// MQTT 상태 캐시 타입 (device_uuid별 최신 상태만 저장)
interface MqttStateCache {
  [deviceUuid: string]: {
    state: PrinterOverview['state'];
    connected: boolean;
    printing: boolean;
    pending: boolean;
    completion?: number;
    temperature: {
      tool_actual: number;
      tool_target: number;
      bed_actual: number;
      bed_target: number;
    };
    print_time_left?: number;
    current_file?: string;
    last_updated: number; // 타임스탬프
  };
}


const PrinterCard = ({ printer, isAuthenticated, onSetupRequired, onStreamStart }: {
  printer: PrinterOverview;
  isAuthenticated: boolean;
  onSetupRequired?: (printerId: string) => void;
  onStreamStart?: (printerId: string, streamUrl: string, startTime: number) => void;
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const percent = printer.completion ? Math.round(printer.completion * 100) : 0;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);
  const streamingAttemptedRef = useRef(false);

  const STREAM_TIMEOUT = 15 * 60 * 1000; // 15분

  const goDetail = () => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    // manufacture_id가 없으면 설정 유도
    if (!printer.manufacture_id && onSetupRequired) {
      onSetupRequired(printer.id);
      return;
    }

    // 프린터 상태를 state로 전달
    navigate(`/printer/${printer.id}`, { state: { printer } });
  };

  // 시간 포맷 함수
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}${t('dashboard.time.hours')} ${minutes}${t('dashboard.time.minutes')}`;
    return `${minutes}${t('dashboard.time.minutes')}`;
  };

  // 카메라 스트림 URL - MQTT를 통해 스트리밍 시작
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [webrtcUrl, setWebrtcUrl] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'offline' | 'starting' | 'online' | 'error'>('offline');

  // MQTT 카메라 상태 구독
  useEffect(() => {
    if (!printer.device_uuid) {
      setStreamUrl(null);
      setWebrtcUrl(null);
      setCameraStatus('offline');
      return;
    }

    let unsub: (() => Promise<void>) | null = null;

    (async () => {
      try {
        // 카메라 상태 구독만 수행 (자동 시작하지 않음)
        unsub = await subscribeCameraState(printer.device_uuid!, ({ running, webrtcUrl, status }) => {
          setCameraStatus(status);
          if (webrtcUrl) {
            setWebrtcUrl(webrtcUrl);
            setStreamUrl(webrtcUrl);
          }
        });
      } catch (error) {
        console.error('[Dashboard] 카메라 구독 실패:', error);
      }
    })();

    return () => {
      if (unsub) unsub().catch(console.error);
    };
  }, [printer.device_uuid]);

  // 카메라 스트리밍 시작 핸들러
  const handleStreamStart = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지

    if (!printer.device_uuid) {
      toast({
        title: t('camera.error'),
        description: t('camera.deviceNotFound'),
        variant: "destructive"
      });
      return;
    }

    if (!printer.connected) {
      toast({
        title: t('camera.error'),
        description: t('camera.serverConnectionRequired'),
        variant: "destructive"
      });
      return;
    }

    try {
      setCameraStatus('starting');
      await publishCameraStart(printer.device_uuid, 'webrtc');
      toast({
        title: t('camera.streamStarting'),
        description: t('camera.streamStartingDesc'),
      });
    } catch (error) {
      console.error('[Dashboard] 카메라 시작 실패:', error);
      setCameraStatus('error');
      toast({
        title: t('camera.error'),
        description: t('camera.streamStartFailed'),
        variant: "destructive"
      });
    }
  };

  // 비디오 스트림 연결
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !streamUrl) {
      return;
    }

    // HLS 스트림인 경우
    if (streamUrl.includes('.m3u8')) {
      // HLS.js를 사용하여 스트림 연결
      import('hls.js').then((module) => {
        const Hls = module.default;

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
          });

          hls.loadSource(streamUrl);
          hls.attachMedia(videoElement);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoElement.play().catch((error) => {
              console.warn('Video autoplay failed:', error);
            });
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS error:', data);
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.error('Network error, trying to recover...');
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.error('Media error, trying to recover...');
                  hls.recoverMediaError();
                  break;
                default:
                  console.error('Fatal error, cannot recover');
                  hls.destroy();
                  break;
              }
            }
          });

          return () => {
            hls.destroy();
          };
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS support
          videoElement.src = streamUrl;
          videoElement.play().catch((error) => {
            console.warn('Video autoplay failed:', error);
          });
        }
      }).catch((error) => {
        console.error('Failed to load HLS.js:', error);
      });
    } else {
      // MJPEG 또는 일반 비디오 스트림
      videoElement.src = streamUrl;
      videoElement.play().catch((error) => {
        console.warn('Video autoplay failed:', error);
      });
    }

    return () => {
      if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
      }
    };
  }, [streamUrl]);

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer"
      onClick={goDetail}
    >
      {/* 상단: 카메라 피드 (메인 비주얼) */}
      <div className="relative bg-black aspect-video">
        {printer.connected && streamUrl ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            {/* 상태 오버레이 */}
            <div className="absolute top-3 left-3 flex gap-2">
              <Badge variant="destructive" className="animate-pulse shadow-lg">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  LIVE
                </div>
              </Badge>
              {printer.group && (
                <Badge className="shadow-lg" style={{ backgroundColor: printer.group.color }}>
                  {printer.group.name}
                </Badge>
              )}
            </div>
            {/* 연결 상태 표시 */}
            <div className="absolute top-3 right-3">
              <div className={`h-3 w-3 rounded-full ${printer.connected ? 'bg-success' : 'bg-destructive'} shadow-lg ring-2 ring-white`} />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted/50 to-muted">
            <div className="text-center px-4">
              <Monitor className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium mb-4 text-muted-foreground/80">
                {printer.connected ? t('camera.streamPreparation') : t('printerDetail.disconnected')}
              </p>
              {printer.connected && (
                <Button
                  size="sm"
                  onClick={handleStreamStart}
                  disabled={cameraStatus === 'starting'}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                >
                  {cameraStatus === 'starting' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('camera.starting')}
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      {t('camera.startStream')}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 프린터 정보 섹션 */}
      <div className="p-4 space-y-3">
        {/* 헤더: 이름과 상태 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold truncate">{printer.name}</h3>
            {printer.model && <p className="text-xs text-muted-foreground truncate">{printer.model}</p>}
          </div>
          <PrinterStatusBadge status={printer.state} />
        </div>
        {printer.printing && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-success font-medium">
              {printer.print_time_left ? `${formatTime(printer.print_time_left)} ${t('dashboard.printer.remainingTime').replace(':', '')}` : t('dashboard.status.printing')}
            </span>
          </div>
        )}

        {/* 진행률 바 - 큰 스타일 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">{t('printer.progress')}</span>
            <span className="text-2xl font-bold text-primary">{percent}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                percent === 100 ? 'bg-success' : 'bg-primary'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          {printer.printing && printer.current_file && (
            <p className="text-xs text-muted-foreground mt-2 truncate">
              📁 {printer.current_file}
            </p>
          )}
        </div>

        {/* 온도 정보 - 아코디언 버튼 포함 */}
        {(printer.connected || printer.state !== 'disconnected') && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-4 text-sm flex-1">
              <div className="flex items-center gap-1">
                <Thermometer className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {printer.state === 'disconnected' ? '-' : `${printer.temperature.tool_actual?.toFixed(0) || 0}°C`}
                </span>
                {printer.state !== 'disconnected' && printer.temperature.tool_target > 0 && (
                  <span className="text-muted-foreground text-xs">/ {printer.temperature.tool_target.toFixed(0)}°C</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-xs">{t('printer.bed')}:</span>
                <span className="font-medium">
                  {printer.state === 'disconnected' ? '-' : `${printer.temperature.bed_actual?.toFixed(0) || 0}°C`}
                </span>
                {printer.state !== 'disconnected' && printer.temperature.bed_target > 0 && (
                  <span className="text-muted-foreground text-xs">/ {printer.temperature.bed_target.toFixed(0)}°C</span>
                )}
              </div>
            </div>
            <Button
              onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {/* 펼쳤을 때 추가 상세 정보 */}
        {open && (
          <div className="pt-3 border-t space-y-2 text-sm animate-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('printerDetail.connection')}</p>
                <p className={`font-medium ${printer.connected ? 'text-success' : 'text-destructive'}`}>
                  {printer.connected ? t('printerDetail.connected') : t('printerDetail.disconnected')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('dashboard.status.printing')}</p>
                <p className={`font-medium ${printer.printing ? 'text-primary' : 'text-muted-foreground'}`}>
                  {printer.printing ? t('printerDetail.inProgress') : t('printerDetail.idle')}
                </p>
              </div>
            </div>
            {printer.device_uuid && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">UUID</p>
                <p className="font-mono text-xs truncate">{printer.device_uuid}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

const Home = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [printers, setPrinters] = useState<PrinterOverview[]>([]); // localStorage 제거
  const [mqttStates, setMqttStates] = usePersistentState<MqttStateCache>('mobile:dashboard:mqtt_states', {}); // MQTT 상태만 저장
  const [groups, setGroups] = useState<PrinterGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // 설정 유도 모달 상태
  const [showSetupPrompt, setShowSetupPrompt] = useState(false);
  const [printerToSetup, setPrinterToSetup] = useState<string | null>(null);

  // 설정 유도 핸들러
  const handleSetupRequired = (printerId: string) => {
    setPrinterToSetup(printerId);
    setShowSetupPrompt(true);
  };

  // 설정 페이지로 이동
  const handleGoToSettings = () => {
    setShowSetupPrompt(false);
    // printerToSetup을 쿼리 파라미터로 전달
    navigate(`/settings?editPrinter=${printerToSetup}`);
  };

  // 다음에 하기 - 프린터 디테일로 이동
  const handleSkipSetup = () => {
    console.log('[Dashboard] "다음에 할게요" 클릭 - 모달 닫기 전:', {
      scrollY: window.scrollY,
      scrollX: window.scrollX,
      bodyOverflow: document.body.style.overflow,
      printerToSetup,
      timestamp: new Date().toISOString()
    });

    setShowSetupPrompt(false);

    // 스크롤을 즉시 최상단으로 이동
    window.scrollTo(0, 0);

    console.log('[Dashboard] 스크롤 초기화 직후 (current 위치):', {
      current_scrollY: window.scrollY,
      current_scrollX: window.scrollX,
      success: window.scrollY === 0 && window.scrollX === 0,
      timestamp: new Date().toISOString()
    });

    // body 스크롤 잠금 해제 후 네비게이션
    setTimeout(() => {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';

      console.log('[Dashboard] 네비게이션 직전 (200ms 후, current 위치):', {
        current_scrollY: window.scrollY,
        current_scrollX: window.scrollX,
        bodyOverflow: document.body.style.overflow,
        stillAtTop: window.scrollY === 0 && window.scrollX === 0,
        timestamp: new Date().toISOString()
      });

      // 모달 애니메이션 완료 후 네비게이션
      if (printerToSetup) {
        navigate(`/printer/${printerToSetup}`);
      }
    }, 200);
  };

  // Pull-to-Refresh 상태
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const pullingRef = useRef(false);
  const topAtStartRef = useRef(false);
  const [pullY, setPullY] = useState(0);
  const PTR_THRESHOLD = 72; // px to trigger refresh
  const PTR_ACTIVATION = 12; // minimal drag before engaging PTR
  const MAX_PULL = 160; // cap for visual pull distance
  const summary = useDashboardSummary();

  // 프릭션 함수(러버밴드)
  const computePull = (dy: number) => {
    const d = Math.max(0, dy - PTR_ACTIVATION);
    if (d <= 0) return 0;
    if (d <= 80) return Math.min(MAX_PULL, d * 0.5); // 초기 구간: 절반 속도
    const extra = d - 80;
    return Math.min(MAX_PULL, 40 + extra * 0.25); // 이후 구간: 더 강한 감쇠
  };

  // 프린터 데이터 로드: DB 조회 + localStorage의 MQTT 상태 복원
  const loadPrinters = useCallback(async (showSpinner?: boolean) => {
    console.log('[DASH][LOAD] start', { userId: user?.id ?? null, showSpinner });
    if (!user) {
      console.log('[DASH][LOAD] skip: no user');
      setPrinters([]);
      setLoading(false);
      return;
    }

    try {
      if (showSpinner) setLoading(true);

      // 그룹 / 프린터 데이터 (shared service 활용)
      const groupsData = await getUserPrinterGroups(user.id);
      console.log('[DASH][FETCH] groups', { count: groupsData?.length ?? 0 });
      setGroups(groupsData);

      const printersData = await getUserPrintersWithGroup(user.id);
      console.log('[DASH][FETCH] printers from DB', { count: printersData?.length ?? 0 });

      // cameras 테이블에서 stream_url 조회
      const { data: camerasData } = await supabase
        .from('cameras')
        .select('device_uuid, stream_url')
        .in('device_uuid', printersData.map((p) => (p as { device_uuid?: string }).device_uuid).filter(Boolean));

      console.log('[DASH][FETCH] cameras', { count: camerasData?.length || 0 });

      // device_uuid로 stream_url 매핑
      const streamUrlMap = new Map<string, string | null>();
      (camerasData || []).forEach((cam) => {
        const camera = cam as { device_uuid?: string; stream_url?: string | null };
        if (camera.device_uuid) {
          streamUrlMap.set(camera.device_uuid, camera.stream_url ?? null);
        }
      });

      // DB 데이터 + localStorage의 MQTT 상태 병합 (현재 시점의 mqttStates 읽기)
      const currentMqttStates = JSON.parse(localStorage.getItem('mobile:dashboard:mqtt_states') || '{}');
      const formattedPrinters: PrinterOverview[] = printersData.map(printer => {
        const printerData = printer as { device_uuid?: string; name?: string; manufacture_id?: string; [key: string]: unknown };
        const deviceUuid = printerData.device_uuid;
        const streamUrl = deviceUuid ? streamUrlMap.get(deviceUuid) : null;
        const cachedState = deviceUuid ? currentMqttStates[deviceUuid] : null;

        // localStorage에 캐시된 MQTT 상태가 있으면 사용, 없으면 기본값
        if (cachedState) {
          console.log('[DASH][RESTORE] MQTT 상태 복원:', deviceUuid, cachedState.state);
          return {
            id: printer.id,
            name: printerData.name || printer.model,
            model: printer.model,
            group_id: printer.group_id,
            group: printer.group,
            state: cachedState.state,
            connected: cachedState.connected,
            printing: cachedState.printing,
            pending: cachedState.pending,
            completion: cachedState.completion ?? 0,
            temperature: cachedState.temperature,
            print_time_left: cachedState.print_time_left,
            current_file: cachedState.current_file,
            device_uuid: deviceUuid,
            manufacture_id: printerData.manufacture_id ?? undefined,
            stream_url: streamUrl ?? null,
            stream_start_time: null,
          };
        } else {
          // 캐시 없으면 기본값 (connecting 상태)
          console.log('[DASH][NEW] 새 프린터 또는 캐시 없음:', deviceUuid);
          return {
            id: printer.id,
            name: printerData.name || printer.model,
            model: printer.model,
            group_id: printer.group_id,
            group: printer.group,
            state: 'connecting',
            connected: false,
            printing: false,
            pending: true,
            completion: 0,
            temperature: {
              tool_actual: 0,
              tool_target: 0,
              bed_actual: 23,
              bed_target: 0
            },
            print_time_left: 0,
            current_file: undefined,
            device_uuid: deviceUuid,
            manufacture_id: printerData.manufacture_id ?? undefined,
            stream_url: streamUrl ?? null,
            stream_start_time: null,
          };
        }
      });

      setPrinters(formattedPrinters);
      console.log('[DASH][SET] 프린터 목록 업데이트 완료:', formattedPrinters.length);
    } catch (error) {
      console.error('Error loading printers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]); // mqttStates 의존성 제거 - 대신 localStorage에서 직접 읽기

  // 초기 로드: 항상 DB에서 프린터 목록 조회 + localStorage MQTT 상태 복원
  useEffect(() => {
    console.log('모바일 대시보드 초기 로드:', { user: !!user });
    if (!user) {
      console.log('user 없음 - 로드 생략');
      return;
    }
    console.log('DB에서 프린터 목록 조회 시작');
    loadPrinters(true); // 항상 스피너 표시
  }, [user, loadPrinters]);

  // MQTT: dash_status 수신 → 프린터 카드에 반영 (실시간 연결 상태 모니터링)
  useEffect(() => {
    if (printers.length === 0) return; // 프린터가 없으면 실행 안 함

    console.log('[MQTT] 실시간 모니터링 시작 - 프린터 수:', printers.length);

    // 각 프린터별 타임아웃 추적 (5초 동안 데이터 없으면 disconnected)
    const timeouts: Record<string, number> = {};
    const TIMEOUT_DURATION = 5000; // 5초

    // 타임아웃 설정/재설정 함수
    const startTimeoutFor = (uuid?: string, currentState?: string) => {
      if (!uuid) {
        console.log('[MQTT] UUID 없음, 타임아웃 설정 건너뜀');
        return;
      }

      // 기존 타임아웃 제거
      if (timeouts[uuid]) {
        console.log('[MQTT] 기존 타임아웃 제거:', uuid);
        try {
          clearTimeout(timeouts[uuid]);
        } catch (error) {
          console.warn('Failed to clear timeout:', error);
        }
      }

      console.log(`[MQTT] ${TIMEOUT_DURATION/1000}초 타임아웃 설정:`, uuid, '현재 상태:', currentState);
      timeouts[uuid] = window.setTimeout(() => {
        console.log('[MQTT] 타임아웃 실행:', uuid, '- 연결끊김으로 변경');

        // printers 상태 업데이트
        setPrinters((prev) => prev.map(p => {
          if (p.device_uuid === uuid) {
            console.log('[MQTT] 프린터 상태 업데이트:', uuid, p.state, '-> disconnected');

            // localStorage에도 동시 저장
            setMqttStates((prevStates) => ({
              ...prevStates,
              [uuid]: {
                state: 'disconnected',
                connected: false,
                printing: false,
                pending: false,
                completion: p.completion,
                temperature: p.temperature,
                print_time_left: p.print_time_left,
                current_file: p.current_file,
                last_updated: Date.now(),
              },
            }));

            return { ...p, state: 'disconnected', connected: false, pending: false };
          }
          return p;
        }));
      }, TIMEOUT_DURATION);
    };

    // 초기 connecting 상태 설정 및 타임아웃 시작
    setPrinters((prev) => prev.map(p => {
      // 이미 connected 상태가 아니면 connecting으로 표시
      if (p.state !== 'disconnected' && !p.connected) {
        startTimeoutFor(p.device_uuid, 'connecting');
        return { ...p, state: 'connecting', pending: true };
      }
      // connected 상태면 타임아웃만 시작
      startTimeoutFor(p.device_uuid, p.state);
      return p;
    }));

    // MQTT 메시지 수신 핸들러
    const off = onDashStatusMessage((uuid, data) => {
      console.log('[MQTT] 메시지 수신:', uuid);

      setPrinters((prev) => {
        const next = [...prev];
        const idx = next.findIndex(p => p.device_uuid === uuid);
        if (idx >= 0) {
          const bed = data?.temperature_info?.bed;
          const toolAny = data?.temperature_info?.tool;
          const tool = toolAny?.tool0 ?? toolAny;
          const flags = data?.printer_status?.flags ?? {};
          const isConnected = Boolean(
            data?.connected ||
            flags.operational || flags.printing || flags.paused || flags.ready || flags.error
          );
          const nextState: PrinterOverview['state'] =
            flags.printing ? 'printing' :
            flags.paused   ? 'paused'   :
            flags.error    ? 'error'    :
            (isConnected   ? 'idle'     : 'disconnected');

          console.log('[MQTT] 프린터 상태 업데이트:', uuid, nextState, 'connected:', isConnected);

          // 데이터 수신 시 타임아웃 재설정 (연결 상태 계속 모니터링)
          startTimeoutFor(uuid, nextState);

          const updatedPrinter = {
            ...next[idx],
            pending: false,
            state: nextState,
            connected: isConnected,
            printing: (flags?.printing ?? data?.printer_status?.printing) ?? next[idx].printing,
            completion: typeof data?.progress?.completion === 'number' ? data.progress.completion : next[idx].completion,
            temperature: {
              tool_actual: typeof tool?.actual === 'number' ? tool.actual : next[idx].temperature.tool_actual,
              tool_target: typeof tool?.target === 'number' ? tool.target : next[idx].temperature.tool_target,
              bed_actual: typeof bed?.actual === 'number' ? bed.actual : next[idx].temperature.bed_actual,
              bed_target: typeof bed?.target === 'number' ? bed.target : next[idx].temperature.bed_target,
            },
            print_time_left: data?.progress?.print_time_left ?? next[idx].print_time_left,
            current_file: data?.printer_status?.current_file ?? next[idx].current_file,
          };

          // localStorage에 MQTT 상태 저장
          setMqttStates((prevStates) => ({
            ...prevStates,
            [uuid]: {
              state: updatedPrinter.state,
              connected: updatedPrinter.connected,
              printing: updatedPrinter.printing,
              pending: updatedPrinter.pending,
              completion: updatedPrinter.completion,
              temperature: updatedPrinter.temperature,
              print_time_left: updatedPrinter.print_time_left,
              current_file: updatedPrinter.current_file,
              last_updated: Date.now(),
            },
          }));

          next[idx] = updatedPrinter;
        }
        return next;
      });
    });

    console.log('[MQTT] 핸들러 등록 완료');

    return () => {
      console.log('[MQTT] 클린업 - 모든 타임아웃 제거');
      off();
      Object.values(timeouts).forEach(t => {
        try {
          clearTimeout(t);
        } catch (error) {
          console.warn('Failed to clear timeout during cleanup:', error);
        }
      });
    };
  }, [printers.length, setMqttStates]);


  // 대시보드 이탈 시 stop 전송 제거 (세션 종료 시에만 stop 전송)

  // 스크롤 이벤트 모니터링 - 디버깅용
  useEffect(() => {
    const handleScroll = () => {
      console.log('[Dashboard] 스크롤 이벤트 - current 위치:', {
        current_scrollY: window.scrollY,
        current_scrollX: window.scrollX,
        timestamp: new Date().toISOString()
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Touch Handlers
  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (refreshing) return;
    const el = containerRef.current;
    if (!el) return;
    startYRef.current = e.touches[0].clientY;
    startXRef.current = e.touches[0].clientX;
    topAtStartRef.current = el.scrollTop <= 0;
    pullingRef.current = false; // 아직 비활성
  };

  const onTouchMove: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (refreshing) return;
    const el = containerRef.current;
    if (!el || !topAtStartRef.current) return;

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const dy = currentY - startYRef.current;
    const dx = currentX - startXRef.current;

    if (dy <= 0) { setPullY(0); return; }
    // 수평 제스처 우선이면 PTR 비활성
    if (Math.abs(dx) > Math.abs(dy)) { setPullY(0); return; }

    const pull = computePull(dy);
    if (pull > 0) {
      // 이 시점부터 스크롤 대신 당기기 처리
      pullingRef.current = true;
      e.preventDefault();
      setPullY(pull);
    } else {
      setPullY(0);
    }
  };

  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = async () => {
    if (refreshing) return;
    if (!pullingRef.current) { setPullY(0); return; }
    pullingRef.current = false;
    if (pullY >= PTR_THRESHOLD) {
      setRefreshing(true);
      setPullY(PTR_THRESHOLD);
      await loadPrinters(false);
    }
    setPullY(0);
  };

  const filteredPrinters = selectedGroup === "all" 
    ? printers 
    : printers.filter(printer => printer.group_id === selectedGroup);
  // 요약 정보 발행: 필터 기준(필요 시 printers로 변경 가능)
  useEffect(() => {
    const summary = computeDashboardSummary(filteredPrinters);
    publishDashboardSummary(summary);
  }, [filteredPrinters]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background safe-area-top safe-area-bottom">
        <div className="h-full flex items-center justify-center px-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-sm text-muted-foreground">{t('dashboard.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-background"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* 미니 헤더 */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b px-4 pt-4 pb-3 safe-area-top">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Monitor className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-lg font-semibold">Printer Dashboard</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => navigate('/notifications')}
          >
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-2">
        <div
          className="h-10 flex items-center justify-center text-xs text-muted-foreground"
          style={{ height: `${Math.max(0, pullY)}px`, transition: pullingRef.current ? 'none' : 'height 150ms ease' }}
        >
          {refreshing ? t('common.loading') : (pullY >= PTR_THRESHOLD ? t('camera.refresh') : (pullY > 0 ? t('camera.refresh') : ''))}
        </div>
      </div>

      <div ref={contentRef} className="max-w-7xl mx-auto px-6 space-y-2 pb-24" style={{ transform: `translateY(${pullY}px)`, transition: pullingRef.current ? 'none' : 'transform 150ms ease' }}>
        {/* 로그인 안내 */}
        {!user && (
          <Alert className="bg-primary/10 border-primary">
            <LogIn className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{t('dashboard.loginRequired')}</span>
              <Button asChild size="sm" className="ml-4">
                <Link to="/">
                  <LogIn className="h-3 w-3 mr-1" />
                  {t('nav.login')}
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* 연결 통계: 접기/펼치기 */}
        <Accordion type="single" collapsible defaultValue={undefined}>
          <AccordionItem value="details" className="border-none">
            <Card>
              <CardContent className="p-4">
                <AccordionTrigger className="text-base font-semibold hover:no-underline py-0">
                  <div className="flex items-center justify-between w-full pr-2">
                    <span>{t('dashboard.statistics')}</span>
                    <div className="flex items-center gap-2 text-sm font-normal">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${summary.connected > 0 ? 'bg-success/40 text-success-foreground' : ''}`}
                      >
                        {t('nav.connected')}: {summary.connected}/{summary.total}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${summary.printing > 0 ? 'bg-primary/40 text-primary-foreground' : ''}`}
                      >
                        {t('nav.printing')}: {summary.printing}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${summary.error > 0 ? 'bg-warning/40 text-warning-foreground' : ''}`}
                      >
                        {t('nav.error')}: {summary.error}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
              </CardContent>
            </Card>
            <AccordionContent className="pt-2">
              <div className="grid grid-cols-2 md:grid-cols-2 gap-2">
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <div className="text-2xl font-bold text-primary">{summary.total}</div>
                    <div className="text-sm text-muted-foreground">{t('dashboard.stats.totalPrinters')}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <div className="text-2xl font-bold text-primary">{summary.printing}</div>
                    <div className="text-sm text-muted-foreground">{t('dashboard.stats.printing')}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <div className="text-2xl font-bold text-success">{summary.connected}</div>
                    <div className="text-sm text-muted-foreground">{t('dashboard.stats.connected')}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <div className="text-2xl font-bold text-destructive">{summary.error}</div>
                    <div className="text-sm text-muted-foreground">{t('dashboard.stats.errors')}</div>
                  </CardContent>
                </Card>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* 프린터 목록 */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">{t('dashboard.printerList')}</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Layers className="h-4 w-4" />
                  <span>{selectedGroup === "all" ? t('dashboard.allPrinters') : groups.find(g => g.id === selectedGroup)?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setSelectedGroup("all")}
                  className={selectedGroup === "all" ? 'bg-accent' : ''}
                >
                  {t('dashboard.allPrinters')}
                </DropdownMenuItem>
                {groups.map((group) => (
                  <DropdownMenuItem
                    key={group.id}
                    onClick={() => setSelectedGroup(group.id)}
                    className={selectedGroup === group.id ? 'bg-accent' : ''}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                      {group.name}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {filteredPrinters.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t('dashboard.noPrinters')}</h3>
                <p className="text-muted-foreground text-center mb-4">{selectedGroup === "all" ? t('dashboard.noRegisteredPrinters') : t('dashboard.noGroupPrinters')}</p>
                {user && (<Button asChild><Link to="/settings"><Plus className="h-4 w-4 mr-2" />{t('dashboard.addPrinter')}</Link></Button>)}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredPrinters.map((printer) => (<PrinterCard key={printer.id} printer={printer} isAuthenticated={!!user} onSetupRequired={handleSetupRequired} />))}
            </div>
          )}
        </div>
      </div>

      {/* 프린터 설정 유도 모달 - 친화적 UI */}
      <AlertDialog open={showSetupPrompt} onOpenChange={setShowSetupPrompt}>
        <AlertDialogContent className="rounded-3xl border-0 max-w-md shadow-2xl">
          <div className="flex flex-col items-center text-center py-8 px-6">
            {/* 아이콘 */}
            <div className="mb-8 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full blur-xl"></div>
              <div className="relative p-5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-full">
                <SettingsIcon className="h-14 w-14 text-primary" />
              </div>
            </div>

            {/* 제목 */}
            <AlertDialogHeader className="space-y-4 mb-8">
              <AlertDialogTitle className="text-2xl font-bold tracking-tight">
                프린터 설정이 필요해요
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base leading-relaxed text-muted-foreground">
                더 나은 사용 경험을 위해<br />
                제조사 정보를 설정해주세요 ✨
              </AlertDialogDescription>
            </AlertDialogHeader>

            {/* 버튼 */}
            <AlertDialogFooter className="flex-col sm:flex-col gap-3 w-full">
              <AlertDialogAction
                onClick={handleGoToSettings}
                className="w-full h-14 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <SettingsIcon className="h-5 w-5 mr-2" />
                지금 설정하기
              </AlertDialogAction>
              <AlertDialogCancel
                onClick={handleSkipSetup}
                className="w-full h-14 text-base font-medium rounded-xl bg-muted/50 hover:bg-muted border-0 transition-all duration-200"
              >
                다음에 할게요
              </AlertDialogCancel>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Home;