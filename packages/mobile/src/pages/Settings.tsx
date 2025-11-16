import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlatformHeader } from "@/components/PlatformHeader";
import { useSafeAreaStyle } from "@/hooks/usePlatform";
import {
  Plus,
  Settings as SettingsIcon,
  FolderPlus,
  ChevronRight,
  ArrowLeft
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@shared/integrations/supabase/client";
import { getUserPrinterGroups, getUserPrintersWithGroup } from "@shared/services/supabaseService/printerList";
import { useAuth } from "@shared/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { getPrinterStatusInfo } from "@shared/utils/printerStatus";
import type { PrinterState, PrinterStateFlags } from "@shared/types/printerType";
import { onDashStatusMessage } from "@shared/services/mqttService";
import { FullScreenInput } from "@/components/FullScreenInput";
import { WheelPicker } from "@/components/WheelPicker";

// 프린터 그룹 타입
interface PrinterGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at: string;
  updated_at: string;
}

// 프린터 설정 타입
interface PrinterConfig {
  id: string;
  name: string;
  model: string;
  group_id?: string;
  group?: PrinterGroup;
  ip_address: string;
  port: number;
  api_key?: string;
  firmware: "marlin" | "klipper" | "repetier" | "bambu" | "another";
  status: "connected" | "disconnected" | "error";
  last_connected?: Date;
  device_uuid?: string;
  manufacture_id?: string; // manufacturing_printers ID 저장
  camera_url?: string; // 카메라 URL
  // MQTT 실시간 상태
  mqttConnected?: boolean;
  mqttState?: PrinterState;
  mqttFlags?: PrinterStateFlags;
}

// 미리 정의된 색상 팔레트
const colorPalette = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6", "#eab308"
];

// 그룹 추가 페이지 컴포넌트
interface AddGroupPageProps {
  onBack: () => void;
  onUpdate: () => void;
}

