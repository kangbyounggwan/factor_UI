import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Lazy load ModelViewer to reduce initial bundle size
const ModelViewer = lazy(() => import("@/components/ai/ModelViewer"));
const GCodeViewer = lazy(() => import("@/components/ai/GCodeViewer"));
const GCodePreview = lazy(() => import("@/components/ai/GCodePreview"));
import TextTo3DForm from "@/components/ai/TextTo3DForm";
import ImageTo3DForm from "@/components/ai/ImageTo3DForm";
import ModelPreview from "@/components/ai/ModelPreview";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Refactored Components
import { PrintSettingsDialog } from "@/components/ai/PrintSettingsDialog";
import { AIArchiveSidebar } from "@/components/ai/AIArchiveSidebar";
import { TextToImageTab } from "@/components/ai/TextToImageTab";
import {
  UpgradePromptDialog,
  PrinterConfirmDialog,
  DeleteImageDialog
} from "@/components/ai/AIConfirmDialogs";

// 타입 정의는 shared에서 가져옴
import type { UploadedFile } from "@shared/hooks/useAIImageUpload";
import type { AIGeneratedModel } from "@shared/types/aiModelType";
import type { PrinterData as Printer, PrinterGroup, GCodeInfo, PrintSettings } from "@/types/ai";

type SymmetryMode = 'off' | 'auto' | 'on';
type ArtStyle = 'realistic' | 'sculpture';
import {
  Layers,
  Upload,
  Download,
  Play,
  MessageSquare,
  Pause,
  Image,
  Box,
  FileText,
  File as FileIcon,
  Printer as PrinterIcon,
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

import { buildCommon, buildPrintablePrompt, BASE_3D_PRINT_PROMPT, postTextTo3D, postImageTo3D, extractGLBUrl, extractSTLUrl, extractMetadata, extractThumbnailUrl, pollTaskUntilComplete, AIModelResponse } from "@shared/services/aiService";
import { createAIModel, updateAIModel, listAIModels, deleteAIModel } from "@shared/services/supabaseService/aiModel";
import { supabase } from "@shared/integrations/supabase/client";
import { useAIImageUpload } from "@shared/hooks/useAIImageUpload";
import { useAIPrinters } from "@/hooks/ai/useAIPrinters";
import { usePrintJob } from "@/hooks/ai/usePrintJob";
import { downloadAndUploadModel, downloadAndUploadSTL, downloadAndUploadThumbnail, deleteModelFiles } from "@shared/services/supabaseService/aiStorage";

import { subscribeToTaskUpdates, BackgroundTask } from "@shared/services/backgroundSlicing";
import { canGenerateAiModel, getAiGenerationLimit, getRemainingAiGenerations } from "@shared/utils/subscription";
import { SubscriptionPlan } from "@shared/types/subscription";
import { generateShortFilename } from "@shared/services/geminiService";


const AI = () => {
  const { t } = useTranslation();
  const { user } = useAuth();


  const [activeTab, setActiveTab] = useState<string>('text-to-3d');
  const [textPrompt, setTextPrompt] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0); // 진행률 (0-100)
  const [progressStatus, setProgressStatus] = useState<string>(''); // 진행 상태 메시지
  const [generatedModels, setGeneratedModels] = useState<AIGeneratedModel[]>([]);
  const { printers, connectedCount, printingCount, totalPrinters } = useAIPrinters(user?.id);
  const [modelViewerUrl, setModelViewerUrl] = useState<string | null>(null);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null); // 현재 선택된 모델 ID
  const [currentGlbUrl, setCurrentGlbUrl] = useState<string | null>(null); // 현재 모델의 GLB URL
  const [currentStlUrl, setCurrentStlUrl] = useState<string | null>(null); // 현재 모델의 STL URL
  const [currentGCodeUrl, setCurrentGCodeUrl] = useState<string | null>(null); // 현재 모델의 GCode URL
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null); // Text-to-Image 생성 이미지 URL

  const {
    isSlicing, setIsSlicing,
    gcodeInfo, setGcodeInfo,
    printSettings, setPrintSettings,
    printDialogOpen, setPrintDialogOpen,
    printerConfirmDialogOpen, setPrinterConfirmDialogOpen,
    printerToConfirm, setPrinterToConfirm,
    selectedPrinter, setSelectedPrinter,
    printFileName, setPrintFileName,
    settingsTab, setSettingsTab,
    targetPrinterModelId, setTargetPrinterModelId,
    resliceManufacturer, setResliceManufacturer,
    resliceSeries, setResliceSeries,
    resliceModelId, setResliceModelId,
    manufacturers,
    seriesList,
    modelsList,
    isLoadingDefaultPrinter,
    loadDefaultPrinterSettings,
    openPrinterSettings,
    confirmPrinterSelection,
    handleReslice,
    startPrint
  } = usePrintJob({
    user,
    printers,
    currentModelId,
    currentGCodeUrl,
    setCurrentGCodeUrl,
    currentGlbUrl,
    generatedModels
  });
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
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();



  // 구독 플랜 상태
  const [userPlan, setUserPlan] = useState<SubscriptionPlan>('free');
  const [monthlyAiUsage, setMonthlyAiUsage] = useState<number>(0);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState<boolean>(false);



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

  // 구독 플랜 및 AI 사용량 로드
  useEffect(() => {
    const loadSubscriptionData = async () => {
      if (!user?.id) return;

      try {
        // 1. 사용자 구독 플랜 로드
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('plan_name')
          .eq('user_id', user.id)
          .single();

        const planName = (subscription?.plan_name?.toLowerCase() || 'free') as SubscriptionPlan;
        setUserPlan(planName);

        // 2. 이번 달 AI 모델 생성 횟수 로드
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const { count } = await supabase
          .from('ai_generated_models')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth);

        setMonthlyAiUsage(count || 0);
      } catch (error) {
        console.error('[AI] Failed to load subscription data:', error);
      }
    };

    loadSubscriptionData();
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

        // Generate default filename for print
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const modelName = task.input_params?.modelName || currentModelId || 'model';
        const printerName = task.input_params?.printerName || selectedPrinter?.name || 'printer';
        const defaultFileName = `${modelName.replace(/[^a-zA-Z0-9가-힣-]/g, '_')}-${printerName.replace(/[^a-zA-Z0-9가-힣-]/g, '_')}-${timestamp}`;
        setPrintFileName(defaultFileName);

        // Auto-switch to file settings tab after slicing
        setSettingsTab('file');

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
      const { modelId, gcodeUrl, printerModelId } = (state?.autoLoadGCode || {}) as any;
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
          // 캐시 무효화를 위해 updated_at 타임스탬프 추가
          // URL에 이미 쿼리 파라미터가 있으면 &를, 없으면 ?를 사용
          const cacheBustedUrl = model.download_url ?
            `${model.download_url}${model.download_url.includes('?') ? '&' : '?'}t=${new Date(model.updated_at || model.created_at).getTime()}` :
            model.download_url;
          setModelViewerUrl(cacheBustedUrl);
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



  // 이미지 삭제 확인 다이얼로그 상태
  const [deleteImageDialogOpen, setDeleteImageDialogOpen] = useState<boolean>(false);
  const [imageToDelete, setImageToDelete] = useState<number | null>(null);
  const [linkedModelsCount, setLinkedModelsCount] = useState<number>(0);



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

      // 2. Get signed URL (24시간 유효)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('ai-models')
        .createSignedUrl(filePath, 86400);

      if (urlError) {
        console.error('[AI] Failed to create signed URL:', urlError);
        throw urlError;
      }

      const signedUrl = urlData.signedUrl;

      console.log('[AI] GLB uploaded successfully:', {
        signedUrl,
        uploadPath: uploadData.path
      });

      // 3. Update the model record in database
      await updateAIModel(supabase, currentModelId, {
        download_url: signedUrl,
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
      setCurrentGlbUrl(signedUrl);
      setModelViewerUrl(signedUrl);

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

    // 구독 플랜 제한 체크 (text-to-3d, image-to-3d 탭에서만)
    if (activeTab === 'text-to-3d' || activeTab === 'image-to-3d') {
      if (!canGenerateAiModel(userPlan, monthlyAiUsage)) {
        const limit = getAiGenerationLimit(userPlan);
        setShowUpgradePrompt(true);
        toast({
          title: t('ai.limitReached'),
          description: t('ai.limitReachedDescription', {
            limit: limit === 'unlimited' ? '∞' : limit,
            plan: userPlan.toUpperCase()
          }),
          variant: "destructive"
        });
        return;
      }
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
        // 사용자 프롬프트에 3D 프린팅 최적화 제약 조건 추가
        const printablePrompt = buildPrintablePrompt(textPrompt);
        console.log('[AI] Sending prompt with 3D printing constraints');

        // [TEST] 모델 생성 전 Gemini 이름 생성 테스트
        try {
          console.log('[AI] Testing Gemini name generation...');
          const testShortName = await generateShortFilename({ prompt: textPrompt });
          console.log('[AI] Gemini Generated Name Result:', testShortName);
          toast({
            title: "Gemini Name Test",
            description: `Generated: ${testShortName}`,
          });
        } catch (e) {
          console.error('[AI] Gemini Name Test Failed:', e);
        }

        const payload = {
          task: 'text_to_3d',
          prompt: printablePrompt,
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

          // Claude API로 짧은 이름 생성 (프롬프트 기반)
          let shortName: string | undefined;
          try {
            shortName = await generateShortFilename({ prompt: textPrompt });
            console.log('[AI] Generated short_name:', shortName);
          } catch (error) {
            console.warn('[AI] Failed to generate short_name:', error);
          }

          await updateAIModel(supabase, dbModelId, {
            storage_path: glbUploadResult?.path || undefined,           // GLB Supabase Storage 경로
            download_url: glbUploadResult?.publicUrl || undefined,     // GLB Supabase Public URL
            stl_storage_path: stlUploadResult?.path || undefined,      // STL Supabase Storage 경로
            stl_download_url: stlUploadResult?.publicUrl || undefined, // STL Supabase Public URL
            thumbnail_url: thumbnailUploadResult?.publicUrl || undefined,  // Supabase Storage 썸네일 URL
            status: 'completed',
            generation_metadata: metadata || undefined,
            file_format: stlUploadResult ? 'stl' : 'glb',  // STL이 있으면 STL, 없으면 GLB
            short_name: shortName,  // Claude가 생성한 짧은 영문 이름
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

          // 월별 AI 사용량 증가
          setMonthlyAiUsage(prev => prev + 1);
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
        // 3D 프린팅 최적화 제약 조건을 common에 추가
        const common = {
          ...buildCommon(imageSymmetryMode, imageArtStyle, imageTargetPolycount, user?.id, 'web'),
          manufacturing_constraints: BASE_3D_PRINT_PROMPT,
        };
        console.log('[AI] Sending image-to-3D with 3D printing constraints');

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

          // Claude Vision API로 짧은 이름 생성 (이미지 기반)
          let shortName: string | undefined;
          try {
            const imageUrlForShortName = selected.url || selected.storagePath;
            if (imageUrlForShortName) {
              shortName = await generateShortFilename({ imageUrl: imageUrlForShortName });
              console.log('[AI] Generated short_name from image:', shortName);
            }
          } catch (error) {
            console.warn('[AI] Failed to generate short_name from image:', error);
          }

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
            short_name: shortName,  // Claude Vision이 생성한 짧은 영문 이름
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

          // 월별 AI 사용량 증가
          setMonthlyAiUsage(prev => prev + 1);
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

  // AI 생성 제한 정보
  const aiLimit = getAiGenerationLimit(userPlan);
  const remainingGenerations = getRemainingAiGenerations(userPlan, monthlyAiUsage);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      {/* 업그레이드 프롬프트 다이얼로그 */}
      <UpgradePromptDialog
        open={showUpgradePrompt}
        onOpenChange={setShowUpgradePrompt}
        monthlyAiUsage={monthlyAiUsage}
        aiLimit={aiLimit}
        userPlan={userPlan}
      />

      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* 메인 작업 영역 */}
        <div className="flex-1 flex flex-col">
          {/* 헤더 */}
          <div className="border-b p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Layers className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">{t('ai.title')}</h1>
              </div>
              {/* AI 사용량 표시 */}
              <div className="text-sm text-muted-foreground">
                {t('ai.usageInfo', {
                  used: monthlyAiUsage,
                  limit: aiLimit === 'unlimited' ? '∞' : aiLimit
                })}
              </div>
            </div>
          </div>

          {/* 탭 및 작업 영역 */}
          <div className="flex-1 p-4 overflow-hidden">
            {/* 모델 생성 메인 영역 */}
            <div className="flex-1 min-h-0 overflow-hidden h-full flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col overflow-hidden">
                <TabsList className="grid w-full grid-cols-3 mb-4 shrink-0">
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
                                      {t('ai.estimatedTime')}: 5m
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
                  <TextToImageTab
                    prompt={textPrompt}
                    setPrompt={setTextPrompt}
                    isProcessing={isProcessing}
                    generateImage={generateModel}
                    generatedImageUrl={generatedImageUrl}
                  />
                </TabsContent>

              </Tabs>
            </div>
          </div>
        </div>
        <AIArchiveSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          archiveViewMode={archiveViewMode}
          setArchiveViewMode={setArchiveViewMode}
          archiveFilter={archiveFilter}
          setArchiveFilter={setArchiveFilter}
          uploadedFiles={uploadedFiles}
          generatedModels={generatedModels}
          selectedImageId={selectedImageId}
          selectImage={selectImage}
          setModelViewerUrl={setModelViewerUrl}
          setSelectedImageHasModel={setSelectedImageHasModel}
          setCurrentModelId={setCurrentModelId}
          setCurrentGlbUrl={setCurrentGlbUrl}
          setCurrentStlUrl={setCurrentStlUrl}
          setCurrentGCodeUrl={setCurrentGCodeUrl}
          setTextPrompt={setTextPrompt}
          reloadModels={reloadModels}

          printers={printers}
          connectedCount={connectedCount}
          totalPrinters={totalPrinters}
          printingCount={printingCount}
          printerAreaHeight={printerAreaHeight}
          handleResizeStart={handleResizeStart}
          openPrinterSettings={() => setPrintDialogOpen(true)}
          targetPrinterModelId={targetPrinterModelId}
          currentGCodeUrl={currentGCodeUrl}
          handleModelDelete={handleModelDelete}
          modelViewerUrl={modelViewerUrl}
        />
      </div>


      {/* 출력 설정 다이얼로그 */}
      <PrintSettingsDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        selectedPrinter={selectedPrinter}
        settingsTab={settingsTab}
        setSettingsTab={setSettingsTab}
        currentGCodeUrl={currentGCodeUrl}
        modelViewerUrl={modelViewerUrl}
        isSlicing={isSlicing}
        gcodeInfo={gcodeInfo}
        printFileName={printFileName}
        setPrintFileName={setPrintFileName}
        startPrint={startPrint}
        resliceManufacturer={resliceManufacturer}
        setResliceManufacturer={setResliceManufacturer}
        resliceSeries={resliceSeries}
        setResliceSeries={setResliceSeries}
        resliceModelId={resliceModelId}
        setResliceModelId={setResliceModelId}
        manufacturers={manufacturers}
        seriesList={seriesList}
        modelsList={modelsList}
        handleReslice={handleReslice}
        loadDefaultPrinterSettings={loadDefaultPrinterSettings}
        targetPrinterModelId={targetPrinterModelId}
      />

      {/* 프린터 선택 확인 모달 */}
      <PrinterConfirmDialog
        open={printerConfirmDialogOpen}
        onOpenChange={setPrinterConfirmDialogOpen}
        printer={printerToConfirm}
        onConfirm={confirmPrinterSelection}
      />

      {/* 이미지 삭제 확인 다이얼로그 */}
      <DeleteImageDialog
        open={deleteImageDialogOpen}
        onOpenChange={setDeleteImageDialogOpen}
        linkedModelsCount={linkedModelsCount}
        onConfirm={confirmImageDelete}
      />
    </div >
  );
};

export default AI;