import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Camera, Code, FolderOpen, FileCode, Eye, Loader2, Trash2, Pencil, MoreVertical, Check, Upload, Copy, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { AppHeader } from "@/components/common/AppHeader";
import { AppSidebar } from "@/components/common/AppSidebar";
import { PrinterDetailSidebarContent, PrinterDetailTab } from "@/components/sidebar";
import { useSidebarState } from "@/hooks/useSidebarState";
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
import { CameraFeed } from "@/components/PrinterDetail/CameraFeed";
import { PrinterControlPad } from "@/components/PrinterDetail/PrinterControlPad";
import { PrinterStatusCard } from "@/components/PrinterDetail/PrinterStatusCard";
import { TemperatureChart } from "@/components/PrinterDetail/TemperatureChart";
import { GCodeUpload } from "@/components/PrinterDetail/GCodeUpload";
import { GCodeViewerCanvas } from "@/components/PrinterDetail/GCodeViewerCanvas";
import { PrintHistory } from "@/components/PrinterDetail/PrintHistory";
import { PrinterSettingsTab } from "@/components/PrinterDetail/PrinterSettingsTab";
import { useAuth } from "@shared/contexts/AuthContext";
import { supabase } from "@shared/integrations/supabase/client"
import { onDashStatusMessage, mqttConnect, publishSdUploadChunkFirst, publishSdUploadChunk, publishSdUploadCommit, waitForGCodeUploadResult } from "@shared/services/mqttService";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";


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
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  // 사이드바 상태 (페이지 간 공유)
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarState(true);
  const isMobile = useIsMobile();

  // MQTT WebSocket 연결 상태는 사용하지 않음 - 프린터의 connected 상태만 사용
  const [deviceUuid, setDeviceUuid] = useState<string | null>(null);
  const [printerName, setPrinterName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<PrinterDetailTab>('all');
  const [temperatureHistory, setTemperatureHistory] = useState<HistoryDataPoint[]>([]);

  // 카메라/G-code 뷰어 모드
  const [viewMode, setViewMode] = useState<'camera' | 'gcode'>('camera');
  const [currentGCodeContent, setCurrentGCodeContent] = useState<string | null>(null);

  // GCode 뷰어 진행률 - ref로 관리하여 MQTT 업데이트 시 리렌더링 방지
  const printProgressRef = useRef<number>(0);

  // 클라우드 GCode 파일 관리
  interface CloudGCodeFile {
    id: string;
    filename: string;
    file_path: string;
    file_size: number;
    created_at: string;
    // 프린터 호환성 정보
    manufacturer?: string | null;
    series?: string | null;
    printer_model_name?: string | null;
  }
  const [cloudGCodeFiles, setCloudGCodeFiles] = useState<CloudGCodeFile[]>([]);

  // 현재 프린터의 제조사/시리즈 정보
  const [printerManufacturer, setPrinterManufacturer] = useState<string | null>(null);
  const [printerSeries, setPrinterSeries] = useState<string | null>(null);
  const [printerModelName, setPrinterModelName] = useState<string | null>(null);
  const [printerManufactureId, setPrinterManufactureId] = useState<string | null>(null);

  // 호환되지 않는 파일 전송 경고 모달
  const [incompatibleWarningOpen, setIncompatibleWarningOpen] = useState(false);
  const [incompatibleFile, setIncompatibleFile] = useState<CloudGCodeFile | null>(null);

  // 파일이 현재 프린터와 호환되는지 확인
  const isFileCompatible = (file: CloudGCodeFile): boolean => {
    // 파일에 프린터 정보가 없으면 호환 (레거시 파일 또는 직접 업로드)
    if (!file.manufacturer && !file.series) {
      return true;
    }
    // 현재 프린터에 정보가 없으면 호환 (레거시 프린터)
    if (!printerManufacturer && !printerSeries) {
      return true;
    }
    // manufacturer와 series가 일치하면 호환
    const manufacturerMatch = !file.manufacturer || !printerManufacturer ||
      file.manufacturer.toLowerCase() === printerManufacturer.toLowerCase();
    const seriesMatch = !file.series || !printerSeries ||
      file.series.toLowerCase() === printerSeries.toLowerCase();
    return manufacturerMatch && seriesMatch;
  };

  const [loadingCloudFiles, setLoadingCloudFiles] = useState(false);
  const [selectedCloudFile, setSelectedCloudFile] = useState<CloudGCodeFile | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [loadingFileContent, setLoadingFileContent] = useState(false);

  // 클라우드 파일 삭제/이름변경 상태
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<CloudGCodeFile | null>(null);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  // 클라우드→프린터 전송 상태
  const [transferringFileId, setTransferringFileId] = useState<string | null>(null);
  const [transferProgress, setTransferProgress] = useState(0);

  // 프린터에 전송된 파일 ID 목록 (세션 내에서 추적)
  const [transferredFileIds, setTransferredFileIds] = useState<Set<string>>(new Set());

  // 전송된 파일 이름변경 경고 모달 상태
  const [transferredFileWarningOpen, setTransferredFileWarningOpen] = useState(false);
  const [fileToRename, setFileToRename] = useState<CloudGCodeFile | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  // 클라우드 GCode 파일 목록 로드 (프린터 호환성 정보 포함)
  const loadCloudFiles = async () => {
    if (!user) return;
    setLoadingCloudFiles(true);
    try {
      const { data: files, error } = await supabase
        .from('gcode_files')
        .select('id, filename, file_path, file_size, created_at, manufacturer, series, printer_model_name')
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

  // GCodeUpload에서 눈 버튼 클릭 시 파일관리 탭으로 이동하고 파일 미리보기
  const handleViewFileFromUpload = async (fileId: string) => {
    // 1. 파일관리 탭으로 전환
    setActiveTab('files');

    // 2. 클라우드 파일 목록에서 해당 파일 찾기
    let targetFile = cloudGCodeFiles.find(f => f.id === fileId);

    // 3. 목록에 없으면 새로 로드
    if (!targetFile && user) {
      setLoadingCloudFiles(true);
      try {
        const { data: files, error } = await supabase
          .from('gcode_files')
          .select('id, filename, file_path, file_size, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!error && files) {
          setCloudGCodeFiles(files);
          targetFile = files.find(f => f.id === fileId);
        }
      } catch (err) {
        console.error('[PrinterDetail] File load error:', err);
      } finally {
        setLoadingCloudFiles(false);
      }
    }

    // 4. 파일을 찾으면 내용 로드
    if (targetFile) {
      loadFileContent(targetFile);
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

  // 클라우드 파일을 프린터 로컬로 전송
  const handleTransferToPrinter = async (file: CloudGCodeFile) => {
    if (!deviceUuid || !printerConnected) {
      toast({
        title: t('printerDetail.noConnection'),
        description: t('printerDetail.noConnectionDesc'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setTransferringFileId(file.id);
      setTransferProgress(5);

      // 1. Supabase Storage에서 파일 다운로드
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('gcode-files')
        .download(file.file_path);

      if (downloadError) {
        throw new Error(`Download failed: ${downloadError.message}`);
      }

      setTransferProgress(15);

      // 2. 파일 내용을 바이트 배열로 변환
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const total = bytes.length;

      // 3. MQTT 연결
      await mqttConnect();
      setTransferProgress(20);

      // 4. 청크 단위로 전송 (32KB)
      const chunkSize = 32 * 1024;
      const uploadId = `transfer_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const toB64 = (chunk: Uint8Array) => {
        let binary = '';
        for (let i = 0; i < chunk.length; i += 1) binary += String.fromCharCode(chunk[i]);
        return btoa(binary);
      };

      const sendChunk = async (index: number, start: number, end: number) => {
        const slice = bytes.subarray(start, end);
        if (index === 0) {
          await publishSdUploadChunkFirst(deviceUuid, {
            type: 'sd_upload_chunk',
            upload_id: uploadId,
            index,
            name: file.filename,
            total_size: total,
            data_b64: toB64(slice),
            size: slice.length,
            upload_traget: 'local', // 프린터 로컬에 저장
          });
        } else {
          await publishSdUploadChunk(deviceUuid, {
            type: 'sd_upload_chunk',
            upload_id: uploadId,
            index,
            data_b64: toB64(slice),
            size: slice.length,
          });
        }
      };

      let sent = 0;
      let index = 0;
      while (sent < total) {
        const next = Math.min(sent + chunkSize, total);
        await sendChunk(index, sent, next);
        sent = next;
        index += 1;
        // 20% ~ 85% 구간에서 청크 전송 진행률 표시
        setTransferProgress(20 + Math.min(65, Math.round((sent / total) * 65)));
      }

      // 5. 업로드 완료 (commit)
      await publishSdUploadCommit(deviceUuid, uploadId, 'local');
      setTransferProgress(90);

      // 6. OctoPrint 응답 대기 (60초)
      try {
        const uploadResult = await waitForGCodeUploadResult(deviceUuid, uploadId, 60000);
        setTransferProgress(100);

        if (uploadResult.success) {
          // 전송 성공 시 파일 ID 추적 (이후 이름변경 경고에 사용)
          setTransferredFileIds(prev => new Set(prev).add(file.id));
          toast({
            title: t('printerDetail.transferSuccess'),
            description: `${file.filename} → ${t('printerDetail.printerLocal')}`,
          });
        } else {
          toast({
            title: t('printerDetail.transferFailed'),
            description: uploadResult.error || t('errors.general'),
            variant: 'destructive',
          });
        }
      } catch (timeoutError) {
        // 타임아웃이어도 대부분 성공이므로 전송 파일로 추적
        setTransferredFileIds(prev => new Set(prev).add(file.id));
        setTransferProgress(100);
        toast({
          title: t('printerDetail.transferSuccess'),
          description: `${file.filename} (${t('common.responseTimeout')})`,
        });
      }

    } catch (error) {
      console.error('[PrinterDetail] Transfer error:', error);
      toast({
        title: t('printerDetail.transferFailed'),
        description: error instanceof Error ? error.message : t('errors.general'),
        variant: 'destructive',
      });
    } finally {
      // 약간의 딜레이 후 상태 초기화 (진행률 100% 표시를 위해)
      setTimeout(() => {
        setTransferringFileId(null);
        setTransferProgress(0);
      }, 1000);
    }
  };

  // 클라우드 파일 삭제
  const handleDeleteCloudFile = async () => {
    if (!fileToDelete) return;

    try {
      setIsDeleting(true);

      // 1. Supabase Storage에서 파일 삭제
      const { error: storageError } = await supabase.storage
        .from('gcode-files')
        .remove([fileToDelete.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      // 2. DB에서 메타데이터 삭제
      const { error: dbError } = await supabase
        .from('gcode_files')
        .delete()
        .eq('id', fileToDelete.id);

      if (dbError) {
        throw dbError;
      }

      toast({
        title: t('common.delete'),
        description: `${fileToDelete.filename} ${t('common.success')}`,
      });

      // 선택된 파일이 삭제된 파일이면 선택 해제
      if (selectedCloudFile?.id === fileToDelete.id) {
        setSelectedCloudFile(null);
        setSelectedFileContent(null);
      }

      // 파일 목록 새로고침
      loadCloudFiles();

    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: t('errors.general'),
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    }
  };

  // 클라우드 파일 이름 변경
  const handleRenameCloudFile = async (file: CloudGCodeFile) => {
    if (!newFileName.trim() || newFileName === file.filename) {
      setRenamingFileId(null);
      setNewFileName('');
      return;
    }

    // .gcode 확장자 확인 및 추가
    let finalName = newFileName.trim();
    if (!finalName.toLowerCase().endsWith('.gcode') && !finalName.toLowerCase().endsWith('.gco')) {
      finalName += '.gcode';
    }

    try {
      setIsRenaming(true);

      if (!user) throw new Error('User not authenticated');

      // 1. 기존 파일 다운로드
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('gcode-files')
        .download(file.file_path);

      if (downloadError) {
        throw downloadError;
      }

      // 2. 새 경로로 파일 업로드
      const pathParts = file.file_path.split('/');
      pathParts[pathParts.length - 1] = finalName;
      const newFilePath = pathParts.join('/');

      const { error: uploadError } = await supabase.storage
        .from('gcode-files')
        .upload(newFilePath, fileData, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'text/x-gcode',
        });

      if (uploadError) {
        throw uploadError;
      }

      // 3. 기존 파일 삭제 (새 경로와 다른 경우에만)
      if (file.file_path !== newFilePath) {
        await supabase.storage
          .from('gcode-files')
          .remove([file.file_path]);
      }

      // 4. DB 업데이트
      const { error: dbError } = await supabase
        .from('gcode_files')
        .update({
          filename: finalName,
          file_path: newFilePath,
        })
        .eq('id', file.id);

      if (dbError) {
        throw dbError;
      }

      toast({
        title: t('common.rename'),
        description: `${file.filename} → ${finalName}`,
      });

      // 선택된 파일이면 업데이트
      if (selectedCloudFile?.id === file.id) {
        setSelectedCloudFile({
          ...selectedCloudFile,
          filename: finalName,
          file_path: newFilePath,
        });
      }

      // 파일 목록 새로고침
      loadCloudFiles();

    } catch (error) {
      console.error('Rename error:', error);
      toast({
        title: t('errors.general'),
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsRenaming(false);
      setRenamingFileId(null);
      setNewFileName('');
    }
  };

  // 이름 변경 시작
  const startRenaming = (file: CloudGCodeFile) => {
    // 프린터에 전송된 파일인 경우 경고 모달 표시
    if (transferredFileIds.has(file.id)) {
      setFileToRename(file);
      const nameWithoutExt = file.filename.replace(/\.(gcode|gco)$/i, '');
      setNewFileName(nameWithoutExt);
      setTransferredFileWarningOpen(true);
      return;
    }
    // 일반 파일은 바로 이름변경 다이얼로그 열기
    setRenamingFileId(file.id);
    const nameWithoutExt = file.filename.replace(/\.(gcode|gco)$/i, '');
    setNewFileName(nameWithoutExt);
  };

  // 전송된 파일 복사 후 새 파일 생성
  const handleCopyAndCreateNew = async () => {
    if (!fileToRename || !newFileName.trim() || !user) return;

    // .gcode 확장자 확인 및 추가
    let finalName = newFileName.trim();
    if (!finalName.toLowerCase().endsWith('.gcode') && !finalName.toLowerCase().endsWith('.gco')) {
      finalName += '.gcode';
    }

    // 원본과 같은 이름이면 _copy 접미사 추가
    if (finalName === fileToRename.filename) {
      finalName = finalName.replace(/\.(gcode|gco)$/i, '_copy.gcode');
    }

    try {
      setIsCopying(true);

      // 1. 기존 파일 다운로드
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('gcode-files')
        .download(fileToRename.file_path);

      if (downloadError) {
        throw downloadError;
      }

      // 2. 새 경로로 파일 업로드
      const pathParts = fileToRename.file_path.split('/');
      pathParts[pathParts.length - 1] = finalName;
      const newFilePath = pathParts.join('/');

      const { error: uploadError } = await supabase.storage
        .from('gcode-files')
        .upload(newFilePath, fileData, {
          cacheControl: '3600',
          upsert: false, // 덮어쓰기 방지
          contentType: 'text/x-gcode',
        });

      if (uploadError) {
        throw uploadError;
      }

      // 3. DB에 새 파일 메타데이터 추가
      const { error: dbError } = await supabase
        .from('gcode_files')
        .insert({
          user_id: user.id,
          filename: finalName,
          file_path: newFilePath,
          file_size: fileToRename.file_size,
        });

      if (dbError) {
        throw dbError;
      }

      toast({
        title: t('printerDetail.fileCopied'),
        description: `${fileToRename.filename} → ${finalName}`,
      });

      // 파일 목록 새로고침
      loadCloudFiles();

    } catch (error) {
      console.error('Copy error:', error);
      toast({
        title: t('errors.general'),
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsCopying(false);
      setTransferredFileWarningOpen(false);
      setFileToRename(null);
      setNewFileName('');
    }
  };

  // 이름 변경 취소
  const cancelRenaming = () => {
    setRenamingFileId(null);
    setNewFileName('');
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

      // 프린터 이름 및 모델 정보 설정
      const printerWithInfo = printer as typeof printer & {
        name?: string;
        manufacturer?: string;
        series?: string;
        printer_model_name?: string;
        manufacture_id?: string;
      };
      setPrinterName(printerWithInfo?.name || '프린터');
      setPrinterManufacturer(printerWithInfo?.manufacturer || null);
      setPrinterSeries(printerWithInfo?.series || null);
      setPrinterModelName(printerWithInfo?.printer_model_name || null);
      setPrinterManufactureId(printerWithInfo?.manufacture_id || null);

      console.log('[PrinterDetail] 프린터 모델 정보:', {
        manufacturer: printerWithInfo?.manufacturer,
        series: printerWithInfo?.series,
        modelName: printerWithInfo?.printer_model_name,
        manufactureId: printerWithInfo?.manufacture_id
      });

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
        console.warn('[CAM][DB] stream_url 재조회 예외:', e);
      }
    })();
  }, [deviceUuid]);

  // MQTT dash_status 수신 → 상세 데이터에 반영
  useEffect(() => {
    if (!deviceUuid) return;
    const off = onDashStatusMessage((uuid, payload) => {
      if (uuid !== deviceUuid) return;

      /*
      console.log('[웹 PrinterDetail] MQTT dash_status 수신:', {
        uuid,
        printerStatus: payload?.printer_status,
        connection: payload?.connection,
        flags: payload?.printer_status?.flags,
        job: payload?.job,
        progress: payload?.progress,
        fullPayload: payload
      });
      */

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

      // GCode 뷰어 진행률 ref 업데이트 (React 리렌더링 없이 직접 업데이트)
      if (typeof payload?.progress?.completion === 'number') {
        printProgressRef.current = payload.progress.completion * 100;
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

        /*
        console.log('[웹 PrinterDetail] MQTT 업데이트 (DB 상태 기준):', {
          dbState: prev.printerStatus.state,
          isConnected,
          isPrinting,
          flags,
          progress: payload?.progress?.completion
        });
        */

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

  // GCode 뷰어를 메모이제이션하여 MQTT 업데이트로 인한 불필요한 리렌더링 방지
  const gcodeViewer = useMemo(() => (
    <GCodeViewerCanvas
      gcodeContent={currentGCodeContent || undefined}
      bedSize={{ x: 220, y: 220 }}
      printProgressRef={printProgressRef}
      className="h-full"
    />
  ), [currentGCodeContent, printProgressRef]);

  // 파일 관리 탭의 GCode 뷰어도 메모이제이션
  const fileGcodeViewer = useMemo(() => (
    selectedFileContent ? (
      <GCodeViewerCanvas
        gcodeContent={selectedFileContent}
        bedSize={{ x: 220, y: 220 }}
        className="h-full w-full"
      />
    ) : null
  ), [selectedFileContent]);

  // 헤더 오른쪽 콘텐츠: 온도 정보
  const headerRightContent = (
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
  );

  return (
    <div className={cn("h-screen flex overflow-hidden", isMobile && "pb-16")}>
      {/* App Sidebar - printer-detail 모드 */}
      <AppSidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        user={user}
        onSignOut={signOut}
      >
        <PrinterDetailSidebarContent
          printerName={printerName}
          printerUuid={deviceUuid || undefined}
          printerConnected={data.printerStatus.connected}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onBackClick={() => window.history.back()}
        />
      </AppSidebar>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* App Header */}
        <AppHeader
          sidebarOpen={sidebarOpen}
          rightContent={headerRightContent}
        />

        {/* 메인 컨텐츠 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 컨텐츠 영역 */}
          <div className="flex-1 px-8 py-6 flex justify-center overflow-y-auto">
            <div className="w-[80%] space-y-6">
              {activeTab === 'all' ? (
                <>
                  {/* 상단: 카메라/G-code 뷰어 + 상태 카드 */}
                  <div className="grid grid-cols-3 gap-6">
                    {/* 왼쪽: 카메라 피드 / G-code 뷰어 */}
                    <div className="col-span-2">
                      <div className="relative h-[640px] rounded-2xl overflow-hidden bg-card border-2 border-border shadow-sm">
                        {/* 탭 토글 - 모던 세그먼트 스타일 */}
                        <div className="absolute top-0 left-0 right-0 z-10 px-4 py-3 bg-card/95 backdrop-blur-md border-b border-border/30">
                          <div className="inline-flex rounded-xl bg-muted/50 p-1.5">
                            <button
                              onClick={() => setViewMode('camera')}
                              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${viewMode === 'camera'
                                ? 'bg-background shadow-md text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                              <Camera className="h-4 w-4" />
                              카메라
                            </button>
                            <button
                              onClick={() => setViewMode('gcode')}
                              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${viewMode === 'gcode'
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
                            gcodeViewer
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
                        <GCodeUpload deviceUuid={deviceUuid} isConnected={printerConnected} onViewFile={handleViewFileFromUpload} />
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
              ) : activeTab === 'files' ? (
                /* 파일 관리 탭 */
                <div className="h-[calc(100vh-180px)]">
                  <div className="grid grid-cols-12 gap-4 h-full">
                    {/* 왼쪽: 파일 목록 */}
                    <div className="col-span-3 bg-card rounded-xl border-2 border-border shadow-sm overflow-hidden flex flex-col">
                      <div className="p-4 border-b border-border flex items-center justify-between">
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
                        ) : (() => {
                          // 호환 가능한 파일만 필터링하고, 전송된 파일을 상위에 정렬
                          const compatibleFiles = cloudGCodeFiles
                            .filter(file => isFileCompatible(file))
                            .sort((a, b) => {
                              const aTransferred = transferredFileIds.has(a.id);
                              const bTransferred = transferredFileIds.has(b.id);
                              if (aTransferred && !bTransferred) return -1;
                              if (!aTransferred && bTransferred) return 1;
                              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                            });

                          return compatibleFiles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                              <FileCode className="h-8 w-8 mb-2" />
                              <p className="text-sm">{t('printerDetail.noCompatibleFiles')}</p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {compatibleFiles.map((file) => {
                                const isTransferred = transferredFileIds.has(file.id);
                                return (
                                  <div
                                    key={file.id}
                                    className={`group relative flex items-center gap-2 p-3 rounded-lg transition-colors ${selectedCloudFile?.id === file.id
                                      ? 'bg-primary/10 border border-primary/30'
                                      : isTransferred
                                        ? 'border-2 border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10'
                                        : 'hover:bg-muted border border-transparent'
                                      }`}
                                  >
                                    <button
                                      onClick={() => loadFileContent(file)}
                                      className="flex-1 min-w-0 text-left flex items-center gap-2"
                                    >
                                      <FileCode className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{file.filename}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {(file.file_size / 1024).toFixed(1)} KB • {new Date(file.created_at).toLocaleDateString()}
                                        </p>
                                      </div>
                                    </button>
                                    {/* 파일 관리 메뉴 */}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() => handleTransferToPrinter(file)}
                                          disabled={!printerConnected || transferringFileId !== null}
                                        >
                                          <Upload className="h-4 w-4 mr-2" />
                                          {t('printerDetail.transferToPrinter')}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => startRenaming(file)}>
                                          <Pencil className="h-4 w-4 mr-2" />
                                          {t('common.rename')}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setFileToDelete(file);
                                            setDeleteDialogOpen(true);
                                          }}
                                          className="text-destructive focus:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          {t('common.delete')}
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                    {/* 전송 진행률 표시 */}
                                    {transferringFileId === file.id && (
                                      <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-2 w-full px-4">
                                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                          <Progress value={transferProgress} className="h-1.5 w-full" />
                                          <span className="text-xs text-muted-foreground">{transferProgress}%</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* 중앙: GCode 뷰어 */}
                    <div className="col-span-9 bg-card rounded-xl border-2 border-border shadow-sm overflow-hidden flex flex-col">
                      <div className="p-4 border-b border-border flex items-center justify-between">
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
                        ) : fileGcodeViewer ? (
                          fileGcodeViewer
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
              ) : activeTab === 'settings-equipment' ? (
                /* 설비 설정 탭 */
                <PrinterSettingsTab
                  printerId={id || ''}
                  printerName={printerName}
                  currentManufactureId={printerManufactureId}
                  deviceUuid={deviceUuid}
                  onSuccess={() => loadPrinterData(false)}
                  mode="equipment"
                />
              ) : activeTab === 'settings-camera' ? (
                /* 카메라 설정 탭 */
                <PrinterSettingsTab
                  printerId={id || ''}
                  printerName={printerName}
                  currentManufactureId={printerManufactureId}
                  deviceUuid={deviceUuid}
                  onSuccess={() => loadPrinterData(false)}
                  mode="camera"
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {fileToDelete?.filename} 파일을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCloudFile}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 이름 변경 다이얼로그 */}
      <AlertDialog open={!!renamingFileId} onOpenChange={(open) => !open && cancelRenaming()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.rename')}</AlertDialogTitle>
            <AlertDialogDescription>
              새로운 파일명을 입력하세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="새 파일명"
              disabled={isRenaming}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isRenaming) {
                  const file = cloudGCodeFiles.find(f => f.id === renamingFileId);
                  if (file) handleRenameCloudFile(file);
                }
                if (e.key === 'Escape') cancelRenaming();
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">
              .gcode 확장자는 자동으로 추가됩니다.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRenaming} onClick={cancelRenaming}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const file = cloudGCodeFiles.find(f => f.id === renamingFileId);
                if (file) handleRenameCloudFile(file);
              }}
              disabled={isRenaming || !newFileName.trim()}
            >
              {isRenaming ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 전송된 파일 이름변경 경고 모달 */}
      <AlertDialog open={transferredFileWarningOpen} onOpenChange={(open) => {
        if (!open) {
          setTransferredFileWarningOpen(false);
          setFileToRename(null);
          setNewFileName('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('printerDetail.transferredFileWarningTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>{t('printerDetail.transferredFileWarningDesc')}</p>
              <p className="text-muted-foreground text-xs">
                {t('printerDetail.transferredFileWarningHint')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              {t('printerDetail.newFileName')}
            </label>
            <Input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder={t('printerDetail.newFileNamePlaceholder')}
              disabled={isCopying}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isCopying && newFileName.trim()) {
                  handleCopyAndCreateNew();
                }
                if (e.key === 'Escape') {
                  setTransferredFileWarningOpen(false);
                  setFileToRename(null);
                  setNewFileName('');
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">
              .gcode {t('printerDetail.extensionAutoAdded')}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCopying}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCopyAndCreateNew}
              disabled={isCopying || !newFileName.trim()}
              className="bg-primary"
            >
              {isCopying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {t('printerDetail.copyAndCreate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PrinterDetail;