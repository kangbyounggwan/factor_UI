import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

export type PrinterStatus = 'idle' | 'ready' | 'operational' | 'printing' | 'paused' | 'error' | 'connecting' | 'disconnected' | 'disconnect';

interface PrinterStatusBadgeProps {
  status: PrinterStatus | string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

/**
 * 프린터 상태를 표시하는 배지 컴포넌트
 * Dashboard와 AI 페이지에서 공통으로 사용
 * 상태에 따라 자동으로 적절한 색상과 레이블을 표시
 */
export function PrinterStatusBadge({ status, variant, className }: PrinterStatusBadgeProps) {
  const { t } = useTranslation();

  // 상태별 기본 색상(className) 및 번역 키 매핑
  const statusMap: Record<string, { labelKey: string; colorClass: string }> = {
    idle: {
      labelKey: 'dashboard.status.idle',
      colorClass: 'bg-success/40 text-success-foreground'
    },
    ready: {
      labelKey: 'dashboard.status.idle',
      colorClass: 'bg-success/40 text-success-foreground'
    },
    operational: {
      labelKey: 'dashboard.status.idle',
      colorClass: 'bg-success/40 text-success-foreground'
    },
    printing: {
      labelKey: 'dashboard.status.printing',
      colorClass: 'bg-success text-success-foreground'
    },
    paused: {
      labelKey: 'dashboard.status.paused',
      colorClass: 'bg-warning text-warning-foreground'
    },
    error: {
      labelKey: 'dashboard.status.error',
      colorClass: 'bg-warning/40 text-warning-foreground'
    },
    connecting: {
      labelKey: 'dashboard.status.connecting',
      colorClass: 'bg-primary text-primary-foreground'
    },
    disconnected: {
      labelKey: 'dashboard.status.disconnected',
      colorClass: 'bg-destructive/40 text-destructive-foreground'
    },
    disconnect: {
      labelKey: 'dashboard.status.disconnected',
      colorClass: 'bg-destructive/40 text-destructive-foreground'
    },
  };

  const config = statusMap[status] || statusMap.disconnected;
  const label = t(config.labelKey);
  const finalClassName = `${config.colorClass} ${className || ''}`.trim();

  return (
    <Badge className={finalClassName}>
      {label}
    </Badge>
  );
}
