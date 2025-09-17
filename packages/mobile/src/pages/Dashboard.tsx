import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Monitor, Settings, Activity, LogIn, Filter, Plus, Thermometer } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { onDashStatusMessage } from "@shared/services/mqttService";
import { getUserPrinterGroups, getUserPrintersWithGroup } from "@shared/services/supabaseService/printerList";
import { mqttConnect, publishDashboardGetStatus } from "@shared/services/mqttService";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface PrinterOverview {
  id: string;
  model: string;
  group_id?: string;
  group?: PrinterGroup;
  state: "idle" | "printing" | "paused" | "error" | "connecting" | "disconnected";
  connected: boolean;
  printing: boolean;
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
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
};

const PrinterCard = ({ printer, isAuthenticated }: { printer: PrinterOverview; isAuthenticated: boolean }) => {
  const config = statusConfig[printer.state];
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const percent = printer.completion ? Math.round(printer.completion * 100) : 0;

  const goDetail = () => navigate(isAuthenticated ? `/printer/${printer.id}` : '/auth');

  return (
    <Card className="hover:shadow-md transition-all duration-200" onClick={goDetail}>
      {/* 기본 헤더: 이름/연결상태/진행률 + 토글 */}
      <div className="flex items-start justify-between p-4 pb-2">
        <div className="min-w-0 pr-3">
          <div className="text-base font-semibold truncate">{printer.model}</div>
          <div className="text-xs text-muted-foreground truncate">{printer.model}</div>
          {printer.group && (
            <div className="flex items-center gap-1 mt-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: printer.group.color }} />
              <span className="text-xs text-muted-foreground">{printer.group.name}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${printer.connected ? 'bg-success' : 'bg-destructive'}`} />
          <Badge className={config.color}>{config.label}</Badge>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={(e)=>{ e.stopPropagation(); setOpen(!open); }}>{open ? '접기' : '자세히'}</Button>
        </div>
      </div>

      {/* 기본: 진행률 바 */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground flex items-center gap-1"><Activity className="h-4 w-4" />진행률</span>
          <span className="text-base font-bold text-primary">{percent}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {/* 펼쳤을 때 상세 */}
      {open && (
        <div className="px-4 pb-4 border-t pt-3" onClick={(e)=>e.stopPropagation()}>
          <div className="text-xs text-muted-foreground space-y-1 mb-3">
            <div className="truncate">📁 {printer.current_file || '파일 없음'}</div>
            <div className="flex justify-between"><span>남은 시간:</span><span className="font-medium">{printer.print_time_left ? formatTime(printer.print_time_left) : '0분'}</span></div>
          </div>
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between items-center"><span className="text-muted-foreground flex items-center gap-1 flex-shrink-0"><Thermometer className="h-3 w-3" />익스트루더:</span><span className="font-mono text-xs text-right">{printer.temperature.tool_actual?.toFixed(0) || 0}°C{printer.temperature.tool_target > 0 && ` / ${printer.temperature.tool_target.toFixed(0)}°C`}</span></div>
              <div className="flex justify-between items-center"><span className="text-muted-foreground flex-shrink-0">히팅베드:</span><span className="font-mono text-xs text-right">{printer.temperature.bed_actual?.toFixed(0) || 0}°C{printer.temperature.bed_target > 0 && ` / ${printer.temperature.bed_target.toFixed(0)}°C`}</span></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center"><span className="text-muted-foreground flex-shrink-0">연결상태:</span><span className={`font-medium text-xs ${printer.connected ? 'text-success' : 'text-destructive'}`}>{printer.connected ? '연결됨' : '연결끊김'}</span></div>
              <div className="flex justify-between items-center"><span className="text-muted-foreground flex-shrink-0">프린팅:</span><span className={`font-medium text-xs ${printer.printing ? 'text-primary' : 'text-muted-foreground'}`}>{printer.printing ? '진행중' : '중지'}</span></div>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">카드를 탭하면 상세로 이동</div>
        </div>
      )}
    </Card>
  );
};

const Home = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [printers, setPrinters] = usePersistentState<PrinterOverview[]>('dashboard:printers', []);
  const [groups, setGroups] = useState<PrinterGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [loading, setLoading] = useState(printers.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

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

  // 프린터 데이터 로드 - shared 서비스 사용
  const loadPrinters = useCallback(async (showSpinner?: boolean) => {
    console.log('loadPrinters 함수 시작:', { user: !!user, showSpinner, printersLength: printers.length });
    if (!user) {
      console.log('user가 없어서 빈 배열 설정');
      setPrinters([]);
      setLoading(false);
      return;
    }
    try {
      if (showSpinner ?? printers.length === 0) setLoading(true);
      
      console.log('shared 서비스로 데이터 조회 시작');
      // shared 서비스 사용
      const groupsData = await getUserPrinterGroups(user.id);
      console.log('그룹 데이터 조회 완료:', groupsData.length);
      setGroups(groupsData);

      const printersData = await getUserPrintersWithGroup(user.id);
      console.log('프린터 데이터 조회 완료:', printersData.length);

      const formattedPrinters: PrinterOverview[] = printersData.map(printer => {
        const isConnected = printer.status === 'connected' || printer.status === 'printing' || printer.status === 'idle';
        const isPrinting = printer.status === 'printing';
        const state = printer.status as PrinterOverview['state'];
        return {
          id: printer.id,
          model: printer.model,
          group_id: printer.group_id,
          group: printer.group,
          state: state,
          connected: isConnected,
          printing: isPrinting,
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
    } catch (error) {
      console.error('Error loading printers:', error);
    } finally {
      if (showSpinner ?? printers.length === 0) setLoading(false);
      setRefreshing(false);
    }
  }, [user, printers.length, setPrinters]);

  // 프린터 데이터가 복원되면 로딩 상태 업데이트
  useEffect(() => {
    if (printers.length > 0 && loading) {
      console.log('프린터 데이터 복원됨, 로딩 상태 해제');
      setLoading(false);
    }
  }, [printers.length, loading]);

  // 초기 로드
  useEffect(() => {
    console.log('모바일 대시보드 useEffect 실행:', { user: !!user, printersLength: printers.length });
    if (!user) {
      console.log('user가 없어서 return');
      return;
    }
    if (printers.length > 0) {
      console.log('프린터 데이터가 이미 있어서 return');
      console.log(setPrinters)
      return;
    }
    console.log('모바일 대시보드 loadPrinters 실행@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@');
    loadPrinters();
  }, [user, printers.length, loadPrinters]);

  // MQTT: dash_status 수신 → 프린터 카드에 반영
  useEffect(() => {
    const off = onDashStatusMessage((uuid, data) => {
      setPrinters((prev) => {
        const next = [...prev];
        const idx = next.findIndex(p => p.device_uuid === uuid);
        if (idx >= 0) {
          const bed = data?.temperature_info?.bed;
          const toolAny = data?.temperature_info?.tool;
          const tool = toolAny?.tool0 ?? toolAny;
          next[idx] = {
            ...next[idx],
            connected: data?.connected ?? next[idx].connected,
            printing: data?.printer_status?.printing ?? next[idx].printing,
            completion: typeof data?.progress?.completion === 'number' ? data.progress.completion : next[idx].completion,
            temperature: {
              tool_actual: typeof tool?.actual === 'number' ? tool.actual : next[idx].temperature.tool_actual,
              tool_target: typeof tool?.offset === 'number' ? tool.offset : next[idx].temperature.tool_target,
              bed_actual: typeof bed?.actual === 'number' ? bed.actual : next[idx].temperature.bed_actual,
              bed_target: typeof bed?.offset === 'number' ? bed.offset : next[idx].temperature.bed_target,
            },
            print_time_left: data?.progress?.print_time_left ?? next[idx].print_time_left,
            current_file: data?.printer_status?.current_file ?? next[idx].current_file,
          };
        }
        return next;
      });
    });
    return () => { off(); };
  }, []);


  // 대시보드 이탈 시 stop 전송 제거 (세션 종료 시에만 stop 전송)

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
    <div
      ref={containerRef}
      className="bg-background p-6 min-h-[100dvh] overflow-y-auto"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="max-w-7xl mx-auto">
        <div
          className="h-10 flex items-center justify-center text-xs text-muted-foreground"
          style={{ height: `${Math.max(0, pullY)}px`, transition: pullingRef.current ? 'none' : 'height 150ms ease' }}
        >
          {refreshing ? '새로고치는 중...' : (pullY >= PTR_THRESHOLD ? '놓으면 새로고침' : (pullY > 0 ? '당겨서 새로고침' : ''))}
        </div>
      </div>

      <div ref={contentRef} className="max-w-7xl mx-auto space-y-6 pb-6" style={{ transform: `translateY(${pullY}px)`, transition: pullingRef.current ? 'none' : 'transform 150ms ease' }}>
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
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 프린터</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                      {group.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 통계 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-2xl font-bold text-primary">{summary.total}</div>
              <div className="text-sm text-muted-foreground">총 프린터</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-2xl font-bold text-primary">{summary.printing}</div>
              <div className="text-sm text-muted-foreground">프린팅 중</div>
            </CardContent>
          </Card>
        </div>

        {/* 상세 카드: 접기/펼치기 */}
        <Accordion type="single" collapsible defaultValue={undefined}>
          <AccordionItem value="details">
            <AccordionTrigger className="text-sm">상세 카드 보기</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <div className="text-2xl font-bold text-success">{summary.connected}</div>
                  <div className="text-sm text-muted-foreground">연결됨</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <div className="text-2xl font-bold text-destructive">{summary.error}</div>
                  <div className="text-sm text-muted-foreground">오류</div>
                </CardContent>
              </Card>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* 프린터 목록 */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">프린터 목록 {selectedGroup !== "all" && (<span className="text-lg font-normal text-muted-foreground ml-2">- {groups.find(g => g.id === selectedGroup)?.name}</span>)}</h2>
            <Button asChild variant="outline" className="flex items-center gap-2"><Link to="/settings"><Settings className="h-4 w-4" />관리</Link></Button>
          </div>
          {filteredPrinters.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">프린터가 없습니다</h3>
                <p className="text-muted-foreground text-center mb-4">{selectedGroup === "all" ? "아직 등록된 프린터가 없습니다." : "이 그룹에 속한 프린터가 없습니다."}</p>
                {user && (<Button asChild><Link to="/settings"><Plus className="h-4 w-4 mr-2" />프린터 추가</Link></Button>)}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPrinters.map((printer) => (<PrinterCard key={printer.id} printer={printer} isAuthenticated={!!user} />))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;