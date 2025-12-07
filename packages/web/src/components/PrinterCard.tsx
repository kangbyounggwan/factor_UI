import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PrinterStatusBadge, type PrinterStatus } from "@/components/Dashboard/PrinterStatusBadge";
import { formatTemperature } from "@/lib/formatUtils";
import { useTranslation } from "react-i18next";

export interface PrinterCardProps {
  id: string;
  name: string;
  status: PrinterStatus | string;
  temperature: {
    nozzle?: number;
    bed?: number;
    // 새로운 구조도 지원
    tool_actual?: number;
    bed_actual?: number;
  };
  progress?: number;
  onClick?: () => void;
  className?: string;
  isAvailable?: boolean; // GCode가 준비되어 출력 가능한 프린터 여부
}

/**
 * 프린터 정보를 카드 형태로 표시하는 재사용 가능한 컴포넌트
 * AI 페이지와 Dashboard에서 사용
 */
export function PrinterCard({
  id,
  name,
  status,
  temperature,
  progress,
  onClick,
  className = "",
  isAvailable = false,
}: PrinterCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      key={id}
      className={`p-3 cursor-pointer hover:shadow-md transition ${
        isAvailable ? 'border-2 border-green-400/30' : ''
      } ${className}`}
      onClick={onClick}
    >
      <div className="space-y-2">
        {/* 프린터 이름과 상태 */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{name}</p>
          <PrinterStatusBadge
            status={status}
            className="text-xs"
          />
        </div>

        {/* 온도 정보 */}
        <div className="text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>{t('printer.nozzle')}: {formatTemperature(temperature.nozzle ?? temperature.tool_actual)}</span>
            <span>{t('printer.bed')}: {formatTemperature(temperature.bed ?? temperature.bed_actual)}</span>
          </div>
        </div>

        {/* 진행률 (옵션) - 0~1 또는 0~100 범위 모두 지원 */}
        {typeof progress === 'number' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>{t('printer.progress')}</span>
              <span>{progress <= 1 ? (progress * 100).toFixed(1) : progress.toFixed(1)}%</span>
            </div>
            <Progress value={progress <= 1 ? progress * 100 : progress} className="h-1" />
          </div>
        )}
      </div>
    </Card>
  );
}
