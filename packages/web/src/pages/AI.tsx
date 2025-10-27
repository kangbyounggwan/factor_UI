import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Lazy load ModelViewer to reduce initial bundle size
const ModelViewer = lazy(() => import("@/components/ModelViewer"));
const GCodeViewer = lazy(() => import("@/components/GCodeViewer"));
const GCodePreview = lazy(() => import("@/components/GCodePreview"));
import TextTo3DForm from "@/components/ai/TextTo3DForm";
import ImageTo3DForm from "@/components/ai/ImageTo3DForm";
import ModelPreview from "@/components/ai/ModelPreview";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import ModelArchive from "@/components/ai/ModelArchive";
import UploadArchive from "@/components/ai/UploadArchive";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { PrinterCard } from "@/components/PrinterCard";

// 타입 정의는 shared에서 가져옴
import type { UploadedFile } from "@shared/hooks/useAIImageUpload";
import type { AIGeneratedModel } from "@shared/types/aiModelType";

// 프린터 그룹 타입
interface PrinterGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at: string;
  updated_at: string;
}

// 프린터 타입 (Dashboard와 동일)
interface Printer {
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
  manufacture_id?: string; // manufacturing_printers 테이블의 ID
}

interface PrintSettings {
  support_enable: boolean;
  support_angle: number;
  layer_height: number;
  line_width: number;
  speed_print: number;
  material_diameter: number;
  material_flow: number;
  infill_sparse_density: number;
  wall_line_count: number;
  top_layers: number;
  bottom_layers: number;
  adhesion_type: 'none' | 'skirt' | 'brim' | 'raft';
}

