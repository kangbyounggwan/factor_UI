import { lazy, Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Lazy load ModelViewer to reduce initial bundle size
const ModelViewer = lazy(() => import("@/components/ModelViewer"));
import WorkflowStatusCard from "./WorkflowStatusCard";
import { WorkflowStep, WorkflowStepStatus } from "@factor/shared";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/use-toast";

interface ModelPreviewProps {
  isProcessing?: boolean;
  modelUrl?: string;
  glbDownloadUrl?: string;
  stlDownloadUrl?: string;
  progress?: number;
  progressStatus?: string;
  workflowState?: {
    currentStep: WorkflowStep;
    steps: {
      modelling: WorkflowStepStatus;
      optimization: WorkflowStepStatus;
      gcode_generation: WorkflowStepStatus;
    };
    error?: string;
  };
  modelId?: string;
  onSave?: (data: {
    rotation: [number, number, number];
    scale: number;
    optimized: boolean;
    blob: Blob;
    format: 'stl' | 'glb';
  }) => Promise<void>;
}

export default function ModelPreview({
  isProcessing = false,
  modelUrl,
  glbDownloadUrl,
  stlDownloadUrl,
  progress = 0,
  progressStatus = '',
  workflowState,
  modelId,
  onSave,
}: ModelPreviewProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const showWorkflowStatus = workflowState && isProcessing;

  const getWorkflowMessage = () => {
    if (!workflowState) return t('ai.processing');

    switch (workflowState.currentStep) {
      case "modelling":
        return t('ai.workflowModelling');
      case "optimization":
        return t('ai.workflowOptimization');
      case "gcode_generation":
        return t('ai.workflowGcode');
      default:
        return t('ai.processing');
    }
  };

  const downloadFile = async (url: string, filename: string) => {
    try {
      toast({ title: '다운로드 시작', description: `${filename} 다운로드 중...` });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast({ title: '다운로드 완료', description: `${filename}이(가) 다운로드되었습니다.` });
    } catch (error) {
      console.error('[ModelPreview] Download failed:', error);
      toast({
        title: '다운로드 실패',
        description: '파일 다운로드 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    }
  };

  const handleDownloadGLB = () => {
    if (glbDownloadUrl) {
      const filename = `model_${Date.now()}.glb`;
      downloadFile(glbDownloadUrl, filename);
    }
  };

  const handleDownloadSTL = () => {
    if (stlDownloadUrl) {
      const filename = `model_${Date.now()}.stl`;
      downloadFile(stlDownloadUrl, filename);
    }
  };

  const hasDownloadableFiles = glbDownloadUrl || stlDownloadUrl;

  return (
    <div className="space-y-4">
      {/* 워크플로우 상태 카드 (처리 중일 때만 표시) */}
      {showWorkflowStatus && (
        <WorkflowStatusCard
          currentStep={workflowState.currentStep}
          steps={workflowState.steps}
          error={workflowState.error}
        />
      )}

      {/* 모델 뷰어 */}
      <Card className="h-fit lg:sticky top-4">
        <CardContent className="p-0">
          <div className="bg-muted rounded-lg flex items-center justify-center h-[calc(85vh-4rem-2rem)] relative overflow-hidden">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading 3D viewer...</p>
                </div>
              </div>
            }>
              <ModelViewer
                className="w-full h-full"
                modelUrl={modelUrl}
                placeholderMessage={t('ai.generatePrompt')}
                enableRotationControls={true}
                modelId={modelId}
                onSave={onSave}
              />
            </Suspense>

            {/* 다운로드 드롭다운 버튼 - 오른쪽 위 */}
            {hasDownloadableFiles && !isProcessing && (
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
                    {glbDownloadUrl && (
                      <DropdownMenuItem onClick={handleDownloadGLB}>
                        <Download className="w-4 h-4 mr-2" />
                        GLB 다운로드
                      </DropdownMenuItem>
                    )}
                    {stlDownloadUrl && (
                      <DropdownMenuItem onClick={handleDownloadSTL}>
                        <Download className="w-4 h-4 mr-2" />
                        STL 다운로드
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
  );
}


