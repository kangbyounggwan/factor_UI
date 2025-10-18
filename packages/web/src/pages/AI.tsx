import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ModelViewer from "@/components/ModelViewer";
import TextTo3DForm from "@/components/ai/TextTo3DForm";
import ImageTo3DForm from "@/components/ai/ImageTo3DForm";
import ModelPreview from "@/components/ai/ModelPreview";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import ModelArchive from "@/components/ai/ModelArchive";
import UploadArchive from "@/components/ai/UploadArchive";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface Printer {
  id: string;
  name: string;
  status: string;
  temperature: {
    nozzle: number;
    bed: number;
  };
  progress?: number;
  raw?: any;
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

type Quality = 'low' | 'medium' | 'high';
type Model = 'flux-kontext' | 'gpt-4';
type Style = 'realistic' | 'abstract';
type ImageDepth = 'auto' | 'manual';
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
  FolderOpen,
  Grid3X3,
  Image as ImageFile,
  Shapes,
  Type
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@shared/contexts/AuthContext";
import { getUserPrintersWithGroup } from "@shared/services/supabaseService/printerList";
import { buildCommon, postTextTo3D, postImageTo3D, extractGLBUrl, extractSTLUrl, extractMetadata, extractThumbnailUrl, pollTaskUntilComplete, AIModelResponse } from "@/lib/aiService";
import { createAIModel, updateAIModel, listAIModels, deleteAIModel } from "@shared/services/supabaseService/aiModel";
import { supabase } from "@shared/integrations/supabase/client";
import { useAIImageUpload } from "@shared/hooks/useAIImageUpload";
import { downloadAndUploadModel, downloadAndUploadSTL, downloadAndUploadThumbnail } from "@shared/services/supabaseService/aiStorage";

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
  const [currentGlbUrl, setCurrentGlbUrl] = useState<string | null>(null); // 현재 모델의 GLB URL
  const [currentStlUrl, setCurrentStlUrl] = useState<string | null>(null); // 현재 모델의 STL URL
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null); // Text-to-Image 생성 이미지 URL
  const [selectedImageHasModel, setSelectedImageHasModel] = useState<boolean>(false); // 선택된 이미지의 3D 모델 존재 여부
  // 모델 아카이브 필터 상태
  type ArchiveFilter = 'all' | 'text-to-3d' | 'image-to-3d' | 'text-to-image';
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('all');
  // 아카이브 뷰 모드 (RAW / 3D 모델)
  const [archiveViewMode, setArchiveViewMode] = useState<'raw' | '3d'>('3d');
  // Text → 3D 설정 상태
  const [textQuality, setTextQuality] = useState<Quality>('medium');
  const [textModel, setTextModel] = useState<Model>('flux-kontext');
  const [textStyle, setTextStyle] = useState<Style>('realistic');
  // Image → 3D 설정 상태
  const [imageDepth, setImageDepth] = useState<ImageDepth>('auto');
  const [imageQuality, setImageQuality] = useState<Quality>('high');
  const totalPrinters = printers.length;
  const connectedCount = printers.filter((p) => p.status === 'ready' || p.status === 'printing' || p.status === 'operational').length;
  const printingCount = printers.filter((p) => p.status === 'printing').length;
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // 연결된 프린터 로드 (Supabase)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!user?.id) return;
        const rows = await getUserPrintersWithGroup(user.id);
        if (!active) return;
        const mapped: Printer[] = (rows || []).map((r) => ({
          id: r.id,
          name: r.model ?? r.device_uuid ?? 'Unknown Printer',
          status: r.status ?? 'disconnected',
          temperature: { nozzle: 0, bed: 0 },
          progress: undefined,
          raw: r,
        }));
        setPrinters(mapped);
      } catch (e) {
        console.error('[AI] load printers failed', e);
      }
    })();
    return () => { active = false; };
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

  // SEO: Title & Meta description
  useEffect(() => {
    document.title = t('ai.title');
    const desc = t('ai.description');
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);
  }, []);

  // 출력 설정 다이얼로그 상태
  const [printDialogOpen, setPrintDialogOpen] = useState<boolean>(false);
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null);

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

  const openPrinterSettings = (printer: Printer) => {
    setSelectedPrinter(printer);
    setPrintDialogOpen(true);
  };

  const updateSetting = (key: keyof PrintSettings, value: any) => {
    setPrintSettings((prev) => ({ ...prev, [key]: value }));
  };

  const startPrint = async () => {
    toast({
      title: t('ai.printStart'),
      description: `${selectedPrinter?.name}${t('ai.printJobSent')}`,
    });
    setPrintDialogOpen(false);
  };

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
  const handleModelDelete = async (model: any) => {
    try {
      setModelViewerUrl(null);
      await deleteAIModel(supabase, model.id.toString());
      await reloadModels();
      toast({
        title: t('ai.modelDeleted'),
        description: `${model.name}${t('ai.modelDeleteSuccess')}`,
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
          ai_model: textModel,
          quality: textQuality,
          style: textStyle,
          model_name: `Text-to-3D: ${textPrompt.substring(0, 30)}...`,
        }, user.id);

        dbModelId = dbModel.id;

        // 2. 텍스트 → 3D API 호출 (async_mode=true)
        const payload = {
          task: 'text_to_3d',
          prompt: textPrompt,
          ...buildCommon(textModel, textQuality, textStyle, user?.id),
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
          // STL URL을 우선적으로 렌더링에 사용
          const renderUrl = stlUploadResult?.publicUrl || glbUploadResult?.publicUrl;

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
          quality: imageQuality,
          model_name: `Image-to-3D: ${selected.name}`,
        }, user.id);

        dbModelId = dbModel.id;

        // 2. 이미지 → 3D API 호출 (async_mode=true)
        const common = buildCommon('flux-kontext', imageQuality, undefined, user?.id);
        const { model: _omitModel, ...meta } = { depth: imageDepth, ...common } as any;

        const form = new FormData();
        form.append('task', 'image_to_3d');
        form.append('image_file', file, file.name);
        form.append('json', JSON.stringify(meta));

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
          // STL URL을 우선적으로 렌더링에 사용
          const renderUrl = stlUploadResult?.publicUrl || glbUploadResult?.publicUrl;

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

    } catch (e: any) {
      console.error('[AI] 생성 실패:', e);

      // DB에 실패 상태 기록
      if (dbModelId) {
        try {
          await updateAIModel(supabase, dbModelId, {
            status: 'failed',
            generation_metadata: { error: e?.message || 'Unknown error' },
          });
        } catch (updateError) {
          console.error('[AI] DB 업데이트 실패:', updateError);
        }
      }

      toast({
        title: t('ai.generationFailed'),
        description: e?.message || t('ai.generationError'),
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
                    quality={textQuality}
                    model={textModel}
                    style={textStyle}
                    isProcessing={isProcessing}
                    onChangePrompt={setTextPrompt}
                    onChangeQuality={setTextQuality}
                    onChangeModel={setTextModel}
                    onChangeStyle={setTextStyle}
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
                  />
                </div>
              </TabsContent>

              {/* 이미지 → 3D 탭 */}
              <TabsContent value="image-to-3d" className="flex-1 min-h-0 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-6 h-full">
                  <ImageTo3DForm
                    files={uploadedFiles}
                    selectedId={selectedImageId}
                    imageDepth={imageDepth}
                    imageQuality={imageQuality}
                    isProcessing={isProcessing}
                    hasExistingModel={selectedImageHasModel}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onFileChange={handleFileUpload}
                    onRemove={handleImageDelete}
                    onSelect={selectImage}
                    onChangeDepth={setImageDepth}
                    onChangeQuality={setImageQuality}
                    onSubmit={generateModel}
                  />

                  {/* 결과 영역 */}
                  <Card className="h-fit lg:sticky top-4">
                    <CardContent className="p-0">
                      <div className="rounded-lg overflow-hidden h-[calc(85vh-4rem-2rem)] relative">
                        <ModelViewer className="w-full h-full" modelUrl={modelViewerUrl ?? undefined} modelScale={1} enableRotationControls={true} />

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
          {/* 모델 아카이브 영역 (75%) */}
          <div className="flex-[3] flex flex-col p-6 overflow-hidden">
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

                      // 디버깅용 로그
                      console.log('[AI] Model archive item:', {
                        name: model.model_name,
                        thumbnail_url: model.thumbnail_url,
                        isThumbnailSupabaseUrl,
                        download_url: model.download_url
                      });

                      return {
                        id: model.id,
                        name: model.model_name,
                        createdAt: model.created_at,
                        download_url: isSupabaseUrl ? model.download_url : undefined,
                        thumbnail_url: isThumbnailSupabaseUrl ? model.thumbnail_url : undefined,
                        _originalModel: model, // 원본 모델 정보 저장
                      };
                    })
                  }
                  onSelect={async (item: any) => {
                    const model = item._originalModel as AIGeneratedModel;

                    if (item.download_url) {
                      console.log('[AI] Loading model from archive:', item.name, item.download_url);

                      // STL 우선, GLB 폴백으로 뷰어 URL 설정
                      const viewerUrl = model.stl_download_url || model.download_url;
                      setModelViewerUrl(viewerUrl);

                      // 다운로드 버튼용 URL 설정
                      setCurrentGlbUrl(model.download_url || null);
                      setCurrentStlUrl(model.stl_download_url || null);

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

          {/* 연결된 프린터 영역 (25%) - 3D 관련 탭에서만 표시 */}
          {(activeTab === 'text-to-3d' || activeTab === 'image-to-3d') && (
            <div className="flex-[1] flex flex-col border-t p-6 overflow-hidden">
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
                      status={printer.status}
                      temperature={printer.temperature}
                      progress={printer.progress}
                      onClick={() => openPrinterSettings(printer)}
                    />
                  ))}
                </div>
              </ScrollArea>
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
                <DialogTitle className="text-lg font-semibold">
                  출력 설정{selectedPrinter ? ` - ${selectedPrinter.name}` : ''}
                </DialogTitle>
              </DialogHeader>
            </div>

            {/* 본문 */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(560px,1fr)_440px] gap-6 p-6 overflow-hidden flex-1">
              {/* 좌: 렌더링 */}
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <ModelViewer className="w-full h-[68vh]" modelUrl={modelViewerUrl ?? undefined} modelScale={1} />
                </CardContent>
              </Card>

              {/* 우: 설정 폼 */}
              <div className="h-[68vh] overflow-y-auto pr-1">
                <div className="space-y-6">
                  {/* 서포트 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">서포트</h4>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <Label htmlFor="support_enable">서포트 활성화</Label>
                      <Switch id="support_enable" checked={printSettings.support_enable} onCheckedChange={(v)=>updateSetting('support_enable', v)} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="support_angle">오버행 임계각(°)</Label>
                        <Input id="support_angle" type="number" step="1" value={printSettings.support_angle} onChange={(e)=>updateSetting('support_angle', Number(e.target.value))} />
                      </div>
                      <div>
                        <Label htmlFor="adhesion_type">빌드플레이트 접착</Label>
                        <Select value={printSettings.adhesion_type} onValueChange={(v)=>updateSetting('adhesion_type', v)}>
                          <SelectTrigger id="adhesion_type" className="w-full">
                            <SelectValue placeholder="없음" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="none">없음</SelectItem>
                            <SelectItem value="skirt">Skirt</SelectItem>
                            <SelectItem value="brim">Brim</SelectItem>
                            <SelectItem value="raft">Raft</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* 품질/속도 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="layer_height">레이어 높이(mm)</Label>
                      <Input id="layer_height" type="number" step="0.01" value={printSettings.layer_height} onChange={(e)=>updateSetting('layer_height', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor="line_width">라인 너비(mm)</Label>
                      <Input id="line_width" type="number" step="0.01" value={printSettings.line_width} onChange={(e)=>updateSetting('line_width', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor="speed_print">프린트 속도(mm/s)</Label>
                      <Input id="speed_print" type="number" step="1" value={printSettings.speed_print} onChange={(e)=>updateSetting('speed_print', Number(e.target.value))} />
                    </div>
                  </div>

                  <Separator />

                  {/* 재료 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="material_diameter">재료 직경(mm)</Label>
                      <Input id="material_diameter" type="number" step="0.01" value={printSettings.material_diameter} onChange={(e)=>updateSetting('material_diameter', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor="material_flow">재료 유량(%)</Label>
                      <Input id="material_flow" type="number" step="1" value={printSettings.material_flow} onChange={(e)=>updateSetting('material_flow', Number(e.target.value))} />
                    </div>
                  </div>

                  <Separator />

                  {/* 인필/벽/탑/바닥 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="infill_sparse_density">인필 밀도(%)</Label>
                      <Input id="infill_sparse_density" type="number" step="1" value={printSettings.infill_sparse_density} onChange={(e)=>updateSetting('infill_sparse_density', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor="wall_line_count">벽 라인 수</Label>
                      <Input id="wall_line_count" type="number" step="1" value={printSettings.wall_line_count} onChange={(e)=>updateSetting('wall_line_count', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor="top_layers">탑 레이어</Label>
                      <Input id="top_layers" type="number" step="1" value={printSettings.top_layers} onChange={(e)=>updateSetting('top_layers', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor="bottom_layers">바닥 레이어</Label>
                      <Input id="bottom_layers" type="number" step="1" value={printSettings.bottom_layers} onChange={(e)=>updateSetting('bottom_layers', Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 푸터 */}
            <div className="px-6 py-4 border-t flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>취소</Button>
              <Button onClick={startPrint}>
                <Printer className="w-4 h-4 mr-2" />
                출력 시작
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 이미지 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteImageDialogOpen} onOpenChange={setDeleteImageDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이미지 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              {linkedModelsCount > 0 ? (
                <>
                  이 이미지로 생성된 <strong>{linkedModelsCount}개의 3D 모델</strong>이 함께 삭제됩니다.
                  <br /><br />
                  정말로 삭제하시겠습니까?
                </>
              ) : (
                '이 이미지를 삭제하시겠습니까?'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImageDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AI;