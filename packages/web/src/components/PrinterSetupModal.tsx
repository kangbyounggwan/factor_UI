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

interface PrinterSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  printerId: string;
  printerName: string;
  onSuccess?: () => void;
}

export function PrinterSetupModal({
  open,
  onOpenChange,
  printerId,
  printerName,
  onSuccess,
}: PrinterSetupModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 데이터
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

    setSaving(true);
    try {
      // manufacturing_printers 테이블에서 선택한 모델의 정보 가져오기
      const selectedModelData = modelsList.find((m) => m.id === selectedModel);

      if (!selectedModelData) {
        throw new Error("Selected model not found");
      }

      // printers 테이블 업데이트
      const { error } = await supabase
        .from("printers")
        .update({
          model: selectedModelData.display_name, // 모델 표시 이름
          manufacture_id: selectedModel, // manufacturing_printers.id
          updated_at: new Date().toISOString(),
        })
        .eq("id", printerId);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("printer.setup.saveSuccess"),
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to save printer setup:", error);
      toast({
        title: t("common.error"),
        description: t("printer.setup.saveError"),
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
    }
    onOpenChange(open);
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("printer.setup.title")}</DialogTitle>
            <DialogDescription>
              {t("printer.setup.description")}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6 py-6 px-2">
              {/* 프린터 이름 표시 */}
              <div className="space-y-2">
                <Label>{t("printer.setup.printerName")}</Label>
                <div className="px-3 py-2 bg-muted rounded-md">
                  <p className="text-sm font-medium">{printerName}</p>
                </div>
              </div>

              {/* MANUFACTURER 카드 - Settings 페이지 스타일 적용 */}
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
                   <Select value={selectedModel} onValueChange={setSelectedModel} open={modelOpen} onOpenChange={setModelOpen}>
                    <SelectTrigger
                      id="model"
                      className={cn(                           // 아이콘 자리 확보
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
                      className="w-[--radix-select-trigger-width] p-0" // 트리거와 동일 폭
                    >
                      {modelsList.map((model) => (
                        <SelectItem
                          key={model.id}
                          value={model.id}
                        >
                          {/* 아이템도 absolute 대신 flex로 정렬 */}
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
                  // 큐라 엔진 지원: 2개 모두 초록 체크
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
                  // 큐라 엔진 미지원: 초록 체크 + 노란 경고
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
          <Button onClick={handleSave} disabled={!selectedModel || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
}
