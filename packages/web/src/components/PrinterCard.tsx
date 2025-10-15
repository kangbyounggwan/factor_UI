import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PrinterStatusBadge, type PrinterStatus } from "@/components/PrinterStatusBadge";
import { formatTemperature } from "@/lib/formatUtils";
import { useTranslation } from "react-i18next";

export interface PrinterCardProps {
  id: string;
  name: string;
  status: PrinterStatus | string;
  temperature: {
    nozzle: number;
    bed: number;
  };
  progress?: number;
  onClick?: () => void;
  className?: string;
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
}: PrinterCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      key={id}
      className={`p-3 cursor-pointer hover:shadow-md transition ${className}`}
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
            <span>{t('printer.nozzle')}: {formatTemperature(temperature.nozzle)}</span>
            <span>{t('printer.bed')}: {formatTemperature(temperature.bed)}</span>
          </div>
        </div>

        {/* 진행률 (옵션) */}
        {typeof progress === 'number' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>{t('printer.progress')}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        )}
      </div>
    </Card>
  );
}
