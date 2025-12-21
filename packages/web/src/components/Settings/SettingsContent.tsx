import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  Edit,
  Settings as SettingsIcon,
  FolderPlus,
  AlertTriangle,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@shared/integrations/supabase/client";
import { getUserPrinterGroups }  from "@shared/services/supabaseService/printerList";
import { useAuth } from "@shared/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useWebSocket } from "@shared/hooks/useWebSocket";
import { onDashStatusMessage } from "@shared/services/mqttService";
import { getPrinterStatusInfo } from "@shared/utils/printerStatus";
import {
  getManufacturers,
  getSeriesByManufacturer,
  getModelsByManufacturerAndSeries,
  type ManufacturerOption,
  type SeriesOption,
  type ModelOption
} from "@shared/api/manufacturingPrinter";
import { getUserPlan } from "@shared/services/supabaseService/subscription";
import { canAddPrinterAsync, getPlanInfo, getMaxPrintersFromPlanInfo } from "@shared/utils/subscription";
import type { SubscriptionPlan, SubscriptionPlanInfo } from "@shared/types/subscription";
import { UpgradePrompt } from "@/components/Settings/UpgradePrompt";

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
  firmware: "marlin" | "klipper" | "repetier" | "octoprint";
  status: "connected" | "disconnected" | "error";
  last_connected?: Date;
  manufacture_id?: string;
  device_uuid?: string;
  stream_url?: string;
}

// 미리 정의된 색상 팔레트
const colorPalette = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6", "#eab308"
];

interface SettingsContentProps {
  embedded?: boolean;
  onBack?: () => void;
  editPrinterId?: string;
}