const AddGroupPage = ({ onBack, onUpdate }: AddGroupPageProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    color: colorPalette[0]
  });
  const [editingField, setEditingField] = useState<{
    key: string;
    title: string;
    label: string;
    value: string;
    placeholder: string;
    onChange: (value: string) => void;
  } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleSave = async () => {
    if (!user || !newGroup.name.trim()) {
      toast({
        title: t('settings.error'),
        description: t('settings.groupName') + ' ' + t('settings.groupNamePlaceholder'),
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('printer_groups')
        .insert([{
          user_id: user.id,
          name: newGroup.name.trim(),
          description: newGroup.description.trim() || null,
          color: newGroup.color
        }]);

      if (error) throw error;

      toast({
        title: t('settings.success'),
        description: t('settings.groupAdded'),
      });
      onUpdate();
      onBack();
    } catch (error) {
      console.error('Error adding group:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.addGroupError'),
        variant: "destructive",
      });
    }
  };

  const groupFields = [
    {
      key: "name",
      label: t("settings.groupName"),
      value: newGroup.name,
      onChange: (value: string) => setNewGroup({ ...newGroup, name: value }),
      placeholder: t("settings.groupNamePlaceholder"),
      readOnly: false,
    },
    {
      key: "description",
      label: t("settings.groupDescription"),
      value: newGroup.description,
      onChange: (value: string) => setNewGroup({ ...newGroup, description: value }),
      placeholder: t("settings.groupDescriptionPlaceholder"),
      readOnly: false,
    },
  ];

  const handleFieldClick = (field: typeof groupFields[0]) => {
    if (field.readOnly) return;

    setEditingField({
      key: field.key,
      title: field.label,
      label: field.label,
      value: field.value,
      placeholder: field.placeholder,
      onChange: field.onChange,
    });
  };

  return (
    <>
      <div className="min-h-screen bg-background" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}>
        {/* 헤더 */}
        <div className="sticky top-0 z-10 bg-background border-b safe-area-top">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-accent rounded-full transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="text-lg font-semibold">{t('settings.newGroup')}</h1>
            <div className="w-9" />
          </div>
        </div>

        {/* 프로필 필드 */}
        <div className="px-4 py-4">
          {groupFields.map((field, index) => (
            <div key={index}>
              <button
                className="w-full flex items-center justify-between py-4 hover:bg-accent transition-colors"
                onClick={() => handleFieldClick(field)}
              >
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">
                  {field.label}
                </span>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className={`text-sm text-right ${field.value ? "" : "text-muted-foreground"}`}>
                    {field.value || t('settings.notSet')}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
              {index < groupFields.length - 1 && (
                <div className="border-b border-border/50" />
              )}
            </div>
          ))}

          {/* 색상 선택 */}
          <div className="border-b border-border/50" />
          <button
            className="w-full flex items-center justify-between py-4 hover:bg-accent transition-colors"
            onClick={() => setShowColorPicker(true)}
          >
            <span className="text-sm font-medium text-muted-foreground min-w-[80px]">
              {t('settings.groupColor')}
            </span>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full border-2 border-border"
                style={{ backgroundColor: newGroup.color }}
              />
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        </div>

        {/* 저장 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t safe-area-bottom">
          <Button
            onClick={handleSave}
            className="w-full h-12"
            disabled={!newGroup.name.trim()}
          >
            {t('settings.add')}
          </Button>
        </div>
      </div>

      {/* 전체 화면 입력 모달 */}
      {editingField && (
        <FullScreenInput
          isOpen={!!editingField}
          onClose={() => setEditingField(null)}
          onConfirm={(value) => {
            editingField.onChange(value);
          }}
          title={editingField.title}
          label={editingField.label}
          value={editingField.value}
          placeholder={editingField.placeholder}
          type="text"
        />
      )}

      {/* 색상 선택 전체 화면 모달 */}
      {showColorPicker && (
        <div className="fixed inset-0 z-50 bg-background animate-in fade-in duration-200 flex flex-col">
          {/* Header - back button only */}
          <div className="px-6 py-4 safe-area-top">
            <button
              onClick={() => setShowColorPicker(false)}
              className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
            >
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>
          </div>

          {/* Title and description */}
          <div className="px-6 py-8">
            <h1 className="text-3xl font-bold mb-2">
              {t('settings.selectColor', '색상을 선택해주세요')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('settings.colorDescription', '그룹의 색상을 나타냅니다!')}
            </p>
          </div>

          {/* Color grid - flex-1 for expansion */}
          <div className="flex-1 px-6 pb-safe">
            <div className="grid grid-cols-4 gap-4">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  className={`w-full aspect-square rounded-2xl border-4 transition-all ${
                    newGroup.color === color ? "border-primary scale-95" : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setNewGroup({ ...newGroup, color });
                    setShowColorPicker(false);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// 그룹 상세 페이지 컴포넌트
interface GroupDetailPageProps {
  group: PrinterGroup;
  onBack: () => void;
  onUpdate: () => void;
}

const GroupDetailPage = ({ group, onBack, onUpdate }: GroupDetailPageProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [editedGroup, setEditedGroup] = useState({
    name: group.name,
    description: group.description || "",
    color: group.color
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingField, setEditingField] = useState<{
    key: string;
    title: string;
    label: string;
    value: string;
    placeholder: string;
    onChange: (value: string) => void;
  } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleDelete = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('printer_groups')
        .delete()
        .eq('id', group.id);

      if (error) throw error;

      toast({
        title: t('settings.success'),
        description: t('settings.groupDeleted'),
      });
      onUpdate();
      onBack();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.deleteGroupError'),
        variant: "destructive",
      });
    }
  };

  const groupFields = [
    {
      key: "name",
      label: t("settings.groupName"),
      value: editedGroup.name,
      onChange: (value: string) => setEditedGroup({ ...editedGroup, name: value }),
      placeholder: t("settings.groupNamePlaceholder"),
      readOnly: false,
    },
    {
      key: "description",
      label: t("settings.groupDescription"),
      value: editedGroup.description,
      onChange: (value: string) => setEditedGroup({ ...editedGroup, description: value }),
      placeholder: t("settings.groupDescriptionPlaceholder"),
      readOnly: false,
    },
  ];

  // 개별 필드 저장
  const handleSaveField = async (key: string, value: string) => {
    if (!user) return;

    try {
      const updateData: any = {};

      if (key === 'name') {
        if (!value.trim()) {
          toast({
            title: t('settings.error'),
            description: t('settings.groupName') + ' ' + t('settings.groupNamePlaceholder'),
            variant: "destructive",
          });
          return;
        }
        updateData.name = value.trim();
      } else if (key === 'description') {
        updateData.description = value.trim() || null;
      }

      const { error } = await supabase
        .from('printer_groups')
        .update(updateData)
        .eq('id', group.id);

      if (error) throw error;

      toast({
        title: t('settings.success'),
        description: t('settings.groupUpdated'),
      });
      onUpdate();
    } catch (error) {
      console.error('Error updating group field:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.updateGroupError'),
        variant: "destructive",
      });
    }
  };

  // 색상 저장
  const handleSaveColor = async (color: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('printer_groups')
        .update({ color })
        .eq('id', group.id);

      if (error) throw error;

      toast({
        title: t('settings.success'),
        description: t('settings.groupUpdated'),
      });
      onUpdate();
    } catch (error) {
      console.error('Error updating group color:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.updateGroupError'),
        variant: "destructive",
      });
    }
  };

  const handleFieldClick = (field: typeof groupFields[0]) => {
    if (field.readOnly) return;

    setEditingField({
      key: field.key,
      title: field.label,
      label: field.label,
      value: field.value,
      placeholder: field.placeholder,
      onChange: field.onChange,
    });
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* 헤더 */}
        <div className="sticky top-0 z-10 bg-background border-b safe-area-top">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-accent rounded-full transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="text-lg font-semibold">{t('settings.editGroup')}</h1>
            <div className="w-9" />
          </div>
        </div>

        {/* 프로필 필드 */}
        <div className="px-4 py-4">
          {groupFields.map((field, index) => (
            <div key={index}>
              <button
                className="w-full flex items-center justify-between py-4 hover:bg-accent transition-colors"
                onClick={() => handleFieldClick(field)}
              >
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">
                  {field.label}
                </span>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className={`text-sm text-right ${field.value ? "" : "text-muted-foreground"}`}>
                    {field.value || t('settings.notSet')}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
              {index < groupFields.length - 1 && (
                <div className="border-b border-border/50" />
              )}
            </div>
          ))}

          {/* 색상 선택 */}
          <div className="border-b border-border/50" />
          <button
            className="w-full flex items-center justify-between py-4 hover:bg-accent transition-colors"
            onClick={() => setShowColorPicker(true)}
          >
            <span className="text-sm font-medium text-muted-foreground min-w-[80px]">
              {t('settings.groupColor')}
            </span>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full border-2 border-border"
                style={{ backgroundColor: editedGroup.color }}
              />
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        </div>

        {/* 삭제 버튼 */}
        <div className="px-4 mt-8 mb-4 pb-safe">
          <Button
            variant="destructive"
            className="w-full h-12 rounded-xl"
            onClick={() => setShowDeleteDialog(true)}
          >
            {t('settings.deleteGroup')}
          </Button>
        </div>
      </div>

      {/* 전체 화면 입력 모달 */}
      {editingField && (
        <FullScreenInput
          isOpen={!!editingField}
          onClose={() => setEditingField(null)}
          onConfirm={(value) => {
            editingField.onChange(value);
            handleSaveField(editingField.key, value);
            setEditingField(null);
          }}
          title={editingField.title}
          label={editingField.label}
          value={editingField.value}
          placeholder={editingField.placeholder}
          type="text"
        />
      )}

      {/* 색상 선택 전체 화면 모달 */}
      {showColorPicker && (
        <div className="fixed inset-0 z-50 bg-background animate-in fade-in duration-200 flex flex-col">
          {/* Header - back button only */}
          <div className="px-6 py-4 safe-area-top">
            <button
              onClick={() => setShowColorPicker(false)}
              className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
            >
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>
          </div>

          {/* Title and description */}
          <div className="px-6 py-8">
            <h1 className="text-3xl font-bold mb-2">
              {t('settings.selectColor', '색상을 선택해주세요')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('settings.colorDescription', '그룹의 색상을 나타냅니다!')}
            </p>
          </div>

          {/* Color grid - flex-1 for expansion */}
          <div className="flex-1 px-6 pb-safe">
            <div className="grid grid-cols-4 gap-4">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  className={`w-full aspect-square rounded-2xl border-4 transition-all ${
                    editedGroup.color === color ? "border-primary scale-95" : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setEditedGroup({ ...editedGroup, color });
                    handleSaveColor(color);
                    setShowColorPicker(false);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl" aria-describedby={undefined}>
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl font-semibold">{t('settings.deleteGroup')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {t('settings.deleteGroupConfirm')}
            </p>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1 h-12 rounded-xl text-base font-medium"
              >
                {t('settings.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="flex-1 h-12 rounded-xl text-base font-medium"
              >
                {t('settings.delete')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// 프린터 추가 페이지 컴포넌트
interface AddPrinterPageProps {
  onBack: () => void;
  onUpdate: () => void;
  groups: PrinterGroup[];
}

const AddPrinterPage = ({ onBack, onUpdate, groups }: AddPrinterPageProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [newPrinter, setNewPrinter] = useState({
    name: "",
    model: "",
    ip_address: "",
    port: 80,
    group_id: undefined as string | undefined,
    firmware: "marlin" as "marlin" | "klipper" | "repetier" | "bambu" | "another",
    camera_url: "",
    manufacture_id: undefined as string | undefined,
  });

  const [editingField, setEditingField] = useState<{
    key: string;
    title: string;
    label: string;
    value: string;
    placeholder: string;
    onChange: (value: string) => void;
  } | null>(null);

  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [showFirmwareSelector, setShowFirmwareSelector] = useState(false);
  const [showManufacturerSelector, setShowManufacturerSelector] = useState(false);

  // 제조사 선택 단계: 'manufacturer' | 'series' | 'model'
  const [manufacturerStep, setManufacturerStep] = useState<'manufacturer' | 'series' | 'model'>('manufacturer');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [selectedSeries, setSelectedSeries] = useState<string>('');
  const [selectedModelIndex, setSelectedModelIndex] = useState<number>(0);

  // 제조사 데이터
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [seriesList, setSeriesList] = useState<string[]>([]);
  const [modelsList, setModelsList] = useState<Array<{ id: string; display_name: string }>>([]);

  // 제조사 목록 로드
  useEffect(() => {
    const loadManufacturers = async () => {
      try {
        const { data, error } = await supabase
          .from('manufacturing_printers')
          .select('manufacturer')
          .order('manufacturer');

        if (!error && data) {
          const uniqueManufacturers = Array.from(new Set(data.map(item => item.manufacturer)));
          setManufacturers(uniqueManufacturers);
          if (uniqueManufacturers.length > 0 && !selectedManufacturer) {
            setSelectedManufacturer(uniqueManufacturers[0]);
          }
        }
      } catch (error) {
        console.error('Error loading manufacturers:', error);
      }
    };

    loadManufacturers();
  }, []);

  // 제조사 배열이 변경되면 선택값 보정
  useEffect(() => {
    if (manufacturers.length === 0) return;
    if (!selectedManufacturer || !manufacturers.includes(selectedManufacturer)) {
      setSelectedManufacturer(manufacturers[0]);
    }
  }, [manufacturers]);

  // 제조사 선택 시 시리즈 목록 로드
  useEffect(() => {
    if (!selectedManufacturer) return;

    const loadSeries = async () => {
      try {
        const { data, error } = await supabase
          .from('manufacturing_printers')
          .select('series')
          .eq('manufacturer', selectedManufacturer)
          .order('series');

        if (!error && data) {
          const uniqueSeries = Array.from(new Set(data.map(item => item.series)));
          setSeriesList(uniqueSeries);
          if (uniqueSeries.length > 0) {
            setSelectedSeries(uniqueSeries[0]);
          }
        }
      } catch (error) {
        console.error('Error loading series:', error);
      }
    };

    loadSeries();
    setSelectedSeries('');
  }, [selectedManufacturer]);

  // 시리즈 배열이 변경되면 선택값 보정
  useEffect(() => {
    if (seriesList.length === 0) return;
    if (!selectedSeries || !seriesList.includes(selectedSeries)) {
      setSelectedSeries(seriesList[0]);
    }
  }, [seriesList]);

  // 시리즈 선택 시 모델 목록 로드
  useEffect(() => {
    if (!selectedManufacturer || !selectedSeries) return;

    const loadModels = async () => {
      try {
        const { data, error } = await supabase
          .from('manufacturing_printers')
          .select('id, display_name')
          .eq('manufacturer', selectedManufacturer)
          .eq('series', selectedSeries)
          .order('display_name');

        if (!error && data) {
          setModelsList(data);
          if (data.length > 0) {
            setSelectedModelIndex(0);
          }
        }
      } catch (error) {
        console.error('Error loading models:', error);
      }
    };

    loadModels();
    setSelectedModelIndex(0);
  }, [selectedManufacturer, selectedSeries]);

  // 모델 배열이 변경되면 인덱스 보정
  useEffect(() => {
    if (modelsList.length === 0) return;
    if (selectedModelIndex >= modelsList.length) {
      setSelectedModelIndex(0);
    }
  }, [modelsList, selectedModelIndex]);

  const handleSave = async () => {
    if (!user || !newPrinter.name.trim() || !newPrinter.model.trim()) {
      toast({
        title: t('settings.error'),
        description: t('settings.printerNameAndModelRequired'),
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('printers')
        .insert([{
          user_id: user.id,
          name: newPrinter.name.trim(),
          model: newPrinter.model.trim(),
          ip_address: newPrinter.ip_address.trim() || '0.0.0.0',
          port: newPrinter.port,
          group_id: newPrinter.group_id || null,
          firmware: newPrinter.firmware,
          status: 'disconnected',
          camera_url: newPrinter.camera_url.trim() || null,
          manufacture_id: newPrinter.manufacture_id || null,
        }]);

      if (error) throw error;

      toast({
        title: t('settings.success'),
        description: t('settings.printerAdded'),
      });
      onUpdate();
      onBack();
    } catch (error) {
      console.error('Error adding printer:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.addPrinterError'),
        variant: "destructive",
      });
    }
  };

  const printerFields = [
    {
      key: "name",
      label: t("settings.printerName"),
      value: newPrinter.name,
      onChange: (value: string) => setNewPrinter({ ...newPrinter, name: value }),
      placeholder: t("settings.printerNamePlaceholder", "예: My Printer"),
      readOnly: false,
    },
    {
      key: "model",
      label: t("settings.modelName"),
      value: newPrinter.model || t('settings.notSet'),
      type: 'manufacturer',
      readOnly: true,
    },
    {
      key: "ip_address",
      label: t("settings.ipAddress", "IP Address"),
      value: newPrinter.ip_address,
      onChange: (value: string) => setNewPrinter({ ...newPrinter, ip_address: value }),
      placeholder: "192.168.1.100",
      readOnly: false,
    },
    {
      key: "port",
      label: t("settings.port", "Port"),
      value: String(newPrinter.port),
      onChange: (value: string) => {
        const port = parseInt(value) || 80;
        setNewPrinter({ ...newPrinter, port });
      },
      placeholder: "80",
      readOnly: false,
    },
    {
      key: "camera_url",
      label: t("settings.cameraUrl"),
      value: newPrinter.camera_url,
      onChange: (value: string) => setNewPrinter({ ...newPrinter, camera_url: value }),
      placeholder: t("settings.cameraUrlPlaceholder", "http://192.168.1.100/webcam"),
      readOnly: false,
    },
  ];

  const handleFieldClick = (field: typeof printerFields[0]) => {
    if (field.type === 'manufacturer') {
      setManufacturerStep('manufacturer');
      setShowManufacturerSelector(true);
      return;
    }

    if (field.readOnly) return;

    setEditingField({
      key: field.key,
      title: field.label,
      label: field.label,
      value: field.value,
      placeholder: field.placeholder || "",
      onChange: field.onChange || (() => {}),
    });
  };

  const firmwareOptions = [
    { value: "marlin", label: "Marlin" },
    { value: "klipper", label: "Klipper" },
    { value: "repetier", label: "Repetier" },
    { value: "bambu", label: "Bambu" },
    { value: "another", label: t("settings.other", "기타") },
  ];

  return (
    <>
      <div className="min-h-screen bg-background" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}>
        {/* 헤더 */}
        <div className="sticky top-0 z-10 bg-background border-b safe-area-top">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-accent rounded-full transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="text-lg font-semibold">{t('settings.newPrinter', '새 프린터')}</h1>
            <div className="w-9" />
          </div>
        </div>

        {/* 프린터 필드 */}
        <div className="px-4 py-4">
          {printerFields.map((field, index) => (
            <div key={index}>
              <button
                className="w-full flex items-center justify-between py-4 hover:bg-accent transition-colors"
                onClick={() => handleFieldClick(field)}
              >
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">
                  {field.label}
                </span>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className={`text-sm text-right ${field.value && field.value !== t('settings.notSet') ? "" : "text-muted-foreground"}`}>
                    {field.value || t('settings.notSet')}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
              {index < printerFields.length - 1 && (
                <div className="border-b border-border/50" />
              )}
            </div>
          ))}

          {/* 그룹 선택 */}
          <div className="border-b border-border/50" />
          <button
            className="w-full flex items-center justify-between py-4 hover:bg-accent transition-colors"
            onClick={() => setShowGroupSelector(true)}
          >
            <span className="text-sm font-medium text-muted-foreground min-w-[80px]">
              {t('settings.group')}
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${newPrinter.group_id ? "" : "text-muted-foreground"}`}>
                {groups.find(g => g.id === newPrinter.group_id)?.name || t('settings.notSet')}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>

          {/* 펌웨어 선택 */}
          <div className="border-b border-border/50" />
          <button
            className="w-full flex items-center justify-between py-4 hover:bg-accent transition-colors"
            onClick={() => setShowFirmwareSelector(true)}
          >
            <span className="text-sm font-medium text-muted-foreground min-w-[80px]">
              {t('settings.firmware')}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {firmwareOptions.find(f => f.value === newPrinter.firmware)?.label || newPrinter.firmware}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        </div>

        {/* 저장 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t safe-area-bottom">
          <Button
            onClick={handleSave}
            className="w-full h-12"
            disabled={!newPrinter.name.trim() || !newPrinter.model.trim()}
          >
            {t('settings.add')}
          </Button>
        </div>
      </div>

      {/* 전체 화면 입력 모달 */}
      {editingField && (
        <FullScreenInput
          isOpen={!!editingField}
          onClose={() => setEditingField(null)}
          onConfirm={(value) => {
            editingField.onChange(value);
          }}
          title={editingField.title}
          label={editingField.label}
          value={editingField.value}
          placeholder={editingField.placeholder}
          type="text"
        />
      )}

      {/* 그룹 선택 전체 화면 모달 */}
      {showGroupSelector && (
        <div className="fixed inset-0 z-50 bg-background animate-in fade-in duration-200 flex flex-col">
          <div className="px-6 py-4 safe-area-top">
            <button
              onClick={() => setShowGroupSelector(false)}
              className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
            >
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>
          </div>

          <div className="px-6 py-8">
            <h1 className="text-3xl font-bold mb-2">{t('settings.selectGroup')}</h1>
          </div>

          <div className="flex-1 overflow-y-auto px-6">
            <WheelPicker
              items={[
                { value: "none", label: t('settings.notSet') },
                ...groups.map(g => ({ value: g.id, label: g.name }))
              ]}
              selectedIndex={
                newPrinter.group_id
                  ? groups.findIndex(g => g.id === newPrinter.group_id) + 1
                  : 0
              }
              onSelectedIndexChange={(index) => {
                setNewPrinter({
                  ...newPrinter,
                  group_id: index === 0 ? undefined : groups[index - 1].id
                });
              }}
            />
          </div>

          <div className="px-6 py-6 border-t bg-background safe-area-bottom">
            <Button
              onClick={() => setShowGroupSelector(false)}
              className="w-full h-14 text-base font-semibold"
            >
              {t('settings.select')}
            </Button>
          </div>
        </div>
      )}

      {/* 펌웨어 선택 전체 화면 모달 */}
      {showFirmwareSelector && (
        <div className="fixed inset-0 z-50 bg-background animate-in fade-in duration-200 flex flex-col">
          <div className="px-6 py-4 safe-area-top">
            <button
              onClick={() => setShowFirmwareSelector(false)}
              className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
            >
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>
          </div>

          <div className="px-6 py-8">
            <h1 className="text-3xl font-bold mb-2">{t('settings.selectFirmware')}</h1>
          </div>

          <div className="flex-1 overflow-y-auto px-6">
            <WheelPicker
              items={firmwareOptions}
              selectedIndex={firmwareOptions.findIndex(f => f.value === newPrinter.firmware)}
              onSelectedIndexChange={(index) => {
                setNewPrinter({
                  ...newPrinter,
                  firmware: firmwareOptions[index].value as typeof newPrinter.firmware
                });
              }}
            />
          </div>

          <div className="px-6 py-6 border-t bg-background safe-area-bottom">
            <Button
              onClick={() => setShowFirmwareSelector(false)}
              className="w-full h-14 text-base font-semibold"
            >
              {t('settings.select')}
            </Button>
          </div>
        </div>
      )}

      {/* 제조사 선택 전체 화면 모달 */}
      {showManufacturerSelector && (
        <div className="fixed inset-0 z-50 bg-background animate-in fade-in duration-200 flex flex-col">
          {manufacturerStep === 'manufacturer' && (
            <>
              <div className="px-6 py-4 safe-area-top">
                <button
                  onClick={() => setShowManufacturerSelector(false)}
                  className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
                >
                  <ArrowLeft className="h-6 w-6 text-foreground" />
                </button>
              </div>

              <div className="px-6 py-8">
                <h1 className="text-3xl font-bold mb-2">{t('settings.selectManufacturer')}</h1>
              </div>

              <div className="flex-1 overflow-y-auto px-6">
                <WheelPicker
                  items={manufacturers.map(m => ({ value: m, label: m }))}
                  selectedIndex={manufacturers.indexOf(selectedManufacturer)}
                  onSelectedIndexChange={(index) => {
                    setSelectedManufacturer(manufacturers[index]);
                  }}
                />
              </div>

              <div className="px-6 py-6 border-t bg-background safe-area-bottom">
                <Button
                  onClick={() => setManufacturerStep('series')}
                  className="w-full h-14 text-base font-semibold"
                  disabled={manufacturers.length === 0}
                >
                  {t('settings.next')}
                </Button>
              </div>
            </>
          )}

          {manufacturerStep === 'series' && (
            <>
              <div className="px-6 py-4 safe-area-top">
                <button
                  onClick={() => setManufacturerStep('manufacturer')}
                  className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
                >
                  <ArrowLeft className="h-6 w-6 text-foreground" />
                </button>
              </div>

              <div className="px-6 py-8">
                <h1 className="text-3xl font-bold mb-2">{t('settings.selectSeries')}</h1>
                <p className="text-muted-foreground">{selectedManufacturer}</p>
              </div>

              <div className="flex-1 overflow-y-auto px-6">
                <WheelPicker
                  items={seriesList.map(s => ({ value: s, label: s }))}
                  selectedIndex={seriesList.indexOf(selectedSeries)}
                  onSelectedIndexChange={(index) => {
                    setSelectedSeries(seriesList[index]);
                  }}
                />
              </div>

              <div className="px-6 py-6 border-t bg-background safe-area-bottom">
                <Button
                  onClick={() => setManufacturerStep('model')}
                  className="w-full h-14 text-base font-semibold"
                  disabled={seriesList.length === 0}
                >
                  {t('settings.next')}
                </Button>
              </div>
            </>
          )}

          {manufacturerStep === 'model' && (
            <>
              <div className="px-6 py-4 safe-area-top">
                <button
                  onClick={() => setManufacturerStep('series')}
                  className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
                >
                  <ArrowLeft className="h-6 w-6 text-foreground" />
                </button>
              </div>

              <div className="px-6 py-8">
                <h1 className="text-3xl font-bold mb-2">{t('settings.selectModel')}</h1>
                <p className="text-muted-foreground">{selectedManufacturer} / {selectedSeries}</p>
              </div>

              <div className="flex-1 overflow-y-auto px-6">
                <WheelPicker
                  items={modelsList.map(m => ({ value: m.id, label: m.display_name }))}
                  selectedIndex={selectedModelIndex}
                  onSelectedIndexChange={(index) => {
                    setSelectedModelIndex(index);
                  }}
                />
              </div>

              <div className="px-6 py-6 border-t bg-background safe-area-bottom">
                <Button
                  onClick={() => {
                    const selectedModel = modelsList[selectedModelIndex];
                    if (selectedModel) {
                      setNewPrinter({
                        ...newPrinter,
                        manufacture_id: selectedModel.id,
                        model: selectedModel.display_name
                      });
                      setShowManufacturerSelector(false);
                    }
                  }}
                  className="w-full h-14 text-base font-semibold"
                  disabled={modelsList.length === 0 || !modelsList[selectedModelIndex]}
                >
                  {t('settings.select')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

// 프린터 상세 페이지 컴포넌트
interface PrinterDetailPageProps {
  printer: PrinterConfig;
  onBack: () => void;
  onUpdate: () => void;
  groups: PrinterGroup[];
}

const PrinterDetailPage = ({ printer, onBack, onUpdate, groups }: PrinterDetailPageProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [editedPrinter, setEditedPrinter] = useState(printer);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [manufacturerInfo, setManufacturerInfo] = useState<{
    manufacturer: string;
    series: string;
    displayName: string;
  } | null>(null);

  // 필드 편집 상태
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [showFirmwareSelector, setShowFirmwareSelector] = useState(false);
  const [showManufacturerSelector, setShowManufacturerSelector] = useState(false);

  // 제조사 선택 단계: 'manufacturer' | 'series' | 'model'
  const [manufacturerStep, setManufacturerStep] = useState<'manufacturer' | 'series' | 'model'>('manufacturer');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [selectedSeries, setSelectedSeries] = useState<string>('');
  const [selectedModelIndex, setSelectedModelIndex] = useState<number>(0);

  // 제조사 데이터
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [seriesList, setSeriesList] = useState<string[]>([]);
  const [modelsList, setModelsList] = useState<Array<{ id: string; display_name: string }>>([]);

  // 제조사 정보 로드
  useEffect(() => {
    const loadManufacturerInfo = async () => {
      if (!printer.manufacture_id) return;

      try {
        const { data, error } = await supabase
          .from('manufacturing_printers')
          .select('manufacturer, series, display_name')
          .eq('id', printer.manufacture_id)
          .single();

        if (!error && data) {
          setManufacturerInfo({
            manufacturer: data.manufacturer,
            series: data.series,
            displayName: data.display_name
          });
        }
      } catch (error) {
        console.error('Error loading manufacturer info:', error);
      }
    };

    loadManufacturerInfo();
  }, [printer.manufacture_id]);

  // 제조사 목록 로드
  useEffect(() => {
    const loadManufacturers = async () => {
      try {
        const { data, error } = await supabase
          .from('manufacturing_printers')
          .select('manufacturer')
          .order('manufacturer');

        if (!error && data) {
          const uniqueManufacturers = Array.from(new Set(data.map(item => item.manufacturer)));
          setManufacturers(uniqueManufacturers);
          // 첫 번째 항목을 기본값으로 설정
          if (uniqueManufacturers.length > 0 && !selectedManufacturer) {
            setSelectedManufacturer(uniqueManufacturers[0]);
          }
        }
      } catch (error) {
        console.error('Error loading manufacturers:', error);
      }
    };

    loadManufacturers();
  }, []);

  // 제조사 배열이 변경되면 선택값 보정
  useEffect(() => {
    if (manufacturers.length === 0) return;
    if (!selectedManufacturer || !manufacturers.includes(selectedManufacturer)) {
      setSelectedManufacturer(manufacturers[0]);
    }
  }, [manufacturers]);

  // 제조사 선택 시 시리즈 목록 로드
  useEffect(() => {
    if (!selectedManufacturer) return;

    const loadSeries = async () => {
      try {
        const { data, error } = await supabase
          .from('manufacturing_printers')
          .select('series')
          .eq('manufacturer', selectedManufacturer)
          .order('series');

        if (!error && data) {
          const uniqueSeries = Array.from(new Set(data.map(item => item.series)));
          setSeriesList(uniqueSeries);
          // 첫 번째 항목을 기본값으로 설정
          if (uniqueSeries.length > 0) {
            setSelectedSeries(uniqueSeries[0]);
          }
        }
      } catch (error) {
        console.error('Error loading series:', error);
      }
    };

    loadSeries();
    // 제조사가 바뀌면 시리즈 초기화
    setSelectedSeries('');
  }, [selectedManufacturer]);

  // 시리즈 배열이 변경되면 선택값 보정
  useEffect(() => {
    if (seriesList.length === 0) return;
    if (!selectedSeries || !seriesList.includes(selectedSeries)) {
      setSelectedSeries(seriesList[0]);
    }
  }, [seriesList]);

  // 시리즈 선택 시 모델 목록 로드
  useEffect(() => {
    if (!selectedManufacturer || !selectedSeries) return;

    const loadModels = async () => {
      try {
        const { data, error } = await supabase
          .from('manufacturing_printers')
          .select('id, display_name')
          .eq('manufacturer', selectedManufacturer)
          .eq('series', selectedSeries)
          .order('display_name');

        if (!error && data) {
          setModelsList(data);
          // 첫 번째 항목을 기본값으로 설정
          if (data.length > 0) {
            setSelectedModelIndex(0);
          }
        }
      } catch (error) {
        console.error('Error loading models:', error);
      }
    };

    loadModels();
    // 시리즈가 바뀌면 모델 초기화
    setSelectedModelIndex(0);
  }, [selectedManufacturer, selectedSeries]);

  // 모델 배열이 변경되면 인덱스 보정
  useEffect(() => {
    if (modelsList.length === 0) return;
    if (selectedModelIndex >= modelsList.length) {
      setSelectedModelIndex(0);
    }
  }, [modelsList, selectedModelIndex]);

  // 프린터 필드 목록
  const printerFields = [
    { key: 'name', label: t('settings.printerName'), value: editedPrinter.name, type: 'text' },
    {
      key: 'model',
      label: t('settings.modelName'),
      value: editedPrinter.model,
      subValue: manufacturerInfo ? `${manufacturerInfo.manufacturer} / ${manufacturerInfo.series}` : null,
      type: 'manufacturer'
    },
    { key: 'group_id', label: t('settings.group'), value: groups.find(g => g.id === editedPrinter.group_id)?.name || t('settings.notSet'), type: 'select' },
    { key: 'firmware', label: t('settings.firmware'), value: editedPrinter.firmware, type: 'select' },
    { key: 'camera_url', label: t('settings.cameraUrl'), value: editedPrinter.camera_url || t('settings.notSet'), type: 'text' },
  ];

  const handleDelete = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('printers')
        .delete()
        .eq('id', printer.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: t('settings.deleted'),
        description: t('settings.printerDeleted'),
      });

      onUpdate();
      onBack();
    } catch (error) {
      console.error('Error deleting printer:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.deleteFailed'),
        variant: 'destructive',
      });
    }
  };

  // 개별 필드 저장
  const handleSaveField = async (key: string, value: string) => {
    if (!user) return;

    try {
      const updateData: any = {};

      if (key === 'name') {
        if (!value.trim()) {
          toast({
            title: t('settings.error'),
            description: t('settings.printerName') + ' ' + t('settings.printerNamePlaceholder'),
            variant: "destructive",
          });
          return;
        }
        updateData.name = value.trim();
      } else if (key === 'camera_url') {
        updateData.camera_url = value.trim() || null;
      }

      const { error } = await supabase
        .from('printers')
        .update(updateData)
        .eq('id', printer.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: t('settings.success'),
        description: t('settings.printerUpdated'),
      });
      onUpdate();
    } catch (error) {
      console.error('Error updating printer field:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.saveFailed'),
        variant: "destructive",
      });
    }
  };

  // 그룹 저장
  const handleSaveGroup = async (groupId: string | undefined) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('printers')
        .update({ group_id: groupId || null })
        .eq('id', printer.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: t('settings.success'),
        description: t('settings.printerUpdated'),
      });
      onUpdate();
    } catch (error) {
      console.error('Error updating printer group:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.saveFailed'),
        variant: "destructive",
      });
    }
  };

  // 펌웨어 저장
  const handleSaveFirmware = async (firmware: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('printers')
        .update({ firmware })
        .eq('id', printer.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: t('settings.success'),
        description: t('settings.printerUpdated'),
      });
      onUpdate();
    } catch (error) {
      console.error('Error updating printer firmware:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.saveFailed'),
        variant: "destructive",
      });
    }
  };

  // 제조사/모델 저장
  const handleSaveManufacturer = async (manufactureId: string, modelName: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('printers')
        .update({
          manufacture_id: manufactureId,
          model: modelName
        })
        .eq('id', printer.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: t('settings.success'),
        description: t('settings.printerUpdated'),
      });
      onUpdate();
    } catch (error) {
      console.error('Error updating printer manufacturer:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.saveFailed'),
        variant: "destructive",
      });
    }
  };

  const handleFieldClick = (field: typeof printerFields[0]) => {
    if (field.type === 'text') {
      setEditingField(field.key);
    } else if (field.key === 'group_id') {
      setShowGroupSelector(true);
    } else if (field.key === 'firmware') {
      setShowFirmwareSelector(true);
    } else if (field.type === 'manufacturer') {
      setManufacturerStep('manufacturer');
      setSelectedManufacturer('');
      setSelectedSeries('');
      setShowManufacturerSelector(true);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b safe-area-top">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-accent rounded-full transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="text-lg font-semibold">{t('settings.printerDetails')}</h1>
            <div className="w-9" />
          </div>
        </div>

        {/* 필드 리스트 */}
        <div className="px-4 py-4">
          {printerFields.map((field, index) => (
            <button
              key={field.key}
              onClick={() => handleFieldClick(field)}
              className={`w-full flex items-center justify-between py-4 px-4 hover:bg-accent/50 transition-colors ${
                index !== printerFields.length - 1 ? 'border-b border-border/50' : ''
              }`}
            >
              <div className="flex-1 text-left">
                <p className="text-sm text-muted-foreground">{field.label}</p>
                <p className="text-base font-medium mt-1">{field.value || t('settings.notSet')}</p>
                {'subValue' in field && field.subValue && (
                  <p className="text-xs text-muted-foreground mt-1">{field.subValue}</p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* 삭제 버튼 */}
        <div className="px-4 mt-8 mb-4 pb-safe">
          <Button
            variant="destructive"
            className="w-full h-12 rounded-xl"
            onClick={() => setShowDeleteDialog(true)}
          >
            {t('settings.deletePrinter')}
          </Button>
        </div>
      </div>

      {/* FullScreenInput for text fields */}
      <FullScreenInput
        isOpen={editingField !== null && printerFields.find(f => f.key === editingField)?.type === 'text'}
        title={printerFields.find(f => f.key === editingField)?.label || ''}
        label=""
        value={editingField ? (editedPrinter[editingField as keyof PrinterConfig]?.toString() || '') : ''}
        onClose={() => setEditingField(null)}
        onConfirm={(value) => {
          if (editingField) {
            setEditedPrinter({ ...editedPrinter, [editingField]: value });
            handleSaveField(editingField, value);
            setEditingField(null);
          }
        }}
        type="text"
      />

      {/* 삭제 확인 Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl" aria-describedby={undefined}>
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl font-semibold">{t('settings.deletePrinter')}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              {t('settings.deletePrinterConfirm')}
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              className="flex-1 h-12 rounded-xl text-base font-medium"
            >
              {t('settings.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="flex-1 h-12 rounded-xl text-base font-medium"
            >
              {t('settings.delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 그룹 선택 다이얼로그 */}
      {showGroupSelector && (
        <div className="fixed inset-0 z-50 bg-background animate-in fade-in duration-200 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 safe-area-top">
            <button
              onClick={() => setShowGroupSelector(false)}
              className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
            >
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>
          </div>

          {/* Title */}
          <div className="px-6 py-8">
            <h1 className="text-3xl font-bold">{t('settings.group')}</h1>
          </div>

          {/* Group list */}
          <div className="flex-1 px-6 pb-safe">
            <div className="space-y-2">
              {/* No Group option */}
              <button
                onClick={() => {
                  setEditedPrinter({ ...editedPrinter, group_id: undefined });
                  handleSaveGroup(undefined);
                  setShowGroupSelector(false);
                }}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  !editedPrinter.group_id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="text-base font-medium">{t('settings.noGroup')}</span>
                {!editedPrinter.group_id && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>

              {/* Group options */}
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => {
                    setEditedPrinter({ ...editedPrinter, group_id: group.id });
                    handleSaveGroup(group.id);
                    setShowGroupSelector(false);
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    editedPrinter.group_id === group.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="text-base font-medium">{group.name}</span>
                  </div>
                  {editedPrinter.group_id === group.id && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 펌웨어 선택 다이얼로그 */}
      {showFirmwareSelector && (
        <div className="fixed inset-0 z-50 bg-background animate-in fade-in duration-200 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 safe-area-top">
            <button
              onClick={() => setShowFirmwareSelector(false)}
              className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
            >
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>
          </div>

          {/* Title */}
          <div className="px-6 py-8">
            <h1 className="text-3xl font-bold">{t('settings.firmware')}</h1>
          </div>

          {/* Firmware list */}
          <div className="flex-1 px-6 pb-safe">
            <div className="space-y-2">
              {['marlin', 'klipper', 'repetier', 'bambu', 'another'].map((fw) => (
                <button
                  key={fw}
                  onClick={() => {
                    setEditedPrinter({ ...editedPrinter, firmware: fw as any });
                    handleSaveFirmware(fw);
                    setShowFirmwareSelector(false);
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    editedPrinter.firmware === fw
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="text-base font-medium capitalize">{fw}</span>
                  {editedPrinter.firmware === fw && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 제조사/시리즈/모델 선택 다이얼로그 */}
      {showManufacturerSelector && (
        <div className="fixed inset-0 z-50 bg-background animate-in fade-in duration-200 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 safe-area-top">
            <button
              onClick={() => {
                if (manufacturerStep === 'manufacturer') {
                  setShowManufacturerSelector(false);
                } else if (manufacturerStep === 'series') {
                  setManufacturerStep('manufacturer');
                  setSelectedSeries('');
                } else if (manufacturerStep === 'model') {
                  setManufacturerStep('series');
                }
              }}
            >
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>
          </div>

          {/* Title */}
          <div className="px-6 py-4">
            <h1 className="text-3xl font-bold">
              {manufacturerStep === 'manufacturer' && t('settings.manufacturer')}
              {manufacturerStep === 'series' && t('settings.series')}
              {manufacturerStep === 'model' && t('settings.modelName')}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {manufacturerStep === 'manufacturer' && t('settings.selectManufacturerDesc')}
              {manufacturerStep === 'series' && t('settings.selectSeriesDesc')}
              {manufacturerStep === 'model' && t('settings.selectModelDesc')}
            </p>
          </div>

          {/* Step Indicator */}
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2">
              {/* Step 1: Manufacturer */}
              <div className="flex items-center gap-2 flex-1">
                <div
                  className={`flex-1 h-1.5 rounded-full transition-all ${
                    manufacturerStep === 'manufacturer'
                      ? 'bg-primary'
                      : manufacturerStep === 'series' || manufacturerStep === 'model'
                      ? 'bg-primary'
                      : 'bg-muted'
                  }`}
                />
                <span
                  className={`text-xs font-medium transition-colors ${
                    manufacturerStep === 'manufacturer'
                      ? 'text-primary'
                      : manufacturerStep === 'series' || manufacturerStep === 'model'
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                >
                  {t('settings.manufacturer')}
                </span>
              </div>

              {/* Arrow */}
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

              {/* Step 2: Series */}
              <div className="flex items-center gap-2 flex-1">
                <div
                  className={`flex-1 h-1.5 rounded-full transition-all ${
                    manufacturerStep === 'series'
                      ? 'bg-primary'
                      : manufacturerStep === 'model'
                      ? 'bg-primary'
                      : 'bg-muted'
                  }`}
                />
                <span
                  className={`text-xs font-medium transition-colors ${
                    manufacturerStep === 'series'
                      ? 'text-primary'
                      : manufacturerStep === 'model'
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                >
                  {t('settings.series')}
                </span>
              </div>

              {/* Arrow */}
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

              {/* Step 3: Model */}
              <div className="flex items-center gap-2 flex-1">
                <div
                  className={`flex-1 h-1.5 rounded-full transition-all ${
                    manufacturerStep === 'model' ? 'bg-primary' : 'bg-muted'
                  }`}
                />
                <span
                  className={`text-xs font-medium transition-colors ${
                    manufacturerStep === 'model' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {t('settings.modelName')}
                </span>
              </div>
            </div>
          </div>

          {/* Selected Values Display */}
          {(selectedManufacturer || selectedSeries || modelsList[selectedModelIndex]) && (
            <div className="px-6 pb-6">
              <div className="bg-muted rounded-xl p-4 space-y-2 border border-border">
                {selectedManufacturer && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground min-w-[60px]">
                      {t('settings.manufacturer')}:
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {selectedManufacturer}
                    </span>
                  </div>
                )}
                {selectedSeries && (manufacturerStep === 'series' || manufacturerStep === 'model') && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground min-w-[60px]">
                      {t('settings.series')}:
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {selectedSeries}
                    </span>
                  </div>
                )}
                {modelsList[selectedModelIndex] && manufacturerStep === 'model' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground min-w-[60px]">
                      {t('settings.modelName')}:
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {modelsList[selectedModelIndex].display_name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 제조사 목록 */}
          {manufacturerStep === 'manufacturer' && manufacturers.length > 0 && (
            <>
              <div className="flex-1 px-6 flex items-center">
                <WheelPicker
                  options={manufacturers}
                  value={selectedManufacturer}
                  onChange={setSelectedManufacturer}
                />
              </div>
              <div className="px-6 pb-6 safe-area-bottom">
                <Button
                  onClick={() => {
                    if (selectedManufacturer) {
                      setManufacturerStep('series');
                    }
                  }}
                  className="w-full h-14 text-base font-semibold"
                  disabled={!selectedManufacturer || manufacturers.length === 0}
                >
                  {t('settings.next')}
                </Button>
              </div>
            </>
          )}

          {/* 시리즈 목록 */}
          {manufacturerStep === 'series' && seriesList.length > 0 && (
            <>
              <div className="flex-1 px-6 flex items-center">
                <WheelPicker
                  options={seriesList}
                  value={selectedSeries}
                  onChange={setSelectedSeries}
                />
              </div>
              <div className="px-6 pb-6 safe-area-bottom">
                <Button
                  onClick={() => {
                    if (selectedSeries) {
                      setManufacturerStep('model');
                    }
                  }}
                  className="w-full h-14 text-base font-semibold"
                  disabled={!selectedSeries || seriesList.length === 0}
                >
                  {t('settings.next')}
                </Button>
              </div>
            </>
          )}

          {/* 모델 목록 */}
          {manufacturerStep === 'model' && modelsList.length > 0 && (
            <>
              <div className="flex-1 px-6 flex items-center">
                <WheelPicker
                  options={modelsList.map(m => m.display_name)}
                  value={modelsList[selectedModelIndex]?.display_name}
                  onChange={(displayName) => {
                    const index = modelsList.findIndex(m => m.display_name === displayName);
                    if (index >= 0) {
                      setSelectedModelIndex(index);
                    }
                  }}
                />
              </div>
              <div className="px-6 pb-6 safe-area-bottom">
                <Button
                  onClick={() => {
                    const selectedModel = modelsList[selectedModelIndex];
                    if (selectedModel) {
                      setEditedPrinter({
                        ...editedPrinter,
                        manufacture_id: selectedModel.id,
                        model: selectedModel.display_name
                      });
                      handleSaveManufacturer(selectedModel.id, selectedModel.display_name);
                      setShowManufacturerSelector(false);
                    }
                  }}
                  className="w-full h-14 text-base font-semibold"
                  disabled={modelsList.length === 0 || !modelsList[selectedModelIndex]}
                >
                  {t('settings.select')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

const Settings = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // 플랫폼별 하단 SafeArea 패딩
  const contentBottomStyle = useSafeAreaStyle({
    bottom: true,
    bottomPadding: '6rem',
  });

  // 상태 관리
  const [groups, setGroups] = useState<PrinterGroup[]>([]);
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // URL 쿼리 파라미터로 그룹 추가/수정 페이지 상태 관리
  const showAddGroup = searchParams.has('addGroup');
  const editGroupId = searchParams.get('editGroup');
  const selectedGroup = editGroupId ? groups.find(g => g.id === editGroupId) : null;

  // URL 쿼리 파라미터로 프린터 추가/수정 페이지 상태 관리
  const showAddPrinter = searchParams.has('addPrinter');
  const editPrinterId = searchParams.get('editPrinter');
  const selectedPrinter = editPrinterId ? printers.find(p => p.id === editPrinterId) : null;

  // 데이터 로드
  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // 그룹/프린터 데이터 로드 (공용 서비스 재사용)
      const groupsData = await getUserPrinterGroups(user.id);
      setGroups(groupsData || []);

      const printersData = await getUserPrintersWithGroup(user.id);
      
      // 타입 변환 및 안전한 할당
      const formattedPrinters: PrinterConfig[] = (printersData || []).map(printer => {
        const printerData = printer as Record<string, unknown>;
        return {
          id: printer.id,
          name: (printerData.name as string | undefined) ?? printer.model,
          model: printer.model,
          group_id: printer.group_id,
          group: printer.group?.[0] || undefined,
          ip_address: printer.ip_address,
          port: printer.port,
          api_key: printer.api_key,
          firmware: printer.firmware as "marlin" | "klipper" | "repetier" | "bambu" | "another",
          status: printer.status as "connected" | "disconnected" | "error",
          last_connected: printer.last_connected ? new Date(printer.last_connected) : undefined,
          device_uuid: printer.device_uuid,  // device_uuid 포함
          manufacture_id: printerData.manufacture_id as string | undefined  // manufacture_id 포함
        };
      });

      setPrinters(formattedPrinters);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.loadError'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // 페이지 진입 시 스크롤 초기화
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);


  // MQTT dash_status 구독 (이미 AuthContext에서 구독 중)
  useEffect(() => {
    const unsubscribe = onDashStatusMessage((deviceUuid, payload) => {
      if (!deviceUuid || !payload) return;

      // 해당 device_uuid를 가진 프린터 찾아서 MQTT 상태 업데이트
      setPrinters(prev => prev.map(printer => {
        if (printer.device_uuid !== deviceUuid) return printer;

        const flags = payload.printer_status?.flags;
        const connected = Boolean(flags && (flags.operational || flags.printing || flags.paused || flags.ready || flags.error));
        const state = flags?.ready === true ? 'operational' : (payload.printer_status?.state || 'disconnected');

        return {
          ...printer,
          mqttConnected: connected,
          mqttState: state as PrinterState,
          mqttFlags: flags as PrinterStateFlags
        };
      }));
    });

    return () => {
      unsubscribe();
    };
  }, []);



  // 프린터 그룹 배정/해제 (카드에서 즉시 반영)
  const handleAssignPrinterGroup = async (printerId: string, value: string) => {
    if (!user) return;
    const groupId = value === "none" ? null : value;
    try {
      const q = supabase
        .from('printers')
        .update({ group_id: groupId })
        .eq('id', printerId)
        .eq('user_id', user.id);
      const { error } = await q;
      if (error) throw error;

      // 로컬 상태 업데이트
      setPrinters(prev => prev.map(p => {
        if (p.id !== printerId) return p;
        const nextGroup = groupId ? groups.find(g => g.id === groupId) : undefined;
        return { ...p, group_id: groupId ?? undefined, group: nextGroup } satisfies PrinterConfig;
      }));

      toast({ title: t('settings.saved'), description: t('settings.groupUpdated') });
    } catch (error) {
      console.error('Error assigning group:', error);
      toast({ title: t('settings.error'), description: t('settings.assignGroupError'), variant: "destructive" });
    }
  };

  // shared 유틸리티를 사용하여 프린터 상태 정보 가져오기
  const getPrinterStatusForSettings = (printer: PrinterConfig) => {
    // MQTT 데이터가 있으면 MQTT 데이터 사용, 없으면 disconnected
    const printerState: PrinterState = printer.mqttConnected && printer.mqttState
      ? printer.mqttState
      : 'disconnected';

    const flags: PrinterStateFlags = printer.mqttConnected && printer.mqttFlags
      ? printer.mqttFlags
      : {};

    return getPrinterStatusInfo(printerState, flags, {
      idle: t('settings.statusConnected'),
      printing: t('printer.statusPrinting'),
      paused: t('printerDetail.paused'),
      error: t('settings.statusError'),
      connecting: t('printerDetail.connecting'),
      disconnected: t('settings.statusDisconnected')
    });
  };

  if (!user) {
    return (
      <div className="bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">{t('settings.loginRequired')}</h1>
            <p className="text-muted-foreground mb-6">
              {t('settings.loginRequiredDescription')}
            </p>
            <Button asChild>
              <a href="/auth">{t('auth.login')}</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">{t('settings.loading')}</p>
        </div>
      </div>
    );
  }

  // 그룹 추가 페이지를 표시하는 경우
  if (showAddGroup) {
    return <AddGroupPage onBack={() => setSearchParams({})} onUpdate={loadData} />;
  }

  // 그룹 상세 페이지를 표시하는 경우
  if (selectedGroup) {
    return <GroupDetailPage group={selectedGroup} onBack={() => setSearchParams({})} onUpdate={loadData} />;
  }

  // 프린터 추가 페이지를 표시하는 경우
  if (showAddPrinter) {
    return <AddPrinterPage onBack={() => setSearchParams({})} onUpdate={loadData} groups={groups} />;
  }

  // 프린터 상세 페이지를 표시하는 경우
  if (selectedPrinter) {
    return <PrinterDetailPage printer={selectedPrinter} onBack={() => setSearchParams({})} onUpdate={loadData} groups={groups} />;
  }

  return (
    <div className="bg-background">
      {/* 미니 헤더 */}
      <PlatformHeader>
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <SettingsIcon className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-lg font-semibold">{t('settings.title')}</h1>
        </div>
      </PlatformHeader>

      <div className="max-w-screen-sm md:max-w-2xl mx-auto px-4 py-4 space-y-4" style={contentBottomStyle}>
        {/* 프린터 그룹 관리 섹션 */}
        <section className="space-y-3 mt-4">
          <h2 className="text-lg font-semibold">{t('settings.groupManagement')}</h2>

          {groups.length === 0 ? (
            <div className="bg-muted/40 rounded-2xl border border-white/10 dark:border-white/10 p-12 text-center shadow-sm">
              <FolderPlus className="h-10 w-10 text-muted-foreground mb-3 mx-auto" />
              <h3 className="text-base font-medium mb-1">{t('settings.noGroups')}</h3>
              <p className="text-xs text-muted-foreground">
                {t('settings.noGroupsDescription')}
              </p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-white/10 dark:border-white/10 shadow-sm divide-y divide-border/50">
              {groups.map((group) => (
                <button
                  key={group.id}
                  className="w-full px-4 py-4 hover:bg-accent transition-colors min-h-[56px] flex items-center text-left"
                  onClick={() => setSearchParams({ editGroup: group.id })}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* 색상 표시 */}
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    />

                    {/* 그룹 정보 */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-medium truncate">{group.name}</h3>
                      {group.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {group.description}
                        </p>
                      )}
                    </div>

                    {/* 우측: 프린터 수 + chevron */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge variant="secondary" className="text-xs px-2 py-0.5">
                        {printers.filter(p => p.group_id === group.id).length}
                      </Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Add Group 버튼 */}
          <Button
            variant="outline"
            className="w-full h-12 flex items-center justify-center gap-2 rounded-xl"
            onClick={() => setSearchParams({ addGroup: 'true' })}
          >
            <Plus className="h-4 w-4" />
            {t('settings.addGroup')}
          </Button>
        </section>

        {/* 프린터 관리 섹션 */}
        <section className="space-y-3 mt-4">
          <h2 className="text-lg font-semibold">{t('settings.printerManagement')}</h2>

          <div className="bg-card rounded-2xl border border-white/10 dark:border-white/10 shadow-sm divide-y divide-border/50">
            {printers.map((printer) => {
              const statusInfo = getPrinterStatusForSettings(printer);
              return (
              <button
                key={printer.id}
                className="w-full px-4 py-4 hover:bg-accent transition-colors text-left"
                onClick={() => setSearchParams({ editPrinter: printer.id })}
              >
                <div className="flex items-center gap-3 min-h-[56px]">
                  {/* 좌측: 프린터 정보 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium truncate">{printer.name}</h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{printer.model}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground font-mono">{printer.ip_address}:{printer.port}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground capitalize">{printer.firmware}</span>
                    </div>
                  </div>

                  {/* 우측: 상태 + 꺽쇠 */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={`${statusInfo.badgeClass} text-xs px-2 py-0.5`}>
                      {statusInfo.label}
                    </Badge>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </button>
              );
            })}
          </div>

          {/* Add Printer 버튼 */}
          <Button
            variant="outline"
            className="w-full h-12 flex items-center justify-center gap-2 rounded-xl"
            onClick={() => setSearchParams({ addPrinter: 'true' })}
          >
            <Plus className="h-4 w-4" />
            {t('settings.addPrinter')}
          </Button>
        </section>
      </div>
    </div>
  );
};

export default Settings;
