/**
 * PrinterSelector 컴포넌트
 * 프린터 제조사/시리즈/모델 선택 드롭다운
 * PrinterSetupModal의 로직을 재사용
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import {
  getManufacturers,
  getSeriesByManufacturer,
  getModelsByManufacturerAndSeries,
  type ManufacturerOption,
  type SeriesOption,
  type ModelOption,
} from '@shared/api/manufacturingPrinter';

interface PrinterSelectorProps {
  /** 선택된 프린터 모델명 (표시용) */
  value?: string;
  /** 값 변경 콜백 - 전체 프린터 정보 반환 */
  onChange: (printerInfo: PrinterInfo | null) => void;
  /** 직접 입력 허용 여부 */
  allowCustomInput?: boolean;
  /** 필수 여부 */
  required?: boolean;
  /** 비활성화 */
  disabled?: boolean;
}

export interface PrinterInfo {
  manufacturer: string;
  series: string;
  model: string;
  displayName: string;
  modelId?: string;
}

export function PrinterSelector({
  value,
  onChange,
  allowCustomInput = true,
  required = false,
  disabled = false,
}: PrinterSelectorProps) {
  const { t } = useTranslation();

  // 데이터 상태
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesOption[]>([]);
  const [modelsList, setModelsList] = useState<ModelOption[]>([]);

  // 선택된 값
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [selectedSeries, setSelectedSeries] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');

  // 직접 입력 모드
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState(value || '');

  // 로딩 상태
  const [loadingManufacturers, setLoadingManufacturers] = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  // 제조사 목록 로드
  useEffect(() => {
    const loadManufacturers = async () => {
      setLoadingManufacturers(true);
      try {
        const data = await getManufacturers();
        setManufacturers(data);
      } catch (error) {
        console.error('[PrinterSelector] Failed to load manufacturers:', error);
      } finally {
        setLoadingManufacturers(false);
      }
    };

    loadManufacturers();
  }, []);

  // 제조사 선택 시 시리즈 로드
  useEffect(() => {
    if (!selectedManufacturer) {
      setSeriesList([]);
      setSelectedSeries('');
      setModelsList([]);
      setSelectedModel('');
      return;
    }

    const loadSeries = async () => {
      setLoadingSeries(true);
      try {
        const data = await getSeriesByManufacturer(selectedManufacturer);
        setSeriesList(data);
      } catch (error) {
        console.error('[PrinterSelector] Failed to load series:', error);
      } finally {
        setLoadingSeries(false);
      }
    };

    loadSeries();
  }, [selectedManufacturer]);

  // 시리즈 선택 시 모델 로드
  useEffect(() => {
    if (!selectedManufacturer || !selectedSeries) {
      setModelsList([]);
      setSelectedModel('');
      return;
    }

    const loadModels = async () => {
      setLoadingModels(true);
      try {
        const data = await getModelsByManufacturerAndSeries(selectedManufacturer, selectedSeries);
        setModelsList(data);
      } catch (error) {
        console.error('[PrinterSelector] Failed to load models:', error);
      } finally {
        setLoadingModels(false);
      }
    };

    loadModels();
  }, [selectedManufacturer, selectedSeries]);

  // 모델 선택 시 부모에게 알림
  useEffect(() => {
    if (isCustomMode) return;

    if (selectedModel) {
      const modelData = modelsList.find(m => m.id === selectedModel);
      if (modelData) {
        onChange({
          manufacturer: selectedManufacturer,
          series: selectedSeries,
          model: modelData.model,
          displayName: modelData.display_name,
          modelId: modelData.id,
        });
      }
    } else if (!selectedManufacturer && !selectedSeries && !selectedModel) {
      onChange(null);
    }
  }, [selectedModel, selectedManufacturer, selectedSeries, modelsList, isCustomMode, onChange]);

  // 직접 입력 변경 시
  const handleCustomInputChange = useCallback((value: string) => {
    setCustomInput(value);
    if (value.trim()) {
      onChange({
        manufacturer: '',
        series: '',
        model: value.trim(),
        displayName: value.trim(),
      });
    } else {
      onChange(null);
    }
  }, [onChange]);

  // 직접 입력 모드 토글
  const handleModeToggle = () => {
    if (isCustomMode) {
      // 선택 모드로 전환
      setIsCustomMode(false);
      setCustomInput('');
      onChange(null);
    } else {
      // 직접 입력 모드로 전환
      setIsCustomMode(true);
      setSelectedManufacturer('');
      setSelectedSeries('');
      setSelectedModel('');
      onChange(null);
    }
  };

  if (isCustomMode) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            프린터 모델 {required && <span className="text-destructive">*</span>}
          </Label>
          {allowCustomInput && (
            <button
              type="button"
              onClick={handleModeToggle}
              className="text-xs text-primary hover:underline"
            >
              목록에서 선택
            </button>
          )}
        </div>
        <Input
          placeholder="예: Bambu Lab X1C, Creality Ender 3 V2"
          value={customInput}
          onChange={(e) => handleCustomInputChange(e.target.value)}
          disabled={disabled}
          className="h-8 text-sm"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 제조사 선택 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">제조사</Label>
          {allowCustomInput && (
            <button
              type="button"
              onClick={handleModeToggle}
              className="text-xs text-primary hover:underline"
            >
              직접 입력
            </button>
          )}
        </div>
        <Select
          value={selectedManufacturer}
          onValueChange={(value) => {
            setSelectedManufacturer(value);
            setSelectedSeries('');
            setSelectedModel('');
          }}
          disabled={disabled || loadingManufacturers}
        >
          <SelectTrigger className="h-8 text-sm">
            {loadingManufacturers ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <SelectValue placeholder="제조사 선택" />
            )}
          </SelectTrigger>
          <SelectContent>
            {manufacturers.map((m) => (
              <SelectItem key={m.manufacturer} value={m.manufacturer}>
                {m.manufacturer}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 시리즈 선택 */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">시리즈</Label>
        <Select
          value={selectedSeries}
          onValueChange={(value) => {
            setSelectedSeries(value);
            setSelectedModel('');
          }}
          disabled={disabled || !selectedManufacturer || loadingSeries}
        >
          <SelectTrigger className="h-8 text-sm">
            {loadingSeries ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <SelectValue placeholder={selectedManufacturer ? '시리즈 선택' : '제조사를 먼저 선택하세요'} />
            )}
          </SelectTrigger>
          <SelectContent>
            {seriesList.map((s) => (
              <SelectItem key={s.series} value={s.series}>
                {s.series}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 모델 선택 */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          모델 {required && <span className="text-destructive">*</span>}
        </Label>
        <Select
          value={selectedModel}
          onValueChange={setSelectedModel}
          disabled={disabled || !selectedSeries || loadingModels}
        >
          <SelectTrigger className="h-8 text-sm">
            {loadingModels ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <SelectValue placeholder={selectedSeries ? '모델 선택' : '시리즈를 먼저 선택하세요'} />
            )}
          </SelectTrigger>
          <SelectContent>
            {modelsList.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default PrinterSelector;
