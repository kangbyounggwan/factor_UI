import { useState, useRef, useEffect, lazy, Suspense, useMemo, memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformHeader } from "@/components/PlatformHeader";
import { useSafeAreaStyle, useKeyboardVisible } from "@/hooks/usePlatform";
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { PermissionStatus } from '@capacitor/filesystem';

// Lazy load ModelViewer to reduce initial bundle size
const ModelViewer = lazy(() => import("@/components/ModelViewer"));
import type { ModelViewerHandle } from "@/components/ModelViewer";
import AIWorkflowAnimation from "@/components/AIWorkflowAnimation";
import { Badge } from "@/components/ui/badge";
import { PrinterStatusBadge } from "@/components/PrinterStatusBadge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Layers,
  Upload,
  Loader2,
  Wand2,
  Send,
  ImageIcon,
  Trash2,
  Printer,
  XCircle,
  Download,
  ChevronDown,
  ChevronRight,
  Sparkles,
  FileText,
  Camera as CameraIcon,
  Settings,
  History,
  Check,
  ArrowLeft,
  Share2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@shared/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { supabase } from "@shared/integrations/supabase/client";
import { createAIModel, updateAIModel, listAIModels, deleteAIModel } from "@shared/services/supabaseService/aiModel";
import { downloadAndUploadModel, downloadAndUploadSTL, downloadAndUploadThumbnail, downloadAndUploadGCode, deleteModelFiles } from "@shared/services/supabaseService/aiStorage";
import { getUserPrintersWithGroup } from "@shared/services/supabaseService/printerList";
import { uploadSTLAndSlice, type SlicingSettings, type PrinterDefinition as SlicingPrinterDefinition } from "@shared/services/aiService";
import { createSlicingTask, subscribeToTaskUpdates, processSlicingTask, BackgroundTask } from "@shared/services/backgroundSlicing";
import type { AIGeneratedModel } from "@shared/types/aiModelType";
import { generateShortFilename } from "@shared/services/claudeService";
import type { Database } from "@/integrations/supabase/types";

// 프린터 타입 정의 (데이터베이스 타입 사용)
type PrinterRow = Database['public']['Tables']['printers']['Row'];
type PrinterWithGroup = PrinterRow & {
  group: Database['public']['Tables']['printer_groups']['Row'] | null;
  manufacture_id?: string | null;
  connected?: boolean;
  nozzle_temp?: number;
  bed_temp?: number;
};

// 단계 정의
type Step = "select-input" | "create-prompt" | "configure" | "generate" | "result";

// 업로드된 파일 타입
interface UploadedFile {
  id: number;
  name: string;
  size: number;
  type: string;
  url: string;
}

// 생성된 모델 타입
interface GeneratedModel {
  id: string | number;
  name: string;
  model_name?: string;  // DB의 model_name 필드
  type: string;
  prompt: string;
  status: string;
  thumbnail: string;
  glbUrl?: string;
  createdAt: string;
}

