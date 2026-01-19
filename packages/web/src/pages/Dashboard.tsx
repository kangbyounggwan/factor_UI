import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Monitor, Settings, ArrowRight, Activity, Thermometer, Clock, Lock, LogIn, Plus, Loader2 } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { SettingsContent } from "@/components/Settings/SettingsContent";
import { useAuth } from "@shared/contexts/AuthContext";
import { useUserPlan } from "@shared/hooks/useUserPlan";
import { AppHeader } from "@/components/common/AppHeader";
import { AppSidebar } from "@/components/common/AppSidebar";
import { DashboardSidebarContent, type PrinterQuickItem } from "@/components/sidebar";
import { supabase } from "@shared/integrations/supabase/client"
import { getUserPrinterGroups, getUserPrintersWithGroup } from "@shared/services/supabaseService/printerList";
import { useToast } from "@/hooks/use-toast";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useIsMobile } from "@/hooks/use-mobile";
import { SharedBottomNavigation } from "@/components/shared/SharedBottomNavigation";
import { cn } from "@/lib/utils";
import { onDashStatusMessage } from "@shared/services/mqttService";
import { PrinterStatusBadge } from "@/components/Dashboard/PrinterStatusBadge";
import { computeDashboardSummary, publishDashboardSummary, useDashboardSummary } from "@shared/component/dashboardSummary";

// Lazy load heavy components
const PrinterSetupModal = lazy(() => import("@/components/Dashboard/PrinterSetupModal").then(m => ({ default: m.PrinterSetupModal })));

// 로컬 스냅샷 퍼시스턴스 훅
function usePersistentState<T>(key: string, fallback: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch (err) {
      console.warn('Failed to parse localStorage:', err);
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (err) { console.warn('Failed to save to localStorage:', err); }
  }, [key, state]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setState(JSON.parse(e.newValue) as T);
        } catch (parseErr) { console.warn('Failed to parse storage event:', parseErr); }
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

// 전체 프린터 데이터 타입
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
}

