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
import { useAuth } from "@shared/contexts/AuthContext";
import { supabase } from "@shared/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast";

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
  name?: string;
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

// 구독 플랜
const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "basic",
    name: "Basic",
    price: 0,
    interval: "month",
    max_printers: 2,
    features: [
      "최대 2대 프린터",
      "기본 모니터링",
      "이메일 알림",
      "커뮤니티 지원"
    ],
    current: true
  },
  {
    id: "pro",
    name: "Pro",
    price: 19900,
    interval: "month",
    max_printers: 10,
    features: [
      "최대 10대 프린터",
      "실시간 모니터링",
      "고급 분석",
      "SMS 알림",
      "우선 지원",
      "API 접근"
    ],
    popular: true
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 49900,
    interval: "month",
    max_printers: -1, // 무제한
    features: [
      "무제한 프린터",
      "팀 관리",
      "고급 보안",
      "사용자 정의 대시보드",
      "전용 지원",
      "온프레미스 배포"
    ]
  }
];

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
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
      
      // 그룹 데이터 로드
      const { data: groupsData, error: groupsError } = await supabase
        .from('printer_groups')
        .select('*')
        .order('name');

      if (groupsError) throw groupsError;
      setGroups(groupsData || []);

      // 프린터 데이터 로드
      const { data: printersData, error: printersError } = await supabase
        .from('printers')
        .select(`
          *,
          group:printer_groups(*)
        `)
        .order('model');

      if (printersError) throw printersError;
      
      // 타입 변환 및 안전한 할당
      const formattedPrinters: PrinterConfig[] = (printersData || []).map(printer => ({
        id: printer.id,
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
        title: "오류",
        description: "데이터를 불러오는 중 오류가 발생했습니다.",
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
        title: "성공",
        description: "그룹이 추가되었습니다.",
      });
    } catch (error) {
      console.error('Error adding group:', error);
      toast({
        title: "오류",
        description: "그룹 추가 중 오류가 발생했습니다.",
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
        title: "성공",
        description: "그룹이 삭제되었습니다.",
      });
    } catch (error) {
      console.error('Error deleting group:', error);
      toast({
        title: "오류",
        description: "그룹 삭제 중 오류가 발생했습니다.",
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
        title: "성공",
        description: "프린터가 추가되었습니다.",
      });
    } catch (error) {
      console.error('Error adding printer:', error);
      toast({
        title: "오류",
        description: "프린터 추가 중 오류가 발생했습니다.",
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
        title: "성공",
        description: "프린터가 삭제되었습니다.",
      });
    } catch (error) {
      console.error('Error deleting printer:', error);
      toast({
        title: "오류",
        description: "프린터 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
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
      case "connected": return "연결됨";
      case "disconnected": return "연결끊김";
      case "error": return "오류";
      default: return "알 수 없음";
    }
  };

  const currentPlan = subscriptionPlans.find(plan => plan.current);

  if (!user) {
    return (
      <div className="bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">로그인이 필요합니다</h1>
            <p className="text-muted-foreground mb-6">
              프린터 및 그룹 관리 기능을 사용하려면 로그인해주세요.
            </p>
            <Button asChild>
              <a href="/auth">로그인</a>
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
            <p className="mt-4 text-muted-foreground">데이터를 불러오는 중...</p>
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
            시스템 설정
          </h1>
          <p className="text-muted-foreground">
            프린터 그룹 및 프린터 관리, 구독 플랜을 설정하세요
          </p>
        </header>

        {/* 프린터 그룹 관리 섹션 */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">프린터 그룹 관리</h2>
            <Dialog open={showAddGroup} onOpenChange={setShowAddGroup}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <FolderPlus className="h-4 w-4" />
                  그룹 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>새 프린터 그룹 추가</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-name">그룹 이름</Label>
                    <Input
                      id="group-name"
                      placeholder="예: Creality 프린터, FDM 프린터"
                      value={newGroup.name}
                      onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group-description">설명 (선택사항)</Label>
                    <Textarea
                      id="group-description"
                      placeholder="그룹에 대한 설명을 입력하세요"
                      value={newGroup.description}
                      onChange={(e) => setNewGroup({...newGroup, description: e.target.value})}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>그룹 색상</Label>
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
                      추가
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddGroup(false)} className="flex-1">
                      취소
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
                <h3 className="text-lg font-medium mb-2">프린터 그룹이 없습니다</h3>
                <p className="text-muted-foreground text-center mb-4">
                  프린터를 체계적으로 관리하기 위해 그룹을 만들어보세요.
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
                        <span className="text-muted-foreground">프린터 수:</span>
                        <span className="font-medium">
                          {printers.filter(p => p.group_id === group.id).length}대
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit className="h-3 w-3 mr-1" />
                        수정
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
            <h2 className="text-2xl font-semibold">프린터 관리</h2>
            <Dialog open={showAddPrinter} onOpenChange={setShowAddPrinter}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  프린터 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>새 프린터 추가</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">프린터 이름</Label>
                    <Input
                      id="name"
                      placeholder="예: Ender 3 Pro #1"
                      value={newPrinter.name || ""}
                      onChange={(e) => setNewPrinter({...newPrinter, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">모델명</Label>
                    <Input
                      id="model"
                      placeholder="예: Creality Ender 3 Pro"
                      value={newPrinter.model || ""}
                      onChange={(e) => setNewPrinter({...newPrinter, model: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group">그룹 (선택사항)</Label>
                    <Select
                      value={newPrinter.group_id || "none"}
                      onValueChange={(value) => setNewPrinter({...newPrinter, group_id: value === "none" ? undefined : value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="그룹을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">그룹 없음</SelectItem>
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
                    <Label htmlFor="ip">IP 주소</Label>
                    <Input
                      id="ip"
                      placeholder="예: 192.168.1.100"
                      value={newPrinter.ip_address || ""}
                      onChange={(e) => setNewPrinter({...newPrinter, ip_address: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">포트</Label>
                    <Input
                      id="port"
                      type="number"
                      placeholder="80"
                      value={newPrinter.port || 80}
                      onChange={(e) => setNewPrinter({...newPrinter, port: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firmware">펌웨어</Label>
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
                      추가
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddPrinter(false)} className="flex-1">
                      취소
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
                      <span className="text-muted-foreground">IP 주소:</span>
                      <span className="font-mono">{printer.ip_address}:{printer.port}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">펌웨어:</span>
                      <span className="capitalize">{printer.firmware}</span>
                    </div>
                    {printer.last_connected && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">마지막 연결:</span>
                        <span>{printer.last_connected.toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Edit className="h-3 w-3 mr-1" />
                      수정
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
            <h2 className="text-2xl font-semibold">구독 관리</h2>
            <p className="text-muted-foreground">
              현재 플랜을 확인하고 필요에 따라 업그레이드하세요
            </p>
          </div>

          {/* 현재 구독 정보 */}
          {currentPlan && (
            <Card className="border-primary bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  현재 플랜: {currentPlan.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {currentPlan.price === 0 ? "무료" : `₩${currentPlan.price.toLocaleString()}`}
                  </span>
                  {currentPlan.price > 0 && (
                    <Badge variant="outline">월간 결제</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">포함된 기능:</h4>
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
                    등록된 프린터: {printers.length} / {currentPlan.max_printers === -1 ? "무제한" : currentPlan.max_printers}
                  </span>
                  {currentPlan.price > 0 && (
                    <Button variant="outline" size="sm">
                      구독 관리
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 사용 가능한 플랜 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">사용 가능한 플랜</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {subscriptionPlans.map((plan) => (
                <Card 
                  key={plan.id} 
                  className={`relative ${plan.popular ? "border-primary shadow-lg" : ""} ${plan.current ? "opacity-60" : ""}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">
                        인기 플랜
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <div className="space-y-1">
                      <div className="text-3xl font-bold">
                        {plan.price === 0 ? "무료" : `₩${plan.price.toLocaleString()}`}
                      </div>
                      {plan.price > 0 && (
                        <div className="text-sm text-muted-foreground">월간 결제</div>
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
                        "현재 플랜"
                      ) : plan.price === 0 ? (
                        "무료 시작"
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          상세보기
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