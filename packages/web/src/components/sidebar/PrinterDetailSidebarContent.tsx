/**
 * PrinterDetail 모드 사이드바 콘텐츠
 * - 프린터 정보 + 연결 상태
 * - 탭 메뉴 네비게이션
 */
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronDown,
  LayoutGrid,
  Activity,
  FolderOpen,
  Settings,
  Wrench,
  Camera,
} from "lucide-react";
import type { PrinterDetailTab } from "./types";

interface PrinterDetailSidebarContentProps {
  printerName?: string;
  printerUuid?: string;
  printerConnected: boolean;
  activePrinterTab: PrinterDetailTab;
  onPrinterTabChange?: (tab: PrinterDetailTab) => void;
  onBackClick?: () => void;
}

export function PrinterDetailSidebarContent({
  printerName,
  printerUuid,
  printerConnected,
  activePrinterTab,
  onPrinterTabChange,
  onBackClick,
}: PrinterDetailSidebarContentProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* 프린터 정보 + 연결 상태 구역 */}
      <div className="pb-4 mb-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onBackClick}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          {/* 설비 이름 (왼쪽) */}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm truncate" title={printerName || t('printerDetail.defaultPrinterName', '프린터')}>
              {printerName || t('printerDetail.defaultPrinterName', '프린터')}
            </h2>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {printerUuid ? `${printerUuid.substring(0, 12)}...` : 'N/A'}
            </p>
          </div>
          {/* 연결 상태 (오른쪽) */}
          {printerConnected ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 shrink-0">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium">{t('printerDetail.connected', '연결됨')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs font-medium">{t('printerDetail.disconnected', '연결 끊김')}</span>
            </div>
          )}
        </div>
      </div>

      {/* 탭 메뉴 */}
      <nav className="space-y-1">
        <button
          onClick={() => onPrinterTabChange?.('all')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            activePrinterTab === 'all'
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <LayoutGrid className="h-4 w-4 shrink-0" />
          <span>{t('printerDetail.monitoring', '모니터링')}</span>
        </button>

        <button
          onClick={() => onPrinterTabChange?.('monitoring')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            activePrinterTab === 'monitoring'
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Activity className="h-4 w-4 shrink-0" />
          <span>{t('printerDetail.history', '히스토리')}</span>
        </button>

        <button
          onClick={() => onPrinterTabChange?.('files')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            activePrinterTab === 'files'
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span>{t('printerDetail.fileManagement', '파일 관리')}</span>
        </button>

        {/* 설정 메뉴 (서브메뉴 포함) */}
        <div className="space-y-1">
          <button
            onClick={() => onPrinterTabChange?.('settings-equipment')}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              activePrinterTab?.startsWith('settings')
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-3">
              <Settings className="h-4 w-4 shrink-0" />
              <span>{t('printerDetail.settingsMenu', '설정')}</span>
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              activePrinterTab?.startsWith('settings') ? "rotate-0" : "-rotate-90"
            )} />
          </button>

          {/* 설정 서브메뉴 */}
          {activePrinterTab?.startsWith('settings') && (
            <div className="ml-4 pl-3 border-l border-border space-y-1">
              <button
                onClick={() => onPrinterTabChange?.('settings-equipment')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  activePrinterTab === 'settings-equipment'
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Wrench className="h-4 w-4 shrink-0" />
                <span>{t('printerDetail.settingsEquipment', '설비 설정')}</span>
              </button>

              <button
                onClick={() => onPrinterTabChange?.('settings-camera')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  activePrinterTab === 'settings-camera'
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Camera className="h-4 w-4 shrink-0" />
                <span>{t('printerDetail.settingsCamera', '카메라 설정')}</span>
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}

export default PrinterDetailSidebarContent;