type SymmetryMode = 'off' | 'auto' | 'on';
type ArtStyle = 'realistic' | 'sculpture';
import {
  Layers,
  Upload,
  Download,
  Play,
  Pause,
  Image,
  Box,
  FileText,
  Printer,
  Settings,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Zap,
  Sparkles,
  Monitor,
  Camera,
  Wand2,
  Send,
  ImageIcon,
  FileUp,
  Trash2,
  Eye,
  RotateCcw,
  RefreshCw,
  FolderOpen,
  Grid3X3,
  Image as ImageFile,
  Shapes,
  Type
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@shared/contexts/AuthContext";
import { getUserPrintersWithGroup } from "@shared/services/supabaseService/printerList";
import { onDashStatusMessage } from "@shared/services/mqttService";
import { buildCommon, postTextTo3D, postImageTo3D, extractGLBUrl, extractSTLUrl, extractMetadata, extractThumbnailUrl, pollTaskUntilComplete, AIModelResponse, uploadSTLAndSlice, SlicingSettings, PrinterDefinition } from "@shared/services/aiService";
import { createAIModel, updateAIModel, listAIModels, deleteAIModel } from "@shared/services/supabaseService/aiModel";
import { supabase } from "@shared/integrations/supabase/client";
import { useAIImageUpload } from "@shared/hooks/useAIImageUpload";
import { downloadAndUploadModel, downloadAndUploadSTL, downloadAndUploadThumbnail, downloadAndUploadGCode, deleteModelFiles } from "@shared/services/supabaseService/aiStorage";
import { getManufacturers, getSeriesByManufacturer, getModelsByManufacturerAndSeries, getManufacturingPrinterById } from "@shared/api/manufacturingPrinter";
import { createSlicingTask, subscribeToTaskUpdates, processSlicingTask, BackgroundTask } from "@shared/services/backgroundSlicing";

const AI = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('text-to-3d');
  const [textPrompt, setTextPrompt] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0); // 진행률 (0-100)
  const [progressStatus, setProgressStatus] = useState<string>(''); // 진행 상태 메시지
  const [generatedModels, setGeneratedModels] = useState<AIGeneratedModel[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [modelViewerUrl, setModelViewerUrl] = useState<string | null>(null);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null); // 현재 선택된 모델 ID
  const [currentGlbUrl, setCurrentGlbUrl] = useState<string | null>(null); // 현재 모델의 GLB URL
  const [currentStlUrl, setCurrentStlUrl] = useState<string | null>(null); // 현재 모델의 STL URL
  const [currentGCodeUrl, setCurrentGCodeUrl] = useState<string | null>(null); // 현재 모델의 GCode URL
  const [gcodeInfo, setGcodeInfo] = useState<{
    printTime?: string;
    filamentLength?: string;
    filamentWeight?: string;
    filamentCost?: string;
    layerCount?: number;
    layerHeight?: number;
    modelSize?: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
    nozzleTemp?: number;
    bedTemp?: number;
    printerName?: string;
  } | null>(null); // GCode 메타데이터
  const [isSlicing, setIsSlicing] = useState<boolean>(false); // 슬라이싱 진행 중
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null); // Text-to-Image 생성 이미지 URL
  const [targetPrinterModelId, setTargetPrinterModelId] = useState<string | null>(null); // 슬라이싱된 프린터 모델 ID (알림용)

  // 재슬라이스용 프린터 선택 state
  const [resliceManufacturer, setResliceManufacturer] = useState<string>('');
  const [resliceSeries, setResliceSeries] = useState<string>('');
  const [resliceModelId, setResliceModelId] = useState<string>('');
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [seriesList, setSeriesList] = useState<string[]>([]);
  const [modelsList, setModelsList] = useState<Array<{id: string; display_name: string}>>([]);
  const isLoadingDefaultPrinter = useRef<boolean>(false); // 기본값 로딩 중 플래그
  const [selectedImageHasModel, setSelectedImageHasModel] = useState<boolean>(false); // 선택된 이미지의 3D 모델 존재 여부
  // 모델 아카이브 필터 상태
  type ArchiveFilter = 'all' | 'text-to-3d' | 'image-to-3d' | 'text-to-image';
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('all');
  // 아카이브 뷰 모드 (RAW / 3D 모델)
  const [archiveViewMode, setArchiveViewMode] = useState<'raw' | '3d'>('3d');
  // Text → 3D 설정 상태
  const [textSymmetryMode, setTextSymmetryMode] = useState<'off' | 'auto' | 'on'>('auto');
  const [textArtStyle, setTextArtStyle] = useState<'realistic' | 'sculpture'>('realistic');
  const [textTargetPolycount, setTextTargetPolycount] = useState<number>(30000);
  // Image → 3D 설정 상태
  const [imageSymmetryMode, setImageSymmetryMode] = useState<SymmetryMode>('auto');
  const [imageArtStyle, setImageArtStyle] = useState<ArtStyle>('realistic');
  const [imageTargetPolycount, setImageTargetPolycount] = useState<number>(30000);
  const totalPrinters = printers.length;
  const connectedCount = printers.filter((p) => p.connected).length;
  const printingCount = printers.filter((p) => p.state === 'printing').length;
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  // 프린터 영역 높이 조절
  const [printerAreaHeight, setPrinterAreaHeight] = useState<number>(25); // 기본값 25% (flex-[1] 대신 사용)
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const resizeStartY = useRef<number>(0);
  const resizeStartHeight = useRef<number>(0);

  // 리사이즈 핸들러
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = printerAreaHeight;
  }, [printerAreaHeight]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const containerHeight = window.innerHeight - 64; // 헤더 높이 제외
      const deltaY = e.clientY - resizeStartY.current;
      const deltaPercent = (deltaY / containerHeight) * 100;
      const newHeight = Math.max(10, Math.min(70, resizeStartHeight.current - deltaPercent)); // 10% ~ 70% 제한
      setPrinterAreaHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Shared 훅 사용 - 이미지 업로드 관리
  const {
    uploadedFiles,
    selectedImageId,
    isUploading,
    handleFileUpload: uploadFile,
    removeFile: deleteFile,
    selectImage,
    getSelectedFile,
  } = useAIImageUpload({
    supabase,
    userId: user?.id,
    onSuccess: (file) => {
      toast({
        title: t('ai.fileUploadComplete'),
        description: t('ai.fileUploaded'),
      });
    },
    onError: (error) => {
      toast({
        title: t('ai.uploadFailed'),
        description: error.message || t('errors.uploadFailed'),
        variant: "destructive"
      });
    },
    onDelete: (fileId) => {
      toast({
        title: t('ai.fileDeleted'),
        description: t('ai.fileDeletedDescription'),
      });
    }
  });

  // 연결된 프린터 로드 (Supabase) - Dashboard와 동일한 구조
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!user?.id) return;
        const rows = await getUserPrintersWithGroup(user.id);
        if (!active) return;
        const mapped: Printer[] = (rows || []).map((r) => ({
          id: r.id,
          name: r.name || r.model || r.device_uuid || 'Unknown Printer',
          model: r.model || 'Unknown Model',
          group_id: r.group_id,
          group: r.group,
          state: 'connecting' as const,
          connected: false,
          printing: false,
          pending: true,
          completion: undefined,
          temperature: {
            tool_actual: 0,
            tool_target: 0,
            bed_actual: 0,
            bed_target: 0,
          },
          print_time_left: undefined,
          current_file: undefined,
          device_uuid: r.device_uuid,
          manufacture_id: r.manufacture_id,
        }));
        setPrinters(mapped);
      } catch (e) {
        console.error('[AI] load printers failed', e);
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  // Subscribe to background task updates
  useEffect(() => {
    if (!user?.id) return;

    const subscription = subscribeToTaskUpdates(supabase, user.id, (task: BackgroundTask) => {
      console.log('[AI] Background task updated:', task);

      if (task.status === 'completed' && task.output_url) {
        // Update UI with completed task
        setCurrentGCodeUrl(task.output_url);
        setIsSlicing(false);

        // Update gcode info if metadata available
        if (task.output_metadata) {
          const metadata = task.output_metadata;
          setGcodeInfo({
            printTime: metadata.print_time_formatted,
            filamentLength: metadata.filament_used_m ? `${metadata.filament_used_m.toFixed(2)}m` : undefined,
            filamentWeight: metadata.filament_weight_g ? `${metadata.filament_weight_g.toFixed(1)}g` : undefined,
            filamentCost: metadata.filament_cost ? `$${metadata.filament_cost.toFixed(2)}` : undefined,
            layerCount: metadata.layer_count,
            layerHeight: metadata.layer_height,
            modelSize: metadata.bounding_box ? {
              minX: metadata.bounding_box.min_x,
              maxX: metadata.bounding_box.max_x,
              minY: metadata.bounding_box.min_y,
              maxY: metadata.bounding_box.max_y,
              minZ: metadata.bounding_box.min_z,
              maxZ: metadata.bounding_box.max_z,
            } : undefined,
            nozzleTemp: metadata.nozzle_temp,
            bedTemp: metadata.bed_temp,
            printerName: metadata.printer_name,
          });
        }

        toast({
          title: t('ai.slicingComplete'),
          description: t('ai.slicingCompleteNotification'),
          duration: 7000,
        });
      } else if (task.status === 'failed') {
        setIsSlicing(false);
        toast({
          title: t('ai.slicingFailed'),
          description: task.error_message || t('common.error'),
          variant: 'destructive',
          duration: 7000,
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // MQTT 실시간 상태 업데이트 (Dashboard와 동일)
  useEffect(() => {
    if (printers.length === 0) return;

    console.log('[AI MQTT] 프린터 상태 모니터링 시작:', printers.length);

    // 각 프린터별 타임아웃 추적 (3초 동안 데이터 없으면 disconnected)
    const timeouts: Record<string, number> = {};
    const TIMEOUT_DURATION = 3000; // 3초

    // 타임아웃 설정/재설정 함수
    const startTimeoutFor = (uuid?: string, currentState?: string) => {
      if (!uuid) return;

      // 기존 타임아웃 제거
      if (timeouts[uuid]) {
        try { clearTimeout(timeouts[uuid]); } catch (err) { console.warn('clearTimeout failed:', err); }
      }

      timeouts[uuid] = window.setTimeout(() => {
        console.log('[AI MQTT] 타임아웃 실행:', uuid, '- 연결끊김으로 변경');
        setPrinters((prev) => prev.map(p => {
          if (p.device_uuid === uuid) {
            return { ...p, state: 'disconnected', connected: false, pending: false };
          }
          return p;
        }));
      }, TIMEOUT_DURATION);
    };

    // 초기 타임아웃 시작
    setPrinters((prev) => {
      prev.forEach((p) => startTimeoutFor(p.device_uuid, p.state));
      return prev;
    });

    // MQTT 메시지 수신 핸들러
    const off = onDashStatusMessage((uuid, data) => {
      console.log('[AI MQTT] 메시지 수신:', uuid);

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
          const nextState: Printer['state'] =
            flags.printing ? 'printing' :
            flags.paused   ? 'paused'   :
            flags.error    ? 'error'    :
            (isConnected   ? 'idle'     : 'disconnected');

          // 데이터 수신 시 타임아웃 재설정
          startTimeoutFor(uuid, nextState);

          next[idx] = {
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
        }
        return next;
      });
    });

    console.log('[AI MQTT] 핸들러 등록 완료');

    return () => {
      console.log('[AI MQTT] 클린업 - 모든 타임아웃 제거');
      off();
      Object.values(timeouts).forEach(t => { try { clearTimeout(t); } catch (err) { console.warn('clearTimeout failed:', err); } });
    };
  }, [printers.length]);

  // Supabase Storage에서 이미지는 useAIImageUpload 훅에서 자동 로드됨

  // AI 생성 모델 로드 (Supabase) - 모든 모델 로드, 필터는 UI에서 처리
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!user?.id) return;
        const result = await listAIModels(supabase, user.id, {
          page: 1,
          pageSize: 100, // 더 많은 모델 로드
        });
        if (!active) return;
        setGeneratedModels(result.items);
      } catch (e) {
        console.error('[AI] load models failed', e);
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  // SEO: Meta description
  useEffect(() => {
    const desc = t('ai.description');
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);
  }, []);

  // Sync archiveFilter with activeTab
  useEffect(() => {
    if (activeTab === 'text-to-3d' || activeTab === 'image-to-3d' || activeTab === 'text-to-image') {
      setArchiveFilter(activeTab as ArchiveFilter);
    }
  }, [activeTab]);

  // 알림으로부터 GCode 자동 로드
  useEffect(() => {
    const state = location.state as Record<string, unknown> | null;
    if (state?.autoLoadGCode && user) {
      const { modelId, gcodeUrl, printerModelId } = state.autoLoadGCode;
      console.log('[AI] Auto-loading GCode from notification:', { modelId, gcodeUrl, printerModelId });

      // GCode 정보 로드
      const loadGCodeFromNotification = async () => {
        try {
          // model_id로 모델 정보 가져오기
          const { data: model, error: modelError } = await supabase
            .from('ai_generated_models')
            .select('*')
            .eq('id', modelId)
            .single();

          if (modelError || !model) {
            console.error('[AI] Failed to load model:', modelError);
            return;
          }

          // GCode 메타데이터 가져오기
          const { data: gcodeData, error: gcodeError } = await supabase
            .from('gcode_files')
            .select('*')
            .eq('model_id', modelId)
            .single();

          // 모델 뷰어 및 GCode 정보 설정
          setCurrentModelId(modelId);
          setCurrentGlbUrl(model.download_url);
          setCurrentStlUrl(model.stl_download_url);
          setCurrentGCodeUrl(gcodeUrl);
          setModelViewerUrl(model.download_url);
          setTargetPrinterModelId(printerModelId); // 프린터 모델 ID 저장

          if (gcodeData && !gcodeError) {
            setGcodeInfo({
              printTime: gcodeData.print_time_formatted,
              filamentLength: gcodeData.filament_used_m ? `${gcodeData.filament_used_m.toFixed(2)}m` : undefined,
              filamentWeight: gcodeData.filament_weight_g ? `${gcodeData.filament_weight_g.toFixed(1)}g` : undefined,
              layerCount: gcodeData.layer_count,
              nozzleTemp: gcodeData.nozzle_temp,
              bedTemp: gcodeData.bed_temp,
            });
          }

          toast({
            title: t('ai.slicingComplete'),
            description: t('ai.readyToPrint'),
            duration: 5000,
          });
        } catch (error) {
          console.error('[AI] Error loading GCode from notification:', error);
        }
      };

      loadGCodeFromNotification();

      // state 초기화 (뒤로가기 시 재로드 방지)
      window.history.replaceState({}, document.title);
    }
  }, [location.state, user]);

  // 출력 설정 다이얼로그 상태
  const [printDialogOpen, setPrintDialogOpen] = useState<boolean>(false);
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null);

  // 프린터 선택 확인 모달 상태
  const [printerConfirmDialogOpen, setPrinterConfirmDialogOpen] = useState<boolean>(false);
  const [printerToConfirm, setPrinterToConfirm] = useState<Printer | null>(null);

  // 이미지 삭제 확인 다이얼로그 상태
  const [deleteImageDialogOpen, setDeleteImageDialogOpen] = useState<boolean>(false);
  const [imageToDelete, setImageToDelete] = useState<number | null>(null);
  const [linkedModelsCount, setLinkedModelsCount] = useState<number>(0);
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    support_enable: true,
    support_angle: 50,
    layer_height: 0.2,
    line_width: 0.4,
    speed_print: 50,
    material_diameter: 1.75,
    material_flow: 100,
    infill_sparse_density: 15,
    wall_line_count: 2,
    top_layers: 4,
    bottom_layers: 4,
    adhesion_type: 'none' as 'none' | 'skirt' | 'brim' | 'raft',
  });

  // ModelViewer onSave 콜백
  const handleModelSave = useCallback(async (data: {
    rotation: [number, number, number];
    scale: number;
    optimized: boolean;
    blob: Blob;
    format: 'stl' | 'glb';
  }) => {
    console.log('[AI] ========================================');
    console.log('[AI] handleModelSave 호출됨');
    console.log('[AI] onSave 콜백 호출됨');
    console.log('[AI] Save data:', {
      rotation: data.rotation,
      scale: data.scale,
      optimized: data.optimized,
      blobSize: data.blob.size,
      format: data.format
    });
    console.log('[AI] ========================================');

    try {
      if (!currentModelId) {
        throw new Error('No model selected');
      }

      // 1. Upload the new GLB file to Supabase Storage
      const timestamp = Date.now();
      const fileName = `model_${currentModelId}_${timestamp}.glb`;
      const filePath = `${user?.id}/${fileName}`;

      console.log('[AI] Uploading GLB to Supabase Storage:', {
        fileName,
        filePath,
        blobSize: data.blob.size
      });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ai-models')
        .upload(filePath, data.blob, {
          contentType: 'model/gltf-binary',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('ai-models')
        .getPublicUrl(filePath);

      console.log('[AI] GLB uploaded successfully:', {
        publicUrl,
        uploadPath: uploadData.path
      });

      // 3. Update the model record in database
      await updateAIModel(supabase, currentModelId, {
        download_url: publicUrl,
        generation_metadata: {
          rotation: data.rotation,
          scale: data.scale,
          optimized: data.optimized,
          saved_at: new Date().toISOString()
        }
      });

      console.log('[AI] Database updated with new GLB URL');

      // 4. STL URL을 state에서만 삭제 (DB 컬럼이 없음)
      console.log('[AI] Clearing old STL URL from state');
      setCurrentStlUrl(null);

      // 5. Update local state
      setCurrentGlbUrl(publicUrl);
      setModelViewerUrl(publicUrl);

      console.log('[AI] Local state updated with new GLB URL');

      // 6. 모델 목록만 새로고침 (전체 페이지 리로드 제거)
      await reloadModels();

      console.log('[AI] Model list reloaded without full page refresh');
      console.log('[AI] ========================================');
      console.log('[AI] Model save completed successfully');
      console.log('[AI] ========================================');

      toast({
        title: t('ai.modelSaved') || 'Model Saved',
        description: t('ai.modelSavedDescription') || 'Your model has been saved with current transformations.',
      });
    } catch (error) {
      console.error('[AI] Failed to save model:', error);
      toast({
        title: t('ai.modelSaveFailed') || 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save model',
        variant: 'destructive'
      });
    }
  }, [currentModelId, user?.id, supabase, t, toast]);

  const openPrinterSettings = (printer: Printer) => {
    console.log('[AI] ===== 프린터 카드 클릭됨 =====');
    console.log('[AI] 프린터:', printer.name, '/', printer.model);
    console.log('[AI] 프린터 UUID:', printer.device_uuid);
    console.log('[AI] 현재 상태:');
    console.log('[AI]   - currentModelId:', currentModelId);
    console.log('[AI]   - currentStlUrl:', currentStlUrl);
    console.log('[AI]   - currentGlbUrl:', currentGlbUrl);

    // 먼저 확인 모달 표시
    setPrinterToConfirm(printer);
    setPrinterConfirmDialogOpen(true);
  };

  const confirmPrinterSelection = async () => {
    console.log('[AI] ========================================');
    console.log('[AI] confirmPrinterSelection 호출됨');
    console.log('[AI] 체크 - printerToConfirm:', printerToConfirm);
    console.log('[AI] 체크 - currentStlUrl:', currentStlUrl);
    console.log('[AI] 체크 - currentGlbUrl:', currentGlbUrl);
    console.log('[AI] 체크 - currentModelId:', currentModelId);
    console.log('[AI] 체크 - user?.id:', user?.id);

    // GLB 파일만 사용 (STL 사용 안 함)
    const modelUrl = currentGlbUrl;

    console.log('[AI] 슬라이싱에 사용할 모델 URL:', modelUrl);
    console.log('[AI] URL 타입: GLB');

    if (!printerToConfirm || !modelUrl || !user?.id) {
      console.error('[AI] 필수 데이터 부족:');
      console.error('  - printerToConfirm:', printerToConfirm ? '있음' : '없음');
      console.error('  - currentGlbUrl:', currentGlbUrl ? currentGlbUrl : '없음');
      console.error('  - user?.id:', user?.id ? user.id : '없음');

      toast({
        title: '오류',
        description: '3D 모델 파일이나 프린터 정보가 없습니다.',
        variant: 'destructive',
      });
      setPrinterConfirmDialogOpen(false);
      return;
    }

    try {
      // 확인 모달 닫기
      setPrinterConfirmDialogOpen(false);
      setSelectedPrinter(printerToConfirm);
      setIsSlicing(true);

      // 출력 설정 모달 먼저 열기 (로딩 상태 표시)
      setPrintDialogOpen(true);

      toast({
        title: '슬라이싱 시작',
        description: `${printerToConfirm.name} 프린터로 슬라이싱을 시작합니다...`,
      });

      // 1. 모델 파일 다운로드 (STL 또는 GLB)
      console.log('[AI] ========================================');
      console.log('[AI] 📥 DOWNLOADING MODEL FOR SLICING');
      console.log('[AI] - Model URL:', modelUrl);
      console.log('[AI] ========================================');

      const modelResponse = await fetch(modelUrl);
      if (!modelResponse.ok) {
        throw new Error('모델 파일 다운로드 실패');
      }
      const modelBlob = await modelResponse.blob();

      // 파일 확장자 추출
      const fileExtension = modelUrl.endsWith('.stl') ? 'stl' : 'glb';
      console.log('[AI] Downloaded model file:');
      console.log('[AI] - File format:', fileExtension);
      console.log('[AI] - Downloaded blob size:', modelBlob.size, 'bytes');
      console.log('[AI] - Downloaded blob type:', modelBlob.type);

      // 2. 슬라이싱 설정 구성
      const curaSettings: SlicingSettings = {
        layer_height: printSettings.layer_height.toString(),
        line_width: printSettings.line_width.toString(),
        infill_sparse_density: printSettings.infill_sparse_density.toString(),
        wall_line_count: printSettings.wall_line_count.toString(),
        top_layers: printSettings.top_layers.toString(),
        bottom_layers: printSettings.bottom_layers.toString(),
        speed_print: printSettings.speed_print.toString(),
        support_enable: printSettings.support_enable.toString(),
        support_angle: printSettings.support_angle.toString(),
        adhesion_type: printSettings.adhesion_type,
        material_diameter: printSettings.material_diameter.toString(),
        material_flow: printSettings.material_flow.toString(),
      };

      console.log('[AI] Cura settings prepared:', curaSettings);

      // 3. manufacturing_printers에서 프린터 정보 조회
      let printerFilename = printerToConfirm.model || printerToConfirm.name;
      let printerInfoForGCode: { manufacturer?: string; series?: string; model?: string; printer_name?: string } = {};

      if (printerToConfirm.manufacture_id) {
        try {
          console.log('[AI] Fetching printer info from manufacturing_printers:', printerToConfirm.manufacture_id);
          const { data: manufacturingPrinter, error } = await supabase
            .from('manufacturing_printers')
            .select('filename, build_volume, manufacturer, series, display_name')
            .eq('id', printerToConfirm.manufacture_id)
            .single();

          if (error) {
            console.warn('[AI] Failed to fetch manufacturing printer:', error);
          } else if (manufacturingPrinter) {
            console.log('[AI] Manufacturing printer found:', manufacturingPrinter);
            // .def.json 제거
            printerFilename = manufacturingPrinter.filename.replace('.def.json', '');
            console.log('[AI] Using printer filename:', printerFilename);

            // GCode 파일명에 사용할 프린터 정보 저장
            printerInfoForGCode = {
              manufacturer: manufacturingPrinter.manufacturer,
              series: manufacturingPrinter.series,
              model: manufacturingPrinter.display_name,
              printer_name: printerToConfirm.name  // 현재 선택된 프린터 이름
            };
          }
        } catch (error) {
          console.warn('[AI] Error fetching manufacturing printer:', error);
        }
      }

      // 3. 프린터 정의 (기본값 사용, 필요시 프린터별로 커스터마이징 가능)
      const printerDefinition: PrinterDefinition = {
        version: 2,
        overrides: {
          machine_width: { default_value: 220 },
          machine_depth: { default_value: 220 },
          machine_height: { default_value: 250 },
          machine_extruder_count: { default_value: 1 },
          mesh_rotation_matrix: { default_value: "[[1,0,0], [0,1,0], [0,0,1]]" },
        },
      };

      console.log('[AI] Printer definition prepared:', printerDefinition);

      // 4. DB에서 캐시된 GCode 확인 (API 호출 전)
      if (currentModelId && printerToConfirm.manufacture_id) {
        console.log('[AI] ========================================');
        console.log('[AI] 🔍 Checking for cached GCode in DB...');
        console.log('[AI] - modelId:', currentModelId);
        console.log('[AI] - printerId:', printerToConfirm.manufacture_id);
        console.log('[AI] ========================================');

        // 캐시 확인 중 토스트 표시
        toast({
          title: t('ai.loadingCachedGcode'),
          description: t('ai.loadingCachedGcodeDescription'),
          duration: 2000,
        });

        const { data: existingGcode, error: gcodeError } = await supabase
          .from('gcode_files')
          .select('*')
          .eq('model_id', currentModelId)
          .single();

        if (existingGcode && !gcodeError) {
          console.log('[AI] ✅ Cached GCode found! Skipping API call...');
          console.log('[AI] - file_path:', existingGcode.file_path);
          console.log('[AI] - Created at:', existingGcode.created_at);

          // Public URL 생성
          const { data: urlData } = supabase.storage
            .from('gcode-files')
            .getPublicUrl(existingGcode.file_path);

          // 캐시된 메타데이터를 UI에 표시
          setGcodeInfo({
            printTime: existingGcode.print_time_formatted,
            filamentLength: existingGcode.filament_used_m ? `${existingGcode.filament_used_m.toFixed(2)}m` : undefined,
            filamentWeight: existingGcode.filament_weight_g ? `${existingGcode.filament_weight_g.toFixed(1)}g` : undefined,
            filamentCost: existingGcode.filament_cost ? `$${existingGcode.filament_cost.toFixed(2)}` : undefined,
            layerCount: existingGcode.layer_count,
            layerHeight: existingGcode.layer_height,
            modelSize: existingGcode.bounding_box ? {
              minX: existingGcode.bounding_box.min_x,
              maxX: existingGcode.bounding_box.max_x,
              minY: existingGcode.bounding_box.min_y,
              maxY: existingGcode.bounding_box.max_y,
              minZ: existingGcode.bounding_box.min_z,
              maxZ: existingGcode.bounding_box.max_z,
            } : undefined,
            nozzleTemp: existingGcode.nozzle_temp,
            bedTemp: existingGcode.bed_temp,
            printerName: existingGcode.printer_name,
          });

          setCurrentGCodeUrl(urlData.publicUrl);
          setIsSlicing(false);

          console.log('[AI] ========================================');
          console.log('[AI] ✅ Using cached GCode - No API call needed!');
          console.log('[AI] ========================================');
          return; // API 호출 없이 종료
        } else {
          console.log('[AI] ❌ No cached GCode found, proceeding with API call...');
          if (gcodeError) {
            console.log('[AI] - Error:', gcodeError.message);
          }
        }
      }

      // 5. Create background slicing task
      console.log('[AI] Creating background slicing task...');
      console.log('[AI] - Model URL:', modelUrl);
      console.log('[AI] - Model ID:', currentModelId);
      console.log('[AI] - Printer ID:', printerToConfirm.id);
      console.log('[AI] - Printer Model ID:', printerToConfirm.manufacture_id);

      const currentModel = generatedModels.find(m => m.id === currentModelId);
      const modelName = currentModel?.model_name || currentModel?.prompt || currentModelId;

      const taskId = await createSlicingTask(
        supabase,
        currentModelId,
        printerToConfirm.id,
        printerToConfirm.manufacture_id,
        modelUrl,
        {
          curaSettings,
          printerDefinition,
          printerName: printerFilename,
          modelName,
          printerInfo: printerInfoForGCode,
        }
      );

      console.log('[AI] Background task created:', taskId);
      console.log('[AI] Task will continue in background even if tab is closed');

      toast({
        title: t('ai.slicingBackgroundStart'),
        description: t('ai.slicingBackgroundDescription'),
        duration: 5000,
      });

      // Immediately process the task in background
      processSlicingTask(supabase, {
        id: taskId,
        user_id: user.id,
        task_type: 'slicing',
        status: 'pending',
        model_id: currentModelId,
        printer_id: printerToConfirm.id,
        printer_model_id: printerToConfirm.manufacture_id,
        input_url: modelUrl,
        input_params: {
          curaSettings,
          printerDefinition,
          printerName: printerFilename,
          modelName,
          printerInfo: printerInfoForGCode,
        },
        output_url: null,
        output_metadata: null,
        error_message: null,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
        updated_at: new Date().toISOString(),
      }).catch(error => {
        console.error('[AI] Background task failed to start:', error);
      });

      // Don't wait for slicing to complete - it runs in background
      // The useEffect subscription will update the UI when complete

    } catch (error) {
      console.error('[AI] Slicing failed:', error);
      if (error instanceof Error) {
        console.error('[AI] Error name:', error.name);
        console.error('[AI] Error message:', error.message);
        console.error('[AI] Error stack:', error.stack);
      }
      console.error('[AI] Error details:', JSON.stringify(error, null, 2));

      setIsSlicing(false);
      toast({
        title: '슬라이싱 실패',
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const startPrint = async () => {
    if (!currentGCodeUrl || !selectedPrinter) {
      toast({
        title: '오류',
        description: 'GCode 파일이나 프린터 정보가 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    try {
      toast({
        title: t('ai.printStart'),
        description: `${selectedPrinter.name}${t('ai.printJobSent')}`,
      });

      // TODO: 프린터로 GCode 전송 로직 추가
      // MQTT나 다른 방식으로 프린터에 GCode 전송

      setPrintDialogOpen(false);
    } catch (error) {
      console.error('[AI] Print start failed:', error);
      toast({
        title: '출력 시작 실패',
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  // 제조사 목록 로드
  const loadManufacturers = useCallback(async () => {
    try {
      const data = await getManufacturers();
      setManufacturers(data.map(m => m.manufacturer));
    } catch (error) {
      console.error('[AI] Failed to load manufacturers:', error);
    }
  }, []);

  // 시리즈 목록 로드
  const loadSeriesByManufacturer = useCallback(async (manufacturer: string) => {
    try {
      const data = await getSeriesByManufacturer(manufacturer);
      setSeriesList(data.map(s => s.series));
    } catch (error) {
      console.error('[AI] Failed to load series:', error);
    }
  }, []);

  // 모델 목록 로드
  const loadModelsByManufacturerAndSeries = useCallback(async (manufacturer: string, series: string) => {
    try {
      const data = await getModelsByManufacturerAndSeries(manufacturer, series);
      setModelsList(data);
    } catch (error) {
      console.error('[AI] Failed to load models:', error);
    }
  }, []);

  // 저장된 기본 프린터 설정 로드
  const loadDefaultPrinterSettings = useCallback(async () => {
    if (!selectedPrinter) {
      return;
    }

    const printerExt = selectedPrinter as Printer & { manufacture_id?: string };
    if (printerExt.manufacture_id) {
      isLoadingDefaultPrinter.current = true;
      try {
        const { data: manufacturingPrinter, error } = await supabase
          .from('manufacturing_printers')
          .select('id, manufacturer, series, model, display_name')
          .eq('id', printerExt.manufacture_id)
          .single();

        if (error) {
          console.error('[AI] Error loading manufacturing printer:', error);
          isLoadingDefaultPrinter.current = false;
          return;
        }

        if (manufacturingPrinter) {
          // 1단계: 제조사 설정
          setResliceManufacturer(manufacturingPrinter.manufacturer);

          // 2단계: 시리즈 목록 로드 후 시리즈 설정
          const seriesData = await getSeriesByManufacturer(manufacturingPrinter.manufacturer);
          setSeriesList(seriesData.map(s => s.series));
          setResliceSeries(manufacturingPrinter.series);

          // 3단계: 모델 목록 로드 후 모델 설정
          const modelsData = await getModelsByManufacturerAndSeries(
            manufacturingPrinter.manufacturer,
            manufacturingPrinter.series
          );
          setModelsList(modelsData);
          setResliceModelId(manufacturingPrinter.id);

          console.log('[AI] Loaded default printer settings:', {
            manufacturer: manufacturingPrinter.manufacturer,
            series: manufacturingPrinter.series,
            model: manufacturingPrinter.display_name,
            id: manufacturingPrinter.id
          });
        }
      } catch (error) {
        console.error('[AI] Error in loadDefaultPrinterSettings:', error);
      } finally {
        isLoadingDefaultPrinter.current = false;
      }
    }
  }, [selectedPrinter]);

  // 재슬라이스 핸들러
  const handleReslice = async () => {
    // 현재 모델 찾기
    const currentModel = currentModelId ? generatedModels.find(m => m.id === currentModelId) : null;

    if (!resliceModelId || !selectedPrinter || !currentModel || !currentGlbUrl) {
      toast({
        title: t('ai.resliceFailed'),
        description: t('ai.resliceFailedDesc'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSlicing(true);

      toast({
        title: t('ai.resliceStart'),
        description: t('ai.resliceStartDesc'),
      });

      // 선택한 프린터 정보 가져오기
      const manufacturingPrinter = await getManufacturingPrinterById(resliceModelId);
      if (!manufacturingPrinter) {
        throw new Error('선택한 프린터 정보를 찾을 수 없습니다.');
      }

      const printerFilename = manufacturingPrinter.filename.replace('.def.json', '');
      const buildVolume = manufacturingPrinter.build_volume || { x: 220, y: 220, z: 250 };

      // GCode 파일명에 사용할 프린터 정보 저장
      const printerInfoForGCode = {
        manufacturer: manufacturingPrinter.manufacturer,
        series: manufacturingPrinter.series,
        model: manufacturingPrinter.display_name
      };

      // 프린터 정의 생성
      const printerDefinition: PrinterDefinition = {
        version: 2,
        overrides: {
          machine_width: { default_value: buildVolume.x },
          machine_depth: { default_value: buildVolume.y },
          machine_height: { default_value: buildVolume.z },
        },
      };

      // Cura 설정 (API는 문자열 값을 요구함)
      const curaSettings: SlicingSettings = {
        layer_height: printSettings.layer_height.toString(),
        line_width: printSettings.line_width.toString(),
        infill_sparse_density: printSettings.infill_sparse_density.toString(),
        wall_line_count: printSettings.wall_line_count.toString(),
        top_layers: printSettings.top_layers.toString(),
        bottom_layers: printSettings.bottom_layers.toString(),
        speed_print: printSettings.speed_print.toString(),
        support_enable: printSettings.support_enable.toString(),
        support_angle: printSettings.support_angle.toString(),
        adhesion_type: printSettings.adhesion_type,
        material_diameter: printSettings.material_diameter.toString(),
        material_flow: printSettings.material_flow.toString(),
      };

      // GLB 파일 가져오기 (기존 슬라이싱과 동일하게 GLB 사용)
      const modelUrl = currentGlbUrl;
      console.log('[AI] 재슬라이싱에 사용할 모델 URL:', modelUrl);

      const response = await fetch(modelUrl);
      if (!response.ok) {
        throw new Error(`모델 다운로드 실패: ${response.status}`);
      }

      const modelBlob = await response.blob();
      const fileExtension = modelUrl.endsWith('.stl') ? 'stl' : 'glb';
      const fileName = currentModel.model_name ? `${currentModel.model_name}.${fileExtension}` : `model.${fileExtension}`;

      // 슬라이싱 API 호출
      const slicingResult = await uploadSTLAndSlice(
        modelBlob,
        fileName,
        curaSettings,
        printerDefinition,
        printerFilename
      );

      if (slicingResult.status === 'error' || !slicingResult.data) {
        throw new Error(slicingResult.error || '슬라이싱 실패');
      }

      console.log('[AI] 재슬라이싱 결과:', {
        gcode_url: slicingResult.data.gcode_url,
        task_id: slicingResult.data.task_id,
        has_metadata: !!slicingResult.data.gcode_metadata
      });

      // GCode 업로드
      const gcodeUrl = slicingResult.data.gcode_url;
      let uploadedGcodeUrl = gcodeUrl;

      if (gcodeUrl && user?.id) {
        const modelName = currentModel.model_name || currentModel.prompt || currentModel.id;
        const uploaded = await downloadAndUploadGCode(
          supabase,
          user.id,
          currentModel.id,
          gcodeUrl,
          resliceModelId,
          modelName,
          printerInfoForGCode,
          slicingResult.data.gcode_metadata
        );
        if (uploaded) {
          uploadedGcodeUrl = uploaded.publicUrl;

          // 캐시된 메타데이터가 있으면 사용
          if (uploaded.metadata) {
            console.log('[AI] Using cached metadata from DB for reslice');
            setGcodeInfo({
              printTime: uploaded.metadata.print_time_formatted,
              filamentLength: uploaded.metadata.filament_used_m ? `${uploaded.metadata.filament_used_m.toFixed(2)}m` : undefined,
              filamentWeight: uploaded.metadata.filament_weight_g ? `${uploaded.metadata.filament_weight_g.toFixed(1)}g` : undefined,
              filamentCost: uploaded.metadata.filament_cost ? `$${uploaded.metadata.filament_cost.toFixed(2)}` : undefined,
              layerCount: uploaded.metadata.layer_count,
              layerHeight: uploaded.metadata.layer_height,
              modelSize: uploaded.metadata.bounding_box ? {
                minX: uploaded.metadata.bounding_box.min_x,
                maxX: uploaded.metadata.bounding_box.max_x,
                minY: uploaded.metadata.bounding_box.min_y,
                maxY: uploaded.metadata.bounding_box.max_y,
                minZ: uploaded.metadata.bounding_box.min_z,
                maxZ: uploaded.metadata.bounding_box.max_z,
              } : undefined,
              nozzleTemp: uploaded.metadata.nozzle_temp,
              bedTemp: uploaded.metadata.bed_temp,
              printerName: uploaded.metadata.printer_name,
            });
          } else if (slicingResult.data.gcode_metadata) {
            // 새로 슬라이싱한 경우 서버 메타데이터 사용
            const metadata = slicingResult.data.gcode_metadata;
            setGcodeInfo({
              printTime: metadata.print_time_formatted,
              filamentLength: metadata.filament_used_m ? `${metadata.filament_used_m.toFixed(2)}m` : undefined,
              filamentWeight: metadata.filament_weight_g ? `${metadata.filament_weight_g.toFixed(1)}g` : undefined,
              filamentCost: metadata.filament_cost ? `$${metadata.filament_cost.toFixed(2)}` : undefined,
              layerCount: metadata.layer_count,
              layerHeight: metadata.layer_height,
              modelSize: metadata.bounding_box ? {
                minX: metadata.bounding_box.min_x,
                maxX: metadata.bounding_box.max_x,
                minY: metadata.bounding_box.min_y,
                maxY: metadata.bounding_box.max_y,
                minZ: metadata.bounding_box.min_z,
                maxZ: metadata.bounding_box.max_z,
              } : undefined,
              nozzleTemp: metadata.nozzle_temp,
              bedTemp: metadata.bed_temp,
              printerName: metadata.printer_name,
            });
          }
        }
      }

      // DB 업데이트 (GCode URL만 저장)
      if (user?.id && uploadedGcodeUrl) {
        await updateAIModel(supabase, currentModel.id, {
          gcode_url: uploadedGcodeUrl,
        });
        console.log('[AI] 재슬라이싱 - GCode URL을 DB에 저장:', uploadedGcodeUrl);
      }

      // UI 업데이트
      const gcodeUrlWithTimestamp = uploadedGcodeUrl ? `${uploadedGcodeUrl}?t=${Date.now()}` : null;
      setCurrentGCodeUrl(gcodeUrlWithTimestamp);

      // 메타데이터를 UI 형식으로 변환하여 설정
      if (slicingResult.data.gcode_metadata) {
        const metadata = slicingResult.data.gcode_metadata;
        setGcodeInfo({
          printTime: metadata.print_time_formatted,
          filamentLength: metadata.filament_used_m ? `${metadata.filament_used_m.toFixed(2)}m` : undefined,
          filamentWeight: metadata.filament_weight_g ? `${metadata.filament_weight_g.toFixed(1)}g` : undefined,
          filamentCost: metadata.filament_cost ? `$${metadata.filament_cost.toFixed(2)}` : undefined,
          layerCount: metadata.layer_count,
          layerHeight: metadata.layer_height,
          modelSize: metadata.bounding_box ? {
            minX: metadata.bounding_box.min_x,
            maxX: metadata.bounding_box.max_x,
            minY: metadata.bounding_box.min_y,
            maxY: metadata.bounding_box.max_y,
            minZ: metadata.bounding_box.min_z,
            maxZ: metadata.bounding_box.max_z,
          } : undefined,
          nozzleTemp: metadata.nozzle_temp,
          bedTemp: metadata.bed_temp,
          printerName: metadata.printer_name,
        });
      }

      toast({
        title: t('ai.resliceComplete'),
        description: t('ai.resliceCompleteDesc'),
      });
    } catch (error) {
      console.error('[AI] Reslice failed:', error);
      toast({
        title: t('ai.resliceFailed'),
        description: error instanceof Error ? error.message : t('ai.resliceFailedError'),
        variant: 'destructive',
      });
    } finally {
      setIsSlicing(false);
    }
  };

  // 제조사 목록 로드 및 기본값 설정 (다이얼로그가 열릴 때)
  useEffect(() => {
    if (printDialogOpen) {
      loadManufacturers();
      loadDefaultPrinterSettings();
    } else {
      // 다이얼로그가 닫힐 때 초기화
      setResliceManufacturer('');
      setResliceSeries('');
      setResliceModelId('');
      setSeriesList([]);
      setModelsList([]);
    }
  }, [printDialogOpen, selectedPrinter, loadManufacturers, loadDefaultPrinterSettings]);

  // 제조사 선택 시 시리즈 목록 로드 (수동 선택 시에만)
  useEffect(() => {
    // 기본값 로딩 중에는 실행하지 않음
    if (isLoadingDefaultPrinter.current) return;

    if (resliceManufacturer) {
      loadSeriesByManufacturer(resliceManufacturer);
    } else {
      setSeriesList([]);
      setResliceSeries('');
      setModelsList([]);
      setResliceModelId('');
    }
  }, [resliceManufacturer, loadSeriesByManufacturer]);

  // 시리즈 선택 시 모델 목록 로드 (수동 선택 시에만)
  useEffect(() => {
    // 기본값 로딩 중에는 실행하지 않음
    if (isLoadingDefaultPrinter.current) return;

    if (resliceManufacturer && resliceSeries) {
      loadModelsByManufacturerAndSeries(resliceManufacturer, resliceSeries);
    } else {
      setModelsList([]);
      setResliceModelId('');
    }
  }, [resliceManufacturer, resliceSeries, loadModelsByManufacturerAndSeries]);

  // Shared 훅의 함수를 래핑
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  // 이미지 삭제 핸들러 (연결된 모델 확인 후 모달 표시)
  const handleImageDelete = async (fileId: number) => {
    const fileToDelete = uploadedFiles.find(f => f.id === fileId);
    if (!fileToDelete) return;

    // 해당 이미지와 연결된 모델 개수 확인
    const linkedModels = generatedModels.filter(
      model => model.source_image_url === fileToDelete.storagePath ||
               model.source_image_url === fileToDelete.url
    );

    setImageToDelete(fileId);
    setLinkedModelsCount(linkedModels.length);
    setDeleteImageDialogOpen(true);
  };

  // 이미지 및 연결된 모델 삭제 확인
  const confirmImageDelete = async () => {
    if (imageToDelete === null) return;

    const fileToDelete = uploadedFiles.find(f => f.id === imageToDelete);
    if (!fileToDelete) return;

    try {
      // 연결된 모든 모델 삭제
      const linkedModels = generatedModels.filter(
        model => model.source_image_url === fileToDelete.storagePath ||
                 model.source_image_url === fileToDelete.url
      );

      for (const model of linkedModels) {
        // 스토리지 파일 삭제 (GLB, STL, 썸네일, GCode)
        if (user?.id) {
          console.log('[AI] Deleting storage files for linked model:', model);
          await deleteModelFiles(supabase, user.id, {
            id: model.id,
            storage_path: model.storage_path,
            stl_url: model.stl_download_url,
            thumbnail_url: model.thumbnail_url,
            gcode_url: model.gcode_url,
            model_name: model.model_name,
            prompt: model.prompt
          });
        }
        // DB에서 모델 삭제
        await deleteAIModel(supabase, model.id);
      }

      // 이미지 파일 삭제
      await deleteFile(imageToDelete);

      // 모델 목록 새로고침
      await reloadModels();

      toast({
        title: t('ai.fileDeleted'),
        description: linkedModelsCount > 0
          ? `${t('ai.imageWithModelsDeleted')} ${linkedModelsCount}${t('ai.linkedModelsWillBeDeleted')}${t('ai.linkedModelsDeleteWarning2')}`
          : t('ai.fileDeletedDescription'),
      });
    } catch (error) {
      console.error('[AI] Failed to delete image and models:', error);
      toast({
        title: t('ai.deleteFailed'),
        description: t('ai.imageModelDeleteError'),
        variant: 'destructive'
      });
    } finally {
      setDeleteImageDialogOpen(false);
      setImageToDelete(null);
      setLinkedModelsCount(0);
    }
  };

  // 모델 목록 다시 로드 - 모든 모델 로드
  const reloadModels = async () => {
    if (!user?.id) return;
    try {
      const result = await listAIModels(supabase, user.id, {
        page: 1,
        pageSize: 100,
      });
      setGeneratedModels(result.items);
    } catch (e) {
      console.error('[AI] reload models failed', e);
    }
  };

  // 개별 모델 삭제 핸들러
  const handleModelDelete = async (item: { id: string | number; name: string }) => {
    try {
      setModelViewerUrl(null);

      // 모델 정보 가져오기
      const modelToDelete = generatedModels.find(m => m.id === item.id.toString());

      // 스토리지 파일 삭제 (GLB, STL, 썸네일, GCode)
      if (modelToDelete && user?.id) {
        console.log('[AI] Deleting storage files for model:', modelToDelete);
        await deleteModelFiles(supabase, user.id, {
          id: modelToDelete.id,
          storage_path: modelToDelete.storage_path,
          stl_url: modelToDelete.stl_download_url,
          thumbnail_url: modelToDelete.thumbnail_url,
          gcode_url: modelToDelete.gcode_url,
          model_name: modelToDelete.model_name,
          prompt: modelToDelete.prompt
        });
      }

      // DB에서 모델 삭제
      await deleteAIModel(supabase, item.id.toString());
      await reloadModels();

      toast({
        title: t('ai.modelDeleted'),
        description: `${item.name}${t('ai.modelDeleteSuccess')}`,
      });
    } catch (error) {
      console.error('[AI] Failed to delete model:', error);
      toast({
        title: t('ai.modelDeleteFailed'),
        description: t('ai.modelDeleteError'),
        variant: 'destructive'
      });
    }
  };

  const generateModel = async () => {
    // 탭별 유효성 검사
    if (activeTab === 'text-to-3d' && !textPrompt.trim()) {
      toast({ title: t('ai.inputRequired'), description: t('ai.textRequired'), variant: "destructive" });
      return;
    }
    if (activeTab === 'image-to-3d') {
      if (uploadedFiles.length === 0) {
        toast({ title: t('ai.inputRequired'), description: t('ai.imageRequired'), variant: "destructive" });
        return;
      }
      // 선택된 이미지 검증
      const fallback = uploadedFiles[uploadedFiles.length - 1];
      const selected = selectedImageId != null ? uploadedFiles.find(f => f.id === selectedImageId) : fallback;

      if (!selected || (!selected.file && !selected.url)) {
        toast({
          title: t('ai.inputRequired'),
          description: t('ai.invalidImageSelected'),
          variant: "destructive"
        });
        return;
      }
    }

    if (!user?.id) {
      toast({ title: t('ai.authRequired'), description: t('auth.loginRequired'), variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    toast({ title: t('ai.generating'), description: t('ai.generatingDescription') });

    let dbModelId: string | null = null;

    try {
      if (activeTab === 'text-to-3d') {
        // 1. DB에 레코드 생성 (status: processing)
        const dbModel = await createAIModel(supabase, {
          generation_type: 'text_to_3d',
          prompt: textPrompt,
          art_style: textArtStyle,
          target_polycount: textTargetPolycount,
          symmetry_mode: textSymmetryMode,
          model_name: `Text-to-3D: ${textPrompt.substring(0, 30)}...`,
        }, user.id);

        dbModelId = dbModel.id;

        // 2. 텍스트 → 3D API 호출 (async_mode=true)
        const payload = {
          task: 'text_to_3d',
          prompt: textPrompt,
          ...buildCommon(textSymmetryMode, textArtStyle, textTargetPolycount, user?.id, 'web'),
        };

        // async_mode로 즉시 task_id 받기
        const initialResponse = await postTextTo3D(payload, true); // async_mode=true
        console.log('[AI.tsx] Initial response:', JSON.stringify(initialResponse, null, 2));

        const taskId = initialResponse.data?.task_id || initialResponse.task_id;
        console.log('[AI.tsx] Task ID:', taskId);

        if (!taskId) {
          throw new Error('Task ID를 받지 못했습니다.');
        }

        // 진행률 폴링
        const result = await pollTaskUntilComplete(taskId, (progress, status) => {
          setProgress(progress);
          setProgressStatus(status);
          console.log(`[AI.tsx] Progress: ${progress}% (${status})`);
        });

        console.log('[AI.tsx] Final result:', JSON.stringify(result, null, 2));

        const glbUrl = extractGLBUrl(result);
        console.log('[AI.tsx] Extracted GLB URL:', glbUrl);

        const stlUrl = extractSTLUrl(result);
        console.log('[AI.tsx] Extracted STL URL:', stlUrl);

        const thumbnailUrl = extractThumbnailUrl(result);
        console.log('[AI.tsx] Extracted thumbnail URL:', thumbnailUrl);

        const metadata = extractMetadata(result);
        console.log('[AI.tsx] Extracted metadata:', metadata);

        if (glbUrl || stlUrl) {
          // 3. Python 서버에서 모델 다운로드 → Supabase Storage에 업로드
          let glbUploadResult = null;
          let stlUploadResult = null;

          // GLB 파일 다운로드 및 업로드
          if (glbUrl) {
            try {
              console.log('[AI] Downloading and uploading GLB to Supabase...', glbUrl);
              glbUploadResult = await downloadAndUploadModel(supabase, user.id, dbModelId, glbUrl);
            } catch (glbError) {
              console.error('[AI] Failed to upload GLB:', glbError);
            }
          }

          // STL 파일 다운로드 및 업로드
          if (stlUrl) {
            try {
              console.log('[AI] Downloading and uploading STL to Supabase...', stlUrl);
              stlUploadResult = await downloadAndUploadSTL(supabase, user.id, dbModelId, stlUrl);
            } catch (stlError) {
              console.error('[AI] Failed to upload STL:', stlError);
            }
          }

          // 3-1. 썸네일도 Supabase Storage에 다운로드 및 업로드
          let thumbnailUploadResult = null;
          if (thumbnailUrl) {
            try {
              console.log('[AI] Downloading and uploading thumbnail to Supabase...', thumbnailUrl);
              thumbnailUploadResult = await downloadAndUploadThumbnail(supabase, user.id, dbModelId, thumbnailUrl);
            } catch (thumbnailError) {
              console.error('[AI] Failed to upload thumbnail:', thumbnailError);
              // 썸네일 업로드 실패는 치명적이지 않으므로 계속 진행
            }
          }

          // 4. DB 업데이트 (Supabase Storage URL 사용)
          // GLB URL을 우선적으로 렌더링에 사용
          const renderUrl = glbUploadResult?.publicUrl || stlUploadResult?.publicUrl;

          await updateAIModel(supabase, dbModelId, {
            storage_path: glbUploadResult?.path || undefined,           // GLB Supabase Storage 경로
            download_url: glbUploadResult?.publicUrl || undefined,     // GLB Supabase Public URL
            stl_storage_path: stlUploadResult?.path || undefined,      // STL Supabase Storage 경로
            stl_download_url: stlUploadResult?.publicUrl || undefined, // STL Supabase Public URL
            thumbnail_url: thumbnailUploadResult?.publicUrl || undefined,  // Supabase Storage 썸네일 URL
            status: 'completed',
            generation_metadata: metadata || undefined,
            file_format: stlUploadResult ? 'stl' : 'glb',  // STL이 있으면 STL, 없으면 GLB
          });

          // 5. Supabase Storage URL로 렌더링 (STL 우선)
          if (renderUrl) {
            setModelViewerUrl(renderUrl);
            setCurrentGlbUrl(glbUploadResult?.publicUrl || null);
            setCurrentStlUrl(stlUploadResult?.publicUrl || null);
            toast({ title: t('ai.generationComplete'), description: t('ai.textGenerationComplete') });
          } else {
            throw new Error('No model files were uploaded successfully');
          }

          // 모델 목록 새로고침
          await reloadModels();
        } else {
          // URL이 없으면 실패 처리
          await updateAIModel(supabase, dbModelId, {
            status: 'failed',
            generation_metadata: { error: 'No model URL in response' },
          });
          toast({ title: t('ai.generationFailed'), description: 'No model URL in response', variant: 'destructive' });
        }

      } else if (activeTab === 'image-to-3d') {
        // 이미지 → 3D
        const fallback = uploadedFiles[uploadedFiles.length - 1];
        const selected = selectedImageId != null ? uploadedFiles.find(f => f.id === selectedImageId) : fallback;

        if (!selected) {
          throw new Error(t('ai.imageRequired2'));
        }

        // File 객체가 없는 경우 (Storage에서 로드된 이미지) URL에서 fetch
        let file: File;
        if (selected.file) {
          file = selected.file;
        } else if (selected.url) {
          toast({ title: t('ai.generating'), description: t('ai.loadingImage') });
          const response = await fetch(selected.url);
          const blob = await response.blob();
          file = new File([blob], selected.name, { type: selected.type || 'image/jpeg' });
        } else {
          throw new Error(t('ai.imageNotFound'));
        }

        // 1. DB에 레코드 생성 (Supabase Storage 경로 저장)
        const dbModel = await createAIModel(supabase, {
          generation_type: 'image_to_3d',
          source_image_url: selected.storagePath || selected.url, // Supabase Storage 경로 또는 URL
          art_style: imageArtStyle,
          target_polycount: imageTargetPolycount,
          symmetry_mode: imageSymmetryMode,
          model_name: `Image-to-3D: ${selected.name}`,
        }, user.id);

        dbModelId = dbModel.id;

        // 2. 이미지 → 3D API 호출 (async_mode=true)
        const common = buildCommon(imageSymmetryMode, imageArtStyle, imageTargetPolycount, user?.id, 'web');

        const form = new FormData();
        form.append('task', 'image_to_3d');
        form.append('image_file', file, file.name);
        form.append('json', JSON.stringify(common));

        // async_mode로 즉시 task_id 받기
        const initialResponse = await postImageTo3D(form, true); // async_mode=true
        console.log('[AI.tsx] Initial response:', JSON.stringify(initialResponse, null, 2));

        const taskId = initialResponse.data?.task_id || initialResponse.task_id;
        console.log('[AI.tsx] Task ID:', taskId);

        if (!taskId) {
          throw new Error('Task ID를 받지 못했습니다.');
        }

        // 진행률 폴링
        const result = await pollTaskUntilComplete(taskId, (progress, status) => {
          setProgress(progress);
          setProgressStatus(status);
          console.log(`[AI.tsx] Progress: ${progress}% (${status})`);
        });

        console.log('[AI.tsx] Final result:', JSON.stringify(result, null, 2));

        const glbUrl = extractGLBUrl(result);
        console.log('[AI.tsx] Extracted GLB URL:', glbUrl);

        const thumbnailUrl = extractThumbnailUrl(result);
        console.log('[AI.tsx] Extracted thumbnail URL:', thumbnailUrl);

        const metadata = extractMetadata(result);
        console.log('[AI.tsx] Extracted metadata:', metadata);

        const stlUrl = extractSTLUrl(result);
        console.log('[AI.tsx] Extracted STL URL:', stlUrl);

        if (glbUrl || stlUrl) {
          // 3. Python 서버에서 모델 다운로드 → Supabase Storage에 업로드
          let glbUploadResult = null;
          let stlUploadResult = null;

          // GLB 파일 다운로드 및 업로드
          if (glbUrl) {
            try {
              console.log('[AI] Downloading and uploading GLB to Supabase...', glbUrl);
              glbUploadResult = await downloadAndUploadModel(supabase, user.id, dbModelId, glbUrl);
            } catch (glbError) {
              console.error('[AI] Failed to upload GLB:', glbError);
            }
          }

          // STL 파일 다운로드 및 업로드
          if (stlUrl) {
            try {
              console.log('[AI] Downloading and uploading STL to Supabase...', stlUrl);
              stlUploadResult = await downloadAndUploadSTL(supabase, user.id, dbModelId, stlUrl);
            } catch (stlError) {
              console.error('[AI] Failed to upload STL:', stlError);
            }
          }

          // 3-1. 썸네일도 Supabase Storage에 다운로드 및 업로드
          let thumbnailUploadResult = null;
          if (thumbnailUrl) {
            try {
              console.log('[AI] Downloading and uploading thumbnail to Supabase...', thumbnailUrl);
              thumbnailUploadResult = await downloadAndUploadThumbnail(supabase, user.id, dbModelId, thumbnailUrl);
            } catch (thumbnailError) {
              console.error('[AI] Failed to upload thumbnail:', thumbnailError);
              // 썸네일 업로드 실패는 치명적이지 않으므로 계속 진행
            }
          }

          // 4. DB 업데이트 (Supabase Storage URL 사용)
          // GLB URL을 우선적으로 렌더링에 사용
          const renderUrl = glbUploadResult?.publicUrl || stlUploadResult?.publicUrl;

          await updateAIModel(supabase, dbModelId, {
            storage_path: glbUploadResult?.path || undefined,           // GLB Supabase Storage 경로
            download_url: glbUploadResult?.publicUrl || undefined,     // GLB Supabase Public URL
            stl_storage_path: stlUploadResult?.path || undefined,      // STL Supabase Storage 경로
            stl_download_url: stlUploadResult?.publicUrl || undefined, // STL Supabase Public URL
            thumbnail_url: thumbnailUploadResult?.publicUrl || undefined,  // Supabase Storage 썸네일 URL
            status: 'completed',
            generation_metadata: metadata || undefined,
            file_format: stlUploadResult ? 'stl' : 'glb',  // STL이 있으면 STL, 없으면 GLB
            source_image_url: selected.storagePath || metadata?.uploaded_local_path || selected.url,
          });

          // 5. Supabase Storage URL로 렌더링 (STL 우선)
          if (renderUrl) {
            setModelViewerUrl(renderUrl);
            setCurrentGlbUrl(glbUploadResult?.publicUrl || null);
            setCurrentStlUrl(stlUploadResult?.publicUrl || null);
            toast({ title: t('ai.generationComplete'), description: t('ai.imageGenerationComplete') });
          } else {
            throw new Error('No model files were uploaded successfully');
          }

          // 모델 목록 새로고침
          await reloadModels();
        } else {
          await updateAIModel(supabase, dbModelId, {
            status: 'failed',
            generation_metadata: { error: 'No model URL in response' },
          });
          toast({ title: t('ai.generationFailed'), description: 'No model URL in response', variant: 'destructive' });
        }

      } else {
        throw new Error(t('ai.unsupportedGenerationType'));
      }

    } catch (e: unknown) {
      console.error('[AI] 생성 실패:', e);

      // DB에 실패 상태 기록
      if (dbModelId) {
        try {
          await updateAIModel(supabase, dbModelId, {
            status: 'failed',
            generation_metadata: { error: e instanceof Error ? e.message : 'Unknown error' },
          });
        } catch (updateError) {
          console.error('[AI] DB 업데이트 실패:', updateError);
        }
      }

      toast({
        title: t('ai.generationFailed'),
        description: (e instanceof Error ? e.message : String(e)) || t('ai.generationError'),
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setProgressStatus('');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* 메인 작업 영역 */}
        <div className="flex-1 flex flex-col">
          {/* 헤더 */}
          <div className="border-b p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Layers className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">{t('ai.title')}</h1>
            </div>
          </div>

          {/* 탭 및 작업 영역 */}
          <div className="flex-1 p-4 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-3 mb-6 shrink-0">
                <TabsTrigger value="text-to-3d" className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  {t('ai.textTo3D')}
                </TabsTrigger>
                <TabsTrigger value="image-to-3d" className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  {t('ai.imageTo3D')}
                </TabsTrigger>
                <TabsTrigger value="text-to-image" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {t('ai.textToImage')}
                </TabsTrigger>
              </TabsList>

              {/* 텍스트 → 3D 탭 */}
              <TabsContent value="text-to-3d" className="flex-1 min-h-0 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-6 h-full">
                  {/* 입력 영역 → TextTo3DForm */}
                  <TextTo3DForm
                    prompt={textPrompt}
                    symmetryMode={textSymmetryMode}
                    artStyle={textArtStyle}
                    targetPolycount={textTargetPolycount}
                    isProcessing={isProcessing}
                    onChangePrompt={setTextPrompt}
                    onChangeSymmetryMode={setTextSymmetryMode}
                    onChangeArtStyle={setTextArtStyle}
                    onChangeTargetPolycount={setTextTargetPolycount}
                    onSubmit={generateModel}
                  />

                  {/* 프리뷰 영역 → ModelPreview */}
                  <ModelPreview
                    isProcessing={isProcessing}
                    modelUrl={modelViewerUrl ?? undefined}
                    glbDownloadUrl={currentGlbUrl ?? undefined}
                    stlDownloadUrl={currentStlUrl ?? undefined}
                    progress={progress}
                    progressStatus={progressStatus}
                    modelId={currentModelId ?? undefined}
                    onSave={handleModelSave}
                  />
                </div>
              </TabsContent>

              {/* 이미지 → 3D 탭 */}
              <TabsContent value="image-to-3d" className="flex-1 min-h-0 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-6 h-full">
                  <ImageTo3DForm
                    files={uploadedFiles}
                    selectedId={selectedImageId}
                    symmetryMode={imageSymmetryMode}
                    artStyle={imageArtStyle}
                    targetPolycount={imageTargetPolycount}
                    isProcessing={isProcessing}
                    hasExistingModel={selectedImageHasModel}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onFileChange={handleFileUpload}
                    onRemove={handleImageDelete}
                    onSelect={selectImage}
                    onChangeSymmetryMode={setImageSymmetryMode}
                    onChangeArtStyle={setImageArtStyle}
                    onChangeTargetPolycount={setImageTargetPolycount}
                    onSubmit={generateModel}
                  />

                  {/* 결과 영역 */}
                  <Card className="h-fit lg:sticky top-4">
                    <CardContent className="p-0">
                      <div className="rounded-lg overflow-hidden h-[calc(85vh-4rem-2rem)] relative">
                        <Suspense fallback={
                          <div className="flex items-center justify-center h-full bg-muted">
                            <div className="text-center">
                              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground">Loading 3D viewer...</p>
                            </div>
                          </div>
                        }>
                          <ModelViewer
                            key={currentModelId || modelViewerUrl || 'default'} // 모델 변경 시 뷰어 재생성하여 카메라 리셋
                            className="w-full h-full"
                            modelUrl={modelViewerUrl ?? undefined}
                            modelScale={1}
                            enableRotationControls={true}
                            modelId={currentModelId ?? undefined}
                            onSave={handleModelSave}
                          />
                        </Suspense>

                        {/* 다운로드 드롭다운 버튼 - 오른쪽 위 */}
                        {(currentGlbUrl || currentStlUrl) && !isProcessing && (
                          <div className="absolute top-4 right-4 z-20">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="flex items-center gap-2 shadow-lg"
                                >
                                  <Download className="w-4 h-4" />
                                  Download
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {currentGlbUrl && (
                                  <DropdownMenuItem onClick={async () => {
                                    try {
                                      toast({ title: t('ai.downloadStarted'), description: t('ai.downloadingGLB') });
                                      const response = await fetch(currentGlbUrl);
                                      const blob = await response.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const link = document.createElement('a');
                                      link.href = url;
                                      link.download = `model_${Date.now()}.glb`;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      window.URL.revokeObjectURL(url);
                                      toast({ title: t('ai.downloadComplete'), description: t('ai.glbDownloaded') });
                                    } catch (error) {
                                      toast({ title: t('ai.downloadFailed'), variant: 'destructive' });
                                    }
                                  }}>
                                    <Download className="w-4 h-4 mr-2" />
                                    {t('ai.downloadGLB')}
                                  </DropdownMenuItem>
                                )}
                                {currentStlUrl && (
                                  <DropdownMenuItem onClick={async () => {
                                    try {
                                      toast({ title: t('ai.downloadStarted'), description: t('ai.downloadingSTL') });
                                      const response = await fetch(currentStlUrl);
                                      const blob = await response.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const link = document.createElement('a');
                                      link.href = url;
                                      link.download = `model_${Date.now()}.stl`;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      window.URL.revokeObjectURL(url);
                                      toast({ title: t('ai.downloadComplete'), description: t('ai.stlDownloaded') });
                                    } catch (error) {
                                      toast({ title: t('ai.downloadFailed'), variant: 'destructive' });
                                    }
                                  }}>
                                    <Download className="w-4 h-4 mr-2" />
                                    {t('ai.downloadSTL')}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}

                        {isProcessing && (
                          <div className="absolute inset-0 bg-gray-900/95 flex items-center justify-center z-10">
                            <div className="text-center space-y-6 max-w-md w-full px-8">
                              {/* Circular spinning icon */}
                              <div className="relative w-24 h-24 mx-auto">
                                <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
                                <Sparkles className="absolute inset-0 m-auto w-12 h-12 text-blue-500" />
                              </div>

                              {/* Title */}
                              <h2 className="text-2xl font-bold text-white">
                                {t('ai.generatingAI')}
                              </h2>

                              {/* Subtitle */}
                              <p className="text-lg text-gray-300">{t('ai.generatingDesc')}</p>

                              {/* Progress section */}
                              {progress > 0 && (
                                <div className="space-y-3 mt-6">
                                  {/* Progress label and percentage */}
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400">{t('ai.progressLabel')}</span>
                                    <span className="text-white font-semibold">{progress}%</span>
                                  </div>

                                  {/* Progress bar */}
                                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                    <div
                                      className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
                                      style={{ width: `${progress}%` }}
                                    ></div>
                                  </div>

                                  {/* Estimated time */}
                                  <p className="text-sm text-gray-400 text-center">
                                    {t('ai.estimatedTime')}: {Math.max(1, Math.ceil((100 - progress) / 25))}s
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                       </CardContent>
                     </Card>
                   </div>
                 </TabsContent>

              {/* 텍스트 → 이미지 탭 */}
              <TabsContent value="text-to-image" className="flex-1 min-h-0 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-6 h-full">
                  <Card className="lg:sticky top-4 max-h-[calc(85vh-4rem-2rem)] overflow-auto">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Camera className="w-5 h-5" />
                        {t('ai.imageGeneration')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t('ai.imageDescription')}</label>
                        <Textarea
                          placeholder={t('ai.imageDescriptionPlaceholder')}
                          value={textPrompt}
                          onChange={(e) => setTextPrompt(e.target.value)}
                          className="min-h-[120px]"
                        />
                      </div>

                      {/* 이미지 설정 */}
                      <div className="space-y-4 p-4 bg-muted/5 rounded-lg">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t('ai.artStyle')}</label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="default" size="sm">{t('ai.realistic')}</Button>
                            <Button variant="outline" size="sm">{t('ai.cartoon')}</Button>
                            <Button variant="outline" size="sm">{t('ai.abstract')}</Button>
                            <Button variant="outline" size="sm">{t('ai.pixelArt')}</Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t('ai.resolution')}</label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm">512x512</Button>
                            <Button variant="default" size="sm">1024x1024</Button>
                          </div>
                        </div>
                      </div>

                      <Button onClick={generateModel} className="w-full" size="lg">
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t('ai.generatingImage')}
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4 mr-2" />
                            {t('ai.generateImage')}
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                    <Card className="h-fit lg:sticky top-4">
                    <CardContent className="p-0">
                      <div className="bg-gray-900 rounded-lg flex items-center justify-center h-[calc(85vh-4rem-2rem)] relative overflow-hidden">
                        {isProcessing ? (
                          <div className="flex flex-col items-center justify-center gap-4 z-10">
                            <Loader2 className="w-12 h-12 text-primary animate-spin" />
                            <div className="text-center">
                              <p className="text-lg font-medium text-white">{t('ai.processing')}</p>
                              <p className="text-sm text-muted-foreground">{t('ai.pleaseWait')}</p>
                            </div>
                          </div>
                        ) : generatedImageUrl ? (
                          <img
                            src={generatedImageUrl}
                            alt="Generated"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                            <div className="absolute inset-0" style={{
                              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                              backgroundSize: '20px 20px'
                            }} />
                            <div className="text-center z-10">
                              <Box className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">{t('ai.generatedImagePlaceholder')}</p>
                            </div>
                          </div>
                        )}

                        {/* 이미지 다운로드 버튼 - 오른쪽 위 */}
                        {generatedImageUrl && !isProcessing && (
                          <div className="absolute top-4 right-4 z-20">
                            <Button
                              onClick={async () => {
                                try {
                                  toast({ title: t('ai.downloadStarted'), description: t('ai.downloadingImage') });
                                  const response = await fetch(generatedImageUrl);
                                  const blob = await response.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = `generated_image_${Date.now()}.png`;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  window.URL.revokeObjectURL(url);
                                  toast({ title: t('ai.downloadComplete'), description: t('ai.imageDownloaded') });
                                } catch (error) {
                                  toast({ title: t('ai.downloadFailed'), variant: 'destructive' });
                                }
                              }}
                              variant="secondary"
                              size="sm"
                              className="flex items-center gap-2 shadow-lg"
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </Button>
                          </div>
                        )}
                       </div>
                     </CardContent>
                   </Card>
                 </div>
               </TabsContent>
             </Tabs>
           </div>
         </div>

        {/* 사이드바 - 모든 탭에서 모델 아카이브 통일 */}
        <div className="w-[340px] border-l bg-muted/5 flex flex-col overflow-hidden">
          {/* 모델 아카이브 영역 (동적 높이) */}
          <div
            className="flex flex-col p-6 overflow-hidden"
            style={{ height: (activeTab === 'text-to-3d' || activeTab === 'image-to-3d') ? `${100 - printerAreaHeight}%` : '100%' }}
          >
            <div className="flex items-center justify-between mb-4">
              {/* 제목 - 왼쪽 */}
              <h2 className="text-lg font-semibold">{t('ai.modelArchive').toUpperCase()}</h2>
              {/* RAW / 3D/2D 모델 토글 - 오른쪽 (탭에 따라 레이블 변경) */}
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant={archiveViewMode === 'raw' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setArchiveViewMode('raw')}
                >
                  RAW
                </Button>
                <Button
                  variant={archiveViewMode === '3d' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setArchiveViewMode('3d')}
                >
                  {activeTab === 'text-to-image' ? '2D' : '3D'}
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {archiveViewMode === 'raw' ? (
                // RAW 모드: 입력 데이터 보여주기
                (archiveFilter === 'image-to-3d') ? (
                  // 이미지→3D: 업로드된 이미지 목록
                  <UploadArchive
                    items={uploadedFiles.map(file => ({
                      ...file,
                      has3DModel: generatedModels.some(
                        model => model.source_image_url === file.storagePath || model.source_image_url === file.url
                      ),
                    }))}
                    selectedId={selectedImageId}
                    onSelect={(fileId) => {
                      selectImage(fileId);
                      const file = uploadedFiles.find(f => f.id === fileId);
                      if (file) {
                        const linkedModel = generatedModels.find(
                          model => model.source_image_url === file.storagePath || model.source_image_url === file.url
                        );
                        if (linkedModel?.download_url) {
                          setModelViewerUrl(linkedModel.download_url);
                          setSelectedImageHasModel(true);
                          toast({ title: t('ai.imageSelected'), description: file.name });
                        } else {
                          setSelectedImageHasModel(false);
                          setModelViewerUrl(null);
                        }
                      }
                    }}
                  />
                ) : (
                  // 텍스트→3D 또는 텍스트→이미지: 프롬프트 목록 표시
                  <ModelArchive
                    items={generatedModels
                      .filter(model => {
                        switch (archiveFilter) {
                          case 'all':
                            return true;
                          case 'text-to-3d':
                            return model.generation_type === 'text_to_3d';
                          case 'text-to-image':
                            return model.generation_type === 'text_to_image';
                          default:
                            return model.generation_type !== 'image_to_3d';
                        }
                      })
                      .map(model => ({
                        id: model.id,
                        name: model.prompt || model.model_name, // 프롬프트 우선 표시
                        createdAt: model.created_at,
                        download_url: undefined, // RAW 모드에서는 다운로드 URL 숨김
                        thumbnail_url: undefined,
                        gcode_url: model.gcode_url, // GCode URL 추가
                        isGenerating: model.status === 'processing', // 생성 중인지 확인
                      }))}
                    onSelect={(model) => {
                      toast({
                        title: t('ai.rawData'),
                        description: t('ai.inputTextPrompt')
                      });
                    }}
                  />
                )
              ) : (
                // 3D/2D 모드: 생성된 모델 보여주기
                <ModelArchive
                  items={generatedModels
                    .filter(model => {
                      // 타입 필터
                      let typeMatch = false;
                      switch (archiveFilter) {
                        case 'all':
                          typeMatch = true;
                          break;
                        case 'text-to-3d':
                          typeMatch = model.generation_type === 'text_to_3d';
                          break;
                        case 'image-to-3d':
                          typeMatch = model.generation_type === 'image_to_3d';
                          break;
                        case 'text-to-image':
                          typeMatch = model.generation_type === 'text_to_image';
                          break;
                        default:
                          typeMatch = false;
                      }

                      if (!typeMatch) return false;

                      // 매핑된 입력 데이터가 있는 모델만 표시
                      if (model.generation_type === 'image_to_3d') {
                        // 이미지→3D: source_image_url이 있어야 함
                        return !!model.source_image_url;
                      } else if (model.generation_type === 'text_to_3d' || model.generation_type === 'text_to_image') {
                        // 텍스트→3D/이미지: prompt가 있어야 함
                        return !!model.prompt;
                      }
                      return true;
                    })
                    .map(model => {
                      // Supabase Storage URL만 허용 (CORS 에러 방지)
                      const isSupabaseUrl = model.download_url?.includes('supabase.co') ||
                                           model.download_url?.includes('localhost') ||
                                           model.download_url?.includes('127.0.0.1');
                      const isThumbnailSupabaseUrl = model.thumbnail_url?.includes('supabase.co') ||
                                                     model.thumbnail_url?.includes('localhost') ||
                                                     model.thumbnail_url?.includes('127.0.0.1');

                      return {
                        id: model.id,
                        name: model.model_name,
                        createdAt: model.created_at,
                        download_url: isSupabaseUrl ? model.download_url : undefined,
                        thumbnail_url: isThumbnailSupabaseUrl ? model.thumbnail_url : undefined,
                        gcode_url: model.gcode_url, // GCode URL 추가
                        isGenerating: model.status === 'processing', // 생성 중인지 확인
                        _originalModel: model, // 원본 모델 정보 저장
                      };
                    })
                  }
                  onSelect={async (item: { id: string | number; _originalModel?: AIGeneratedModel; download_url?: string; name?: string }) => {
                    const model = item._originalModel;

                    if (item.download_url && model) {
                      console.log('[AI] ===== 모델 아카이브에서 모델 선택됨 =====');
                      console.log('[AI] 모델명:', item.name);
                      console.log('[AI] 모델 ID:', model.id);
                      console.log('[AI] GLB URL:', model.download_url);
                      console.log('[AI] STL URL:', model.stl_download_url);
                      console.log('[AI] GCode URL:', model.gcode_url);

                      // 모델 ID 설정
                      setCurrentModelId(model.id);

                      // GLB 우선, STL 폴백으로 뷰어 URL 설정
                      const viewerUrl = model.download_url || model.stl_download_url;
                      console.log('[AI] ===== MODEL SELECTION =====');
                      console.log('[AI] Setting modelViewerUrl to:', viewerUrl);
                      console.log('[AI] Previous modelViewerUrl was:', modelViewerUrl);
                      setModelViewerUrl(viewerUrl);

                      // 다운로드 버튼용 URL 설정
                      setCurrentGlbUrl(model.download_url || null);
                      setCurrentStlUrl(model.stl_download_url || null);
                      setCurrentGCodeUrl(null); // 새 모델 선택 시 GCode 초기화

                      console.log('[AI] 상태 업데이트 완료:');
                      console.log('[AI]   - currentModelId:', model.id);
                      console.log('[AI]   - currentGlbUrl:', model.download_url || null);
                      console.log('[AI]   - currentStlUrl:', model.stl_download_url || null);
                      console.log('[AI]   - currentGCodeUrl: null (초기화됨)');

                      // 왼쪽 사이드바에 매핑된 입력 데이터 표시
                      if (model.generation_type === 'image_to_3d') {
                        // 이미지→3D: 매핑된 이미지 선택
                        const matchedFile = uploadedFiles.find(
                          f => f.storagePath === model.source_image_url || f.url === model.source_image_url
                        );
                        if (matchedFile) {
                          selectImage(matchedFile.id);
                          setActiveTab('image-to-3d');
                          toast({
                            title: t('ai.modelLoad'),
                            description: `${item.name} ${t('ai.modelAndImageSelected')}`
                          });
                        }
                      } else if (model.generation_type === 'text_to_3d') {
                        // 텍스트→3D: 텍스트 입력란에 프롬프트 넣기
                        if (model.prompt) {
                          setTextPrompt(model.prompt);
                          setActiveTab('text-to-3d');
                          toast({
                            title: t('ai.modelLoad'),
                            description: `${item.name} ${t('ai.modelAndPromptRestored')}`
                          });
                        }
                      } else {
                        toast({
                          title: t('ai.modelLoad'),
                          description: `${item.name} ${t('ai.rendering')}`
                        });
                      }
                    } else {
                      // 모델 파일을 찾을 수 없으면 자동 삭제
                      try {
                        setModelViewerUrl(null);
                        await deleteAIModel(supabase, item.id.toString());
                        await reloadModels();
                        toast({
                          title: t('ai.modelDeleted'),
                          description: t('ai.modelNotFound'),
                          variant: 'default'
                        });
                      } catch (error) {
                        console.error('[AI] Failed to delete model:', error);
                        toast({
                          title: t('ai.modelDeleteFailed'),
                          description: t('ai.modelDeleteError'),
                          variant: 'destructive'
                        });
                      }
                    }
                  }}
                  onDelete={handleModelDelete}
                />
              )}
            </div>

            {/* 컨트롤 버튼 */}
            <div className="flex items-center justify-center gap-2 mt-4 p-2 bg-muted/5 rounded-lg shrink-0">
              <Button
                variant={'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  // 폴더 버튼: 전체 보기
                  setArchiveFilter('all');
                }}
                title="전체 보기"
              >
                <FolderOpen className="w-4 h-4" />
              </Button>
              <Button
                variant={archiveFilter === 'text-to-3d' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  setArchiveFilter('text-to-3d');
                  setActiveTab('text-to-3d');
                }}
                title="텍스트→3D"
              >
                <Type className="w-4 h-4" />
              </Button>
              <Button
                variant={archiveFilter === 'image-to-3d' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  setArchiveFilter('image-to-3d');
                  setActiveTab('image-to-3d');
                }}
                title="이미지→3D"
              >
                <ImageFile className="w-4 h-4" />
              </Button>
              <Button
                variant={archiveFilter === 'text-to-image' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  setArchiveFilter('text-to-image');
                  setActiveTab('text-to-image');
                }}
                title="텍스트→이미지"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* 연결된 프린터 영역 (높이 조절 가능) - 3D 관련 탭에서만 표시 */}
          {(activeTab === 'text-to-3d' || activeTab === 'image-to-3d') && (
            <div
              className="flex flex-col border-t overflow-hidden relative"
              style={{ height: `${printerAreaHeight}%` }}
            >
              {/* 리사이저 핸들 */}
              <div
                className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-primary/50 transition-colors z-10 group"
                onMouseDown={handleResizeStart}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-1 bg-border group-hover:bg-primary rounded-full transition-colors" />
              </div>

              <div className="flex flex-col p-6 pt-8 h-full overflow-hidden">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <h3 className="font-medium">{t('ai.connectedPrinters')}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {t('ai.connection')}: {connectedCount}/{totalPrinters}
                    </Badge>
                    <Badge className="rounded-full px-3 py-1 text-xs">
                      {t('ai.printing')}: {printingCount}
                    </Badge>
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-3 pr-4">
                    {printers.map((printer) => (
                      <PrinterCard
                        key={printer.id}
                        id={printer.id}
                        name={printer.name}
                        status={printer.state}
                        temperature={printer.temperature}
                        progress={printer.completion}
                        onClick={() => openPrinterSettings(printer)}
                        isAvailable={
                          !!currentGCodeUrl &&
                          (printer.state === 'idle' || printer.state === 'disconnected') &&
                          (!targetPrinterModelId || printer.manufacture_id === targetPrinterModelId)
                        }
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 출력 설정 다이얼로그 */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="w-[75vw] max-w-[75vw] max-h-[90vh] overflow-hidden p-0 rounded-xl" aria-describedby={undefined}>
          <div className="flex flex-col h-full">
            {/* 헤더 */}
            <div className="px-6 py-4 border-b">
              <DialogHeader className="flex flex-row items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-semibold">
                    {t('ai.printSettings')}{selectedPrinter ? ` - ${selectedPrinter.name}` : ''}
                  </DialogTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      // 기본값으로 되돌리기
                      loadDefaultPrinterSettings();
                    }}
                    title={t('ai.resetToDefault')}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </DialogHeader>
            </div>

            {/* 프린터 선택 바 (상단 수평 레이아웃) */}
            <div className="px-6 pt-4 pb-2 bg-muted/30">
              <div className="flex items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-muted-foreground block mb-1.5">{t('ai.manufacturer')}</label>
                  <select
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                    value={resliceManufacturer}
                    onChange={(e) => setResliceManufacturer(e.target.value)}
                    disabled={isSlicing}
                  >
                    <option value="">{t('ai.selectOption')}</option>
                    {manufacturers.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-muted-foreground block mb-1.5">{t('ai.series')}</label>
                  <select
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                    value={resliceSeries}
                    onChange={(e) => setResliceSeries(e.target.value)}
                    disabled={isSlicing || !resliceManufacturer}
                  >
                    <option value="">{t('ai.selectOption')}</option>
                    {seriesList.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-muted-foreground block mb-1.5">{t('ai.printerModel')}</label>
                  <select
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                    value={resliceModelId}
                    onChange={(e) => setResliceModelId(e.target.value)}
                    disabled={isSlicing || !resliceSeries}
                  >
                    <option value="">{t('ai.selectOption')}</option>
                    {modelsList.map(model => (
                      <option key={model.id} value={model.id}>{model.display_name}</option>
                    ))}
                  </select>
                </div>

                <Button
                  variant="default"
                  className="px-8"
                  disabled={
                    isSlicing ||
                    !resliceModelId ||
                    selectedPrinter?.manufacture_id === resliceModelId
                  }
                  onClick={handleReslice}
                >
                  {isSlicing ? t('ai.reslicing') : t('ai.reslice')}
                </Button>
              </div>
            </div>

            {/* 본문 */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(560px,1fr)_440px] gap-6 p-6 overflow-hidden flex-1 relative">
              {/* 슬라이싱 중 오버레이 */}
              {isSlicing && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="text-lg font-medium">{t('ai.slicingInProgress')}</p>
                    <p className="text-sm text-muted-foreground">{t('ai.slicingInProgressDescription')}</p>
                  </div>
                </div>
              )}

              {/* 좌: G-code 프리뷰 */}
              <Card className="overflow-hidden">
                <CardContent className="p-0 h-[60vh]">
                  <Suspense fallback={<div className="w-full h-full flex items-center justify-center">Loading...</div>}>
                    <GCodePreview gcodeUrl={currentGCodeUrl ?? modelViewerUrl ?? undefined} />
                  </Suspense>
                </CardContent>
              </Card>

              {/* 우: 출력 정보 */}
              <div className="h-[60vh] overflow-y-auto pr-1">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">{t('ai.printInfo')}</h3>

                  {gcodeInfo ? (
                    <>
                      {/* 시간 정보 */}
                      <Card>
                        <CardContent className="p-4 space-y-3">
                          <h4 className="font-medium text-sm text-muted-foreground">{t('ai.printTime')}</h4>
                          {gcodeInfo.printTime && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm">{t('ai.estimatedPrintTime')}</span>
                              <span className="font-semibold">{gcodeInfo.printTime}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* 필라멘트 정보 */}
                      <Card>
                        <CardContent className="p-4 space-y-3">
                          <h4 className="font-medium text-sm text-muted-foreground">{t('ai.filament')}</h4>
                          {gcodeInfo.filamentLength && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm">{t('ai.filamentLength')}</span>
                              <span className="font-semibold">{gcodeInfo.filamentLength}</span>
                            </div>
                          )}
                          {gcodeInfo.filamentWeight && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm">{t('ai.filamentWeight')}</span>
                              <span className="font-semibold">{gcodeInfo.filamentWeight}</span>
                            </div>
                          )}
                          {gcodeInfo.filamentCost && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm">{t('ai.estimatedCost')}</span>
                              <span className="font-semibold">${gcodeInfo.filamentCost}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* 레이어 정보 */}
                      <Card>
                        <CardContent className="p-4 space-y-3">
                          <h4 className="font-medium text-sm text-muted-foreground">{t('ai.layer')}</h4>
                          {gcodeInfo.layerCount && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm">{t('ai.totalLayers')}</span>
                              <span className="font-semibold">{gcodeInfo.layerCount}개</span>
                            </div>
                          )}
                          {gcodeInfo.layerHeight && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm">{t('ai.layerHeight')}</span>
                              <span className="font-semibold">{gcodeInfo.layerHeight}mm</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* 모델 크기 */}
                      {gcodeInfo.modelSize && (
                        <Card>
                          <CardContent className="p-4 space-y-3">
                            <h4 className="font-medium text-sm text-muted-foreground">{t('ai.modelSize')}</h4>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="p-2 rounded bg-muted">
                                <div className="text-xs text-muted-foreground">X</div>
                                <div className="font-semibold text-sm">
                                  {(gcodeInfo.modelSize.maxX - gcodeInfo.modelSize.minX).toFixed(1)}
                                </div>
                              </div>
                              <div className="p-2 rounded bg-muted">
                                <div className="text-xs text-muted-foreground">Y</div>
                                <div className="font-semibold text-sm">
                                  {(gcodeInfo.modelSize.maxY - gcodeInfo.modelSize.minY).toFixed(1)}
                                </div>
                              </div>
                              <div className="p-2 rounded bg-muted">
                                <div className="text-xs text-muted-foreground">Z</div>
                                <div className="font-semibold text-sm">
                                  {(gcodeInfo.modelSize.maxZ - gcodeInfo.modelSize.minZ).toFixed(1)}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* 온도 설정 */}
                      <Card>
                        <CardContent className="p-4 space-y-3">
                          <h4 className="font-medium text-sm text-muted-foreground">{t('ai.printTemperature')}</h4>
                          {gcodeInfo.nozzleTemp && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm">{t('ai.nozzleTemperature')}</span>
                              <span className="font-semibold">{gcodeInfo.nozzleTemp}°C</span>
                            </div>
                          )}
                          {gcodeInfo.bedTemp && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm">{t('ai.bedTemperature')}</span>
                              <span className="font-semibold">{gcodeInfo.bedTemp}°C</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      {t('ai.noSlicingData')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 푸터 */}
            <div className="px-6 py-4 border-t">
              {/* 프린터 연결 상태 경고 */}
              {selectedPrinter && !selectedPrinter.connected && (
                <div className="mb-3 text-sm text-red-500 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {t('ai.printerNotConnected')}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setPrintDialogOpen(false)} disabled={isSlicing}>
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={startPrint}
                  disabled={isSlicing || !currentGCodeUrl || !selectedPrinter?.connected}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  {t('ai.startPrint')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 프린터 선택 확인 모달 */}
      <AlertDialog open={printerConfirmDialogOpen} onOpenChange={setPrinterConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('ai.printPreparation')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('ai.printPreparationMessage', {
                printer: printerToConfirm?.model || printerToConfirm?.name
              })}
              <br /><br />
              {t('ai.continueQuestion')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPrinterSelection}>
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 이미지 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteImageDialogOpen} onOpenChange={setDeleteImageDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('ai.deleteImageConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {linkedModelsCount > 0 ? (
                <>
                  {t('ai.deleteImageWithModels')} <strong>{linkedModelsCount}{t('ai.deleteImageModelsCount')}</strong>{t('ai.deleteImageModelsWillBeDeleted')}
                  <br /><br />
                  {t('ai.reallyDelete')}
                </>
              ) : (
                t('ai.deleteImageQuestion')
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImageDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AI;