import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ModelViewer from "@/components/ModelViewer";
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
}

export default function ModelPreview({
  isProcessing = false,
  modelUrl,
  glbDownloadUrl,
  stlDownloadUrl,
  progress = 0,
  progressStatus = '',
  workflowState,
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
            <ModelViewer
              className="w-full h-full"
              modelUrl={modelUrl}
              placeholderMessage={t('ai.generatePrompt')}
            />

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
              <div className="absolute inset-0 bg-gray-900/70 flex items-center justify-center z-10">
                <div className="text-center space-y-4">
                  <Loader2 className="w-20 h-20 mx-auto animate-spin text-white" />
                  <div>
                    <p className="text-xl font-medium text-white">
                      {getWorkflowMessage()}
                    </p>
                    <p className="text-lg text-gray-300">{t('ai.waitForGeneration')}</p>
                    {progress > 0 && (
                      <div className="mt-4">
                        <p className="text-2xl font-bold text-white">{progress}%</p>
                        {progressStatus && (
                          <p className="text-sm text-gray-400 mt-1">{progressStatus}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