const PrinterCard = ({
  printer,
  isAuthenticated,
  onSetupClick
}: {
  printer: PrinterOverview;
  isAuthenticated: boolean;
  onSetupClick?: (printer: PrinterOverview) => void;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}${t('dashboard.time.hours')} ${minutes}${t('dashboard.time.minutes')}`;
    }
    return `${minutes}${t('dashboard.time.minutes')}`;
  };

  const hasGroupObject = printer.group && typeof printer.group === 'object';
  const printerGroup = printer.group as { color?: string; name?: string } | undefined;
  const groupColor = hasGroupObject && printerGroup?.color ? printerGroup.color : '#9CA3AF';
  const groupName = hasGroupObject && printerGroup?.name ? printerGroup.name : t('dashboard.printer.noGroup');

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }

    // manufacture_id가 없으면 제조사 설정 모달 표시
    if (!printer.manufacture_id) {
      onSetupClick?.(printer);
      return;
    }

    // manufacture_id가 있으면 프린터 상세 페이지로 이동
    navigate(`/printer/${printer.id}`, { state: { printer } });
  };

  return (
    <div onClick={handleClick} className="block cursor-pointer">
      <Card className="shadow-card hover:shadow-lg hover:scale-105 transition-all duration-200 h-[450px] flex flex-col cursor-pointer border-2 border-border">
        {/* 1. 프린터 정보 - 고정 높이 */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 flex-shrink-0">
          <div className="space-y-1 min-w-0 flex-1 pr-4">
            <CardTitle className="text-lg font-semibold truncate">{printer.name}</CardTitle>
            {printer.model && <p className="text-sm text-muted-foreground truncate">{printer.model}</p>}
            {hasGroupObject ? (
              <div className="flex items-center gap-1">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: groupColor }}
                />
                <span className="text-xs text-muted-foreground">{groupName}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#9CA3AF' }} />
                <span className="text-xs text-muted-foreground">{t('dashboard.printer.noGroup')}</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            {printer.pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <PrinterStatusBadge status="connecting" />
              </>
            ) : (
              <>
                <div className={`h-3 w-3 rounded-full ${printer.connected ? 'bg-success' : 'bg-destructive'}`} />
                <PrinterStatusBadge status={printer.state} />
              </>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col justify-between space-y-4">
          {/* 2. 진행률 - 고정 높이 */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">{t('dashboard.printer.printProgress')}</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium flex items-center gap-1">
                  <Activity className="h-4 w-4" />
                  {t('dashboard.printer.completion')}
                </span>
                <span className="text-lg font-bold text-primary">
                  {printer.completion ? Math.round(printer.completion * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${printer.completion ? printer.completion * 100 : 0}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="truncate">
                  📁 {printer.current_file || t('dashboard.printer.noFile')}
                </div>
                <div className="flex justify-between">
                  <span>{t('dashboard.printer.remainingTime')}</span>
                  <span className="font-medium">
                    {printer.print_time_left ? formatTime(printer.print_time_left) : `0${t('dashboard.time.minutes')}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. 데이터 써머리 - 고정 높이 */}
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-medium text-muted-foreground">{t('dashboard.printer.temperatureStatus')}</h4>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1 flex-shrink-0">
                    <Thermometer className="h-3 w-3" />
                    {t('dashboard.printer.extruder')}
                  </span>
                  <span className="font-mono text-xs text-right">
                    {printer.state === 'disconnected' ? '-' : `${(printer.temperature.tool_actual ?? 0).toFixed(0)}°C / ${(printer.temperature.tool_target ?? 0).toFixed(0)}°C`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex-shrink-0">{t('dashboard.printer.heatingBed')}</span>
                  <span className="font-mono text-xs text-right">
                    {printer.state === 'disconnected' ? '-' : `${(printer.temperature.bed_actual ?? 0).toFixed(0)}°C / ${(printer.temperature.bed_target ?? 0).toFixed(0)}°C`}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex-shrink-0">{t('dashboard.printer.connectionStatus')}</span>
                  {printer.pending ? (
                    <span className="font-medium text-xs text-primary inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> {t('dashboard.printer.verifying')}
                    </span>
                  ) : (
                    <span className={`font-medium text-xs ${printer.connected ? 'text-success' : 'text-destructive'}`}>
                      {printer.connected ? t('dashboard.printer.connected') : t('dashboard.printer.disconnected')}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex-shrink-0">{t('dashboard.printer.printing')}</span>
                  <span className={`font-medium text-xs ${printer.printing ? 'text-primary' : 'text-muted-foreground'}`}>
                    {printer.printing ? t('dashboard.printer.inProgress') : t('dashboard.printer.stopped')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

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

const Home = () => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { plan: userPlan } = useUserPlan(user?.id);
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [printers, setPrinters] = useState<PrinterOverview[]>([]); // localStorage 제거
  const [mqttStates, setMqttStates] = usePersistentState<MqttStateCache>('web:dashboard:mqtt_states', {}); // MQTT 상태만 저장
  const [groups, setGroups] = useState<PrinterGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const summary = useDashboardSummary();

  // Settings 뷰 상태 (URL 파라미터 기반)
  const settingsViewActive = searchParams.get('view') === 'settings';
  const editPrinterId = searchParams.get('editPrinter') || undefined;
  const openAddPrinter = searchParams.get('addPrinter') === 'true';

  // 사이드바 상태 (페이지 간 공유)
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarState(true);

  // 프린터 설정 모달 상태
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedPrinterForSetup, setSelectedPrinterForSetup] = useState<PrinterOverview | null>(null);

  // 프린터 설정 클릭 핸들러
  const handleSetupClick = (printer: PrinterOverview) => {
    setSelectedPrinterForSetup(printer);
    setShowSetupModal(true);
  };

  // 프린터 설정 완료 핸들러
  const handleSetupSuccess = () => {
    // 프린터 목록 새로고침
    loadPrinters(false);
  };

  // Settings 뷰 토글 핸들러
  const handleOpenSettings = () => {
    setSearchParams({ view: 'settings' });
  };

  // 프린터 추가 핸들러 (Settings 뷰 열면서 프린터 추가 모달 바로 열기)
  const handleAddPrinter = () => {
    setSearchParams({ view: 'settings', addPrinter: 'true' });
  };

  // Settings 뷰 닫기 핸들러
  const handleCloseSettings = () => {
    setSearchParams({});
    // 프린터 목록 새로고침 (설정에서 변경사항 반영)
    loadPrinters(false);
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
      const currentMqttStates = JSON.parse(localStorage.getItem('web:dashboard:mqtt_states') || '{}');
      const formattedPrinters: PrinterOverview[] = (printersData || []).map(printer => {
        const printerWithUuid = printer as typeof printer & { device_uuid?: string; name?: string; manufacture_id?: string };
        // device_uuid가 없으면 id를 UUID로 사용 (신규 프린터)
        const deviceUuid = printerWithUuid.device_uuid || printer.id;
        const streamUrl = deviceUuid ? streamUrlMap.get(deviceUuid) : null;
        const cachedState = deviceUuid ? currentMqttStates[deviceUuid] : null;

        // localStorage에 캐시된 MQTT 상태가 있으면 사용, 없으면 기본값
        if (cachedState) {
          console.log('[DASH][RESTORE] MQTT 상태 복원:', deviceUuid, cachedState.state);
          return {
            id: printer.id,
            name: printerWithUuid.name || printer.model,
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
            manufacture_id: printerWithUuid.manufacture_id,
            stream_url: streamUrl ?? null,
          };
        } else {
          // 캐시 없으면 기본값 (connecting 상태)
          console.log('[DASH][NEW] 새 프린터 또는 캐시 없음:', deviceUuid);
          return {
            id: printer.id,
            name: printerWithUuid.name || printer.model,
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
            manufacture_id: printerWithUuid.manufacture_id,
            stream_url: streamUrl ?? null,
          };
        }
      });

      setPrinters(formattedPrinters);
      console.log('[DASH][SET] 프린터 목록 업데이트 완료:', formattedPrinters.length);
    } catch (error) {
      console.error('Error loading printers:', error);
    } finally {
      setLoading(false);
    }
  }, [user]); // mqttStates 의존성 제거 - 대신 localStorage에서 직접 읽기

  // 초기 로드: 항상 DB에서 프린터 목록 조회 + localStorage MQTT 상태 복원
  useEffect(() => {
    console.log('웹 대시보드 초기 로드:', { user: !!user });
    if (!user) {
      console.log('user 없음 - 로드 생략');
      return;
    }
    console.log('DB에서 프린터 목록 조회 시작');
    loadPrinters(true); // 항상 스피너 표시
  }, [user, loadPrinters]);

  // MQTT 연결은 로그인 시 Auth.tsx에서 전역적으로 처리되므로 여기서는 생략

  // MQTT: dash_status 수신 → 프린터 리스트에 반영 (Heartbeat 패턴)
  // lastActivity에 마지막 데이터 수신 시간만 기록하고, 별도 인터벌에서 타임아웃 체크
  const lastActivityRef = useRef<Record<string, number>>({});

  // Heartbeat 체크 인터벌 (2초마다 모든 프린터의 마지막 활동 시간 체크)
  useEffect(() => {
    if (printers.length === 0) return;

    const STALE_THRESHOLD = 5000; // 5초 이상 데이터 없으면 disconnected
    const CHECK_INTERVAL = 2000; // 2초마다 체크

    const heartbeatInterval = setInterval(() => {
      const now = Date.now();

      setPrinters((prev) => {
        let hasChanges = false;
        const next = prev.map((p) => {
          if (!p.device_uuid) return p;

          const lastTime = lastActivityRef.current[p.device_uuid];
          const isStale = !lastTime || (now - lastTime) > STALE_THRESHOLD;

          // 이미 disconnected이면 변경 없음
          if (p.state === 'disconnected' && isStale) return p;

          // 연결됨 → 연결끊김 전환
          if (isStale && p.state !== 'disconnected') {
            hasChanges = true;
            console.log('[MQTT] Heartbeat 타임아웃:', p.device_uuid, p.state, '-> disconnected');

            // localStorage에도 저장
            setMqttStates((prevStates) => ({
              ...prevStates,
              [p.device_uuid!]: {
                state: 'disconnected',
                connected: false,
                printing: false,
                pending: false,
                completion: p.completion,
                temperature: p.temperature,
                print_time_left: p.print_time_left,
                current_file: p.current_file,
                last_updated: now,
              },
            }));

            return { ...p, state: 'disconnected' as const, connected: false, pending: false };
          }

          return p;
        });

        return hasChanges ? next : prev;
      });
    }, CHECK_INTERVAL);

    console.log('[MQTT] Heartbeat 모니터링 시작 - 프린터 수:', printers.length);

    return () => {
      console.log('[MQTT] Heartbeat 모니터링 종료');
      clearInterval(heartbeatInterval);
    };
  }, [printers.length]);

  // MQTT 메시지 수신 핸들러 (별도 useEffect)
  useEffect(() => {
    if (printers.length === 0) return;

    // MQTT 메시지 수신 핸들러
    const off = onDashStatusMessage((uuid, data) => {
      // 마지막 활동 시간만 갱신 (매우 가벼운 연산)
      lastActivityRef.current[uuid] = Date.now();

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

          // 상태 변경 시에만 로그 출력 (불필요한 로그 제거)
          if (next[idx].state !== nextState) {
            console.log('[MQTT] 상태 변경:', uuid, next[idx].state, '->', nextState);
          }

          const updatedPrinter = {
            ...next[idx],
            pending: false,
            state: nextState,
            connected: isConnected,
            printing: (flags?.printing ?? data?.printer_status?.printing) ?? next[idx].printing,
            completion: typeof data?.progress?.completion === 'number' ? data.progress.completion : next[idx].completion,
            temperature: {
              tool_actual: typeof tool?.actual === 'number' ? tool.actual : next[idx].temperature.tool_actual,
              tool_target: typeof tool?.offset === 'number' ? tool.target : next[idx].temperature.tool_target,
              bed_actual: typeof bed?.actual === 'number' ? bed.actual : next[idx].temperature.bed_actual,
              bed_target: typeof bed?.offset === 'number' ? bed.target : next[idx].temperature.bed_target,
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

    console.log('[MQTT] 메시지 핸들러 등록 완료');

    return () => {
      console.log('[MQTT] 메시지 핸들러 해제');
      off();
    };
  }, [printers.length]);

  // 구독 로직은 로그인 시 shared에서 처리됨

  // 필터링된 프린터 목록
  const filteredPrinters = selectedGroup === "all"
    ? printers
    : selectedGroup === "ungrouped"
    ? printers.filter(printer => !printer.group_id)
    : printers.filter(printer => printer.group_id === selectedGroup);
  // 요약 정보 발행: 필터 기준(필요 시 printers로 변경 가능)
  useEffect(() => {
    const summary = computeDashboardSummary(filteredPrinters);
    publishDashboardSummary(summary);
  }, [filteredPrinters]);

  // 집계는 shared 모듈에서 발행/구독하므로 지역 집계 변수 제거

  if (loading) {
    return (
      <div className="bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">{t('dashboard.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-screen flex overflow-hidden", isMobile && "pb-16")}>
      {/* App Sidebar - 데스크탑에서만 표시 */}
      {!isMobile && (
        <AppSidebar
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
          user={user}
          userPlan={userPlan}
          onSignOut={signOut}
        >
          <DashboardSidebarContent
            printers={printers.map((p): PrinterQuickItem => ({
              id: p.id,
              name: p.name,
              model: p.model,
              isOnline: p.connected,
              progress: p.printing ? p.completion : undefined,
              currentJob: p.current_file,
            }))}
            onSelectPrinter={(printer) => navigate(`/printer/${printer.id}`)}
            alerts={[]}
          />
        </AppSidebar>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* App Header */}
        <AppHeader sidebarOpen={sidebarOpen} />

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto bg-background p-6">
          {/* Settings View */}
          {settingsViewActive ? (
            <div className="max-w-7xl mx-auto">
              <SettingsContent
                embedded={true}
                onBack={handleCloseSettings}
                editPrinterId={editPrinterId}
                openAddPrinter={openAddPrinter}
              />
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-6">

        {/* 로그인 안내 */}
        {!user && (
          <Alert className="bg-primary/10 border-primary">
            <LogIn className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{t('dashboard.loginRequired')}</span>
              <Button asChild size="sm" className="ml-4">
                <Link to="/auth">
                  <LogIn className="h-3 w-3 mr-1" />
                  {t('auth.login')}
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* 그룹 필터링 - 탭 스타일 */}
        {user && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* 전체 프린터 탭 */}
            <button
              onClick={() => setSelectedGroup("all")}
              className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${selectedGroup === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border"
                }
              `}
            >
              <Monitor className="h-4 w-4" />
              {t('dashboard.allPrinters')}
              <span className={`
                ml-1 px-1.5 py-0.5 rounded text-xs font-semibold
                ${selectedGroup === "all"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted-foreground/20 text-muted-foreground"
                }
              `}>
                {printers.length}
              </span>
            </button>

            {/* 그룹별 탭 */}
            {groups.map((group) => {
              const groupPrinterCount = printers.filter(p => p.group_id === group.id).length;
              return (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(group.id)}
                  className={`
                    inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${selectedGroup === group.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border"
                    }
                  `}
                >
                  <div
                    className="w-3 h-3 rounded-full border-2 border-current"
                    style={{
                      backgroundColor: selectedGroup === group.id ? group.color : 'transparent',
                      borderColor: group.color
                    }}
                  />
                  {group.name}
                  {groupPrinterCount > 0 && (
                    <span className={`
                      ml-1 px-1.5 py-0.5 rounded text-xs font-semibold
                      ${selectedGroup === group.id
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted-foreground/20 text-muted-foreground"
                      }
                    `}>
                      {groupPrinterCount}
                    </span>
                  )}
                </button>
              );
            })}

            {/* 그룹 없음 필터 (그룹이 없는 프린터가 있을 경우) */}
            {printers.some(p => !p.group_id) && (
              <button
                onClick={() => setSelectedGroup("ungrouped")}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${selectedGroup === "ungrouped"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border"
                  }
                `}
              >
                <div className="w-3 h-3 rounded-full border-2 border-dashed border-current" />
                {t('dashboard.printer.noGroup')}
                <span className={`
                  ml-1 px-1.5 py-0.5 rounded text-xs font-semibold
                  ${selectedGroup === "ungrouped"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted-foreground/20 text-muted-foreground"
                  }
                `}>
                  {printers.filter(p => !p.group_id).length}
                </span>
              </button>
            )}
          </div>
        )}

        {/* 통계 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-2 border-border">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-2xl font-bold text-primary">{summary.total}</div>
              <div className="text-sm text-muted-foreground">{t('dashboard.stats.totalPrinters')}</div>
            </CardContent>
          </Card>
          <Card className="border-2 border-border">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-2xl font-bold text-success">{summary.connected}</div>
              <div className="text-sm text-muted-foreground">{t('dashboard.stats.connected')}</div>
            </CardContent>
          </Card>
          <Card className="border-2 border-border">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-2xl font-bold text-primary">{summary.printing}</div>
              <div className="text-sm text-muted-foreground">{t('dashboard.stats.printing')}</div>
            </CardContent>
          </Card>
          <Card className="border-2 border-border">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-2xl font-bold text-destructive">{summary.error}</div>
              <div className="text-sm text-muted-foreground">{t('dashboard.stats.errors')}</div>
            </CardContent>
          </Card>
        </div>

        {/* 프린터 목록 */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">
              {t('dashboard.printerList')}
              {selectedGroup !== "all" && (
                <span className="text-lg font-normal text-muted-foreground ml-2">
                  - {groups.find(g => g.id === selectedGroup)?.name}
                </span>
              )}
            </h2>
            <button
              onClick={handleOpenSettings}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer select-none bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50 hover:border-border shadow-sm hover:shadow"
            >
              <Settings className="h-4 w-4" />
              {t('dashboard.manage')}
            </button>
          </div>
          
          {filteredPrinters.length === 0 ? (
            <Card className="border-2 border-border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t('dashboard.noPrinters')}</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {selectedGroup === "all"
                    ? t('dashboard.noRegisteredPrinters')
                    : t('dashboard.noGroupPrinters')
                  }
                </p>
                {user && (
                  <Button onClick={handleAddPrinter}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('dashboard.addPrinter')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPrinters.map((printer) => {
                return (
                  <PrinterCard
                    key={printer.id}
                    printer={printer}
                    isAuthenticated={!!user}
                    onSetupClick={handleSetupClick}
                  />
                );
              })}
            </div>
          )}
        </div>
        {/* End space-y-4 프린터 목록 */}
            </div>
          )}
          {/* End max-w-7xl container */}
        </div>
        {/* End Dashboard Content */}
      </div>
      {/* End Main Content */}

      {/* 프린터 설정 모달 */}
      {selectedPrinterForSetup && (
        <Suspense fallback={<div className="flex items-center justify-center p-4"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
          <PrinterSetupModal
            open={showSetupModal}
            onOpenChange={setShowSetupModal}
            printerId={selectedPrinterForSetup.id}
            printerName={selectedPrinterForSetup.name}
            onSuccess={handleSetupSuccess}
          />
        </Suspense>
      )}

      {/* 모바일 하단 네비게이션 */}
      {isMobile && <SharedBottomNavigation />}
    </div>
  );
};

export default Home;