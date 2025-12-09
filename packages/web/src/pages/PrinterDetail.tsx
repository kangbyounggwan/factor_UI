import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Wifi, WifiOff, LayoutGrid, Activity, Thermometer, Camera, Code, FolderOpen, FileCode, Eye, Loader2 } from "lucide-react";
import { CameraFeed } from "@/components/PrinterDetail/CameraFeed";
import { PrinterControlPad } from "@/components/PrinterDetail/PrinterControlPad";
import { PrinterStatusCard } from "@/components/PrinterDetail/PrinterStatusCard";
import { TemperatureChart } from "@/components/PrinterDetail/TemperatureChart";
import { GCodeUpload } from "@/components/PrinterDetail/GCodeUpload";
import { GCodeViewerCanvas } from "@/components/PrinterDetail/GCodeViewerCanvas";
import { PrintHistory } from "@/components/PrinterDetail/PrintHistory";
import { useAuth } from "@shared/contexts/AuthContext";
import { supabase } from "@shared/integrations/supabase/client"
import { onDashStatusMessage } from "@shared/services/mqttService";
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
    file_name?: string;
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
    filament_used: 0,
    file_name: undefined
  },
  settings: {
    feedrate: 100,
    flowrate: 100,
    fan_speed: 0
  }
};


// 온도 히스토리 데이터 포인트 타입
interface HistoryDataPoint {
  time: string;
  toolTemp: number;
  toolTarget: number;
  bedTemp: number;
  bedTarget: number;
}

const PrinterDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const storageKey = `printer:detail:${id ?? 'unknown'}`;
  const hasSnapshot = typeof window !== 'undefined' ? !!localStorage.getItem(storageKey) : false;
  const [data, setData] = usePersistentState<MonitoringData>(storageKey, defaultData);
  const [loading, setLoading] = useState(!hasSnapshot);
  const { user } = useAuth();
  const { toast } = useToast();

  // MQTT WebSocket 연결 상태는 사용하지 않음 - 프린터의 connected 상태만 사용
  const [deviceUuid, setDeviceUuid] = useState<string | null>(null);
  const [printerName, setPrinterName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'monitoring' | 'files'>('all');
  const [temperatureHistory, setTemperatureHistory] = useState<HistoryDataPoint[]>([]);

  // 카메라/G-code 뷰어 모드
  const [viewMode, setViewMode] = useState<'camera' | 'gcode'>('camera');
  const [currentGCodeContent, setCurrentGCodeContent] = useState<string | null>(null);

  // 클라우드 GCode 파일 관리
  interface CloudGCodeFile {
    id: string;
    filename: string;
    file_path: string;
    file_size: number;
    created_at: string;
  }
  const [cloudGCodeFiles, setCloudGCodeFiles] = useState<CloudGCodeFile[]>([]);
  const [loadingCloudFiles, setLoadingCloudFiles] = useState(false);
  const [selectedCloudFile, setSelectedCloudFile] = useState<CloudGCodeFile | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [loadingFileContent, setLoadingFileContent] = useState(false);

  // 클라우드 GCode 파일 목록 로드
  const loadCloudFiles = async () => {
    if (!user) return;
    setLoadingCloudFiles(true);
    try {
      const { data: files, error } = await supabase
        .from('gcode_files')
        .select('id, filename, file_path, file_size, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[PrinterDetail] Cloud files load error:', error);
        toast({
          title: t('printerDetail.fileLoadError'),
          variant: 'destructive'
        });
        return;
      }

      setCloudGCodeFiles(files || []);
      console.log('[PrinterDetail] Cloud GCode files loaded:', files?.length || 0);
    } catch (err) {
      console.error('[PrinterDetail] Cloud files load exception:', err);
    } finally {
      setLoadingCloudFiles(false);
    }
  };

  // 선택한 파일 내용 로드
  const loadFileContent = async (file: CloudGCodeFile) => {
    setSelectedCloudFile(file);
    setLoadingFileContent(true);
    setSelectedFileContent(null);
    try {
      const { data: fileData, error } = await supabase.storage
        .from('gcode-files')
        .download(file.file_path);

      if (error) {
        console.error('[PrinterDetail] File download error:', error);
        toast({
          title: t('printerDetail.fileDownloadError'),
          variant: 'destructive'
        });
        return;
      }

      const content = await fileData.text();
      setSelectedFileContent(content);
      console.log(`[PrinterDetail] File content loaded: ${file.filename} (${content.length} bytes)`);
    } catch (err) {
      console.error('[PrinterDetail] File content load exception:', err);
    } finally {
      setLoadingFileContent(false);
    }
  };

  // 프린터 연결 상태 (대시보드에서 전달받거나 MQTT로 업데이트됨)
  const printerConnected = data.printerStatus.connected;

  // 파일 탭 활성화 시 클라우드 파일 로드
  useEffect(() => {
    if (activeTab === 'files' && cloudGCodeFiles.length === 0) {
      loadCloudFiles();
    }
  }, [activeTab]);

  // DB에서 온도 히스토리 로드 + Realtime 구독
  useEffect(() => {
    if (!id) return;

    const loadTemperatureHistory = async () => {
      try {
        console.log('[PrinterDetail] 🔄 Loading temperature history from printer_temperature_logs...');

        // printer_temperature_logs에서 최근 30분 데이터 로드 (최대 800개)
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        const { data: logs, error } = await supabase
          .from('printer_temperature_logs')
          .select('*')
          .eq('printer_id', id)
          .gte('recorded_at', thirtyMinsAgo)
          .order('recorded_at', { ascending: true })
          .limit(800);

        if (!error && logs && logs.length > 0) {
          const historyData = logs.map((log: any) => {
            const date = new Date(log.recorded_at);
            return {
              time: `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`,
              toolTemp: log.nozzle_temp || 0,
              toolTarget: log.nozzle_target || 0,
              bedTemp: log.bed_temp || 0,
              bedTarget: log.bed_target || 0
            };
          });
          setTemperatureHistory(historyData);
          console.log('[PrinterDetail] ✅ 온도 히스토리 로드 완료:', historyData.length, '개 (최근 30분)');
        } else {
          console.log('[PrinterDetail] ℹ️  No temperature history found');
        }
      } catch (error) {
        console.error('[PrinterDetail] 온도 히스토리 로드 예외:', error);
      }
    };

    loadTemperatureHistory();

    // Supabase Realtime 구독 (printer_temperature_logs INSERT 이벤트)
    console.log(`[PrinterDetail] 📡 Starting Realtime subscription for printer ${id}`);

    const channel = supabase
      .channel(`printer_temp_logs:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'printer_temperature_logs',
          filter: `printer_id=eq.${id}`,
        },
        (payload) => {
          const log = payload.new as any;
          const date = new Date(log.recorded_at);
          const timeStr = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

          const newPoint = {
            time: timeStr,
            toolTemp: log.nozzle_temp || 0,
            toolTarget: log.nozzle_target || 0,
            bedTemp: log.bed_temp || 0,
            bedTarget: log.bed_target || 0,
          };

          setTemperatureHistory(prev => {
            const updated = [...prev, newPoint];
            // 최근 30분(1800개) 데이터만 유지
            return updated.slice(-1800);
          });

          console.log('[PrinterDetail] 🔥 Realtime 온도 데이터 수신:', newPoint);
        }
      )
      .subscribe((status) => {
        console.log(`[PrinterDetail] 📡 Realtime subscription status:`, status);
      });

    return () => {
      channel.unsubscribe();
      console.log('[PrinterDetail] Realtime 구독 해제');
    };
  }, [id]);

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

  // 실제 프린터 데이터 로드
  useEffect(() => {
    if (id && user) {
      loadPrinterData(!hasSnapshot);
    }
  }, [id, user]);

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

      // 프린터 이름 설정
      const printerWithName = printer as typeof printer & { name?: string };
      setPrinterName(printerWithName?.name || '프린터');

      // DB 상태를 항상 우선 적용 (DB가 source of truth)
      setData((prev) => {
        const dbStatus = printer.status as MonitoringData['printerStatus']['state'];
        const isConnected = dbStatus !== 'disconnected';
        const isPrinting = dbStatus === 'printing';

        console.log('[웹 PrinterDetail] DB 상태 적용:', {
          dbStatus,
          isConnected,
          isPrinting,
          hasSnapshot
        });

        return {
          ...prev,
          printerStatus: {
            ...prev.printerStatus,
            state: dbStatus ?? prev.printerStatus.state,
            timestamp: Date.now(),
            connected: isConnected,
            printing: isPrinting,
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
        flags: payload?.printer_status?.flags,
        job: payload?.job,
        progress: payload?.progress,
        fullPayload: payload
      });

      // 온도 히스토리 수집 및 세션 기반 배치 저장
      const bed = payload?.temperature_info?.bed;
      const toolAny = payload?.temperature_info?.tool;
      const tool = toolAny?.tool0 ?? toolAny;

      if (tool?.actual !== undefined || bed?.actual !== undefined) {
        const now = new Date();
        const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

        // ✅ 온도 데이터 저장은 WebSocket Proxy Server → Edge Function에서 자동 처리
        // 클라이언트는 UI 업데이트용 로컬 히스토리만 유지

        // 로컬 히스토리 업데이트 (최근 30분 데이터만 유지)
        setTemperatureHistory(prev => {
          const newPoint: HistoryDataPoint = {
            time: timeStr,
            toolTemp: tool?.actual || 0,
            toolTarget: tool?.target || 0,
            bedTemp: bed?.actual || 0,
            bedTarget: bed?.target || 0
          };
          const updated = [...prev, newPoint];
          // 30분(1800초) 이전 데이터는 제거 (1초마다 데이터 수집 시 최대 1800개)
          return updated.slice(-1800);
        });
      }

      setData((prev) => {
        const flags = payload?.printer_status?.flags as Record<string, unknown>;

        // DB 상태를 기준으로 사용 (prev.printerStatus.state는 DB에서 로드된 값)
        // MQTT 메시지가 왔다는 것은 연결되어 있다는 의미이므로 connected는 true로 설정
        const isConnected = payload?.connected === true || Boolean(
          flags && (flags.operational || flags.printing || flags.paused || flags.ready || flags.error)
        );

        // DB 상태 기준으로 printing 여부 판단
        const isPrinting = prev.printerStatus.state === 'printing' || Boolean(flags?.printing);

        console.log('[웹 PrinterDetail] MQTT 업데이트 (DB 상태 기준):', {
          dbState: prev.printerStatus.state,
          isConnected,
          isPrinting,
          flags,
          progress: payload?.progress?.completion
        });

        return {
          ...prev,
          printerStatus: {
            // DB 상태 유지 (DB가 source of truth)
            state: prev.printerStatus.state,
            timestamp: Date.now(),
            connected: isConnected,
            printing: isPrinting,
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
          // printing일 때만 진행률 업데이트
          printProgress: isPrinting ? {
            active: Boolean(payload?.progress?.active ?? prev.printProgress.active),
            completion: typeof payload?.progress?.completion === 'number' ? payload.progress.completion : prev.printProgress.completion,
            file_position: payload?.progress?.file_position ?? prev.printProgress.file_position,
            file_size: payload?.progress?.file_size ?? prev.printProgress.file_size,
            print_time: payload?.progress?.print_time ?? prev.printProgress.print_time,
            print_time_left: payload?.progress?.print_time_left ?? prev.printProgress.print_time_left,
            filament_used: payload?.progress?.filament_used ?? prev.printProgress.filament_used,
            file_name: payload?.printer_status?.current_file ??
                       payload?.job?.file?.name ??
                       payload?.job?.file?.display ??
                       payload?.job?.file?.path ??
                       payload?.progress?.file_name ??
                       payload?.current?.file?.name ??
                       payload?.current?.file?.display ??
                       prev.printProgress.file_name,
          } : prev.printProgress,
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

  // 현재 출력 중인 파일의 G-code 자동 로드
  useEffect(() => {
    const fileName = data.printProgress.file_name;

    console.log('[PrinterDetail] G-code 자동 로드 체크:', {
      fileName,
      printing: data.printerStatus.printing,
      deviceUuid,
      hasContent: !!currentGCodeContent
    });

    // 출력 중이고 파일명이 있을 때만 로드
    if (!fileName || !data.printerStatus.printing || !deviceUuid) {
      console.log('[PrinterDetail] G-code 로드 스킵 - 조건 미충족');
      return;
    }

    // 이미 로드된 파일인지 확인 (불필요한 재로드 방지)
    if (currentGCodeContent) {
      console.log('[PrinterDetail] G-code 이미 로드됨');
      return;
    }

    // DB에서 short_filename으로 G-code 파일 찾기
    const loadGCode = async () => {
      try {
        console.log(`[PrinterDetail] 🔍 DB에서 G-code 파일 검색: ${fileName}`);

        // 1. gcode_files 테이블에서 short_filename으로 검색
        const { data: gcodeFiles, error: dbError } = await supabase
          .from('gcode_files')
          .select('file_path')
          .eq('short_filename', fileName)
          .limit(1);

        if (dbError) {
          console.error('[PrinterDetail] DB 조회 실패:', dbError);
          return;
        }

        if (!gcodeFiles || gcodeFiles.length === 0) {
          console.log('[PrinterDetail] ❌ DB에 해당 파일 없음:', fileName);
          console.log('[PrinterDetail] 💡 AI로 생성된 G-code만 뷰어에서 볼 수 있습니다.');
          return;
        }

        const filePath = gcodeFiles[0].file_path;
        console.log(`[PrinterDetail] ✅ DB에서 파일 경로 찾음: ${filePath}`);

        // 2. Supabase Storage에서 파일 다운로드
        // 경로: {userId}/{modelId}/{modelName}/{shortFileName}.gcode
        const { data: fileData, error: storageError } = await supabase.storage
          .from('gcode-files')
          .download(filePath);

        if (storageError) {
          console.error('[PrinterDetail] Storage 다운로드 실패:', storageError);
          return;
        }

        const content = await fileData.text();
        setCurrentGCodeContent(content);
        console.log(`[PrinterDetail] ✅ G-code 로드 성공: ${fileName} (${content.length} bytes)`);
      } catch (err) {
        console.error('[PrinterDetail] G-code 로드 에러:', err);
      }
    };

    loadGCode();
  }, [data.printProgress.file_name, data.printerStatus.printing, deviceUuid, currentGCodeContent]);

  return (
    <div className="bg-background min-h-screen">
      <div className="w-full mx-auto">
        {/* 상단 헤더 바 */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center justify-between px-6 py-3">
            {/* 왼쪽: 뒤로가기 + 프린터 정보 + 연결 상태 */}
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link to="/dashboard">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">{printerName || t('printerDetail.defaultPrinterName')}</h1>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{deviceUuid ? `${deviceUuid.substring(0, 8)}...` : 'N/A'}</span>
                </div>
              </div>
              {data.printerStatus.connected ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                  <Wifi className="h-3 w-3" />
                  <span className="text-xs font-medium">{t('printerDetail.connected')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  <WifiOff className="h-3 w-3" />
                  <span className="text-xs font-medium">{t('printerDetail.disconnected')}</span>
                </div>
              )}
            </div>

            {/* 오른쪽: 온도 정보 */}
            <div className="flex items-center gap-3">
              {/* 베드 온도 */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <Thermometer className="h-4 w-4 text-red-600 dark:text-red-400" />
                <div className="text-sm">
                  <span className="font-bold text-red-600 dark:text-red-400">
                    {data.temperature.bed.actual.toFixed(0)}°C
                  </span>
                  {data.temperature.bed.target > 0 && (
                    <span className="text-muted-foreground ml-0.5">
                      / {data.temperature.bed.target}°C
                    </span>
                  )}
                </div>
              </div>
              {/* 노즐 온도 */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Thermometer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div className="text-sm">
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {data.temperature.tool.actual.toFixed(0)}°C
                  </span>
                  {data.temperature.tool.target > 0 && (
                    <span className="text-muted-foreground ml-0.5">
                      / {data.temperature.tool.target}°C
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 메인 컨텐츠 - 사이드바와 컨텐츠 */}
        <div className="flex">
          {/* 왼쪽 사이드바 */}
          <div className="w-64 border-r bg-muted/10 min-h-screen">
            <div className="p-4 space-y-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <LayoutGrid className="h-5 w-5" />
                <span className="font-medium">{t('printerDetail.monitoring')}</span>
              </button>
              <button
                onClick={() => setActiveTab('monitoring')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'monitoring'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <Activity className="h-5 w-5" />
                <span className="font-medium">{t('printerDetail.history')}</span>
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'files'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <FolderOpen className="h-5 w-5" />
                <span className="font-medium">{t('printerDetail.fileManagement')}</span>
              </button>
            </div>
          </div>

          {/* 오른쪽 컨텐츠 */}
          <div className="flex-1 px-8 py-6 flex justify-center">
            <div className="w-[80%] space-y-6">
              {activeTab === 'all' ? (
                <>
                  {/* 상단: 카메라/G-code 뷰어 + 상태 카드 */}
                  <div className="grid grid-cols-3 gap-6">
                    {/* 왼쪽: 카메라 피드 / G-code 뷰어 */}
                    <div className="col-span-2">
                      <div className="relative h-[640px] rounded-2xl overflow-hidden bg-card border border-border/50 shadow-lg">
                        {/* 탭 토글 - 모던 세그먼트 스타일 */}
                        <div className="absolute top-0 left-0 right-0 z-10 px-4 py-3 bg-gradient-to-b from-background/95 to-background/80 backdrop-blur-md">
                          <div className="inline-flex rounded-xl bg-muted/50 p-1.5">
                            <button
                              onClick={() => setViewMode('camera')}
                              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                viewMode === 'camera'
                                  ? 'bg-background shadow-md text-foreground'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <Camera className="h-4 w-4" />
                              카메라
                            </button>
                            <button
                              onClick={() => setViewMode('gcode')}
                              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                viewMode === 'gcode'
                                  ? 'bg-background shadow-md text-foreground'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <Code className="h-4 w-4" />
                              G-code 뷰어
                            </button>
                          </div>
                        </div>

                        {/* 컨텐츠 영역 */}
                        <div className="h-full pt-[60px]">
                          {viewMode === 'camera' ? (
                            <div className="relative h-full">
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
                          ) : (
                            <GCodeViewerCanvas
                              gcodeContent={currentGCodeContent || undefined}
                              bedSize={{ x: 220, y: 220 }}
                              printProgress={data.printProgress.completion * 100}
                              className="h-full"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 오른쪽: 상태 표시 카드 */}
                    <div className="col-span-1">
                      <div className="h-[640px] flex flex-col gap-4">
                        {/* 상태 표시 카드 */}
                        <PrinterStatusCard
                          isPrinting={data.printerStatus.printing}
                          isConnected={data.printerStatus.connected}
                          completion={data.printProgress.completion}
                        />

                        {/* 프린터 컨트롤 패드 */}
                        <div className="relative flex-1 overflow-auto">
                          <PrinterControlPad
                            isConnected={printerConnected}
                            isPrinting={data.printerStatus.printing}
                            deviceUuid={deviceUuid}
                            temperature={data.temperature}
                            currentFeedrate={data.settings.feedrate}
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
                  </div>

                  {/* 하단: 온도 그래프 + G-code 파일 관리 */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="col-span-2">
                      <TemperatureChart data={temperatureHistory} />
                    </div>
                    <div className="col-span-1">
                      <div className="relative h-[380px] space-y-3 overflow-y-auto">
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
                </>
              ) : activeTab === 'monitoring' ? (
                /* 히스토리 탭 */
                <div className="h-[calc(100vh-180px)]">
                  <PrintHistory printerId={id || ''} className="h-full" />
                </div>
              ) : (
                /* 파일 관리 탭 */
                <div className="h-[calc(100vh-180px)]">
                  <div className="grid grid-cols-3 gap-6 h-full">
                    {/* 왼쪽: 파일 목록 */}
                    <div className="col-span-1 bg-card rounded-xl border border-border/50 shadow-lg overflow-hidden flex flex-col">
                      <div className="p-4 border-b border-border/50 flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                          <FolderOpen className="h-5 w-5" />
                          {t('printerDetail.cloudFiles')}
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={loadCloudFiles}
                          disabled={loadingCloudFiles}
                        >
                          {loadingCloudFiles ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            t('common.refresh')
                          )}
                        </Button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2">
                        {loadingCloudFiles ? (
                          <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : cloudGCodeFiles.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                            <FileCode className="h-8 w-8 mb-2" />
                            <p className="text-sm">{t('printerDetail.noCloudFiles')}</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {cloudGCodeFiles.map((file) => (
                              <button
                                key={file.id}
                                onClick={() => loadFileContent(file)}
                                className={`w-full text-left p-3 rounded-lg transition-colors ${
                                  selectedCloudFile?.id === file.id
                                    ? 'bg-primary/10 border border-primary/30'
                                    : 'hover:bg-muted'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <FileCode className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{file.filename}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {(file.file_size / 1024).toFixed(1)} KB • {new Date(file.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 오른쪽: GCode 뷰어 */}
                    <div className="col-span-2 bg-card rounded-xl border border-border/50 shadow-lg overflow-hidden flex flex-col">
                      <div className="p-4 border-b border-border/50 flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Eye className="h-5 w-5" />
                          {selectedCloudFile ? selectedCloudFile.filename : t('printerDetail.gcodeViewer')}
                        </h3>
                        {selectedCloudFile && (
                          <Badge variant="outline" className="text-xs">
                            {(selectedCloudFile.file_size / 1024).toFixed(1)} KB
                          </Badge>
                        )}
                      </div>
                      <div className="flex-1 relative min-h-[500px]">
                        {loadingFileContent ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </div>
                        ) : selectedFileContent ? (
                          <GCodeViewerCanvas
                            gcodeContent={selectedFileContent}
                            bedSize={{ x: 220, y: 220 }}
                            className="h-full w-full"
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                            <FileCode className="h-16 w-16 mb-4 opacity-30" />
                            <p className="text-lg">{t('printerDetail.selectFileToView')}</p>
                            <p className="text-sm">{t('printerDetail.selectFileToViewDesc')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrinterDetail;