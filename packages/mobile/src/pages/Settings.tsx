import { useState, useEffect } from "react";
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
  Monitor, 
  Wifi, 
  Crown,
  Check,
  Zap,
  Settings as SettingsIcon,
  FolderPlus,
  Palette
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
}

// 구독 플랜 타입
interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: "month" | "year";
  features: string[];
  max_printers: number;
  popular?: boolean;
  current?: boolean;
}

// 미리 정의된 색상 팔레트
const colorPalette = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", 
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6", "#eab308"
];

// 구독 플랜 features keys
const planFeaturesKeys = {
  basic: ["planFeature1", "planFeature2", "planFeature3", "planFeature4"],
  pro: ["planFeature5", "planFeature6", "planFeature7", "planFeature8", "planFeature9", "planFeature10"],
  enterprise: ["planFeature11", "planFeature12", "planFeature13", "planFeature14", "planFeature15", "planFeature16"]
};

// 구독 플랜 (features는 번역 키로 참조)
const getSubscriptionPlans = (t: (key: string) => string): SubscriptionPlan[] => [
  {
    id: "basic",
    name: "Basic",
    price: 0,
    interval: "month",
    max_printers: 2,
    features: planFeaturesKeys.basic.map(key => t(`settings.${key}`)),
    current: true
  },
  {
    id: "pro",
    name: "Pro",
    price: 19900,
    interval: "month",
    max_printers: 10,
    features: planFeaturesKeys.pro.map(key => t(`settings.${key}`)),
    popular: true
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 49900,
    interval: "month",
    max_printers: -1, // 무제한
    features: planFeaturesKeys.enterprise.map(key => t(`settings.${key}`))
  }
];

const Settings = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  // 구독 플랜 (번역 적용)
  const subscriptionPlans = getSubscriptionPlans(t);

  // 상태 관리
  const [groups, setGroups] = useState<PrinterGroup[]>([]);
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 모달 상태
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PrinterGroup | null>(null);
  
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
        last_connected: printer.last_connected ? new Date(printer.last_connected) : undefined
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected": return "bg-success text-success-foreground";
      case "disconnected": return "bg-muted text-muted-foreground";
      case "error": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "connected": return t('settings.statusConnected');
      case "disconnected": return t('settings.statusDisconnected');
      case "error": return t('settings.statusError');
      default: return t('settings.statusUnknown');
    }
  };

  const currentPlan = subscriptionPlans.find(plan => plan.current);

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
              <DialogContent className="sm:max-w-md">
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
                      <Button variant="outline" size="sm" className="flex-1">
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
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {t('settings.addPrinter')}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {printers.map((printer) => (
              <Card key={printer.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{printer.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{printer.model}</p>
                  </div>
                  <Badge className={getStatusColor(printer.status)}>
                    {getStatusLabel(printer.status)}
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
                    <Button variant="outline" size="sm" className="flex-1">
                      <Edit className="h-3 w-3 mr-1" />
                      {t('settings.edit')}
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
            ))}
          </div>
        </section>

        <Separator />

        {/* 구독 관리 섹션 */}
        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">{t('settings.subscriptionManagement')}</h2>
            <p className="text-muted-foreground">
              {t('settings.subscriptionDescription')}
            </p>
          </div>

          {/* 현재 구독 정보 */}
          {currentPlan && (
            <Card className="border-primary bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  {t('settings.currentPlan')} {currentPlan.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {currentPlan.price === 0 ? t('settings.free') : `₩${currentPlan.price.toLocaleString()}`}
                  </span>
                  {currentPlan.price > 0 && (
                    <Badge variant="outline">{t('settings.monthlyPayment')}</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">{t('settings.includedFeatures')}</h4>
                  <ul className="space-y-1">
                    {currentPlan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-success" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-muted-foreground">
                    {t('settings.registeredPrinters')} {printers.length} / {currentPlan.max_printers === -1 ? t('settings.unlimited') : currentPlan.max_printers}
                  </span>
                  {currentPlan.price > 0 && (
                    <Button variant="outline" size="sm">
                      {t('settings.manageSubscription')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 사용 가능한 플랜 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">{t('settings.availablePlans')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {subscriptionPlans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`relative ${plan.popular ? "border-primary shadow-lg" : ""} ${plan.current ? "opacity-60" : ""}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">
                        {t('settings.popularPlan')}
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <div className="space-y-1">
                      <div className="text-3xl font-bold">
                        {plan.price === 0 ? t('settings.free') : `₩${plan.price.toLocaleString()}`}
                      </div>
                      {plan.price > 0 && (
                        <div className="text-sm text-muted-foreground">{t('settings.monthlyPayment')}</div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-success flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={plan.current ? "outline" : "default"}
                      disabled={plan.current}
                      onClick={() => window.location.href = '/subscription'}
                    >
                      {plan.current ? (
                        t('settings.currentPlanButton')
                      ) : plan.price === 0 ? (
                        t('settings.freeStart')
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          {t('settings.viewDetails')}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;