export const SettingsContent = ({ embedded = false, onBack, editPrinterId }: SettingsContentProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const manufacturerCardRef = useRef<HTMLDivElement>(null);
  const isPrefillingRef = useRef(false);

  // MQTT WebSocket 연결 (실시간 상태 추적용)
  const { isConnected: mqttConnected } = useWebSocket();

  // 상태 관리
  const [groups, setGroups] = useState<PrinterGroup[]>([]);
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // 프린터별 MQTT 실시간 연결 상태 (deviceUuid -> connected)
  const [printerMqttStatus, setPrinterMqttStatus] = useState<Record<string, boolean>>({});

  // 모달 상태
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [showEditPrinter, setShowEditPrinter] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PrinterGroup | null>(null);
  const [editingPrinter, setEditingPrinter] = useState<PrinterConfig | null>(null);

  // 구독 플랜 상태 (DB 기반)
  const [userPlan, setUserPlan] = useState<SubscriptionPlan>('free');
  const [planInfo, setPlanInfo] = useState<SubscriptionPlanInfo | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // 제조사 데이터 상태
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("");
  const [seriesList, setSeriesList] = useState<SeriesOption[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string>("");
  const [modelsList, setModelsList] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");

  // 폼 데이터
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    color: colorPalette[0]
  });

  const [newPrinter, setNewPrinter] = useState<Partial<PrinterConfig>>({
    name: "",
    model: "",
    group_id: "",
    ip_address: "",
    port: 80,
    firmware: "marlin"
  });

  // 데이터 로드
  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 그룹/프린터 데이터 로드 (공용 서비스 재사용)
      const groupsData = await getUserPrinterGroups(user.id);
      setGroups(groupsData || []);

      // 프린터 데이터 가져오기
      const { data: printersData, error: printersError } = await supabase
        .from('printers')
        .select(`
          *,
          printer_groups (
            id,
            name,
            color,
            description
          )
        `)
        .eq('user_id', user.id);

      if (printersError) throw printersError;

      // cameras 테이블에서 stream_url 가져오기
      const { data: camerasData } = await supabase
        .from('cameras')
        .select('device_uuid, stream_url')
        .eq('user_id', user.id);

      // device_uuid를 key로 하는 Map 생성
      const cameraMap = new Map<string, string>();
      (camerasData || []).forEach(camera => {
        if (camera.device_uuid && camera.stream_url) {
          cameraMap.set(camera.device_uuid, camera.stream_url);
        }
      });

      // 타입 변환 및 안전한 할당
      const formattedPrinters: PrinterConfig[] = (printersData || []).map(printer => {
        const printerExt = printer as typeof printer & {
          name?: string;
          manufacture_id?: string;
          device_uuid?: string;
          printer_groups?: Array<PrinterGroup>;
        };
        return {
        id: printer.id,
        name: printerExt.name ?? printer.model,
        model: printer.model,
        group_id: printer.group_id,
        group: printerExt.printer_groups?.[0] || undefined,
        ip_address: printer.ip_address,
        port: printer.port,
        api_key: printer.api_key,
        firmware: printer.firmware as "marlin" | "klipper" | "repetier" | "octoprint",
        status: printer.status as "connected" | "disconnected" | "error",
        last_connected: printer.last_connected ? new Date(printer.last_connected) : undefined,
        manufacture_id: printerExt.manufacture_id,
        device_uuid: printerExt.device_uuid,
        stream_url: printerExt.device_uuid ? cameraMap.get(printerExt.device_uuid) : undefined
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

  // 사용자 플랜 로드 (DB 기반)
  useEffect(() => {
    const loadUserPlan = async () => {
      if (!user) return;
      try {
        const plan = await getUserPlan(user.id);
        setUserPlan(plan);

        // 플랜 정보도 로드
        const info = await getPlanInfo(plan);
        setPlanInfo(info);
      } catch (error) {
        console.error('Error loading user plan:', error);
      }
    };
    loadUserPlan();
  }, [user]);

  // editPrinterId가 전달되면 해당 프린터 수정 모달 열기
  useEffect(() => {
    if (editPrinterId && printers.length > 0) {
      const printer = printers.find(p => p.id === editPrinterId);
      if (printer) {
        handleEditPrinter(printer);
        setTimeout(() => {
          manufacturerCardRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
          });
        }, 500);
      }
    }
  }, [editPrinterId, printers]);

  // 제조사 목록 로드
  useEffect(() => {
    const loadManufacturers = async () => {
      try {
        const data = await getManufacturers();
        setManufacturers(data);
      } catch (error) {
        console.error('Failed to load manufacturers:', error);
      }
    };
    loadManufacturers();
  }, []);

  // 제조사 선택 시 시리즈 로드
  useEffect(() => {
    if (isPrefillingRef.current) return;
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
        console.error('Failed to load series:', error);
      }
    };
    loadSeries();
  }, [selectedManufacturer]);

  // 시리즈 선택 시 모델 로드
  useEffect(() => {
    if (isPrefillingRef.current) return;
    if (!selectedManufacturer || !selectedSeries) {
      setModelsList([]);
      setSelectedModel("");
      return;
    }
    const loadModels = async () => {
      try {
        const data = await getModelsByManufacturerAndSeries(selectedManufacturer, selectedSeries);
        setModelsList(data);
        setSelectedModel("");
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    };
    loadModels();
  }, [selectedManufacturer, selectedSeries]);

  // 모델 선택 시 editingPrinter.model 및 selectedModelId 업데이트
  useEffect(() => {
    if (selectedModel && editingPrinter) {
      const selectedModelData = modelsList.find(m => m.id === selectedModel);
      if (selectedModelData) {
        setEditingPrinter({
          ...editingPrinter,
          model: selectedModelData.display_name
        });
        setSelectedModelId(selectedModelData.id);
      }
    }
  }, [selectedModel]);

  // MQTT dash_status 구독하여 프린터별 실시간 연결 상태 추적
  useEffect(() => {
    const unsubscribe = onDashStatusMessage((deviceUuid, payload) => {
      const connected = Boolean(payload?.connected);
      setPrinterMqttStatus(prev => ({
        ...prev,
        [deviceUuid]: connected
      }));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 그룹 관리 함수들
  const handleAddGroup = async () => {
    if (!user || !newGroup.name.trim()) return;

    try {
      const { data, error } = await supabase
        .from('printer_groups')
        .insert([{
          user_id: user.id,
          name: newGroup.name.trim(),
          description: newGroup.description.trim() || null,
          color: newGroup.color
        }])
        .select()
        .single();

      if (error) throw error;

      setGroups([...groups, data]);
      setNewGroup({ name: "", description: "", color: colorPalette[0] });
      setShowAddGroup(false);

      toast({
        title: t('settings.success'),
        description: t('settings.groupAdded'),
      });
    } catch (error) {
      console.error('Error adding group:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.addGroupError'),
        variant: "destructive",
      });
    }
  };

  const handleEditGroup = (group: PrinterGroup) => {
    setEditingGroup(group);
    setNewGroup({
      name: group.name,
      description: group.description || "",
      color: group.color
    });
    setShowAddGroup(true);
  };

  const handleUpdateGroup = async () => {
    if (!user || !editingGroup || !newGroup.name.trim()) return;

    try {
      const { error } = await supabase
        .from('printer_groups')
        .update({
          name: newGroup.name.trim(),
          description: newGroup.description.trim() || null,
          color: newGroup.color
        })
        .eq('id', editingGroup.id);

      if (error) throw error;

      setGroups(groups.map(g =>
        g.id === editingGroup.id
          ? { ...g, name: newGroup.name.trim(), description: newGroup.description.trim(), color: newGroup.color }
          : g
      ));
      setNewGroup({ name: "", description: "", color: colorPalette[0] });
      setEditingGroup(null);
      setShowAddGroup(false);

      toast({
        title: t('settings.success'),
        description: t('settings.groupUpdated'),
      });
    } catch (error) {
      console.error('Error updating group:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.updateGroupError'),
        variant: "destructive",
      });
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('printer_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      setGroups(groups.filter(g => g.id !== groupId));

      toast({
        title: t('settings.success'),
        description: t('settings.groupDeleted'),
      });
    } catch (error) {
      console.error('Error deleting group:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.deleteGroupError'),
        variant: "destructive",
      });
    }
  };

  // 프린터 추가 버튼 클릭 핸들러 (플랜 제한 체크 - DB 기반)
  const handleAddPrinterClick = async () => {
    if (!user) return;

    // DB에서 프린터 추가 가능 여부 체크
    const canAdd = await canAddPrinterAsync(user.id);

    if (!canAdd) {
      setShowUpgradePrompt(true);
      return;
    }

    setShowAddPrinter(true);
  };

  const handleAddPrinter = async () => {
    if (!user || !newPrinter.name || !newPrinter.ip_address) return;

    try {
      const { data, error } = await supabase
        .from('printers')
        .insert([{
          user_id: user.id,
          name: newPrinter.name,
          model: newPrinter.model || "Unknown",
          group_id: newPrinter.group_id || null,
          ip_address: newPrinter.ip_address,
          port: newPrinter.port || 80,
          firmware: newPrinter.firmware || "marlin",
          device_uuid: newPrinter.device_uuid || null
        }])
        .select(`
          *,
          group:printer_groups(*)
        `)
        .single();

      if (error) throw error;

      const formattedPrinter: PrinterConfig = {
        id: data.id,
        name: data.name,
        model: data.model,
        group_id: data.group_id,
        group: data.group?.[0] || undefined,
        ip_address: data.ip_address,
        port: data.port,
        api_key: data.api_key,
        firmware: data.firmware as "marlin" | "klipper" | "repetier" | "octoprint",
        status: data.status as "connected" | "disconnected" | "error",
        last_connected: data.last_connected ? new Date(data.last_connected) : undefined,
        device_uuid: data.device_uuid
      };

      setPrinters([...printers, formattedPrinter]);
      setNewPrinter({
        name: "",
        model: "",
        group_id: "",
        ip_address: "",
        port: 80,
        firmware: "marlin"
      });
      setShowAddPrinter(false);

      toast({
        title: t('settings.success'),
        description: t('settings.printerAdded'),
        duration: 3000,
      });
    } catch (error) {
      console.error('Error adding printer:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.addPrinterError'),
        variant: "destructive",
      });
    }
  };

  const handleDeletePrinter = async (printerId: string) => {
    if (!user) return;

    try {
      const printerToDelete = printers.find(p => p.id === printerId);

      const { error } = await supabase
        .from('printers')
        .delete()
        .eq('id', printerId);

      if (error) throw error;

      if (printerToDelete?.device_uuid) {
        const { error: cameraError } = await supabase
          .from('cameras')
          .delete()
          .eq('device_uuid', printerToDelete.device_uuid)
          .eq('user_id', user.id);

        if (cameraError) {
          console.error('[Settings] Failed to delete camera record:', cameraError);
        } else {
          console.log('[Settings] Camera record deleted for device_uuid:', printerToDelete.device_uuid);
        }
      }

      setPrinters(printers.filter(p => p.id !== printerId));

      toast({
        title: t('settings.success'),
        description: t('settings.printerDeleted'),
      });
    } catch (error) {
      console.error('Error deleting printer:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.deletePrinterError'),
        variant: "destructive",
      });
    }
  };

  const handleEditPrinter = async (printer: PrinterConfig) => {
    setEditingPrinter(printer);
    setShowEditPrinter(true);

    setSelectedManufacturer("");
    setSelectedSeries("");
    setSelectedModel("");
    setSelectedModelId("");
    setSeriesList([]);
    setModelsList([]);

    isPrefillingRef.current = true;

    const printerExt = printer as PrinterConfig & { manufacture_id?: string };
    if (printerExt.manufacture_id) {
      try {
        const { data: manufacturingPrinter, error } = await supabase
          .from('manufacturing_printers')
          .select('id, manufacturer, series, model, display_name')
          .eq('id', printerExt.manufacture_id)
          .single();

        if (error) {
          console.error('Error loading manufacturing printer:', error);
          isPrefillingRef.current = false;
          return;
        }

        if (manufacturingPrinter) {
          setSelectedManufacturer(manufacturingPrinter.manufacturer);

          const seriesData = await getSeriesByManufacturer(manufacturingPrinter.manufacturer);
          setSeriesList(seriesData);
          setSelectedSeries(manufacturingPrinter.series);

          const modelsData = await getModelsByManufacturerAndSeries(
            manufacturingPrinter.manufacturer,
            manufacturingPrinter.series
          );
          setModelsList(modelsData);
          setSelectedModel(manufacturingPrinter.id);
          setSelectedModelId(manufacturingPrinter.id);
        }
        isPrefillingRef.current = false;
      } catch (error) {
        console.error('Error in handleEditPrinter:', error);
        isPrefillingRef.current = false;
      }
    } else {
      isPrefillingRef.current = false;
    }
  };

  const handleUpdatePrinter = async () => {
    if (!user || !editingPrinter) return;

    try {
      const updateData: {
        name: string;
        model: string;
        group_id: string | null;
        manufacture_id?: string;
      } = {
        name: editingPrinter.name,
        model: editingPrinter.model,
        group_id: editingPrinter.group_id || null,
      };

      if (selectedModelId) {
        updateData.manufacture_id = selectedModelId;
      }

      const { error } = await supabase
        .from('printers')
        .update(updateData)
        .eq('id', editingPrinter.id)
        .eq('user_id', user.id);

      if (error) throw error;

      if (editingPrinter.device_uuid && editingPrinter.stream_url !== undefined) {
        const { error: cameraError } = await supabase
          .from('cameras')
          .update({ stream_url: editingPrinter.stream_url || null })
          .eq('device_uuid', editingPrinter.device_uuid)
          .eq('user_id', user.id);

        if (cameraError) {
          console.error('Error updating camera URL:', cameraError);
        }
      }

      setPrinters(prev => prev.map(p => {
        if (p.id !== editingPrinter.id) return p;
        return { ...p, ...updateData };
      }));

      setShowEditPrinter(false);
      setEditingPrinter(null);

      toast({
        title: t('settings.success'),
        description: t('settings.printerUpdated'),
      });
    } catch (error) {
      console.error('Error updating printer:', error);
      toast({
        title: t('settings.error'),
        description: t('settings.updatePrinterError'),
        variant: "destructive",
      });
    }
  };

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

      setPrinters(prev => prev.map(p => {
        if (p.id !== printerId) return p;
        const nextGroup = groupId ? groups.find(g => g.id === groupId) : undefined;
        return { ...p, group_id: groupId ?? undefined, group: nextGroup };
      }));

      toast({ title: t('settings.saved'), description: t('settings.groupUpdated') });
    } catch (error) {
      console.error('Error assigning group:', error);
      toast({ title: t('settings.error'), description: t('settings.assignGroupError'), variant: "destructive" });
    }
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
      <div className="bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">{t('settings.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "bg-background p-6"}>
      <div className={embedded ? "space-y-8" : "max-w-7xl mx-auto space-y-8"}>
        {/* 헤더 */}
        <header className="space-y-2 pb-6 border-b">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <SettingsIcon className="h-8 w-8" />
                {t('settings.title')}
              </h1>
              <p className="text-muted-foreground">
                {t('settings.description')}
              </p>
            </div>
            {embedded && onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8 rounded-full hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </header>

        {/* 프린터 그룹 관리 섹션 */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">{t('settings.groupManagement')}</h2>
            <Dialog open={showAddGroup} onOpenChange={setShowAddGroup}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <FolderPlus className="h-4 w-4" />
                  {t('settings.addGroup')}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
                <DialogHeader>
                  <DialogTitle>{editingGroup ? t('settings.editGroup') : t('settings.newGroup')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-name">{t('settings.groupName')}</Label>
                    <Input
                      id="group-name"
                      placeholder={t('settings.groupNamePlaceholder')}
                      value={newGroup.name}
                      onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group-description">{t('settings.groupDescription')}</Label>
                    <Textarea
                      id="group-description"
                      placeholder={t('settings.groupDescriptionPlaceholder')}
                      value={newGroup.description}
                      onChange={(e) => setNewGroup({...newGroup, description: e.target.value})}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('settings.groupColor')}</Label>
                    <div className="flex gap-2 flex-wrap">
                      {colorPalette.map((color) => (
                        <button
                          key={color}
                          className={`w-8 h-8 rounded-full border-2 ${
                            newGroup.color === color ? "border-foreground" : "border-muted"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewGroup({...newGroup, color})}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={editingGroup ? handleUpdateGroup : handleAddGroup} className="flex-1">
                      {editingGroup ? t('settings.save') : t('settings.add')}
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setShowAddGroup(false);
                      setEditingGroup(null);
                      setNewGroup({ name: "", description: "", color: colorPalette[0] });
                    }} className="flex-1">
                      {t('settings.cancel')}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {groups.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderPlus className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t('settings.noGroups')}</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {t('settings.noGroupsDescription')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => (
                <Card key={group.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
                        {group.name}
                      </CardTitle>
                      {group.description && (
                        <p className="text-sm text-muted-foreground">{group.description}</p>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('settings.printerCount')}</span>
                        <span className="font-medium">
                          {printers.filter(p => p.group_id === group.id).length}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditGroup(group)}>
                        <Edit className="h-3 w-3 mr-1" />
                        {t('settings.edit')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteGroup(group.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <Separator />

        {/* 프린터 관리 섹션 */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">{t('settings.printerManagement')}</h2>
            <Dialog open={showAddPrinter} onOpenChange={setShowAddPrinter}>
              <Button
                className="flex items-center gap-2"
                onClick={handleAddPrinterClick}
              >
                <Plus className="h-4 w-4" />
                {t('settings.addPrinter')}
              </Button>
              <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
                <DialogHeader>
                  <DialogTitle>{t('settings.newPrinter')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('settings.printerName')}</Label>
                    <Input
                      id="name"
                      placeholder={t('settings.printerNamePlaceholder')}
                      value={newPrinter.name || ""}
                      onChange={(e) => setNewPrinter({...newPrinter, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">{t('settings.modelName')}</Label>
                    <Input
                      id="model"
                      placeholder={t('settings.modelNamePlaceholder')}
                      value={newPrinter.model || ""}
                      onChange={(e) => setNewPrinter({...newPrinter, model: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group">{t('settings.groupOptional')}</Label>
                    <Select
                      value={newPrinter.group_id || "none"}
                      onValueChange={(value) => setNewPrinter({...newPrinter, group_id: value === "none" ? undefined : value})}
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
                  <div className="space-y-2">
                    <Label htmlFor="ip">{t('settings.ipAddress')}</Label>
                    <Input
                      id="ip"
                      placeholder={t('settings.ipAddressPlaceholder')}
                      value={newPrinter.ip_address || ""}
                      onChange={(e) => setNewPrinter({...newPrinter, ip_address: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">{t('settings.port')}</Label>
                    <Input
                      id="port"
                      type="number"
                      placeholder="80"
                      value={newPrinter.port || 80}
                      onChange={(e) => setNewPrinter({...newPrinter, port: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firmware">{t('settings.firmware')}</Label>
                    <Select
                      value={newPrinter.firmware || "marlin"}
                      onValueChange={(value) => setNewPrinter({...newPrinter, firmware: value as "marlin" | "klipper" | "repetier" | "octoprint"})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="marlin">Marlin</SelectItem>
                        <SelectItem value="klipper">Klipper</SelectItem>
                        <SelectItem value="repetier">Repetier</SelectItem>
                        <SelectItem value="octoprint">OctoPrint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="device_uuid">{t('settings.deviceUUID')}</Label>
                    <Input
                      id="device_uuid"
                      placeholder={t('settings.deviceUUIDPlaceholder')}
                      value={newPrinter.device_uuid || ""}
                      onChange={(e) => setNewPrinter({...newPrinter, device_uuid: e.target.value})}
                    />
                    <p className="text-xs text-muted-foreground">{t('settings.deviceUUIDHelper')}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddPrinter} className="flex-1">
                      {t('settings.add')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddPrinter(false)} className="flex-1">
                      {t('settings.cancel')}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {printers.map((printer) => {
              const mqttConnectedStatus = printer.device_uuid ? printerMqttStatus[printer.device_uuid] ?? false : false;

              const printerState = mqttConnectedStatus ? 'operational' : 'disconnected';
              const flags = mqttConnectedStatus ? { operational: true } : null;
              const statusInfo = getPrinterStatusInfo(
                printerState,
                flags,
                {
                  idle: t('settings.statusConnected'),
                  printing: t('settings.statusPrinting'),
                  paused: t('settings.statusPaused'),
                  error: t('settings.statusError'),
                  connecting: t('settings.statusConnecting'),
                  disconnected: t('settings.statusDisconnected')
                }
              );

              return (
              <Card key={printer.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{printer.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{printer.model}</p>
                  </div>
                  <Badge className={statusInfo.badgeClass}>
                    {statusInfo.label}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('settings.ipAddress')}:</span>
                      <span className="font-mono">{printer.ip_address}:{printer.port}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('settings.firmware')}:</span>
                      <span className="capitalize">{printer.firmware}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{t('settings.group')}:</span>
                      <div className="min-w-[180px]">
                        <Select
                          value={printer.group_id || "none"}
                          onValueChange={(val) => handleAssignPrinterGroup(printer.id, val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('settings.selectGroup')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('settings.noGroup')}</SelectItem>
                            {groups.map((group) => (
                              <SelectItem key={group.id} value={group.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                                  {group.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {printer.last_connected && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('settings.lastConnected')}</span>
                        <span>{printer.last_connected.toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditPrinter(printer)}>
                      <Edit className="h-3 w-3 mr-1" />
                      {t('settings.edit')}
                      {!printer.manufacture_id && (
                        <AlertTriangle className="h-3 w-3 ml-1 text-red-500" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeletePrinter(printer.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>

          {/* 프린터 수정 모달 */}
          <Dialog open={showEditPrinter} onOpenChange={setShowEditPrinter}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">{t('settings.editPrinter')}</DialogTitle>
              </DialogHeader>
              {editingPrinter && (
                <div className="space-y-6 pt-2">
                  {/* 기본 정보 */}
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <h3 className="text-sm font-bold uppercase tracking-wide">{t('settings.basicInformation')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">{t('settings.printerName')}</Label>
                        <Input
                          id="edit-name"
                          value={editingPrinter.name}
                          onChange={(e) => setEditingPrinter({ ...editingPrinter, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-group">{t('settings.group')}</Label>
                        <Select
                          value={editingPrinter.group_id || "none"}
                          onValueChange={(value) => setEditingPrinter({
                            ...editingPrinter,
                            group_id: value === "none" ? undefined : value
                          })}
                        >
                          <SelectTrigger id="edit-group">
                            <SelectValue placeholder={t('settings.selectGroup')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('settings.noGroup')}</SelectItem>
                            {groups.map((group) => (
                              <SelectItem key={group.id} value={group.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                                  {group.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* 제조사 섹션 */}
                  <div
                    ref={manufacturerCardRef}
                    className={`space-y-4 p-4 rounded-lg border ${
                      editingPrinter.manufacture_id
                        ? 'bg-muted/30'
                        : 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-wide">{t('settings.manufacturer')}</h3>
                      {!editingPrinter.manufacture_id && (
                        <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{t('settings.manufacturerRequired')}</span>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {/* 제조사 선택 */}
                      <div className="space-y-2">
                        <Label htmlFor="edit-manufacturer">{t('settings.selectManufacturer')}</Label>
                        <Select
                          value={selectedManufacturer}
                          onValueChange={setSelectedManufacturer}
                        >
                          <SelectTrigger id="edit-manufacturer">
                            <SelectValue placeholder={`${t('settings.selectManufacturerPlaceholder')} (${t('settings.currentModel')}: ${editingPrinter?.model || '-'})`} />
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
                      <div className="space-y-2">
                        <Label htmlFor="edit-series">{t('settings.selectSeries')}</Label>
                        <Select
                          value={selectedSeries}
                          onValueChange={setSelectedSeries}
                          disabled={!selectedManufacturer}
                        >
                          <SelectTrigger id="edit-series">
                            <SelectValue placeholder={t('settings.selectSeriesPlaceholder')} />
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
                      <div className="space-y-2">
                        <Label htmlFor="edit-model-select">{t('settings.selectModel')}</Label>
                        <Select
                          value={selectedModel}
                          onValueChange={setSelectedModel}
                          disabled={!selectedSeries}
                        >
                          <SelectTrigger id="edit-model-select">
                            <SelectValue placeholder={t('settings.selectModelPlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            {modelsList.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* 카메라 정보 섹션 */}
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <h3 className="text-sm font-bold uppercase tracking-wide">{t('settings.camera')}</h3>

                    <div className="space-y-2">
                      <Label htmlFor="edit-camera-url">{t('settings.cameraUrl')}</Label>
                      <Input
                        id="edit-camera-url"
                        placeholder="rtsp://... or http://..."
                        value={editingPrinter.stream_url || ""}
                        onChange={(e) => setEditingPrinter({ ...editingPrinter, stream_url: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('settings.cameraUrlHelper')}
                      </p>
                    </div>
                  </div>

                  {/* 저장 버튼 */}
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowEditPrinter(false)}>
                      {t('settings.cancel')}
                    </Button>
                    <Button onClick={handleUpdatePrinter}>
                      {t('settings.apply')}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </section>

        {/* 업그레이드 프롬프트 */}
        <UpgradePrompt
          open={showUpgradePrompt}
          onOpenChange={setShowUpgradePrompt}
          feature={t('subscription.printerConnection')}
          requiredPlan={userPlan === 'free' ? 'pro' : 'enterprise'}
          currentPlan={userPlan}
        />
      </div>
    </div>
  );
};

export default SettingsContent;
