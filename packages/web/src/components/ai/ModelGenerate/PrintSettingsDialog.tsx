import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Printer, RefreshCw, File as FileIcon, Download } from "lucide-react";
import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";

const GCodePreview = lazy(() => import("./GCodePreview"));

export interface PrinterData {
    id: string;
    name: string;
    model: string;
    state: "idle" | "printing" | "paused" | "error" | "connecting" | "disconnected";
    connected: boolean;
    printing: boolean;
    manufacture_id?: string;
    temperature: {
        tool_actual: number;
        tool_target: number;
        bed_actual: number;
        bed_target: number;
    };
    completion?: number;
}

export interface GCodeInfo {
    printTime?: string;
    filamentLength?: string;
    filamentWeight?: string;
    filamentCost?: string;
    layerCount?: number;
    layerHeight?: number;
    modelSize?: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
    nozzleTemp?: number;
    bedTemp?: number;
    printerName?: string;
}

interface PrintSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedPrinter: PrinterData | null;
    settingsTab: 'printer' | 'file';
    setSettingsTab: (tab: 'printer' | 'file') => void;
    currentGCodeUrl: string | null;
    modelViewerUrl: string | null; // For GCodePreview fallback
    isSlicing: boolean;
    gcodeInfo: GCodeInfo | null;
    printFileName: string;
    setPrintFileName: (name: string) => void;
    startPrint: () => void;

    // G-code 전송 진행률
    isSendingGCode?: boolean;
    sendProgress?: number;

    // Reslice Related Props
    resliceManufacturer: string;
    setResliceManufacturer: (val: string) => void;
    resliceSeries: string;
    setResliceSeries: (val: string) => void;
    resliceModelId: string;
    setResliceModelId: (val: string) => void;
    manufacturers: string[];
    seriesList: string[];
    modelsList: Array<{ id: string; display_name: string }>;
    handleReslice: () => void;
    loadDefaultPrinterSettings: () => void;
    targetPrinterModelId: string | null;
}

export function PrintSettingsDialog({
    open,
    onOpenChange,
    selectedPrinter,
    settingsTab,
    setSettingsTab,
    currentGCodeUrl,
    modelViewerUrl,
    isSlicing,
    gcodeInfo,
    printFileName,
    setPrintFileName,
    startPrint,
    isSendingGCode = false,
    sendProgress = 0,
    resliceManufacturer,
    setResliceManufacturer,
    resliceSeries,
    setResliceSeries,
    resliceModelId,
    setResliceModelId,
    manufacturers,
    seriesList,
    modelsList,
    handleReslice,
    loadDefaultPrinterSettings,
    targetPrinterModelId
}: PrintSettingsDialogProps) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[75vw] max-w-[75vw] h-[90vh] max-h-[90vh] overflow-hidden p-0 rounded-xl flex flex-col" aria-describedby={undefined}>
                <div className="flex flex-col h-full min-h-0">
                    {/* 헤더 */}
                    <div className="px-6 py-4 border-b">
                        <DialogHeader className="flex flex-row items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                                <DialogTitle className="text-lg font-semibold">
                                    {t('ai.printSettings')}{selectedPrinter ? ` - ${selectedPrinter.name}` : ''}
                                </DialogTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={loadDefaultPrinterSettings}
                                    title={t('ai.resetToDefault')}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        </DialogHeader>
                    </div>

                    {/* 설정 탭 (프린터 선택 / 파일 설정) */}
                    <div className="px-6 pt-4 pb-2 bg-muted/30">
                        <Tabs value={settingsTab} onValueChange={(v) => setSettingsTab(v as 'printer' | 'file')} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-3">
                                <TabsTrigger value="printer" className="text-xs">
                                    <Printer className="w-3.5 h-3.5 mr-1.5" />
                                    {t('ai.printerSelection')}
                                </TabsTrigger>
                                <TabsTrigger value="file" className="text-xs" disabled={!currentGCodeUrl}>
                                    <FileIcon className="w-3.5 h-3.5 mr-1.5" />
                                    {t('ai.printFileSettings')}
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="printer" className="mt-0">
                                <div className="flex items-end gap-4">
                                    <div className="flex-1 min-w-[200px]">
                                        <label className="text-xs text-muted-foreground block mb-1.5">{t('ai.manufacturer')}</label>
                                        <select
                                            className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                                            value={resliceManufacturer}
                                            onChange={(e) => setResliceManufacturer(e.target.value)}
                                            disabled={isSlicing}
                                        >
                                            <option value="">{t('ai.selectOption')}</option>
                                            {manufacturers.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex-1 min-w-[200px]">
                                        <label className="text-xs text-muted-foreground block mb-1.5">{t('ai.series')}</label>
                                        <select
                                            className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                                            value={resliceSeries}
                                            onChange={(e) => setResliceSeries(e.target.value)}
                                            disabled={isSlicing || !resliceManufacturer}
                                        >
                                            <option value="">{t('ai.selectOption')}</option>
                                            {seriesList.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex-1 min-w-[200px]">
                                        <label className="text-xs text-muted-foreground block mb-1.5">{t('ai.printerModel')}</label>
                                        <select
                                            className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                                            value={resliceModelId}
                                            onChange={(e) => setResliceModelId(e.target.value)}
                                            disabled={isSlicing || !resliceSeries}
                                        >
                                            <option value="">{t('ai.selectOption')}</option>
                                            {modelsList.map(model => (
                                                <option key={model.id} value={model.id}>{model.display_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <Button
                                        variant="default"
                                        className="px-8"
                                        disabled={
                                            isSlicing ||
                                            !resliceModelId ||
                                            selectedPrinter?.manufacture_id === resliceModelId
                                        }
                                        onClick={handleReslice}
                                    >
                                        {isSlicing ? t('ai.reslicing') : t('ai.reslice')}
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="file" className="mt-0">
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="print-filename-tab" className="text-xs text-muted-foreground">{t('ai.fileName')}</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="print-filename-tab"
                                                value={printFileName}
                                                onChange={(e) => setPrintFileName(e.target.value)}
                                                placeholder="my-model-2025-01-17"
                                                className="text-sm h-9 flex-1"
                                                disabled={isSlicing}
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-9 px-3"
                                                disabled={!currentGCodeUrl || isSlicing}
                                                onClick={async () => {
                                                    if (currentGCodeUrl) {
                                                        try {
                                                            const response = await fetch(currentGCodeUrl);
                                                            const blob = await response.blob();
                                                            const url = window.URL.createObjectURL(blob);
                                                            const link = document.createElement('a');
                                                            link.href = url;
                                                            // 파일명에 .gcode 확장자가 없으면 추가
                                                            let fileName = printFileName || 'model';
                                                            if (!fileName.toLowerCase().endsWith('.gcode')) {
                                                                fileName = `${fileName}.gcode`;
                                                            }
                                                            link.download = fileName;
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            document.body.removeChild(link);
                                                            window.URL.revokeObjectURL(url);
                                                        } catch (error) {
                                                            console.error('G-code download failed:', error);
                                                        }
                                                    }
                                                }}
                                                title={t('ai.downloadGCode')}
                                            >
                                                <Download className="h-4 w-4 mr-1.5" />
                                                {t('ai.download')}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* 본문 */}
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(560px,1fr)_440px] gap-6 p-6 overflow-hidden flex-1 min-h-0 relative">
                        {/* 슬라이싱 중 오버레이 */}
                        {isSlicing && (
                            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
                                <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                                    <p className="text-lg font-medium">{t('ai.slicingInProgress')}</p>
                                    <p className="text-sm text-muted-foreground">{t('ai.slicingInProgressDescription')}</p>
                                </div>
                            </div>
                        )}

                        {/* 좌: G-code 프리뷰 */}
                        <Card className="overflow-hidden h-full min-h-0">
                            <CardContent className="p-0 h-full">
                                <Suspense fallback={<div className="w-full h-full flex items-center justify-center">Loading...</div>}>
                                    <GCodePreview gcodeUrl={currentGCodeUrl ?? undefined} />
                                </Suspense>
                            </CardContent>
                        </Card>

                        {/* 우: 출력 정보 */}
                        <div className="h-full overflow-y-auto pr-1 min-h-0">
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">{t('ai.printInfo')}</h3>

                                {gcodeInfo ? (
                                    <>
                                        {/* 시간 정보 */}
                                        <Card>
                                            <CardContent className="p-4 space-y-3">
                                                <h4 className="font-medium text-sm text-muted-foreground">{t('ai.printTime')}</h4>
                                                {gcodeInfo.printTime && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm">{t('ai.estimatedPrintTime')}</span>
                                                        <span className="font-semibold">{gcodeInfo.printTime}</span>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        {/* 필라멘트 정보 */}
                                        <Card>
                                            <CardContent className="p-4 space-y-3">
                                                <h4 className="font-medium text-sm text-muted-foreground">{t('ai.filament')}</h4>
                                                {gcodeInfo.filamentLength && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm">{t('ai.filamentLength')}</span>
                                                        <span className="font-semibold">{gcodeInfo.filamentLength}</span>
                                                    </div>
                                                )}
                                                {gcodeInfo.filamentWeight && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm">{t('ai.filamentWeight')}</span>
                                                        <span className="font-semibold">{gcodeInfo.filamentWeight}</span>
                                                    </div>
                                                )}
                                                {gcodeInfo.filamentCost && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm">{t('ai.estimatedCost')}</span>
                                                        <span className="font-semibold">${gcodeInfo.filamentCost}</span>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        {/* 레이어 정보 */}
                                        <Card>
                                            <CardContent className="p-4 space-y-3">
                                                <h4 className="font-medium text-sm text-muted-foreground">{t('ai.layer')}</h4>
                                                {gcodeInfo.layerCount && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm">{t('ai.totalLayers')}</span>
                                                        <span className="font-semibold">{gcodeInfo.layerCount}개</span>
                                                    </div>
                                                )}
                                                {gcodeInfo.layerHeight && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm">{t('ai.layerHeight')}</span>
                                                        <span className="font-semibold">{gcodeInfo.layerHeight}mm</span>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        {/* 모델 크기 */}
                                        {gcodeInfo.modelSize && (
                                            <Card>
                                                <CardContent className="p-4 space-y-3">
                                                    <h4 className="font-medium text-sm text-muted-foreground">{t('ai.modelSize')}</h4>
                                                    <div className="grid grid-cols-3 gap-2 text-center">
                                                        <div className="p-2 rounded bg-muted">
                                                            <div className="text-xs text-muted-foreground">X</div>
                                                            <div className="font-semibold text-sm">
                                                                {(gcodeInfo.modelSize.maxX - gcodeInfo.modelSize.minX).toFixed(1)}
                                                            </div>
                                                        </div>
                                                        <div className="p-2 rounded bg-muted">
                                                            <div className="text-xs text-muted-foreground">Y</div>
                                                            <div className="font-semibold text-sm">
                                                                {(gcodeInfo.modelSize.maxY - gcodeInfo.modelSize.minY).toFixed(1)}
                                                            </div>
                                                        </div>
                                                        <div className="p-2 rounded bg-muted">
                                                            <div className="text-xs text-muted-foreground">Z</div>
                                                            <div className="font-semibold text-sm">
                                                                {(gcodeInfo.modelSize.maxZ - gcodeInfo.modelSize.minZ).toFixed(1)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}

                                        {/* 온도 설정 */}
                                        <Card>
                                            <CardContent className="p-4 space-y-3">
                                                <h4 className="font-medium text-sm text-muted-foreground">{t('ai.printTemperature')}</h4>
                                                {gcodeInfo.nozzleTemp && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm">{t('ai.nozzleTemperature')}</span>
                                                        <span className="font-semibold">{gcodeInfo.nozzleTemp}°C</span>
                                                    </div>
                                                )}
                                                {gcodeInfo.bedTemp && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm">{t('ai.bedTemperature')}</span>
                                                        <span className="font-semibold">{gcodeInfo.bedTemp}°C</span>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </>
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground text-sm">
                                        {t('ai.noSlicingData')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 푸터 */}
                    <div className="px-6 py-4 border-t space-y-4 flex-shrink-0 bg-background">
                        {/* 프린터 연결 상태 경고 */}
                        {selectedPrinter && !selectedPrinter.connected && (
                            <div className="text-sm text-red-500 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {t('ai.printerNotConnected')}
                            </div>
                        )}

                        {/* G-code 전송 진행률 표시 */}
                        {isSendingGCode && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{t('ai.sendingGCode')}</span>
                                    <span className="font-semibold">{sendProgress}%</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
                                        style={{ width: `${sendProgress}%` }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground text-center">
                                    {sendProgress < 10 && t('ai.sendProgressPreparing')}
                                    {sendProgress >= 10 && sendProgress < 90 && t('ai.sendProgressUploading')}
                                    {sendProgress >= 90 && sendProgress < 100 && t('ai.sendProgressFinalizing')}
                                    {sendProgress === 100 && t('ai.sendProgressComplete')}
                                </p>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSlicing || isSendingGCode}>
                                {t('common.cancel')}
                            </Button>
                            <Button
                                onClick={startPrint}
                                disabled={isSlicing || isSendingGCode || !currentGCodeUrl || !selectedPrinter?.connected || !printFileName.trim()}
                            >
                                {isSendingGCode ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                        {t('ai.sending')} {sendProgress}%
                                    </>
                                ) : (
                                    <>
                                        <Printer className="w-4 h-4 mr-2" />
                                        {t('ai.startPrint')}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
