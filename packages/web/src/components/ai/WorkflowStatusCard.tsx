/**
 * AI 워크플로우 상태 표시 컴포넌트
 * 3단계 프로세스 (Modelling → Optimization → G-code Generation)의 진행 상태를 시각화
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Loader2, XCircle, Box, Zap, Code } from "lucide-react";
import { WorkflowStep, WorkflowStepStatus } from "@factor/shared";

interface WorkflowStatusCardProps {
  currentStep: WorkflowStep;
  steps: {
    modelling: WorkflowStepStatus;
    optimization: WorkflowStepStatus;
    gcode_generation: WorkflowStepStatus;
  };
  error?: string;
}

const stepConfig = {
  modelling: {
    label: "1. 3D 모델 생성",
    description: "AI가 3D 모델을 생성하고 있습니다",
    icon: Box,
    color: "text-blue-500",
  },
  optimization: {
    label: "2. 모델 최적화",
    description: "Blender로 모델을 최적화하고 있습니다",
    icon: Zap,
    color: "text-yellow-500",
  },
  gcode_generation: {
    label: "3. G-code 생성",
    description: "프린터용 G-code를 생성하고 있습니다",
    icon: Code,
    color: "text-green-500",
  },
};

function getStepIcon(status: WorkflowStepStatus, StepIcon: React.ComponentType<{ className?: string }>) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case "processing":
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case "failed":
      return <XCircle className="w-5 h-5 text-red-500" />;
    case "pending":
    default:
      return <Circle className="w-5 h-5 text-gray-400" />;
  }
}

function getStepBadgeVariant(status: WorkflowStepStatus) {
  switch (status) {
    case "completed":
      return "default";
    case "processing":
      return "secondary";
    case "failed":
      return "destructive";
    case "pending":
    default:
      return "outline";
  }
}

function getStepBadgeText(status: WorkflowStepStatus) {
  switch (status) {
    case "completed":
      return "완료";
    case "processing":
      return "진행 중";
    case "failed":
      return "실패";
    case "pending":
    default:
      return "대기 중";
  }
}

function calculateProgress(steps: {
  modelling: WorkflowStepStatus;
  optimization: WorkflowStepStatus;
  gcode_generation: WorkflowStepStatus;
}): number {
  let progress = 0;

  if (steps.modelling === "completed") progress += 33;
  else if (steps.modelling === "processing") progress += 16;

  if (steps.optimization === "completed") progress += 33;
  else if (steps.optimization === "processing") progress += 16;

  if (steps.gcode_generation === "completed") progress += 34;
  else if (steps.gcode_generation === "processing") progress += 17;

  return progress;
}

export default function WorkflowStatusCard({
  currentStep,
  steps,
  error,
}: WorkflowStatusCardProps) {
  const progress = calculateProgress(steps);
  const isProcessing = Object.values(steps).some((s) => s === "processing");
  const hasFailed = Object.values(steps).some((s) => s === "failed");
  const allCompleted = Object.values(steps).every((s) => s === "completed");

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        {/* 전체 진행률 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">AI 워크플로우 진행 상태</h3>
            <span className="text-sm font-medium text-muted-foreground">
              {progress}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* 단계별 상태 */}
        <div className="space-y-4">
          {(["modelling", "optimization", "gcode_generation"] as const).map(
            (step, index) => {
              const config = stepConfig[step];
              const status = steps[step];
              const Icon = config.icon;
              const isActive = currentStep === step;

              return (
                <div
                  key={step}
                  className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background"
                  }`}
                >
                  {/* 아이콘 */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getStepIcon(status, Icon)}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{config.label}</h4>
                      <Badge variant={getStepBadgeVariant(status)} className="text-xs">
                        {getStepBadgeText(status)}
                      </Badge>
                    </div>
                    {status === "processing" && (
                      <p className="text-sm text-muted-foreground">
                        {config.description}
                      </p>
                    )}
                  </div>

                  {/* 단계 번호 (오른쪽) */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        status === "completed"
                          ? "bg-green-100 text-green-700"
                          : status === "processing"
                          ? "bg-blue-100 text-blue-700"
                          : status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {index + 1}
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-start gap-2">
              <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm text-destructive mb-1">
                  오류 발생
                </h4>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 완료 메시지 */}
        {allCompleted && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm text-green-700 mb-1">
                  모든 작업 완료
                </h4>
                <p className="text-sm text-green-600">
                  3D 모델 생성, 최적화, G-code 생성이 모두 완료되었습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 진행 중 안내 */}
        {isProcessing && !hasFailed && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Loader2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" />
              <div>
                <h4 className="font-medium text-sm text-blue-700 mb-1">
                  처리 중
                </h4>
                <p className="text-sm text-blue-600">
                  작업이 진행 중입니다. 잠시만 기다려 주세요.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
