import { lazy, Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Sparkles, Box } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Lazy load ModelViewer to reduce initial bundle size
const ModelViewer = lazy(() => import("@/components/ai/ModelViewer"));
import WorkflowStatusCard from "./WorkflowStatusCard";
import { WorkflowStep, WorkflowStepStatus } from "@factor/shared";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/use-toast";

// 생성 소요 시간 기준값(분). 남은 시간 안내에만 사용한다.
const ESTIMATED_TOTAL_MINUTES = 5;

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

  const downloadFile = async (url: string, filename: string) => {
    try {
      toast({ title: t('ai.downloadStarted'), description: filename });

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

      toast({ title: t('ai.downloadComplete'), description: filename });
    } catch (error) {
      console.error('[ModelPreview] Download failed:', error);
      toast({
        title: t('ai.downloadFailed'),
        variant: 'destructive'
      });
    }
  };

  const handleDownloadGLB = () => {
    if (glbDownloadUrl) downloadFile(glbDownloadUrl, `model_${Date.now()}.glb`);
  };

  const handleDownloadSTL = () => {
    if (stlDownloadUrl) downloadFile(stlDownloadUrl, `model_${Date.now()}.stl`);
  };

  const hasDownloadableFiles = Boolean(glbDownloadUrl || stlDownloadUrl);
  const showEmptyState = !isProcessing && !modelUrl;

  // 진행률 기준 남은 시간(분). 0%일 때는 아직 추정하지 않는다.
  const remainingMinutes = Math.max(
    1,
    Math.ceil(((100 - progress) / 100) * ESTIMATED_TOTAL_MINUTES)
  );

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
      <Card className="h-fit lg:sticky top-4 overflow-hidden">
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
                placeholderMessage=""
                enableRotationControls={true}
                modelId={modelId}
                onSave={onSave}
              />
            </Suspense>

            {/* 빈 상태 — 무엇을 해야 하는지 안내 */}
            {showEmptyState && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                <div className="text-center max-w-xs">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background/80 shadow-sm">
                    <Box className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {t('ai.emptyStateTitle')}
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {t('ai.emptyStateDesc')}
                  </p>
                </div>
              </div>
            )}

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
                      {t('ai.download')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {glbDownloadUrl && (
                      <DropdownMenuItem onClick={handleDownloadGLB}>
                        <Download className="w-4 h-4 mr-2" />
                        {t('ai.downloadGLB')}
                      </DropdownMenuItem>
                    )}
                    {stlDownloadUrl && (
                      <DropdownMenuItem onClick={handleDownloadSTL}>
                        <Download className="w-4 h-4 mr-2" />
                        {t('ai.downloadSTL')}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* 생성 진행 오버레이 — 디자인 토큰 기반이라 라이트/다크 모두 대응 */}
            {isProcessing && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/95 backdrop-blur-sm">
                <div className="w-full max-w-sm space-y-6 px-8 text-center">
                  <div className="relative mx-auto h-20 w-20">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" />
                    <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-primary" />
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="text-xl font-semibold text-foreground">
                      {t('ai.generatingAI')}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {progressStatus || t('ai.generatingDesc')}
                    </p>
                  </div>

                  {progress > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('ai.progressLabel')}</span>
                        <span className="font-semibold tabular-nums text-foreground">{progress}%</span>
                      </div>

                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {t('ai.remainingTime', { min: remainingMinutes })}
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
