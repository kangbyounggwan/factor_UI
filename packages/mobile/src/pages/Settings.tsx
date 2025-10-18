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
  FolderPlus
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
import { getUserPrinterGroups, getUserPrintersWithGroup } from "@shared/services/supabaseService/printerList";
import { useAuth } from "@shared/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { getPrinterStatusInfo } from "@shared/utils/printerStatus";
import type { PrinterState, PrinterStateFlags } from "@shared/types/printerType";
import { onDashStatusMessage } from "@shared/services/mqttService";
import {
  getManufacturers,
  getSeriesByManufacturer,
  getModelsByManufacturerAndSeries,
  type ManufacturerOption,
  type SeriesOption,
  type ModelOption
} from "@shared/api/manufacturingPrinter";

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
  device_uuid?: string;
  manufacture_id?: string; // manufacturing_printers ID 저장
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

const Settings = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const manufacturerCardRef = useRef<HTMLDivElement>(null);
  const isPrefillingRef = useRef(false);

  // 상태 관리
  const [groups, setGroups] = useState<PrinterGroup[]>([]);
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // 모달 상태
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [showEditPrinter, setShowEditPrinter] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PrinterGroup | null>(null);
  const [editingPrinter, setEditingPrinter] = useState<PrinterConfig | null>(null);

  // 제조사 데이터 상태
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("");
  const [seriesList, setSeriesList] = useState<SeriesOption[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string>("");
  const [modelsList, setModelsList] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>(""); // manufacturing_printers ID
  
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

      const printersData = await getUserPrintersWithGroup(user.id);
      
      // 타입 변환 및 안전한 할당
      const formattedPrinters: PrinterConfig[] = (printersData || []).map(printer => ({
        id: printer.id,
        name: (printer as any).name ?? printer.model,
        model: printer.model,
        group_id: printer.group_id,
        group: printer.group?.[0] || undefined,
        ip_address: printer.ip_address,
        port: printer.port,
        api_key: printer.api_key,
        firmware: printer.firmware as "marlin" | "klipper" | "repetier" | "octoprint",
        status: printer.status as "connected" | "disconnected" | "error",
        last_connected: printer.last_connected ? new Date(printer.last_connected) : undefined,
        device_uuid: printer.device_uuid,  // device_uuid 포함
        manufacture_id: (printer as any).manufacture_id  // manufacture_id 포함
      }));

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

  // 쿼리 파라미터로 프린터 ID가 전달되면 해당 프린터 수정 모달 열기
  useEffect(() => {
    const editPrinterId = searchParams.get('editPrinter');
    if (editPrinterId && printers.length > 0) {
      const printer = printers.find(p => p.id === editPrinterId);
      if (printer) {
        handleEditPrinter(printer);
        // 쿼리 파라미터 제거
        setSearchParams({});

        // 제조사 카드로 스크롤 (모달이 열린 후, 모달 내부 스크롤)
        setTimeout(() => {
          manufacturerCardRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
          });
        }, 500);
      }
    }
  }, [searchParams, printers, setSearchParams]);

  // 제조사 목록 로드
  useEffect(() => {
    const loadManufacturers = async () => {
      try {
        const data = await getManufacturers();
        setManufacturers(data);
      } catch (error) {
        console.error('Error loading manufacturers:', error);
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
        console.error('Error loading series:', error);
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
        console.error('Error loading models:', error);
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
        setSelectedModelId(selectedModelData.id); // manufacturing_printers ID 저장
      }
    }
  }, [selectedModel]);

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
          firmware: newPrinter.firmware || "marlin"
        }])
        .select(`
          *,
          group:printer_groups(*)
        `)
        .single();

      if (error) throw error;

      // 타입 변환하여 추가
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
        last_connected: data.last_connected ? new Date(data.last_connected) : undefined
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
      const { error } = await supabase
        .from('printers')
        .delete()
        .eq('id', printerId);

      if (error) throw error;

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
    // 초기 프리필 중에는 의도치 않은 reset을 방지
    isPrefillingRef.current = true;

    // manufacture_id가 있으면 제조사 정보 로드하여 드롭다운 미리 채우기
    if (printer.manufacture_id) {
      try {
        const { data: manufacturingPrinter, error } = await supabase
          .from('manufacturing_printers')
          .select('id, manufacturer, series, model, display_name')
          .eq('id', printer.manufacture_id)
          .single();

        if (error) {
          console.error('Error loading manufacturing printer:', error);
          // 에러 시 초기화
          setSelectedManufacturer("");
          setSelectedSeries("");
          setSelectedModel("");
          setSelectedModelId("");
          isPrefillingRef.current = false;
          return;
        }

        if (manufacturingPrinter) {
          // 1단계: 제조사 설정
          setSelectedManufacturer(manufacturingPrinter.manufacturer);

          // 2단계: 시리즈 목록 로드 후 시리즈 설정
          const seriesData = await getSeriesByManufacturer(manufacturingPrinter.manufacturer);
          setSeriesList(seriesData);
          setSelectedSeries(manufacturingPrinter.series);

          // 3단계: 모델 목록 로드 후 모델 설정
          const modelsData = await getModelsByManufacturerAndSeries(
            manufacturingPrinter.manufacturer,
            manufacturingPrinter.series
          );
          setModelsList(modelsData);
          setSelectedModel(manufacturingPrinter.id);
          setSelectedModelId(manufacturingPrinter.id);
        }
        // 프리필 완료
        isPrefillingRef.current = false;
      } catch (error) {
        console.error('Error in handleEditPrinter:', error);
        // 에러 시 초기화
        setSelectedManufacturer("");
        setSelectedSeries("");
        setSelectedModel("");
        setSelectedModelId("");
        isPrefillingRef.current = false;
      }
    } else {
      // manufacture_id가 없으면 초기화
      setSelectedManufacturer("");
      setSelectedSeries("");
      setSelectedModel("");
      setSelectedModelId("");
      isPrefillingRef.current = false;
    }
  };

  const handleUpdatePrinter = async () => {
    if (!user || !editingPrinter) return;

    try {
      const updateData: any = {
        name: editingPrinter.name,
        model: editingPrinter.model,
        group_id: editingPrinter.group_id || null,
      };

      // selectedModelId가 있으면 manufacture_id도 업데이트
      if (selectedModelId) {
        updateData.manufacture_id = selectedModelId;
      }

      const { error } = await supabase
        .from('printers')
        .update(updateData)
        .eq('id', editingPrinter.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // 로컬 상태 업데이트
      setPrinters(prev => prev.map(p => {
        if (p.id !== editingPrinter.id) return p;
        const nextGroup = editingPrinter.group_id ? groups.find(g => g.id === editingPrinter.group_id) : undefined;
        return { ...editingPrinter, group: nextGroup };
      }));

      setShowEditPrinter(false);
      setEditingPrinter(null);

      // Dashboard의 localStorage 캐시 업데이트 (실시간 반영)
      try {
        const dashboardCacheKey = 'dashboard:printers';
        const cachedData = localStorage.getItem(dashboardCacheKey);
        if (cachedData) {
          const printers = JSON.parse(cachedData);
          const updatedPrinters = printers.map((p: any) => {
            if (p.id === editingPrinter.id) {
              return { ...p, name: updateData.name, model: updateData.model };
            }
            return p;
          });
          localStorage.setItem(dashboardCacheKey, JSON.stringify(updatedPrinters));

          // StorageEvent 발생 (다른 탭에도 전파)
          window.dispatchEvent(new StorageEvent('storage', {
            key: dashboardCacheKey,
            newValue: JSON.stringify(updatedPrinters),
            oldValue: cachedData,
            storageArea: localStorage,
            url: window.location.href
          }));
        }
      } catch (cacheError) {
        console.log('Dashboard cache update failed:', cacheError);
      }

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
        return { ...p, group_id: groupId ?? undefined, group: nextGroup } as any;
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
    <div className="bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 헤더 */}
        <header className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" />
            {t('settings.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('settings.description')}
          </p>
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
                  <DialogTitle>{t('settings.newGroup')}</DialogTitle>
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
                    <Button onClick={handleAddGroup} className="flex-1">
                      {t('settings.add')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddGroup(false)} className="flex-1">
                      {t('settings.cancel')}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {groups.length === 0 ? (
            <Card className="h-[240px]">
              <CardContent className="flex flex-col items-center justify-center h-full">
                <FolderPlus className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-base font-medium mb-1">{t('settings.noGroups')}</h3>
                <p className="text-sm text-muted-foreground text-center">
                  {t('settings.noGroupsDescription')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="h-[240px] overflow-y-auto space-y-2 pr-1">
              {groups.map((group) => (
                <Card key={group.id} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      {/* 색상 표시 */}
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: group.color }}
                      />

                      {/* 그룹 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm truncate">{group.name}</h3>
                          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                            {printers.filter(p => p.group_id === group.id).length}
                          </Badge>
                        </div>
                        {group.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {group.description}
                          </p>
                        )}
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteGroup(group.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {t('settings.addPrinter')}
                </Button>
              </DialogTrigger>
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
                      onValueChange={(value) => setNewPrinter({...newPrinter, firmware: value as any})}
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

          <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
            {printers.map((printer) => {
              const statusInfo = getPrinterStatusForSettings(printer);
              return (
              <Card key={printer.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="space-y-3">
                    {/* 첫 번째 줄: 프린터 이름, 상태, 액션 버튼 */}
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{printer.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">{printer.model}</p>
                      </div>
                      <Badge className={`${statusInfo.badgeClass} text-xs px-1.5 py-0 h-5 flex-shrink-0`}>
                        {statusInfo.label}
                      </Badge>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditPrinter(printer)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePrinter(printer.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* 두 번째 줄: IP 주소와 펌웨어 */}
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="font-mono">{printer.ip_address}:{printer.port}</span>
                      </div>
                      <div className="text-muted-foreground">
                        <span className="capitalize">{printer.firmware}</span>
                      </div>
                    </div>

                    {/* 세 번째 줄: 그룹 선택 */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground flex-shrink-0">{t('settings.group')}:</span>
                      <Select
                        value={printer.group_id || "none"}
                        onValueChange={(val) => handleAssignPrinterGroup(printer.id, val)}
                      >
                        <SelectTrigger className="h-7 text-xs flex-1">
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
                </CardContent>
              </Card>
              );
            })}
          </div>
        </section>

        {/* 프린터 수정 모달 */}
        <Dialog open={showEditPrinter} onOpenChange={setShowEditPrinter}>
          <DialogContent className="sm:max-w-md max-h-[600px]" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">{t('settings.editPrinter')}</DialogTitle>
            </DialogHeader>
            {editingPrinter && (
              <div className="space-y-5 pt-2 overflow-y-auto max-h-[480px]">
                {/* 모니터링 섹션 */}
                <div className="space-y-4 p-4 bg-secondary/30 rounded-lg border border-border/50">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                    {t('settings.monitoring')}
                  </h3>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-name" className="text-xs font-medium text-muted-foreground">
                        {t('settings.printerName')}
                      </Label>
                      <Input
                        id="edit-name"
                        value={editingPrinter.name}
                        onChange={(e) => setEditingPrinter({...editingPrinter, name: e.target.value})}
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="edit-group" className="text-xs font-medium text-muted-foreground">
                        {t('settings.group')}
                      </Label>
                      <Select
                        value={editingPrinter.group_id || "none"}
                        onValueChange={(value) => setEditingPrinter({...editingPrinter, group_id: value === "none" ? undefined : value})}
                      >
                        <SelectTrigger id="edit-group" className="h-10">
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
                </div>

                {/* 제조사 섹션 */}
                <div ref={manufacturerCardRef} className="space-y-4 p-4 bg-secondary/30 rounded-lg border border-border/50">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                    {t('settings.manufacturer')}
                  </h3>

                  <div className="space-y-3">
                    {/* 제조사 선택 */}
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-manufacturer" className="text-xs font-medium text-muted-foreground">
                        {t('settings.selectManufacturer')}
                      </Label>
                      <Select
                        value={selectedManufacturer}
                        onValueChange={setSelectedManufacturer}
                      >
                        <SelectTrigger id="edit-manufacturer" className="h-10">
                          <SelectValue placeholder={t('settings.selectManufacturerPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {manufacturers.map((mfg) => (
                            <SelectItem key={mfg.manufacturer} value={mfg.manufacturer}>
                              {mfg.manufacturer}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 시리즈 선택 */}
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-series" className="text-xs font-medium text-muted-foreground">
                        {t('settings.selectSeries')}
                      </Label>
                      <Select
                        value={selectedSeries}
                        onValueChange={setSelectedSeries}
                        disabled={!selectedManufacturer}
                      >
                        <SelectTrigger id="edit-series" className="h-10">
                          <SelectValue placeholder={t('settings.selectSeriesPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {seriesList.map((series) => (
                            <SelectItem key={series.series} value={series.series}>
                              {series.series}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 모델 선택 */}
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-model-select" className="text-xs font-medium text-muted-foreground">
                        {t('settings.selectModel')}
                      </Label>
                      <Select
                        value={selectedModel}
                        onValueChange={setSelectedModel}
                        disabled={!selectedSeries}
                      >
                        <SelectTrigger id="edit-model-select" className="h-10">
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

                {/* 연결 섹션 */}
                <div className="space-y-4 p-4 bg-secondary/30 rounded-lg border border-border/50">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                    {t('settings.connection')}
                  </h3>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-camera-url" className="text-xs font-medium text-muted-foreground">
                        {t('settings.cameraUrl')}
                      </Label>
                      <Input
                        id="edit-camera-url"
                        placeholder="rtsp://..."
                        disabled
                        className="h-10 opacity-50"
                      />
                      <p className="text-xs text-muted-foreground italic">
                        {t('settings.cameraUrlComingSoon')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="flex gap-3 pt-2 sticky bottom-0 bg-background pb-2">
                  <Button onClick={handleUpdatePrinter} className="flex-1 h-11">
                    {t('settings.apply')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditPrinter(false);
                      setEditingPrinter(null);
                    }}
                    className="flex-1 h-11 bg-background hover:bg-accent"
                  >
                    {t('settings.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Settings;