const AI = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // 키보드 상태 감지 (키보드가 올라오면 하단 SafeArea 비활성화)
  const isKeyboardVisible = useKeyboardVisible();

  // Safe Area 패딩 (컨텐츠 영역은 bottom padding 불필요)
  const safeAreaStyle = useSafeAreaStyle({
    bottom: false,
  });

  // 하단 버튼 영역: BottomNavigation 높이 + safe area
  // App.tsx가 /create 경로에서는 paddingBottom을 적용하지 않으므로
  // 버튼이 BottomNavigation(64px)과 겹치지 않도록 padding 필요
  // 키보드가 올라왔을 때는 SafeArea와 BottomNavigation 패딩을 제거
  const buttonAreaStyle: React.CSSProperties = {
    paddingBottom: isKeyboardVisible
      ? '1rem'  // 키보드가 올라오면 기본 패딩만
      : 'calc(1rem + 4rem + env(safe-area-inset-bottom, 0px))',
  };

  const [currentStep, setCurrentStep] = useState<Step>("select-input");
  const [inputType, setInputType] = useState<"text" | "image">("text");
  const [textPrompt, setTextPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [generatedModel, setGeneratedModel] = useState<GeneratedModel | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const advancedSectionRef = useRef<HTMLDivElement>(null);
  const modelViewerRef = useRef<ModelViewerHandle>(null);

  // 모델 아카이브 Sheet 상태 (URL 쿼리 파라미터로 제어)
  const [showHistory, setShowHistory] = useState(false);
  const [historyModels, setHistoryModels] = useState<AIGeneratedModel[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'text' | 'image' | '2d'>('all');

  // AI 워크플로우 애니메이션 상태
  type WorkflowStep = 'modelling' | 'optimization' | 'gcode_generation';
  type WorkflowStepStatus = 'pending' | 'processing' | 'completed' | 'failed';

  const [workflowState, setWorkflowState] = useState<{
    current_step: WorkflowStep;
    steps: {
      modelling: WorkflowStepStatus;
      optimization: WorkflowStepStatus;
      gcode_generation: WorkflowStepStatus;
    };
  }>({
    current_step: 'modelling',
    steps: {
      modelling: 'pending',
      optimization: 'pending',
      gcode_generation: 'pending',
    },
  });

  // 모델 편집 상태
  const [userRotation, setUserRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [uniformScale, setUniformScale] = useState<number>(1);
  const [maxTriangles, setMaxTriangles] = useState<number>(100000);
  const [modelDimensions, setModelDimensions] = useState<{ x: number; y: number; z: number } | null>(null);

  // 고급 설정
  const [symmetryMode, setSymmetryMode] = useState<"off" | "auto" | "on">("auto");
  const [artStyle, setArtStyle] = useState<"realistic" | "sculpture">("realistic");
  const [targetPolycount, setTargetPolycount] = useState<number>(30000);

  const [connectedPrinters, setConnectedPrinters] = useState<PrinterWithGroup[]>([]);

  // 출력 설정 단계 상태
  const [printStep, setPrintStep] = useState<'printer' | 'preview'>('printer');
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterWithGroup | null>(null);
  const [isSlicing, setIsSlicing] = useState(false);
  const [slicingInBackground, setSlicingInBackground] = useState(false); // 백그라운드 처리 상태
  const [gcodeUrl, setGcodeUrl] = useState<string | null>(null);
  const [gcodeInfo, setGcodeInfo] = useState<{
    printTime?: string;
    filamentLength?: string;
    filamentWeight?: string;
    layerCount?: number;
    nozzleTemp?: number;
    bedTemp?: number;
  } | null>(null);

  // 슬라이싱 설정
  const [printSettings, setPrintSettings] = useState({
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

  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 예시 프롬프트
  const examplePrompts = [
    { icon: "🚗", text: t('ai.exampleCar') || "빨간색 스포츠카" },
    { icon: "🪑", text: t('ai.exampleChair') || "현대적인 의자" },
    { icon: "🤖", text: t('ai.exampleRobot') || "귀여운 로봇" },
    { icon: "🏠", text: t('ai.exampleHouse') || "작은 집 모형" },
  ];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 하드웨어 백 버튼 처리
  useEffect(() => {
    const handleBackButton = (e: Event) => {
      // 모델 아카이브 Sheet가 열려있으면 먼저 닫기
      if (showHistory) {
        e.preventDefault();
        handleCloseHistory();
        return;
      }

      // 첫 화면(select-input)이 아니면 내부에서 뒤로가기 처리
      if (currentStep !== 'select-input') {
        e.preventDefault(); // App.tsx에서 앱 종료하지 않도록

        // 현재 단계에 따라 이전 단계로 이동
        if (currentStep === 'create-prompt') {
          setCurrentStep('select-input');
        } else if (currentStep === 'generate') {
          // 생성 중에는 뒤로가기 무시 (취소 버튼 사용)
          return;
        } else if (currentStep === 'result') {
          resetFlow(); // 처음부터 다시 시작
        }
      }
      // select-input 단계에서는 preventDefault하지 않아서 앱 종료 로직 실행
    };

    window.addEventListener('ai-studio-back', handleBackButton);
    return () => window.removeEventListener('ai-studio-back', handleBackButton);
  }, [currentStep, showHistory]);

  useEffect(() => {
    document.title = t('ai.title') || "AI 3D 모델링 스튜디오";
  }, [t]);

  // 모델 목록 로드 함수
  const loadModels = async () => {
    if (!user?.id) return;
    try {
      setIsLoadingHistory(true);
      const result = await listAIModels(supabase, user.id, {
        page: 1,
        pageSize: 100,
      });
      setHistoryModels(result.items);
    } catch (error) {
      console.error('[AI] Failed to load models:', error);
      toast({
        title: t('ai.failedToLoadHistory'),
        variant: "destructive",
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // MQTT AI 모델 완료/실패 알림 처리
  useEffect(() => {
    const handleAIModelCompleted = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const payload = customEvent.detail;
      console.log('[AI] Model generation completed:', payload);

      // 모델 목록 새로고침
      await loadModels();

      // 토스트 알림
      toast({
        title: t('ai.modelGenerationComplete'),
        description: t('ai.modelGenerationCompleteDesc', { modelName: payload.model_name || '모델' }),
      });
    };

    const handleAIModelFailed = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const payload = customEvent.detail;
      console.log('[AI] Model generation failed (MQTT):', payload);

      // MQTT FAILED 메시지 수신 시, DB에서 실제 상태를 확인
      // AI Python 서버가 타이밍 이슈로 FAILED를 잘못 보내는 경우가 있음
      if (payload.model_id) {
        try {
          // 약간의 지연 후 DB 상태 확인 (폴링이 완료될 시간을 줌)
          await new Promise(resolve => setTimeout(resolve, 2000));

          const { data: model } = await supabase
            .from('ai_generated_models')
            .select('status')
            .eq('id', payload.model_id)
            .single();

          console.log('[AI] Actual model status from DB:', model?.status);

          // DB에서 실제로 completed면 MQTT FAILED 무시
          if (model?.status === 'completed') {
            console.log('[AI] Ignoring MQTT FAILED - model actually succeeded');
            return;
          }
        } catch (e) {
          console.warn('[AI] Could not verify model status:', e);
        }
      }

      // 실제로 실패한 경우에만 토스트 표시
      toast({
        title: t('ai.modelGenerationFailed'),
        description: t('ai.modelGenerationFailedDesc', { error: payload.error_message || '알 수 없는 오류' }),
        variant: "destructive",
      });
    };

    window.addEventListener('ai-model-completed', handleAIModelCompleted as EventListener);
    window.addEventListener('ai-model-failed', handleAIModelFailed as EventListener);

    return () => {
      window.removeEventListener('ai-model-completed', handleAIModelCompleted as EventListener);
      window.removeEventListener('ai-model-failed', handleAIModelFailed as EventListener);
    };
  }, [user?.id, t, toast]);

  // Subscribe to background task updates
  useEffect(() => {
    if (!user?.id) return;

    const subscription = subscribeToTaskUpdates(supabase, user.id, (task: BackgroundTask) => {
      console.log('[Mobile AI] Background task updated:', task);

      if (task.status === 'processing') {
        // GCode 생성 중
        setWorkflowState(prev => ({
          ...prev,
          current_step: 'gcode_generation',
          steps: { ...prev.steps, gcode_generation: 'processing' },
        }));
      } else if (task.status === 'completed' && task.output_url) {
        // GCode 생성 완료
        setWorkflowState(prev => ({
          ...prev,
          steps: { ...prev.steps, gcode_generation: 'completed' },
        }));

        // Update UI with completed task
        setGcodeUrl(task.output_url);
        setIsSlicing(false);

        // Update gcode info if metadata available
        if (task.output_metadata) {
          const metadata = task.output_metadata;
          setGcodeInfo({
            printTime: metadata.print_time_formatted,
            filamentLength: metadata.filament_used_m ? `${metadata.filament_used_m.toFixed(2)}m` : undefined,
            filamentWeight: metadata.filament_weight_g ? `${metadata.filament_weight_g.toFixed(1)}g` : undefined,
            layerCount: metadata.layer_count,
            nozzleTemp: metadata.nozzle_temp,
            bedTemp: metadata.bed_temp,
          });
        }

        toast({
          title: t('ai.slicingComplete'),
          description: t('ai.slicingCompleteNotification'),
          duration: 7000,
        });
      } else if (task.status === 'failed') {
        // GCode 생성 실패
        setWorkflowState(prev => ({
          ...prev,
          steps: { ...prev.steps, gcode_generation: 'failed' },
        }));

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

  // Progress 95% 도달 시 모델링 완료 → 최적화 단계로 전환
  useEffect(() => {
    if (progress >= 95 && workflowState.steps.modelling === 'processing') {
      setWorkflowState(prev => ({
        ...prev,
        current_step: 'optimization',
        steps: {
          ...prev.steps,
          modelling: 'completed',
          optimization: 'processing',
        },
      }));
    }
  }, [progress, workflowState.steps.modelling]);

  // URL 쿼리 파라미터로 모델 아카이브 Sheet 제어
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const shouldShowHistory = searchParams.get('archive') === 'true';

    setShowHistory(shouldShowHistory);

    // Sheet가 열릴 때 모델 목록 로드 (이미 로딩 중이 아니고, 데이터가 없을 때만)
    if (shouldShowHistory && user?.id && historyModels.length === 0 && !isLoadingHistory) {
      loadHistoryModels();
    }
  }, [location.search, user?.id, historyModels.length, isLoadingHistory]);

  // 모델 아카이브에서 모델 ID가 전달된 경우 모델 로드
  useEffect(() => {
    const modelId = (location.state as any)?.modelId;
    if (modelId && user?.id) {
      const loadModel = async () => {
        try {
          const { getAIModel } = await import("@shared/services/supabaseService/aiModel");
          const model = await getAIModel(supabase, modelId);

          if (model) {
            setGeneratedModel({
              id: model.id,
              name: model.model_name || 'Untitled Model',
              type: model.generation_type === 'image_to_3d' ? 'image' : 'text',
              prompt: model.prompt || '',
              status: 'completed',
              thumbnail: model.thumbnail_url || '/placeholder.svg',
              glbUrl: model.download_url || undefined,
              createdAt: model.created_at,
            });

            setUserRotation([0, 0, 0]);
            setUniformScale(1);
            setCurrentStep('result');

            // location state 초기화
            navigate(location.pathname, { replace: true, state: {} });
          }
        } catch (error) {
          console.error('Failed to load model:', error);
        }
      };

      loadModel();
    }
  }, [location.state, user?.id, navigate]);

  // 프린터 목록 로드
  useEffect(() => {
    const loadPrinters = async () => {
      if (!user) return;
      try {
        const printers = await getUserPrintersWithGroup(user.id);
        setConnectedPrinters(printers);
      } catch (error) {
        console.error('[AI] Failed to load printers:', error);
      }
    };
    loadPrinters();
  }, [user]);

  // 프린터 선택 및 슬라이싱 시작
  const handlePrinterSelect = async (printer: PrinterWithGroup) => {
    console.log('[AI Mobile] Printer selected:', printer.name);

    if (!generatedModel?.glbUrl || !user?.id) {
      toast({
        title: t('common.error') || '오류',
        description: t('ai.noModelOrPrinter') || '3D 모델 파일이나 프린터 정보가 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSelectedPrinter(printer);
      setIsSlicing(true);
      setSlicingInBackground(false);
      setPrintStep('preview'); // 프리뷰 단계로 이동

      toast({
        title: t('ai.slicing') || '슬라이싱 시작',
        description: `${printer.name} ${t('ai.slicingStart') || '프린터로 슬라이싱을 시작합니다...'}`,
      });

      // 20초 타이머 시작
      const timeoutId = setTimeout(() => {
        if (isSlicing) {
          console.log('[AI Mobile] Slicing taking too long, switching to background mode');
          setSlicingInBackground(true);
        }
      }, 20000);

      // 1. 모델 파일 다운로드 (GLB만 사용)
      const modelUrl = generatedModel.glbUrl;

      console.log('[AI Mobile] ========================================');
      console.log('[AI Mobile] 📥 DOWNLOADING MODEL FOR SLICING');
      console.log('[AI Mobile] - Model URL:', modelUrl);
      console.log('[AI Mobile] ========================================');

      const modelResponse = await fetch(modelUrl);
      if (!modelResponse.ok) {
        throw new Error('모델 파일 다운로드 실패');
      }
      const modelBlob = await modelResponse.blob();

      // GLB 파일만 사용 (STL 사용 안 함)
      const fileExtension = modelUrl.endsWith('.stl') ? 'stl' : 'glb';
      console.log('[AI Mobile] Downloaded model file:');
      console.log('[AI Mobile] - File format:', fileExtension);
      console.log('[AI Mobile] - Downloaded blob size:', modelBlob.size, 'bytes');
      console.log('[AI Mobile] - Downloaded blob type:', modelBlob.type);

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

      // 3. 프린터 정보 조회
      let printerFilename = printer.model || printer.name;
      if (printer.manufacture_id) {
        try {
          const { data: manufacturingPrinter } = await supabase
            .from('manufacturing_printers')
            .select('filename, manufacturer, series, display_name')
            .eq('id', printer.manufacture_id)
            .single();

          if (manufacturingPrinter) {
            printerFilename = manufacturingPrinter.filename.replace('.def.json', '');
          }
        } catch (error) {
          console.warn('[AI Mobile] Failed to fetch manufacturing printer:', error);
        }
      }

      // 4. 프린터 정의
      const printerDefinition: SlicingPrinterDefinition = {
        version: 2,
        overrides: {
          machine_width: { default_value: 220 },
          machine_depth: { default_value: 220 },
          machine_height: { default_value: 250 },
          machine_extruder_count: { default_value: 1 },
          mesh_rotation_matrix: { default_value: "[[1,0,0], [0,1,0], [0,0,1]]" },
        },
      };

      // 5. DB에서 캐시된 GCode 확인
      if (generatedModel.id && printer.manufacture_id) {
        // Show loading toast
        toast({
          title: t('ai.loadingCachedGcode'),
          description: t('ai.loadingCachedGcodeDescription'),
          duration: 2000,
        });

        const { data: existingGcode, error: gcodeError } = await supabase
          .from('gcode_files')
          .select('*')
          .eq('model_id', generatedModel.id)
          .single();

        if (existingGcode && !gcodeError) {
          console.log('[AI Mobile] Cached GCode found!');
          const { data: urlData } = supabase.storage
            .from('gcode-files')
            .getPublicUrl(existingGcode.file_path);

          setGcodeInfo({
            printTime: existingGcode.print_time_formatted,
            filamentLength: existingGcode.filament_used_m ? `${existingGcode.filament_used_m.toFixed(2)}m` : undefined,
            filamentWeight: existingGcode.filament_weight_g ? `${existingGcode.filament_weight_g.toFixed(1)}g` : undefined,
            layerCount: existingGcode.layer_count,
            nozzleTemp: existingGcode.nozzle_temp,
            bedTemp: existingGcode.bed_temp,
          });

          setGcodeUrl(urlData.publicUrl);
          setIsSlicing(false);

          toast({
            title: t('ai.slicingComplete') || '슬라이싱 완료',
            description: t('ai.readyToPrint') || '출력 준비가 완료되었습니다',
          });
          return;
        }
      }

      // 6. Create background slicing task
      console.log('[AI Mobile] Creating background slicing task...');
      console.log('[AI Mobile] - Model URL:', modelUrl);
      console.log('[AI Mobile] - Model ID:', generatedModel.id);
      console.log('[AI Mobile] - Printer ID:', printer.id);
      console.log('[AI Mobile] - Printer Model ID:', printer.manufacture_id);

      const modelName = generatedModel.model_name || generatedModel.prompt || String(generatedModel.id);
      const modelPrompt = generatedModel.prompt;  // 사용자의 원본 프롬프트

      // Get printer info for GCode
      let printerInfoForGCode: { manufacturer?: string; series?: string; model?: string; printer_name?: string } = {};
      if (printer.manufacture_id) {
        const { data: manufacturingPrinter } = await supabase
          .from('manufacturing_printers')
          .select('manufacturer, series, display_name')
          .eq('id', printer.manufacture_id)
          .single();

        if (manufacturingPrinter) {
          printerInfoForGCode = {
            manufacturer: manufacturingPrinter.manufacturer,
            series: manufacturingPrinter.series,
            model: manufacturingPrinter.display_name,
            printer_name: printer.name
          };
        }
      }

      const taskId = await createSlicingTask(
        supabase,
        generatedModel.id as string,
        printer.id,
        printer.manufacture_id!,
        modelUrl,
        {
          curaSettings,
          printerDefinition,
          printerName: printerFilename,
          modelName,
          printerInfo: printerInfoForGCode,
          prompt: modelPrompt,  // Claude로 파일명 생성용
        }
      );

      console.log('[AI Mobile] Background task created:', taskId);
      console.log('[AI Mobile] Task will continue in background even if app is closed');

      toast({
        title: t('ai.slicingBackgroundStart'),
        description: t('ai.slicingBackgroundDescription'),
        duration: 5000,
      });

      // Immediately process the task in background
      processSlicingTask(supabase, {
        id: taskId,
        user_id: user!.id,
        task_type: 'slicing',
        status: 'pending',
        model_id: generatedModel.id as string,
        printer_id: printer.id,
        printer_model_id: printer.manufacture_id!,
        input_url: modelUrl,
        input_params: {
          curaSettings,
          printerDefinition,
          printerName: printerFilename,
          modelName,
          printerInfo: printerInfoForGCode,
          prompt: modelPrompt,  // Claude로 파일명 생성용
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
        console.error('[AI Mobile] Background task failed to start:', error);
      });

      // Don't wait for slicing to complete - it runs in background
      // The useEffect subscription will update the UI when complete
    } catch (error) {
      console.error('[AI Mobile] Slicing failed:', error);
      toast({
        title: t('common.error') || '오류',
        description: error instanceof Error ? error.message : t('ai.slicingFailed') || '슬라이싱에 실패했습니다',
        variant: 'destructive',
      });
      setPrintStep('printer'); // 실패 시 프린터 선택으로 돌아감
    } finally {
      setIsSlicing(false);
      setSlicingInBackground(false);
    }
  };

  // 고급 설정 열릴 때 해당 섹션으로 스크롤 이동
  useEffect(() => {
    if (showAdvanced && contentScrollRef.current && advancedSectionRef.current) {
      // 약간의 지연 후 스크롤(전개 애니메이션 완료 고려)
      const id = window.setTimeout(() => {
        const container = contentScrollRef.current!;
        const targetTop = advancedSectionRef.current!.offsetTop;
        container.scrollTo({ top: targetTop - 12, behavior: 'smooth' });
      }, 50);
      return () => window.clearTimeout(id);
    }
  }, [showAdvanced]);

  // 파일 업로드 핸들러
  const handleFileUpload = async (event?: React.ChangeEvent<HTMLInputElement>) => {
    // 네이티브 플랫폼에서는 Capacitor Camera 사용
    if (Capacitor.isNativePlatform() && !event) {
      try {
        const image = await CapacitorCamera.getPhoto({
          quality: 90,
          allowEditing: true,
          resultType: CameraResultType.Uri,
          source: CameraSource.Prompt, // Camera or Gallery 선택
        });

        if (!image.webPath) {
          throw new Error('이미지 경로를 가져올 수 없습니다.');
        }

        // Uri를 Blob으로 변환
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        const fileName = `image-${Date.now()}.${image.format}`;

        setUploadedFiles([...uploadedFiles, {
          id: Date.now(),
          name: fileName,
          size: blob.size,
          type: `image/${image.format}`,
          url: image.webPath,
        }]);
        toast({ title: t('ai.uploadSuccess'), description: fileName });
      } catch (error) {
        console.error('Camera error:', error);
        toast({
          title: t('common.error', '오류'),
          description: t('ai.uploadFailed', '이미지 업로드에 실패했습니다.'),
          variant: 'destructive',
        });
      }
    } else if (event) {
      // 웹에서는 기존 파일 업로드 방식
      const files = event.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        setUploadedFiles([...uploadedFiles, {
          id: Date.now(),
          name: file.name,
          size: file.size,
          type: file.type,
          url: URL.createObjectURL(file),
        }]);
        toast({ title: t('ai.uploadSuccess'), description: `${file.name}` });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      setUploadedFiles([...uploadedFiles, {
        id: Date.now(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      }]);
      toast({ title: t('ai.uploadSuccess'), description: `${file.name}` });
    }
  };

  const removeFile = (fileId: number) => {
    setUploadedFiles(uploadedFiles.filter((file) => file.id !== fileId));
  };

  // 생성 시작
  const startGeneration = async () => {
    if (!textPrompt.trim() && uploadedFiles.length === 0) {
      toast({
        title: t('ai.inputRequired'),
        description: t('ai.inputRequiredDesc'),
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setCurrentStep("generate");

    // 워크플로우 상태 초기화 및 시작
    setWorkflowState({
      current_step: 'modelling',
      steps: {
        modelling: 'processing',
        optimization: 'pending',
        gcode_generation: 'pending',
      },
    });

    let dbModelId: string | null = null; // Declare outside try-catch for proper scope

    try {
      let result;

      if (inputType === "text") {
        // 1. DB에 레코드 생성 (status: processing)
        const dbModel = await createAIModel(supabase, {
          generation_type: 'text_to_3d',
          prompt: textPrompt,
          art_style: artStyle,
          target_polycount: targetPolycount,
          symmetry_mode: symmetryMode,
          model_name: `Text-to-3D: ${textPrompt.substring(0, 30)}...`,
        }, user.id);

        dbModelId = dbModel.id;

        // 2. 텍스트 → 3D 변환
        const { postTextTo3D, buildCommon, buildPrintablePrompt, pollTaskUntilComplete, extractGLBUrl, extractSTLUrl, extractThumbnailUrl, extractMetadata } = await import("@shared/services/aiService");

        // 사용자 프롬프트에 3D 프린팅 최적화 제약 조건 추가
        const printablePrompt = buildPrintablePrompt(textPrompt);
        console.log('[AI Mobile] Sending prompt with 3D printing constraints');

        const payload = {
          task: 'text_to_3d',
          prompt: printablePrompt,
          ...buildCommon(symmetryMode, artStyle, targetPolycount, user?.id, 'mobile'),
        };

        console.log('[AI Request] Text-to-3D Payload:', JSON.stringify(payload, null, 2));

        // 비동기 모드로 요청
        const asyncResult = await postTextTo3D(payload, true);
        console.log('[AI Response] Text-to-3D Result:', JSON.stringify(asyncResult, null, 2));

        if (asyncResult.status === 'ok' && asyncResult.data?.task_id) {
          // 진행률 폴링
          result = await pollTaskUntilComplete(
            asyncResult.data.task_id,
            (progressValue, status) => {
              setProgress(progressValue);
              setProgressStatus(status);
              console.log(`[AI] Progress: ${progressValue}% - Status: ${status}`);

              // 워크플로우 애니메이션 업데이트
              if (progressValue >= 100) {
                setWorkflowState(prev => ({
                  ...prev,
                  steps: { ...prev.steps, modelling: 'completed' },
                  current_step: 'optimization',
                }));
              }
            }
          );

          // Modelling 완료 -> Optimization 시작
          setWorkflowState(prev => ({
            ...prev,
            steps: { ...prev.steps, modelling: 'completed', optimization: 'processing' },
            current_step: 'optimization',
          }));

          // 3. 파일 다운로드 및 Supabase Storage 업로드
          const glbUrl = extractGLBUrl(result);
          const stlUrl = extractSTLUrl(result);
          const thumbnailUrl = extractThumbnailUrl(result);
          const metadata = extractMetadata(result);

          if (!glbUrl) {
            throw new Error('GLB URL을 추출할 수 없습니다.');
          }

          // 파일 업로드
          const modelData = await downloadAndUploadModel(supabase, user.id, dbModelId, glbUrl);
          console.log('[AI] modelData:', modelData);
          const stlData = stlUrl ? await downloadAndUploadSTL(supabase, user.id, dbModelId, stlUrl) : null;
          console.log('[AI] stlData:', stlData);
          const thumbnailData = thumbnailUrl ? await downloadAndUploadThumbnail(supabase, user.id, dbModelId, thumbnailUrl) : null;
          console.log('[AI] thumbnailData:', thumbnailData);

          // Optimization 완료
          setWorkflowState(prev => ({
            ...prev,
            steps: { ...prev.steps, optimization: 'completed' },
          }));

          // Claude API로 짧은 이름 생성 (프롬프트 기반)
          let shortNameText: string | undefined;
          try {
            shortNameText = await generateShortFilename({ prompt: textPrompt });
            console.log('[AI Mobile] Generated model_name:', shortNameText);
          } catch (error) {
            console.warn('[AI Mobile] Failed to generate model_name:', error);
          }

          // 4. DB 업데이트
          await updateAIModel(supabase, dbModelId, {
            storage_path: modelData.path,
            download_url: modelData.publicUrl,
            stl_storage_path: stlData?.path,
            stl_download_url: stlData?.publicUrl,
            thumbnail_url: thumbnailData?.publicUrl,
            model_dimensions: metadata?.dimensions,
            generation_metadata: metadata,
            status: 'completed',
            model_name: shortNameText || `Text-to-3D: ${textPrompt.substring(0, 30)}`,  // Claude가 생성한 짧은 영문 이름
          });

          // 5. 상태 업데이트 (Supabase Storage URL 사용)
          const newModel = {
            id: dbModelId,
            name: `Text-to-3D: ${textPrompt.substring(0, 30)}...`,
            type: inputType,
            prompt: textPrompt,
            status: "completed" as const,
            thumbnail: thumbnailData?.publicUrl || "/placeholder.svg",
            glbUrl: modelData.publicUrl,
            createdAt: new Date().toISOString(),
          };

          console.log('[AI] Setting generated model:', newModel);
          setGeneratedModel(newModel);
        } else {
          throw new Error('Task ID를 받지 못했습니다.');
        }
      } else if (inputType === "image" && uploadedFiles.length > 0) {
        // 1. DB에 레코드 생성 (status: processing)
        const uploadedFile = uploadedFiles[0];
        const dbModel = await createAIModel(supabase, {
          generation_type: 'image_to_3d',
          source_image_url: uploadedFile.url,
          art_style: artStyle,
          target_polycount: targetPolycount,
          symmetry_mode: symmetryMode,
          model_name: `Image-to-3D: ${uploadedFile.name}`,
        }, user.id);

        dbModelId = dbModel.id;

        // 2. 이미지 → 3D 변환
        const { postImageTo3D, buildCommon, BASE_3D_PRINT_PROMPT, pollTaskUntilComplete, extractGLBUrl, extractSTLUrl, extractThumbnailUrl, extractMetadata } = await import("@shared/services/aiService");

        const formData = new FormData();

        // 이미지 파일을 Blob으로 변환하여 추가
        const response = await fetch(uploadedFile.url);
        const blob = await response.blob();

        // 3D 프린팅 최적화 제약 조건을 common에 추가
        const common = {
          ...buildCommon(symmetryMode, artStyle, targetPolycount, user?.id, 'mobile'),
          manufacturing_constraints: BASE_3D_PRINT_PROMPT,
        };
        console.log('[AI Mobile] Sending image-to-3D with 3D printing constraints');

        console.log('[AI Request] Image-to-3D Common params:', JSON.stringify(common, null, 2));
        console.log('[AI Request] Image file:', uploadedFile.name, 'size:', blob.size, 'bytes');

        formData.append('task', 'image_to_3d');
        formData.append('image_file', blob, uploadedFile.name);
        formData.append('json', JSON.stringify(common));

        // 비동기 모드로 요청
        const asyncResult = await postImageTo3D(formData, true);
        console.log('[AI Response] Image-to-3D Result:', JSON.stringify(asyncResult, null, 2));

        if (asyncResult.status === 'ok' && asyncResult.data?.task_id) {
          // 진행률 폴링
          result = await pollTaskUntilComplete(
            asyncResult.data.task_id,
            (progressValue, status) => {
              setProgress(progressValue);
              setProgressStatus(status);
              console.log(`[AI] Progress: ${progressValue}% - Status: ${status}`);

              // 워크플로우 애니메이션 업데이트
              if (progressValue >= 100) {
                setWorkflowState(prev => ({
                  ...prev,
                  steps: { ...prev.steps, modelling: 'completed' },
                  current_step: 'optimization',
                }));
              }
            }
          );

          // Modelling 완료 -> Optimization 시작
          setWorkflowState(prev => ({
            ...prev,
            steps: { ...prev.steps, modelling: 'completed', optimization: 'processing' },
            current_step: 'optimization',
          }));

          // 3. 파일 다운로드 및 Supabase Storage 업로드
          const glbUrl = extractGLBUrl(result);
          const stlUrl = extractSTLUrl(result);
          const thumbnailUrl = extractThumbnailUrl(result);
          const metadata = extractMetadata(result);

          if (!glbUrl) {
            throw new Error('GLB URL을 추출할 수 없습니다.');
          }

          // 파일 업로드
          const modelData = await downloadAndUploadModel(supabase, user.id, dbModelId, glbUrl);
          console.log('[AI] modelData (image):', modelData);
          const stlData = stlUrl ? await downloadAndUploadSTL(supabase, user.id, dbModelId, stlUrl) : null;
          console.log('[AI] stlData (image):', stlData);
          const thumbnailData = thumbnailUrl ? await downloadAndUploadThumbnail(supabase, user.id, dbModelId, thumbnailUrl) : null;
          console.log('[AI] thumbnailData (image):', thumbnailData);

          // Optimization 완료
          setWorkflowState(prev => ({
            ...prev,
            steps: { ...prev.steps, optimization: 'completed' },
          }));

          // Claude Vision API로 짧은 이름 생성 (이미지 기반)
          let shortNameImage: string | undefined;
          try {
            shortNameImage = await generateShortFilename({ imageUrl: uploadedFile.url });
            console.log('[AI Mobile] Generated model_name from image:', shortNameImage);
          } catch (error) {
            console.warn('[AI Mobile] Failed to generate model_name from image:', error);
          }

          // 4. DB 업데이트
          await updateAIModel(supabase, dbModelId, {
            storage_path: modelData.path,
            download_url: modelData.publicUrl,
            stl_storage_path: stlData?.path,
            stl_download_url: stlData?.publicUrl,
            thumbnail_url: thumbnailData?.publicUrl,
            model_dimensions: metadata?.dimensions,
            generation_metadata: metadata,
            status: 'completed',
            model_name: shortNameImage || `Image-to-3D: ${uploadedFile.name}`,  // Claude Vision이 생성한 짧은 영문 이름
          });

          // 5. 상태 업데이트 (Supabase Storage URL 사용)
          const newModel = {
            id: dbModelId,
            name: `Image-to-3D: ${uploadedFile.name}`,
            type: inputType,
            prompt: textPrompt,
            status: "completed" as const,
            thumbnail: thumbnailData?.publicUrl || "/placeholder.svg",
            glbUrl: modelData.publicUrl,
            createdAt: new Date().toISOString(),
          };

          console.log('[AI] Setting generated model (image):', newModel);
          setGeneratedModel(newModel);
        } else {
          throw new Error('Task ID를 받지 못했습니다.');
        }
      }

      // 결과 처리
      if (result && dbModelId) {
        setProgress(100);
        setCurrentStep("result");

        // 모델 목록 새로고침
        await loadModels();

        toast({
          title: t('ai.generationComplete'),
          description: t('ai.generationCompleteDesc'),
        });
      }
    } catch (error) {
      console.error('[AI] Generation error:', error);

      // DB에 에러 상태 업데이트
      if (dbModelId) {
        try {
          await updateAIModel(supabase, dbModelId, {
            status: 'failed',
          });
        } catch (updateError) {
          console.error('[AI] Failed to update model status:', updateError);
        }
      }

      toast({
        title: t('ai.generationFailed') || '생성 실패',
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        variant: "destructive",
      });
      setCurrentStep("create-prompt");
    } finally {
      setIsProcessing(false);
    }
  };

  // 다시 시작
  const resetFlow = () => {
    setCurrentStep("select-input");
    setTextPrompt("");
    setUploadedFiles([]);
    setGeneratedModel(null);
    setProgress(0);
  };

  // 모델 아카이브 관련 함수들
  const loadHistoryModels = async () => {
    if (!user?.id) {
      console.log('[AI Mobile] loadHistoryModels - no user ID');
      return;
    }

    console.log('[AI Mobile] Loading history models for user:', user.id);
    setIsLoadingHistory(true);
    try {
      const result = await listAIModels(supabase, user.id, { pageSize: 100 });
      console.log('[AI Mobile] Result:', result);
      console.log('[AI Mobile] Loaded history models:', result.items?.length || 0);
      setHistoryModels(result.items || []);
    } catch (error) {
      console.error('[AI Mobile] Failed to load history models:', error);
      toast({
        title: t('common.error'),
        description: t('ai.failedToLoadHistory'),
        variant: 'destructive',
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleOpenHistory = () => {
    navigate('/create?archive=true');
  };

  const handleCloseHistory = () => {
    navigate('/create');
  };

  const handleLoadHistoryModel = async (modelId: string) => {
    try {
      const { getAIModel } = await import("@shared/services/supabaseService/aiModel");
      const model = await getAIModel(supabase, modelId);

      if (model) {
        setGeneratedModel({
          id: model.id,
          name: model.model_name || 'Untitled Model',
          type: model.generation_type === 'image_to_3d' ? 'image' : 'text',
          prompt: model.prompt || '',
          status: 'completed',
          thumbnail: model.thumbnail_url || '/placeholder.svg',
          glbUrl: model.download_url || undefined,
          createdAt: model.created_at,
        });

        setUserRotation([0, 0, 0]);
        setUniformScale(1);
        setCurrentStep('result');
        handleCloseHistory();
      }
    } catch (error) {
      console.error('Failed to load model:', error);
      toast({
        title: t('common.error'),
        description: t('ai.failedToLoadModel'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteHistoryModel = async (modelId: string) => {
    try {
      // 삭제할 모델 데이터 찾기
      const modelToDelete = historyModels.find(m => m.id === modelId);

      await deleteAIModel(supabase, modelId);

      // 모델 파일도 삭제 (모델 데이터가 있는 경우)
      if (modelToDelete && user) {
        await deleteModelFiles(supabase, user.id, modelToDelete);
      }

      setHistoryModels(prev => prev.filter(m => m.id !== modelId));

      toast({
        title: t('common.success'),
        description: t('ai.modelDeleted'),
      });
    } catch (error) {
      console.error('Failed to delete model:', error);
      toast({
        title: t('common.error'),
        description: t('ai.failedToDeleteModel'),
        variant: 'destructive',
      });
    }
  };

  // Step 1: 입력 방식 선택
  const renderSelectInput = () => (
    <div className="space-y-3">
      <div className="text-center space-y-1.5">
        <h1 className="text-xl font-bold">{t('ai.whatToCreate')}</h1>
        <p className="text-sm text-muted-foreground">{t('ai.selectInputMethod')}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 mt-4">
        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${
            inputType === "text" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => {
            setInputType("text");
            setCurrentStep("create-prompt");
          }}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <Wand2 className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base">{t('ai.textTo3D')}</h3>
              <p className="text-sm text-muted-foreground">{t('ai.textTo3DDesc')}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${
            inputType === "image" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => {
            setInputType("image");
            setCurrentStep("create-prompt");
          }}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <ImageIcon className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base">{t('ai.imageTo3D')}</h3>
              <p className="text-sm text-muted-foreground">{t('ai.imageTo3DDesc')}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </CardContent>
        </Card>

        </div>
    </div>
  );

  // Step 2: 프롬프트 작성
  const renderCreatePrompt = () => (
    <div className="space-y-4">
      {/* 뒤로 가기 */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setCurrentStep("select-input")}>
          ← {t('common.back')}
        </Button>
        <Badge variant="outline">{inputType === "text" ? t('ai.textTo3D') : t('ai.imageTo3D')}</Badge>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">{t('ai.describeYourIdea')}</h2>
        <p className="text-sm text-muted-foreground">{t('ai.describeYourIdeaDesc')}</p>
      </div>

      {/* 이미지 업로드 모드 */}
      {inputType === "image" && (
        <div
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => {
            if (Capacitor.isNativePlatform()) {
              handleFileUpload();
            } else {
              fileInputRef.current?.click();
            }
          }}
        >
          <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">{t('ai.dragAndDrop')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('ai.supportedFormats')}</p>
          <Button variant="outline" size="sm" className="mt-3">
            {t('gcode.selectFile')}
          </Button>
          {!Capacitor.isNativePlatform() && (
            <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept="image/*" />
          )}
        </div>
      )}

      {/* 업로드된 파일 목록 */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          {uploadedFiles.map((file) => (
            <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
              <img src={file.url} alt={file.name} className="w-16 h-16 object-cover rounded" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeFile(file.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* 텍스트 입력 */}
      {inputType === "text" && (
        <div className="space-y-3">
          <Textarea
            placeholder={t('ai.textPromptPlaceholder')}
            value={textPrompt}
            onChange={(e) => setTextPrompt(e.target.value)}
            className="min-h-[120px] text-base resize-none"
          />

          {/* 예시 칩들 */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t('ai.tryExamples')}</p>
            <div className="flex flex-wrap gap-2">
              {examplePrompts.map((example, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => setTextPrompt(example.text)}
                >
                  {example.icon} {example.text}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 고급 설정 (접을 수 있음) */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t('ai.advancedSettings')}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          <div ref={advancedSectionRef} />

          {/* 대칭 모드 */}
          <div className="space-y-2">
            <Label>{t('ai.symmetryMode')}</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={symmetryMode === "off" ? "default" : "outline"}
                size="sm"
                onClick={() => setSymmetryMode("off")}
              >
                {t('ai.symmetryOff')}
              </Button>
              <Button
                variant={symmetryMode === "auto" ? "default" : "outline"}
                size="sm"
                onClick={() => setSymmetryMode("auto")}
              >
                {t('ai.symmetryAuto')}
              </Button>
              <Button
                variant={symmetryMode === "on" ? "default" : "outline"}
                size="sm"
                onClick={() => setSymmetryMode("on")}
              >
                {t('ai.symmetryOn')}
              </Button>
            </div>
          </div>

          {/* 아트 스타일 */}
          <div className="space-y-2">
            <Label>{t('ai.artStyle')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={artStyle === "realistic" ? "default" : "outline"}
                size="sm"
                onClick={() => setArtStyle("realistic")}
              >
                {t('ai.styleRealistic')}
              </Button>
              <Button
                variant={artStyle === "sculpture" ? "default" : "outline"}
                size="sm"
                onClick={() => setArtStyle("sculpture")}
              >
                {t('ai.styleSculpture')}
              </Button>
            </div>
          </div>

          {/* 목표 폴리곤 수 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('ai.targetPolycount')}</Label>
              <span className="text-sm text-muted-foreground">{targetPolycount.toLocaleString()}</span>
            </div>
            <Slider
              min={10000}
              max={50000}
              step={200}
              value={[targetPolycount]}
              onValueChange={(values) => setTargetPolycount(values[0])}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10,000</span>
              <span>50,000</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  // Step 3: 생성 중
  // Static loader - no animations to prevent excessive re-renders
  const StaticLoader = useMemo(() => (
    <div className="relative">
      <Loader2 className="w-16 h-16 text-primary" />
      <Sparkles className="w-6 h-6 text-primary absolute top-0 right-0" />
    </div>
  ), []);

  // Throttle progress display to every 5% to reduce re-renders
  const displayProgress = useMemo(() => Math.floor(progress / 5) * 5, [progress]);

  // Fixed estimated time: 5 minutes
  const estimatedTime = '5m';

  const renderGenerating = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">{t('ai.generatingAI')}</h2>
        <p className="text-sm text-muted-foreground">{t('ai.generatingDesc')}</p>
      </div>

      {/* AI 워크플로우 애니메이션 */}
      <AIWorkflowAnimation workflow={workflowState} className="w-full max-w-lg px-4" />

      <div className="w-full max-w-sm space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('ai.progressLabel')}</span>
          <span className="font-medium">{displayProgress}%</span>
        </div>
        <Progress value={displayProgress} className="h-2" />
        {progressStatus && (
          <p className="text-xs text-center text-muted-foreground">
            {progressStatus}
          </p>
        )}
        <p className="text-xs text-center text-muted-foreground">
          {t('ai.estimatedTime')}: {estimatedTime}
        </p>
      </div>
    </div>
  );

  // Step 4: 결과
  const renderResult = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-green-500/10 rounded-full">
          <Check className="w-5 h-5 text-green-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold">{t('ai.generationComplete')}</h2>
          <p className="text-xs text-muted-foreground">{t('ai.generationCompleteDesc')}</p>
        </div>
      </div>

      {/* 3D 뷰어 */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-lg overflow-hidden h-[40vh] relative bg-muted">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground will-change-transform" style={{ transform: 'translateZ(0)' }} />
              </div>
            }>
              {(() => {
                console.log('[AI] Render check - generatedModel:', generatedModel);
                console.log('[AI] Render check - glbUrl:', generatedModel?.glbUrl);
                return generatedModel?.glbUrl ? (
                  <ModelViewer
                    key={generatedModel.id || generatedModel.glbUrl}
                    ref={modelViewerRef}
                    className="w-full h-full"
                    modelUrl={generatedModel.glbUrl}
                    modelScale={uniformScale}
                    rotation={userRotation}
                    onSize={(size) => setModelDimensions(size)}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">{t('ai.noModelAvailable') || '모델을 불러올 수 없습니다'}</p>
                  </div>
                );
              })()}
            </Suspense>
          </div>
        </CardContent>
      </Card>

      {/* 모델 편집 아코디언 */}
      <Card>
        <CardContent className="p-4">
          <Accordion type="single" collapsible className="w-full">
            {/* 모델 회전 섹션 */}
            <AccordionItem value="rotation" className="border-b">
              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                {t('modelViewer.modelRotation') || 'Model Rotation'}
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {t('modelViewer.xAxisRotation') || 'X Axis'}: {Math.round(userRotation[0] * 180 / Math.PI)}°
                    </label>
                    <Slider
                      min={-180}
                      max={180}
                      step={5}
                      value={[userRotation[0] * 180 / Math.PI]}
                      onValueChange={(value) => setUserRotation([value[0] * Math.PI / 180, userRotation[1], userRotation[2]])}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {t('modelViewer.yAxisRotation') || 'Y Axis'}: {Math.round(userRotation[1] * 180 / Math.PI)}°
                    </label>
                    <Slider
                      min={-180}
                      max={180}
                      step={5}
                      value={[userRotation[1] * 180 / Math.PI]}
                      onValueChange={(value) => setUserRotation([userRotation[0], value[0] * Math.PI / 180, userRotation[2]])}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {t('modelViewer.zAxisRotation') || 'Z Axis'}: {Math.round(userRotation[2] * 180 / Math.PI)}°
                    </label>
                    <Slider
                      min={-180}
                      max={180}
                      step={5}
                      value={[userRotation[2] * 180 / Math.PI]}
                      onValueChange={(value) => setUserRotation([userRotation[0], userRotation[1], value[0] * Math.PI / 180])}
                      className="mt-2"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setUserRotation([0, 0, 0])}
                  >
                    {t('modelViewer.reset') || 'Reset'}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Uniform Scale 섹션 */}
            <AccordionItem value="scale" className="border-b">
              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                {t('modelViewer.uniformScale') || 'Uniform Scale'}
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-muted-foreground">{t('modelViewer.scale') || 'Scale'}</span>
                      <strong className="text-xs">{uniformScale.toFixed(2)}x</strong>
                    </div>
                    <Slider
                      min={0.05}
                      max={10}
                      step={0.01}
                      value={[uniformScale]}
                      onValueChange={(value) => setUniformScale(value[0])}
                      className="mt-2"
                    />
                  </div>
                  {modelDimensions && (
                    <div className="flex justify-end gap-2 text-xs">
                      <div className="text-center">
                        <div className="text-muted-foreground">X</div>
                        <div className="font-medium">{(modelDimensions.x * uniformScale).toFixed(1)}mm</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">Y</div>
                        <div className="font-medium">{(modelDimensions.y * uniformScale).toFixed(1)}mm</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">Z</div>
                        <div className="font-medium">{(modelDimensions.z * uniformScale).toFixed(1)}mm</div>
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Mesh Optimize 섹션 */}
            <AccordionItem value="mesh" className="border-b">
              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                {t('modelViewer.meshOptimize') || 'Mesh Optimize'}
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      maxTriangles: {maxTriangles.toLocaleString()}
                    </label>
                    <Slider
                      min={20000}
                      max={300000}
                      step={1000}
                      value={[maxTriangles]}
                      onValueChange={(value) => setMaxTriangles(value[0])}
                      className="mt-2"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      toast({
                        title: t('modelViewer.optimizing') || 'Optimizing',
                        description: `Applying mesh optimization with ${maxTriangles.toLocaleString()} triangles...`,
                      });
                    }}
                  >
                    {t('modelViewer.apply') || 'Apply'}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 모델 저장 섹션 */}
            <AccordionItem value="export">
              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                {t('modelViewer.saveModel') || 'Save Model'}
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      className="w-full"
                      onClick={async () => {
                        if (!generatedModel?.id || !user) {
                          toast({
                            title: t('common.error') || '오류',
                            description: '모델 ID를 찾을 수 없습니다.',
                            variant: 'destructive',
                          });
                          return;
                        }

                        if (!modelViewerRef.current) {
                          toast({
                            title: t('common.error') || '오류',
                            description: '모델 뷰어가 준비되지 않았습니다.',
                            variant: 'destructive',
                          });
                          return;
                        }

                        try {
                          console.log('[SAVE] ========== 모델 저장 시작 ==========');
                          console.log('[SAVE] 원본 모델 ID:', generatedModel.id);
                          console.log('[SAVE] 현재 회전값:', userRotation);
                          console.log('[SAVE] 현재 스케일:', uniformScale);

                          toast({
                            title: t('common.processing') || '처리 중',
                            description: '회전된 모델을 저장하는 중입니다...',
                          });

                          // 1. 회전/스케일이 적용된 GLB 파일 내보내기
                          console.log('[SAVE] 1. GLB 파일 내보내기 시작...');
                          const blob = await modelViewerRef.current.exportGLB();
                          console.log('[SAVE] ✓ GLB 파일 생성 완료 - 크기:', (blob.size / 1024).toFixed(2), 'KB');

                          // 2. Supabase Storage에 업로드
                          const timestamp = Date.now();
                          const fileName = `${generatedModel.id}-rotated-${timestamp}.glb`;
                          const filePath = `${user.id}/${fileName}`; // 버킷 이름 제외한 경로
                          console.log('[SAVE] ========== 디버그 정보 ==========');
                          console.log('[SAVE] User ID:', user.id);
                          console.log('[SAVE] Auth UID:', (await supabase.auth.getUser()).data.user?.id);
                          console.log('[SAVE] File Name:', fileName);
                          console.log('[SAVE] Full Path:', filePath);
                          console.log('[SAVE] Path Parts:', filePath.split('/'));
                          console.log('[SAVE] First Part:', filePath.split('/')[0]);
                          console.log('[SAVE] Blob Size:', blob.size, 'bytes');
                          console.log('[SAVE] Blob Type:', blob.type);
                          console.log('[SAVE] 2. Storage 업로드 시작...');

                          const { error: uploadError } = await supabase.storage
                            .from('ai-models')
                            .upload(filePath, blob, {
                              contentType: 'model/gltf-binary',
                              upsert: false,
                            });

                          if (uploadError) {
                            console.error('[SAVE] ✗ Storage 업로드 실패:', uploadError);
                            console.error('[SAVE] Error Details:', JSON.stringify(uploadError, null, 2));
                            throw uploadError;
                          }
                          console.log('[SAVE] ✓ Storage 업로드 완료');

                          // 3. Signed URL 가져오기 (24시간 유효)
                          const { data: urlData, error: urlError } = await supabase.storage
                            .from('ai-models')
                            .createSignedUrl(filePath, 86400);

                          if (urlError) {
                            console.error('[SAVE] ✗ Signed URL 생성 실패:', urlError);
                            throw urlError;
                          }

                          const signedUrl = urlData.signedUrl;
                          console.log('[SAVE] 3. Signed URL 생성:', signedUrl);

                          // 4. 기존 모델 업데이트 (새로운 모델 생성 대신)
                          console.log('[SAVE] 4. 기존 모델 업데이트 중...');

                          // 원본 모델 정보 가져오기
                          const { data: originalModel, error: fetchError } = await supabase
                            .from('ai_generated_models')
                            .select('*')
                            .eq('id', generatedModel.id)
                            .single();

                          if (fetchError) {
                            console.error('[SAVE] ✗ 원본 모델 조회 실패:', fetchError);
                            throw fetchError;
                          }
                          console.log('[SAVE] ✓ 원본 모델 조회 완료:', originalModel.model_name);

                          // 기존 Storage 파일 삭제 (옵션)
                          if (originalModel.storage_path) {
                            console.log('[SAVE] 4-1. 기존 Storage 파일 삭제 시도:', originalModel.storage_path);
                            const { error: deleteError } = await supabase.storage
                              .from('ai-models')
                              .remove([originalModel.storage_path]);

                            if (deleteError) {
                              console.warn('[SAVE] ⚠ 기존 파일 삭제 실패 (무시):', deleteError);
                            } else {
                              console.log('[SAVE] ✓ 기존 Storage 파일 삭제 완료');
                            }
                          }

                          // 기존 모델 레코드 업데이트 (새 파일로)
                          const { data: updatedModel, error: updateError } = await supabase
                            .from('ai_generated_models')
                            .update({
                              storage_path: filePath,
                              download_url: signedUrl,
                              file_size: blob.size,
                              updated_at: new Date().toISOString(),
                            })
                            .eq('id', generatedModel.id)
                            .select()
                            .single();

                          if (updateError) {
                            console.error('[SAVE] ✗ 모델 업데이트 실패:', updateError);
                            throw updateError;
                          }
                          console.log('[SAVE] ✓ 모델 업데이트 완료 - ID:', updatedModel.id);

                          // newModel을 updatedModel로 변경
                          const newModel = updatedModel;

                          // 5. 로컬 상태 업데이트 - 새 모델로 전환
                          console.log('[SAVE] 5. UI 상태 업데이트...');
                          setGeneratedModel({
                            id: newModel.id,
                            name: newModel.model_name,
                            type: newModel.generation_type === 'image_to_3d' ? 'image' : 'text',
                            prompt: newModel.prompt || '',
                            status: 'completed',
                            thumbnail: newModel.thumbnail_url || '/placeholder.svg',
                            glbUrl: signedUrl,
                            createdAt: newModel.created_at,
                          });

                          // 회전/스케일 초기화 (새 모델은 이미 회전이 적용되어 있음)
                          setUserRotation([0, 0, 0]);
                          setUniformScale(1);

                          console.log('[SAVE] ========== 모델 저장 완료 ==========');
                          console.log('[SAVE] 새 모델 ID:', newModel.id);
                          console.log('[SAVE] 새 모델 URL:', signedUrl);

                          toast({
                            title: t('common.success') || '저장 완료',
                            description: '회전된 모델이 새로운 버전으로 저장되었습니다.',
                          });
                        } catch (error) {
                          console.error('[SAVE] ========== 저장 실패 ==========');
                          console.error('[SAVE] 오류:', error);
                          toast({
                            title: t('common.error') || '오류',
                            description: '저장에 실패했습니다.',
                            variant: 'destructive',
                          });
                        }
                      }}
                      disabled={!generatedModel?.id}
                    >
                      {t('modelViewer.saveButton') || 'Save'}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={async () => {
                        if (generatedModel?.glbUrl && Capacitor.isNativePlatform()) {
                          try {
                            await Share.share({
                              title: generatedModel.name,
                              text: `3D 모델: ${generatedModel.name}`,
                              url: generatedModel.glbUrl,
                              dialogTitle: t('common.share') || '공유',
                            });
                          } catch (error) {
                            console.error('Share error:', error);
                            toast({
                              title: t('common.error') || '오류',
                              description: t('ai.shareFailed') || '공유에 실패했습니다.',
                              variant: 'destructive',
                            });
                          }
                        }
                      }}
                      disabled={!generatedModel?.glbUrl || !Capacitor.isNativePlatform()}
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      {t('common.share') || '공유'}
                    </Button>
                    {/* 다운로드 버튼 - Android만 표시 */}
                    {Capacitor.getPlatform() === 'android' && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={async () => {
                          if (!generatedModel?.glbUrl) return;

                          try {
                            // URL에서 파일 경로 추출
                            const urlObj = new URL(generatedModel.glbUrl);
                            const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);

                            if (!pathMatch) {
                              throw new Error('Invalid storage URL format');
                            }

                            const bucketName = pathMatch[1];
                            const filePath = decodeURIComponent(pathMatch[2].split('?')[0]);

                            console.log('[Download] Downloading from bucket:', bucketName, 'path:', filePath);

                            // Supabase Storage에서 직접 다운로드 (인증 포함)
                            const { data: blob, error } = await supabase.storage
                              .from(bucketName)
                              .download(filePath);

                            if (error) {
                              console.error('[Download] Supabase download error:', error);
                              throw error;
                            }

                            if (!blob) {
                              throw new Error('No file data received');
                            }

                            console.log('[Download] File downloaded:', blob.size, 'bytes');

                            // 권한 확인 (Android 10 미만)
                            try {
                              const permission = await Filesystem.checkPermissions();
                              console.log('[Download] Filesystem permission status:', permission);

                              if (permission.publicStorage !== 'granted') {
                                const requestResult = await Filesystem.requestPermissions();
                                console.log('[Download] Permission request result:', requestResult);

                                if (requestResult.publicStorage !== 'granted') {
                                  toast({
                                    title: t('common.error') || '오류',
                                    description: '저장소 권한이 필요합니다.',
                                    variant: 'destructive',
                                  });
                                  return;
                                }
                              }
                            } catch (permError) {
                              // Android 10+ (API 29+)에서는 publicStorage 권한이 없을 수 있음
                              console.log('[Download] Permission check skipped (likely Android 10+):', permError);
                            }

                            // Blob을 Base64로 변환
                            const reader = new FileReader();
                            reader.readAsDataURL(blob);
                            reader.onloadend = async () => {
                              const base64Data = reader.result as string;
                              const base64 = base64Data.split(',')[1];

                              try {
                                // Android Downloads 폴더에 저장
                                const result = await Filesystem.writeFile({
                                  path: `Download/${generatedModel.name}.glb`,
                                  data: base64,
                                  directory: Directory.ExternalStorage,
                                  recursive: true, // Download 폴더 자동 생성
                                });

                                console.log('[Download] File saved successfully:', result.uri);

                                toast({
                                  title: t('ai.downloadComplete') || '다운로드 완료',
                                  description: `GLB 파일이 저장되었습니다.\n위치: ${result.uri}`,
                                });
                              } catch (fsError) {
                                console.error('[Download] Filesystem write error:', fsError);
                                toast({
                                  title: t('common.error') || '오류',
                                  description: t('ai.downloadFailed') || '다운로드에 실패했습니다.',
                                  variant: 'destructive',
                                });
                              }
                            };
                          } catch (error) {
                            console.error('Download error:', error);
                            toast({
                              title: t('common.error') || '오류',
                              description: t('ai.downloadFailed') || '다운로드에 실패했습니다.',
                              variant: 'destructive',
                            });
                          }
                        }}
                        disabled={!generatedModel?.glbUrl}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {t('common.download')}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('modelViewer.saveInfo') || 'Saves the model with current rotation, scale, and mesh optimizations applied.'}
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

    </div>
  );

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 상단 헤더 - 고정 */}
      <PlatformHeader sticky={false}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-lg font-semibold">{t('ai.title')}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleOpenHistory}>
            <History className="w-4 h-4" />
          </Button>
        </div>
      </PlatformHeader>

      {/* 컨텐츠 영역 - 스크롤 가능 (BottomNavigation을 위한 하단 여백) */}
      <div ref={contentScrollRef} className="flex-1 overflow-y-auto px-4 pt-4" style={safeAreaStyle}>
        {currentStep === "select-input" && renderSelectInput()}
        {currentStep === "create-prompt" && renderCreatePrompt()}
        {currentStep === "generate" && renderGenerating()}
        {currentStep === "result" && renderResult()}
      </div>

      {/* 고정된 하단 버튼 - BottomNavigation과 safe area 고려 */}
      {currentStep === "create-prompt" && (
        <div className="flex-shrink-0 p-4 bg-background border-t" style={buttonAreaStyle}>
          <Button
            size="lg"
            className="w-full h-14 text-lg font-semibold"
            onClick={startGeneration}
            disabled={!textPrompt.trim() && uploadedFiles.length === 0}
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {t('ai.generate')}
          </Button>
        </div>
      )}

      {currentStep === "result" && (
        <div className="flex-shrink-0 p-4 bg-background border-t" style={buttonAreaStyle}>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-14 text-lg font-semibold"
              onClick={resetFlow}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              {t('ai.createAnother') || '뒤로'}
            </Button>
            <Button
              size="lg"
              className="h-14 text-lg font-semibold"
              onClick={() => setShowPrinterModal(true)}
              disabled={!generatedModel?.glbUrl}
            >
              <Printer className="w-5 h-5 mr-2" />
              {t('ai.print') || '출력'}
            </Button>
          </div>
        </div>
      )}

      {/* 출력 설정 다단계 모달 */}
      <Sheet
        open={showPrinterModal}
        onOpenChange={(open) => {
          // 슬라이싱 중에는 모달을 닫을 수 없음 (백그라운드 모드 제외)
          if (isSlicing && !slicingInBackground) return;

          setShowPrinterModal(open);
          if (!open) {
            // 모달 닫힐 때 상태 초기화
            setPrintStep('printer');
            setSelectedPrinter(null);
            setGcodeUrl(null);
            setGcodeInfo(null);
          }
        }}
      >
        <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
          {/* 1단계: 프린터 선택 */}
          {printStep === 'printer' && (
            <>
              <SheetHeader className="px-6 pt-6">
                <SheetTitle>{t('ai.selectPrinterTitle') || '프린터 선택'}</SheetTitle>
                <SheetDescription>{t('ai.selectPrinterDesc') || '출력할 프린터를 선택하세요'}</SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-6 mt-6">
                <div className="space-y-3 pb-6">
                  {connectedPrinters.length > 0 ? (
                    connectedPrinters.map((printer) => (
                      <Card
                        key={printer.id}
                        className="cursor-pointer hover:bg-accent transition-all duration-150"
                        onClick={() => handlePrinterSelect(printer)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium">{printer.name}</p>
                              <p className="text-xs text-muted-foreground">{printer.model}</p>
                            </div>
                            <PrinterStatusBadge status={printer.status} />
                          </div>
                          <div className="text-xs text-muted-foreground flex justify-between">
                            <span>{t('printer.nozzle') || '노즐'}: {printer.nozzle_temp || 0}°C</span>
                            <span>{t('printer.bed') || '베드'}: {printer.bed_temp || 0}°C</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Printer className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        {t('printer.noConnectedPrinters') || '연결된 프린터가 없습니다'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* 2단계: 출력 정보 & 출력 시작 */}
          {printStep === 'preview' && (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b text-left">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPrintStep('printer')}
                    disabled={isSlicing}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex-1">
                    <SheetTitle className="text-left">{t('ai.printSettings') || '출력 설정'}</SheetTitle>
                    <SheetDescription className="text-left">
                      {selectedPrinter?.name || ''}{selectedPrinter?.model ? ` - ${selectedPrinter.model}` : ''}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                {isSlicing ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mb-4 will-change-transform" style={{ transform: 'translateZ(0)' }} />
                    <p className="text-lg font-medium">{t('ai.slicing') || '슬라이싱 중...'}</p>
                    {slicingInBackground ? (
                      <div className="text-center mt-4 space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {t('ai.modelSizeLarge') || '모델의 크기가 커서 시간이 오래 걸려요'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t('ai.notifyWhenComplete') || '완료되면 푸시 알람으로 알려드릴게요'}
                        </p>
                        <Button
                          variant="link"
                          className="underline text-primary"
                          onClick={() => {
                            setShowPrinterModal(false);
                            navigate('/dashboard');
                          }}
                        >
                          {t('ai.goToHome') || '홈으로 가기'}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-2">{t('ai.pleaseWait') || '잠시만 기다려주세요'}</p>
                    )}
                  </div>
                ) : gcodeUrl && gcodeInfo ? (
                  <div className="space-y-4">
                    {/* 슬라이싱 완료 표시 */}
                    <div className="bg-muted rounded-lg p-8 text-center">
                      <Check className="w-12 h-12 mx-auto text-green-500 mb-3" />
                      <p className="font-medium">{t('ai.slicingComplete') || '슬라이싱 완료'}</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {t('ai.readyToPrint') || '출력 준비가 완료되었습니다'}
                      </p>
                    </div>

                    {/* 출력 정보 표시 */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{t('ai.printInfo') || '출력 정보'}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('ai.estimatedTime') || '예상 시간'}</span>
                            <span className="font-medium">{gcodeInfo.printTime || '-'}</span>
                          </div>
                          {gcodeInfo.filamentLength && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('ai.filamentLength') || '사용량 (길이)'}</span>
                              <span className="font-medium">{gcodeInfo.filamentLength}</span>
                            </div>
                          )}
                          {gcodeInfo.filamentWeight && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('ai.filamentWeight') || '사용량 (무게)'}</span>
                              <span className="font-medium">{gcodeInfo.filamentWeight}</span>
                            </div>
                          )}
                          {gcodeInfo.layerCount && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('ai.totalLayers') || '총 레이어 수'}</span>
                              <span className="font-medium">{gcodeInfo.layerCount}</span>
                            </div>
                          )}
                        </div>

                        <Separator />

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('printer.nozzle') || '노즐'}</span>
                            <span className="font-medium">{gcodeInfo.nozzleTemp || 0}°C</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('printer.bed') || '베드'}</span>
                            <span className="font-medium">{gcodeInfo.bedTemp || 0}°C</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">{t('ai.noGcode') || 'GCode를 생성해주세요'}</p>
                  </div>
                )}
              </div>

              {/* 하단 버튼 */}
              <div className="flex-shrink-0 p-6 border-t bg-background safe-area-bottom">
                <Button
                  size="lg"
                  className="w-full"
                  variant={!selectedPrinter?.connected ? "destructive" : "default"}
                  disabled={!gcodeUrl || isSlicing}
                  onClick={() => {
                    if (!selectedPrinter?.connected) {
                      // 프린터 연결 없을 때: 프린터 선택 화면으로 돌아가기
                      setPrintStep('printer');
                      setSelectedPrinter(null);
                      setGcodeUrl(null);
                      setGcodeInfo(null);
                    } else {
                      // 프린터 연결됨: 출력 시작
                      toast({
                        title: t('ai.printStarted') || '출력 시작',
                        description: `${selectedPrinter?.name}에서 출력을 시작합니다`,
                      });
                      setShowPrinterModal(false);
                    }
                  }}
                >
                  {!selectedPrinter?.connected ? (
                    <>
                      <XCircle className="w-5 h-5 mr-2" />
                      {t('printer.notConnected') || '연결 없음'}
                    </>
                  ) : (
                    <>
                      <Printer className="w-5 h-5 mr-2" />
                      {t('ai.startPrint') || '출력 시작'}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 모델 아카이브 Sheet */}
      <Sheet open={showHistory} onOpenChange={handleCloseHistory}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle>{t('ai.modelArchive') || '모델 아카이브'}</SheetTitle>
            <SheetDescription>
              {t('ai.modelArchiveDesc') || '생성한 AI 모델을 확인하고 다시 불러올 수 있습니다'}
            </SheetDescription>
          </SheetHeader>

          {/* 탭 필터 */}
          <div className="px-6 pt-3 pb-0">
            <div className="grid grid-cols-4 gap-0 border-b">
              <button
                onClick={() => setActiveTab('all')}
                className={`relative h-10 px-3 text-xs font-medium transition-colors ${
                  activeTab === 'all'
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('ai.allModels') || '전체'}
                {activeTab === 'all' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('text')}
                className={`relative h-10 px-3 text-xs font-medium transition-colors ${
                  activeTab === 'text'
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('ai.textOnly') || '텍스트'}
                {activeTab === 'text' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('image')}
                className={`relative h-10 px-3 text-xs font-medium transition-colors ${
                  activeTab === 'image'
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('ai.imageOnly') || '이미지'}
                {activeTab === 'image' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('2d')}
                className={`relative h-10 px-3 text-xs font-medium transition-colors ${
                  activeTab === '2d'
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('ai.image2D') || '2D'}
                {activeTab === '2d' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            </div>
          </div>

          {/* 모델 목록 */}
          <div className="flex-1 overflow-y-auto px-6 pt-4">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary will-change-transform" style={{ transform: 'translateZ(0)' }} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 pb-6">
                {historyModels
                  .filter(model => {
                    if (activeTab === 'all') return true;
                    if (activeTab === 'text') return model.generation_type === 'text_to_3d';
                    if (activeTab === 'image') return model.generation_type === 'image_to_3d';
                    if (activeTab === '2d') return model.generation_type === 'text_to_image';
                    return true;
                  })
                  .map((model) => (
                    <Card
                      key={model.id}
                      className="cursor-pointer hover:shadow-lg transition-all overflow-hidden"
                      onClick={() => handleLoadHistoryModel(model.id)}
                    >
                      <div className="relative aspect-square">
                        {model.status === 'processing' ? (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-primary will-change-transform" style={{ transform: 'translateZ(0)' }} />
                          </div>
                        ) : (
                          <img
                            src={model.thumbnail_url || '/placeholder.svg'}
                            alt={model.model_name || 'Model'}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <Badge
                          className={`absolute top-2 left-2 text-xs flex items-center gap-1.5 ${
                            model.generation_type === 'text_to_3d'
                              ? 'bg-blue-500/90 hover:bg-blue-500'
                              : model.generation_type === 'image_to_3d'
                              ? 'bg-purple-500/90 hover:bg-purple-500'
                              : 'bg-pink-500/90 hover:bg-pink-500'
                          }`}
                        >
                          {model.generation_type === 'text_to_3d' ? (
                            <>
                              <FileText className="w-3 h-3" />
                              <span>Text</span>
                            </>
                          ) : model.generation_type === 'image_to_3d' ? (
                            <>
                              <ImageIcon className="w-3 h-3" />
                              <span>Image</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3" />
                              <span>2D</span>
                            </>
                          )}
                        </Badge>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7 opacity-0 hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHistoryModel(model.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-sm font-medium truncate">
                          {model.model_name || 'Untitled Model'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {model.prompt || 'No prompt'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(model.created_at).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}

            {!isLoadingHistory && historyModels.filter(model => {
              if (activeTab === 'all') return true;
              if (activeTab === 'text') return model.generation_type === 'text_to_3d';
              if (activeTab === 'image') return model.generation_type === 'image_to_3d';
              if (activeTab === '2d') return model.generation_type === 'text_to_image';
              return true;
            }).length === 0 && (
              <div className="text-center py-12">
                <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {t('ai.noModelsFound') || '생성된 모델이 없습니다'}
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* CSS 애니메이션 정의 */}
      <style>{`
        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideInFromLeft {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default AI;
