import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Monitor, Settings, ArrowRight, Activity, Thermometer, Clock, Lock, LogIn, Filter, Plus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { supabase } from "@shared/integrations/supabase/client"
import { getUserPrinterGroups, getUserPrintersWithGroup } from "@shared/services/supabaseService/printerList";
import { useToast } from "@/hooks/use-toast";
import {  onDashStatusMessage, mqttConnect } from "@shared/services/mqttService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  model: string;
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
}

const statusConfig = {
  idle: { color: "bg-muted text-muted-foreground", label: "대기" },
  printing: { color: "bg-success text-success-foreground", label: "프린팅" },
  paused: { color: "bg-warning text-warning-foreground", label: "일시정지" },
  error: { color: "bg-destructive text-destructive-foreground", label: "오류" },
  connecting: { color: "bg-primary text-primary-foreground", label: "연결중" },
  disconnected: { color: "bg-muted text-muted-foreground", label: "연결끊김" }
};

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  return `${minutes}분`;
};

const PrinterCard = ({ printer, isAuthenticated }: { printer: PrinterOverview; isAuthenticated: boolean }) => {
  const config = statusConfig[printer.state] || statusConfig.disconnected;
  const hasGroupObject = printer.group && typeof printer.group === 'object';
  const groupColor = hasGroupObject && (printer.group as any).color ? (printer.group as any).color : '#9CA3AF';
  const groupName = hasGroupObject && (printer.group as any).name ? (printer.group as any).name : '연결안됨';
  
  return (
    <Link to={isAuthenticated ? `/printer/${printer.id}` : "/auth"} className="block">
      <Card className="hover:shadow-lg hover:scale-105 transition-all duration-200 h-[450px] flex flex-col cursor-pointer">
        {/* 1. 프린터 정보 - 고정 높이 */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 flex-shrink-0">
          <div className="space-y-1 min-w-0 flex-1 pr-4">
            <CardTitle className="text-lg font-semibold truncate">{printer.model}</CardTitle>
            <p className="text-sm text-muted-foreground truncate">{printer.model}</p>
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
                <span className="text-xs text-muted-foreground">연결안됨</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            {printer.pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <Badge className={statusConfig.connecting.color}>연결중</Badge>
              </>
            ) : (
              <>
                <div className={`h-3 w-3 rounded-full ${printer.connected ? 'bg-success' : 'bg-destructive'}`} />
                <Badge className={config.color}>
                  {config.label}
                </Badge>
              </>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col justify-between space-y-4">
          {/* 2. 진행률 - 고정 높이 */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">프린트 진행률</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium flex items-center gap-1">
                  <Activity className="h-4 w-4" />
                  완료율
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
                  📁 {printer.current_file || "파일 없음"}
                </div>
                <div className="flex justify-between">
                  <span>남은 시간:</span>
                  <span className="font-medium">
                    {printer.print_time_left ? formatTime(printer.print_time_left) : "0분"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. 데이터 써머리 - 고정 높이 */}
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-medium text-muted-foreground">온도 및 상태</h4>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1 flex-shrink-0">
                    <Thermometer className="h-3 w-3" />
                    익스트루더:
                  </span>
                  <span className="font-mono text-xs text-right">
                    {(printer.temperature.tool_actual ?? 0).toFixed(0)}°C / {(printer.temperature.tool_target ?? 0).toFixed(0)}°C
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex-shrink-0">히팅베드:</span>
                  <span className="font-mono text-xs text-right">
                    {(printer.temperature.bed_actual ?? 0).toFixed(0)}°C / {(printer.temperature.bed_target ?? 0).toFixed(0)}°C
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex-shrink-0">연결상태:</span>
                  {printer.pending ? (
                    <span className="font-medium text-xs text-primary inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> 확인중...
                    </span>
                  ) : (
                    <span className={`font-medium text-xs ${printer.connected ? 'text-success' : 'text-destructive'}`}>
                      {printer.connected ? '연결완료' : '연결없음'}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex-shrink-0">프린팅:</span>
                  <span className={`font-medium text-xs ${printer.printing ? 'text-primary' : 'text-muted-foreground'}`}>
                    {printer.printing ? '진행중' : '중지'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

const Home = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [printers, setPrinters] = usePersistentState<PrinterOverview[]>('web:dashboard:printers', []);
  const [groups, setGroups] = useState<PrinterGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [loading, setLoading] = useState(printers.length === 0);
  const summary = useDashboardSummary();


  // 프린터 데이터 로드
  const loadPrinters = useCallback(async (showSpinner?: boolean) => {
    try { console.log('[DASH][LOAD] start', { userId: user?.id ?? null, showSpinner, cachedCount: printers.length }); } catch {}
    if (!user) {
      try { console.log('[DASH][LOAD] skip: no user'); } catch {}
      setPrinters([]);
      setLoading(false);
      return;
    }

    try {
      if (showSpinner ?? printers.length === 0) setLoading(true);
      
      // 그룹 / 프린터 데이터 (shared service 활용)
      const groupsData = await getUserPrinterGroups(user.id);
      try { console.log('[DASH][FETCH] groups', { count: groupsData?.length ?? 0 }); } catch {}
      setGroups(groupsData);

      const printersData = await getUserPrintersWithGroup(user.id);
      try {
        console.log('[DASH][FETCH] printers', {
          count: printersData?.length ?? 0,
          items: (printersData || []).map((p: any) => ({
            id: p?.id,
            device_uuid: p?.device_uuid ?? p?.uuid ?? null,
            user_id: p?.user_id ?? null,
            model: p?.model ?? null,
          })),
        });
      } catch {}

      // 프린터 데이터를 UI 형식으로 변환 (실제 데이터 사용)
      const formattedPrinters: PrinterOverview[] = (printersData || []).map(printer => {
        const isConnected = printer.status === 'connected' || printer.status === 'printing' || printer.status === 'idle';
        const isPrinting = printer.status === 'printing';
        const state = printer.status as PrinterOverview['state'];
        
        return {
          id: printer.id,
          model: printer.model,
          group_id: printer.group_id,
          group: printer.group,
          state: 'connecting', // 초기엔 연결중으로 표시
          connected: false,
          printing: isPrinting,
          pending: true, // MQTT 수신 대기
          completion: 0, // TODO: 실제 진행률 데이터 필드 추가 필요
          temperature: {
            tool_actual: 0, // TODO: 실제 온도 데이터 필드 추가 필요
            tool_target: 0,
            bed_actual: 23,
            bed_target: 0
          },
          print_time_left: 0, // TODO: 실제 남은 시간 데이터 필드 추가 필요
          current_file: undefined, // TODO: 실제 파일명 데이터 필드 추가 필요
          device_uuid: (printer as any).device_uuid ?? undefined,
        };
      });

      setPrinters(formattedPrinters);
      try {
        console.log('[DASH][SET] printers', {
          count: formattedPrinters.length,
          uuids: formattedPrinters.map(p => p.device_uuid ?? null)
        });
      } catch {}
    } catch (error) {
      console.error('Error loading printers:', error);
    } finally {
      if (showSpinner ?? printers.length === 0) setLoading(false);
    }
  }, [user, printers.length, setPrinters]);

  // 프린터 데이터가 복원되면 로딩 상태 업데이트
  useEffect(() => {
    if (printers.length > 0 && loading) {
      console.log('웹 대시보드: 프린터 데이터 복원됨, 로딩 상태 해제');
      setLoading(false);
    }
  }, [printers.length, loading]);

  // 초기 1회 로드: 스냅샷이 이미 있으면 서버 로드 생략
  useEffect(() => {
    if (!user) return;
    loadPrinters();
  }, [user, printers.length, loadPrinters]);

  // MQTT: 대시보드 진입 시 1회 퍼블리시
  const publishedRef = useRef(false);

  useEffect(() => {
    if (publishedRef.current) return;
    if (!user) return;
    const deviceUuids = Array.from(new Set(
      printers.map(p => p.device_uuid).filter((v): v is string => Boolean(v))
    ));
    if (deviceUuids.length === 0) return;
  }, [user, printers]);

  // 대시보드 이탈 시 stop 전송 제거 (세션 종료 시에만 stop 전송)

  // MQTT: dash_status 수신 → 프린터 리스트에 반영
  useEffect(() => {
    // 3초 타임아웃: 첫 수신이 없으면 연결없음 처리
    const timeouts: Record<string, number> = {};
    setPrinters((prev) => prev.map(p => {
      if (p.pending) return p; // 이미 connecting
      return { ...p, pending: true, state: 'connecting', connected: false };
    }));

    const startTimeoutFor = (uuid?: string) => {
      if (!uuid) return;
      if (timeouts[uuid]) { try { clearTimeout(timeouts[uuid]); } catch {} }
      timeouts[uuid] = window.setTimeout(() => {
        setPrinters((prev) => prev.map(p => (
          p.device_uuid === uuid && p.pending
            ? { ...p, pending: false, state: 'disconnected', connected: false }
            : p
        )));
      }, 3000);
    };

    // 모든 uuid에 타임아웃 설정
    printers.forEach(p => startTimeoutFor(p.device_uuid));

    // 수신 핸들러: 해당 uuid 프린터 데이터를 대체/병합
    const off = onDashStatusMessage((uuid, data) => {
      // 수신되면 타임아웃 해제
      if (uuid && timeouts[uuid]) { try { clearTimeout(timeouts[uuid]); } catch {} delete timeouts[uuid]; }
      setPrinters((prev) => {
        const next = [...prev];
        const idx = next.findIndex(p => p.device_uuid === uuid);
        if (idx >= 0) {
          const bed = data?.temperature_info?.bed;
          const toolAny = data?.temperature_info?.tool;
          const tool = toolAny?.tool0 ?? toolAny; // tool.tool0 우선, 없으면 tool 사용
          next[idx] = {
            ...next[idx],
            // data에 따라 필요한 필드 갱신 (예: 상태/온도/진행률)
            pending: false,
            state: (data?.printer_status?.state ?? (data?.connected ? 'idle' : 'disconnected')) as any,
            connected: Boolean(data?.connected || data?.printer_status?.flags?.operational || data?.printer_status?.flags?.printing || data?.printer_status?.flags?.paused || data?.printer_status?.flags?.ready),
            printing: data?.printer_status?.printing ?? next[idx].printing,
            completion: typeof data?.progress?.completion === 'number' ? data.progress.completion : next[idx].completion,
            temperature: {
              // 익스트루더: actual/offset
              tool_actual: typeof tool?.actual === 'number' ? tool.actual : next[idx].temperature.tool_actual,
              tool_target: typeof tool?.offset === 'number' ? tool.target : next[idx].temperature.tool_target,
              // 히팅베드: actual/offset
              bed_actual: typeof bed?.actual === 'number' ? bed.actual : next[idx].temperature.bed_actual,
              bed_target: typeof bed?.offset === 'number' ? bed.target : next[idx].temperature.bed_target,
            },
            print_time_left: data?.progress?.print_time_left ?? next[idx].print_time_left,
            current_file: data?.printer_status?.current_file ?? next[idx].current_file,
          };
        }
        return next;
      });
    });
    return () => {
      off();
      Object.values(timeouts).forEach(t => { try { clearTimeout(t); } catch {} });
    };
  }, [printers.length]);

  // 구독 로직은 로그인 시 shared에서 처리됨

  // 필터링된 프린터 목록
  const filteredPrinters = selectedGroup === "all" 
    ? printers 
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
            <p className="mt-4 text-muted-foreground">프린터 데이터를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* 로그인 안내 */}
        {!user && (
          <Alert className="bg-primary/10 border-primary">
            <LogIn className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>프린터 상세 모니터링 및 제어 기능을 사용하려면 로그인이 필요합니다.</span>
              <Button asChild size="sm" className="ml-4">
                <Link to="/auth">
                  <LogIn className="h-3 w-3 mr-1" />
                  로그인
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* 그룹 필터링 */}
        {user && groups.length > 0 && (
          <div className="flex items-center gap-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">그룹별 필터:</span>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 프린터</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      {group.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 통계 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-2xl font-bold text-primary">{summary.total}</div>
              <div className="text-sm text-muted-foreground">총 프린터</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-2xl font-bold text-success">{summary.connected}</div>
              <div className="text-sm text-muted-foreground">연결됨</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-2xl font-bold text-primary">{summary.printing}</div>
              <div className="text-sm text-muted-foreground">프린팅 중</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-2xl font-bold text-destructive">{summary.error}</div>
              <div className="text-sm text-muted-foreground">오류</div>
            </CardContent>
          </Card>
        </div>

        {/* 프린터 목록 */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">
              프린터 목록 
              {selectedGroup !== "all" && (
                <span className="text-lg font-normal text-muted-foreground ml-2">
                  - {groups.find(g => g.id === selectedGroup)?.name}
                </span>
              )}
            </h2>
            <Button asChild variant="outline" className="flex items-center gap-2">
              <Link to="/settings">
                <Settings className="h-4 w-4" />
                관리
              </Link>
            </Button>
          </div>
          
          {filteredPrinters.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">프린터가 없습니다</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {selectedGroup === "all" 
                    ? "아직 등록된 프린터가 없습니다." 
                    : "이 그룹에 속한 프린터가 없습니다."
                  }
                </p>
                {user && (
                  <Button asChild>
                    <Link to="/settings">
                      <Plus className="h-4 w-4 mr-2" />
                      프린터 추가
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPrinters.map((printer) => {
                return (
                  <PrinterCard key={printer.id} printer={printer} isAuthenticated={!!user} />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;