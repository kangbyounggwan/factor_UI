import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

export type PrinterStatus = 'ready' | 'operational' | 'printing' | 'paused' | 'error' | 'disconnected' | 'disconnect';

interface PrinterStatusBadgeProps {
  status: PrinterStatus | string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

/**
 * 프린터 상태를 표시하는 배지 컴포넌트
 * 상태에 따라 자동으로 적절한 variant와 레이블을 표시
 */
export function PrinterStatusBadge({ status, variant, className }: PrinterStatusBadgeProps) {
  const { t } = useTranslation();

  // 상태별 기본 variant 및 번역 키 매핑
  const statusMap: Record<string, { labelKey: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    printing: { labelKey: 'printer.statusPrinting', variant: 'default' },
    ready: { labelKey: 'printer.statusIdle', variant: 'secondary' },
    operational: { labelKey: 'printer.statusIdle', variant: 'secondary' },
    paused: { labelKey: 'printer.pausePrint', variant: 'outline' },
    error: { labelKey: 'printer.statusError', variant: 'destructive' },
    disconnected: { labelKey: 'printer.statusOffline', variant: 'destructive' },
    disconnect: { labelKey: 'printer.statusOffline', variant: 'destructive' },
  };

  const config = statusMap[status];
  const label = config ? t(config.labelKey) : (status || t('common.error'));
  const finalVariant = variant ?? (config?.variant || 'outline');

  return (
    <Badge variant={finalVariant} className={className}>
      {label}
    </Badge>
  );
}
