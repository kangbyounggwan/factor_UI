import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@shared/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getManufacturers,
  getSeriesByManufacturer,
  getModelsByManufacturerAndSeries,
  type ManufacturerOption,
  type SeriesOption,
  type ModelOption
} from "@shared/api/manufacturingPrinter";
import { useAuth } from "@shared/contexts/AuthContext";

// 프린터 그룹 타입
interface PrinterGroup {
  id: string;
  name: string;
  color: string;
}

interface PrinterSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 수정 모드일 때 사용
  printerId?: string;
  printerName?: string;
  // 추가 모드일 때 사용
  mode?: 'add' | 'edit';
  groups?: PrinterGroup[];
  onSuccess?: () => void;
}

export function PrinterSetupModal({
  open,
  onOpenChange,
  printerId,
  printerName,
  mode = 'edit',
  groups = [],
  onSuccess,
}: PrinterSetupModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 추가 모드 폼 데이터
  const [formData, setFormData] = useState({
    name: "",
    group_id: "",
    device_uuid: "",
    stream_url: "",
  });

  // 제조사 데이터
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesOption[]>([]);
  const [modelsList, setModelsList] = useState<ModelOption[]>([]);

  // 선택된 값
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("");
  const [selectedSeries, setSelectedSeries] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");

  // 셀렉트박스 열림 상태 추적
  const [manufacturerOpen, setManufacturerOpen] = useState(false);
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  // 선택된 모델의 cura_engine_support 상태
  const selectedModelData = modelsList.find((m) => m.id === selectedModel);
  const hasCuraSupport = selectedModelData?.cura_engine_support !== false;

  // 선택 완료 여부
  const isAllSelected = selectedManufacturer && selectedSeries && selectedModel;
  const isNoneSelected = !selectedManufacturer && !selectedSeries && !selectedModel;

  // 추가 모드에서 필수 필드 체크
  const isFormValid = mode === 'add'
    ? formData.name.trim() && formData.device_uuid.trim() && isAllSelected
    : isAllSelected;

  // 테두리 색상 결정
  const getBorderColor = () => {
    if (isAllSelected && !hasCuraSupport) {
      return "border-yellow-500/30"; // 노란색 30% (슬라이싱 제한)
    }
    if (isAllSelected) {
      return "border-green-500/30"; // 초록색 30%
    }
    if (isNoneSelected) {
      return "border-red-500/30"; // 빨간색 30%
    }
    return "border-border"; // 기본 색상
  };

  // 제조사 목록 로드
  useEffect(() => {
    const loadManufacturers = async () => {
      if (!open) return;

      setLoading(true);
      try {
        const data = await getManufacturers();
        setManufacturers(data);
      } catch (error) {
        console.error("Failed to load manufacturers:", error);
        toast({
          title: t("common.error"),
          description: t("printer.setup.loadError"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadManufacturers();
  }, [open, t, toast]);

  // 제조사 선택 시 시리즈 로드
  useEffect(() => {
    if (!selectedManufacturer) {
      setSeriesList([]);
      setSelectedSeries("");
      setModelsList([]);
      setSelectedModel("");
      return;
    }

    const loadSeries = async () => {
      try {
        const data = await getSeriesByManufacturer(selectedManufacturer);
        setSeriesList(data);
        setSelectedSeries("");
        setModelsList([]);
        setSelectedModel("");
      } catch (error) {
        console.error("Failed to load series:", error);
        toast({
          title: t("common.error"),
          description: t("printer.setup.loadError"),
          variant: "destructive",
        });
      }
    };

    loadSeries();
  }, [selectedManufacturer, t, toast]);

  // 시리즈 선택 시 모델 로드
  useEffect(() => {
    if (!selectedManufacturer || !selectedSeries) {
      setModelsList([]);
      setSelectedModel("");
      return;
    }

    const loadModels = async () => {
      try {
        const data = await getModelsByManufacturerAndSeries(
          selectedManufacturer,
          selectedSeries
        );
        setModelsList(data);
        setSelectedModel("");
      } catch (error) {
        console.error("Failed to load models:", error);
        toast({
          title: t("common.error"),
          description: t("printer.setup.loadError"),
          variant: "destructive",
        });
      }
    };

    loadModels();
  }, [selectedManufacturer, selectedSeries, t, toast]);

  // 저장 핸들러
  const handleSave = async () => {
    if (!selectedModel) {
      toast({
        title: t("common.error"),
        description: t("printer.setup.selectAllFields"),
        variant: "destructive",
      });
      return;
    }

    const selectedModelInfo = modelsList.find((m) => m.id === selectedModel);
    if (!selectedModelInfo) {
      toast({
        title: t("common.error"),
        description: "Selected model not found",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (mode === 'add') {
        // 추가 모드
        if (!user || !formData.name.trim() || !formData.device_uuid.trim()) {
          toast({
            title: t("common.error"),
            description: t("settings.fillRequired"),
            variant: "destructive",
          });
          setSaving(false);
          return;
        }

        const deviceUuid = formData.device_uuid.trim();

        const { error } = await supabase
          .from("printers")
          .insert({
            user_id: user.id,
            name: formData.name.trim(),
            model: selectedModelInfo.display_name,
            manufacture_id: selectedModel,
            group_id: formData.group_id || null,
            device_uuid: deviceUuid,
            ip_address: "0.0.0.0", // MQTT 기반이므로 기본값
            port: 80,
            firmware: "klipper", // 기본값
          });

        if (error) throw error;

        // cameras 테이블에 stream_url 저장 (device_uuid 기준 upsert)
        if (formData.stream_url.trim()) {
          const { error: cameraError } = await supabase
            .from("cameras")
            .upsert({
              user_id: user.id,
              device_uuid: deviceUuid,
              stream_url: formData.stream_url.trim(),
            }, {
              onConflict: 'device_uuid'
            });

          if (cameraError) {
            console.error("Failed to save camera stream URL:", cameraError);
            // 프린터는 저장되었으므로 카메라 URL 저장 실패는 경고만 표시
          }
        }

        toast({
          title: t("common.success"),
          description: t("settings.printerAdded"),
        });
      } else {
        // 수정 모드
        if (!printerId) {
          throw new Error("Printer ID is required for edit mode");
        }

        const { error } = await supabase
          .from("printers")
          .update({
            model: selectedModelInfo.display_name,
            manufacture_id: selectedModel,
            updated_at: new Date().toISOString(),
          })
          .eq("id", printerId);

        if (error) throw error;

        toast({
          title: t("common.success"),
          description: t("printer.setup.saveSuccess"),
        });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to save printer:", error);
      toast({
        title: t("common.error"),
        description: mode === 'add' ? t("settings.addPrinterError") : t("printer.setup.saveError"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // 리셋
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedManufacturer("");
      setSelectedSeries("");
      setSelectedModel("");
      setSeriesList([]);
      setModelsList([]);
      setFormData({ name: "", group_id: "", device_uuid: "", stream_url: "" });
    }
    onOpenChange(open);
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === 'add' ? t("settings.newPrinter") : t("printer.setup.title")}
            </DialogTitle>
            <DialogDescription>
              {mode === 'add'
                ? t("settings.newPrinterDescription", "새 프린터 정보를 입력하고 제조사/모델을 선택하세요.")
                : t("printer.setup.description")}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* 추가 모드: 프린터 기본 정보 입력 */}
              {mode === 'add' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="printer-name">{t('settings.printerName')} *</Label>
                      <Input
                        id="printer-name"
                        placeholder={t('settings.printerNamePlaceholder')}
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="group">{t('settings.groupOptional')}</Label>
                      <Select
                        value={formData.group_id || "none"}
                        onValueChange={(value) => setFormData({...formData, group_id: value === "none" ? "" : value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('settings.selectGroup')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('settings.noGroup')}</SelectItem>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: group.color }}
                                />
                                {group.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="device_uuid">{t('settings.deviceUUID')} *</Label>
                      <Input
                        id="device_uuid"
                        placeholder={t('settings.deviceUUIDPlaceholder')}
                        value={formData.device_uuid}
                        onChange={(e) => setFormData({...formData, device_uuid: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground">{t('settings.deviceUUIDHelper')}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stream_url">{t('settings.cameraUrl', '카메라 URL')}</Label>
                      <Input
                        id="stream_url"
                        placeholder={t('settings.cameraUrlPlaceholder', 'http://192.168.1.100:8080/stream')}
                        value={formData.stream_url}
                        onChange={(e) => setFormData({...formData, stream_url: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground">{t('settings.cameraUrlHelper', '프린터 카메라 스트림 URL (선택사항)')}</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* 수정 모드: 프린터 이름 표시 */
                <div className="space-y-2">
                  <Label>{t("printer.setup.printerName")}</Label>
                  <div className="px-3 py-2 bg-muted rounded-md">
                    <p className="text-sm font-medium">{printerName}</p>
                  </div>
                </div>
              )}

              {/* MANUFACTURER 카드 - 공통 */}
              <div className={`space-y-6 p-6 bg-muted/30 rounded-lg border-2 transition-colors ${getBorderColor()}`}>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide">
                    {t("settings.manufacturer")}
                  </h3>
                  {isAllSelected && !hasCuraSupport ? (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  ) : isAllSelected ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : isNoneSelected ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="h-5 w-5 text-red-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-red-500">
                          {t("printer.setup.setupRequired")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
                <div className="grid grid-cols-12 gap-6">
                  {/* 제조사 선택 */}
                  <div className="space-y-2 col-span-4">
                    <Label htmlFor="manufacturer">
                      {t("settings.selectManufacturer")}
                    </Label>
                    <Select
                      value={selectedManufacturer}
                      open={manufacturerOpen}
                      onOpenChange={setManufacturerOpen}
                      onValueChange={(value) => {
                        setSelectedManufacturer(value);
                        setSelectedSeries("");
                        setSelectedModel("");
                      }}
                    >
                      <SelectTrigger
                        id="manufacturer"
                        className={cn(
                          manufacturerOpen ? "ring-2 ring-primary ring-offset-2" : "",
                          "[&>span]:text-left [&>span]:block [&>span]:w-full"
                        )}
                      >
                        <SelectValue
                          placeholder={t("settings.selectManufacturerPlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {manufacturers.map((m) => (
                          <SelectItem
                            key={m.manufacturer}
                            value={m.manufacturer}
                            className="pl-3 [&>span:first-child]:!hidden [&_svg.lucide-check]:!hidden"
                          >
                            {m.manufacturer}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 시리즈 선택 */}
                  <div className="space-y-2 col-span-3">
                    <Label htmlFor="series">{t("settings.selectSeries")}</Label>
                    <Select
                      value={selectedSeries}
                      open={seriesOpen}
                      onOpenChange={setSeriesOpen}
                      onValueChange={(value) => {
                        setSelectedSeries(value);
                        setSelectedModel("");
                      }}
                      disabled={!selectedManufacturer}
                    >
                      <SelectTrigger
                        id="series"
                        className={cn(
                          seriesOpen ? "ring-2 ring-primary ring-offset-2" : "",
                          "[&>span]:text-left [&>span]:block [&>span]:w-full"
                        )}
                      >
                        <SelectValue
                          placeholder={t("settings.selectSeriesPlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {seriesList.map((s) => (
                          <SelectItem
                            key={s.series}
                            value={s.series}
                            className="pl-3 [&>span:first-child]:!hidden [&_svg.lucide-check]:!hidden"
                          >
                            {s.series}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 모델 선택 */}
                  <div className="space-y-2 col-span-5">
                    <Label htmlFor="model">{t("settings.selectModel")}</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel} open={modelOpen} onOpenChange={setModelOpen} disabled={!selectedSeries}>
                      <SelectTrigger
                        id="model"
                        className={cn(
                          "data-[state=open]:ring-2 data-[state=open]:ring-primary data-[state=open]:ring-offset-2"
                        )}
                      >
                        <div className="flex w-full items-center justify-between gap-3">
                          <SelectValue placeholder={t("settings.selectModelPlaceholder")} />
                        </div>
                      </SelectTrigger>

                      <SelectContent
                        side="bottom"
                        sideOffset={4}
                        className="w-[--radix-select-trigger-width] p-0"
                      >
                        {modelsList.map((model) => (
                          <SelectItem
                            key={model.id}
                            value={model.id}
                          >
                            <div className="flex w-full items-center justify-between gap-3">
                              <span className="truncate">{model.display_name}</span>
                              <span className="pointer-events-none">
                                {model.cura_engine_support !== false ? (
                                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                                )}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 범례 (Legend) - 모델 선택 후에만 표시 */}
              {selectedModel && (
                <div className="space-y-2 text-sm">
                  {hasCuraSupport ? (
                    <>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-muted-foreground">
                          {t("printer.setup.legend.fullSupport")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-muted-foreground">
                          {t("printer.setup.legend.slicingSupported")}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-muted-foreground">
                          {t("printer.setup.legend.fullSupport")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        <span className="text-muted-foreground">
                          {t("printer.setup.legend.limitedSlicing")}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={!isFormValid || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'add' ? t("settings.add") : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
