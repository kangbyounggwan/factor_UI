import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveRegistration } from "@shared/services/supabaseService/equipment"; 
import { useAuth } from "@shared/contexts/AuthContext";
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Settings, Download, Upload, RotateCcw, Save, Printer, Camera, Monitor, RefreshCw, Loader2 } from 'lucide-react';
import { configService, SystemConfig } from '@/lib/configService';
import { equipmentService, EquipmentInfo } from '@/lib/equipmentService';
import { useToast } from '@/hooks/use-toast';

export const ConfigurationManager = () => {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [equipmentInfo, setEquipmentInfo] = useState<EquipmentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEquipment, setIsLoadingEquipment] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadConfiguration();
    loadEquipmentInfo();
  }, []);

  const loadConfiguration = async () => {
    setIsLoading(true);
    try {
      let loadedConfig = await configService.loadConfig();
      if (!loadedConfig) {
        loadedConfig = await configService.getDefaultConfig();
      }
      setConfig(loadedConfig);
    } catch (error) {
      toast({
        title: '설정 로드 실패',
        description: '설정을 불러오는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadEquipmentInfo = async () => {
    setIsLoadingEquipment(true);
    try {
      const info = await equipmentService.getEquipmentInfo();
      console.log('[MobileSetup/ConfigurationTap] loadEquipmentInfo\n' + JSON.stringify(info, null, 2));
      setEquipmentInfo(info);
    } catch (error) {
      console.error('설비정보 로드 실패:', error);
      toast({
        title: '설비정보 로드 실패',
        description: '설비정보를 불러오는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingEquipment(false);
    }
  };

  // 설비 정보에서 필요한 키만 추출해 콘솔로 확인

  const saveConfiguration = async () => {
    if (!config) return;
  
    setIsSaving(true);
    try {
      if (!user?.id) {
        toast({ title: "로그인이 필요합니다", description: "먼저 로그인해주세요.", variant: "destructive" });
        return;
      }
      if (!equipmentInfo) {
        toast({ title: "설비정보 없음", description: "설비정보를 먼저 불러와 주세요.", variant: "destructive" });
        return;
      }
  
      // payload 구성
      const eq: any = equipmentInfo.equipment ?? {};
      const softwareUUID = eq?.software?.uuid ?? eq?.software?.UUID ?? null;
      const payload = {
        client:  { uuid: softwareUUID },
        printer: { 
          model:    eq?.printer?.model ?? null,
          firmware: eq?.printer?.firmware ?? null,
          uuid:     eq?.printer?.uuid ?? eq?.printer?.UUID ?? null
        },
        camera:  { 
          uuid:       eq?.camera?.uuid ?? eq?.camera?.UUID ?? null,
          resolution: eq?.camera?.resolution ?? null
        },
        software: {
          firmware_version: eq?.software?.firmware_version ?? null,
          firmware:         eq?.software?.firmware ?? null,
          last_update:      eq?.software?.last_update ?? null,
          uuid:             softwareUUID,
        },
      };
      
      // 소프트웨어 UUID 없으면 막기
      if (!payload.client.uuid) {
        toast({ title: "클라이언트 식별자 없음", description: "소프트웨어 UUID를 확인할 수 없습니다. 장치를 다시 연결해주세요.", variant: "destructive" });
        return;
      }
  
      await saveRegistration(payload, user.id);
  
      // 로그 & 토스트
      console.log("[MobileSetup/ConfigurationTap] saved\n" + JSON.stringify(payload, null, 2));
      toast({ title: "설정 저장 완료", description: "등록 정보가 저장되었습니다." });
    } catch (error: any) {
      console.error(error);
      toast({
        title: "설정 저장 실패",
        description: String(error?.message ?? error),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const exportConfiguration = async () => {
    try {
      const configJson = await configService.exportConfig();
      if (configJson) {
        const blob = new Blob([configJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'printer_config.json';
        a.click();
        URL.revokeObjectURL(url);
        
        toast({
          title: '설정 내보내기 완료',
          description: '설정 파일이 다운로드되었습니다.',
        });
      }
    } catch (error) {
      toast({
        title: '설정 내보내기 실패',
        description: '설정 내보내기 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const importConfiguration = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const configJson = e.target?.result as string;
        const success = await configService.importConfig(configJson);
        if (success) {
          await loadConfiguration();
          toast({
            title: '설정 가져오기 완료',
            description: '설정이 성공적으로 가져와졌습니다.',
          });
        }
      } catch (error) {
        toast({
          title: '설정 가져오기 실패',
          description: '잘못된 설정 파일입니다.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
  };

  const updateConfig = (path: string, value: any) => {
    if (!config) return;
    
    const keys = path.split('.');
    const newConfig = { ...config };
    let current: any = newConfig;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...current[keys[i]] };
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setConfig(newConfig);
  };

  if (isLoading || !config) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground">설정을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5" />
          시스템 설정
        </CardTitle>
        <CardDescription className="text-sm">
          프린터 및 시스템 설정을 관리하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">

        <Tabs defaultValue="equipment" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-10 text-xs overflow-x-auto">
            <TabsTrigger value="equipment" className="text-xs px-2">설비정보</TabsTrigger>
            <TabsTrigger value="network" className="text-xs px-2">네트워크</TabsTrigger>
            <TabsTrigger value="printer" className="text-xs px-2">프린터</TabsTrigger>
            <TabsTrigger value="camera" className="text-xs px-2">카메라</TabsTrigger>
          </TabsList>

          <TabsContent value="equipment" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">설비 정보</h3>
                <Button 
                  onClick={loadEquipmentInfo} 
                  disabled={isLoadingEquipment}
                  variant="outline" 
                  size="sm"
                  className="h-8"
                >
                  {isLoadingEquipment ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  새로고침
                </Button>
              </div>

              {isLoadingEquipment ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <p className="text-sm text-muted-foreground">설비정보를 불러오는 중...</p>
                </div>
              ) : equipmentInfo ? (
                <div className="space-y-4">
                  {/* 프린터 섹션 */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Printer className="h-4 w-4" />
                        프린터
                        <span className={`h-2 w-2 rounded-full ${
                          equipmentInfo.equipment.printer.status ? 'bg-green-500' : 'bg-gray-500'
                        }`}></span>
                        <span className="text-xs text-muted-foreground">
                          {equipmentInfo.equipment.printer.status ? '연결완료' : '연결없음'}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">모델</Label>
                          <p className="text-sm font-medium">
                            {equipmentInfo.equipment.printer.status ? equipmentInfo.equipment.printer.model : '-'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">펌웨어</Label>
                          <p className="text-sm font-medium">
                            {equipmentInfo.equipment.printer.status ? equipmentInfo.equipment.printer.firmware : '-'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">시리얼 포트</Label>
                          <p className="text-sm font-medium">
                            {equipmentInfo.equipment.printer.status ? equipmentInfo.equipment.printer.serial_port : '-'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">전송 속도</Label>
                          <p className="text-sm font-medium">
                            {equipmentInfo.equipment.printer.status ? `${equipmentInfo.equipment.printer.baud_rate}` : '-'}
                          </p>
                        </div>
                      </div>
                      {!equipmentInfo.equipment.printer.status && equipmentInfo.equipment.printer.message && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                          <p className="text-xs text-red-600">{equipmentInfo.equipment.printer.message}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* 카메라 섹션 */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Camera className="h-4 w-4" />
                        카메라
                        <span className={`h-2 w-2 rounded-full ${
                          equipmentInfo.equipment.camera.status ? 'bg-green-500' : 'bg-gray-500'
                        }`}></span>
                        <span className="text-xs text-muted-foreground">
                          {equipmentInfo.equipment.camera.status ? '연결완료' : '연결없음'}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">모델</Label>
                          <p className="text-sm font-medium">
                            {equipmentInfo.equipment.camera.status ? equipmentInfo.equipment.camera.model : '-'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">해상도</Label>
                          <p className="text-sm font-medium">
                            {equipmentInfo.equipment.camera.status ? equipmentInfo.equipment.camera.resolution : '-'}
                          </p>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">프레임율</Label>
                          <p className="text-sm font-medium">
                            {equipmentInfo.equipment.camera.status ? `${equipmentInfo.equipment.camera.fps} FPS` : '-'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">스트림 URL</Label>
                          <p className="text-sm font-medium break-all">
                            {equipmentInfo.equipment.camera.status ? equipmentInfo.equipment.camera.stream_url : '-'}
                          </p>
                        </div>
                      </div>
                      {!equipmentInfo.equipment.camera.status && equipmentInfo.equipment.camera.message && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                          <p className="text-xs text-red-600">{equipmentInfo.equipment.camera.message}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* 펌웨어 섹션 */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Monitor className="h-4 w-4" />
                        펌웨어
                        <span className="h-2 w-2 rounded-full bg-green-500"></span>
                        <span className="text-xs text-muted-foreground">연결완료</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">펌웨어 버전</Label>
                          <p className="text-sm font-medium">{equipmentInfo.equipment.software.firmware_version}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">API 버전</Label>
                          <p className="text-sm font-medium">{equipmentInfo.equipment.software.api_version}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">플랫폼</Label>
                          <p className="text-sm font-medium">{equipmentInfo.equipment.software.system?.platform || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Python 버전</Label>
                          <p className="text-sm font-medium">{equipmentInfo.equipment.software.system?.python_version || '-'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">마지막 업데이트</Label>
                          <p className="text-sm font-medium">
                            {new Date(equipmentInfo.equipment.software.last_update).toLocaleString('ko-KR')}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">가동 시간</Label>
                          <p className="text-sm font-medium">
                            {equipmentInfo.equipment.software.system?.uptime ? 
                              `${Math.floor(equipmentInfo.equipment.software.system.uptime / 3600)}시간 ${Math.floor((equipmentInfo.equipment.software.system.uptime % 3600) / 60)}분` : 
                              '-'
                            }
                          </p>
                        </div>
                      </div>
                      {equipmentInfo.equipment.software.update_available && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-xs text-blue-600">업데이트가 사용 가능합니다.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <p className="text-sm text-muted-foreground">설비정보를 불러올 수 없습니다.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="network" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="hostname" className="text-sm font-medium">호스트명</Label>
                <Input
                  id="hostname"
                  value={config.network.hostname}
                  onChange={(e) => updateConfig('network.hostname', e.target.value)}
                  placeholder="프린터 호스트명"
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="wifi-country" className="text-sm font-medium">WiFi 국가 코드</Label>
                <Select
                  value={config.network.wifi_country}
                  onValueChange={(value) => updateConfig('network.wifi_country', value)}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KR">대한민국 (KR)</SelectItem>
                    <SelectItem value="US">미국 (US)</SelectItem>
                    <SelectItem value="JP">일본 (JP)</SelectItem>
                    <SelectItem value="CN">중국 (CN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="printer" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="printer-name" className="text-sm font-medium">프린터 이름</Label>
                <Input
                  id="printer-name"
                  value={config.printer.name}
                  onChange={(e) => updateConfig('printer.name', e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="printer-type" className="text-sm font-medium">프린터 타입</Label>
                <Input
                  id="printer-type"
                  value={config.printer.type}
                  onChange={(e) => updateConfig('printer.type', e.target.value)}
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="printer-port" className="text-sm font-medium">시리얼 포트</Label>
                <Select
                  value={config.printer.port}
                  onValueChange={(value) => updateConfig('printer.port', value)}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="/dev/ttyUSB0">/dev/ttyUSB0</SelectItem>
                    <SelectItem value="/dev/ttyACM0">/dev/ttyACM0</SelectItem>
                    <SelectItem value="/dev/ttyS0">/dev/ttyS0</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="baudrate" className="text-sm font-medium">전송 속도</Label>
                <Select
                  value={config.printer.baudrate.toString()}
                  onValueChange={(value) => updateConfig('printer.baudrate', parseInt(value))}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="115200">115200</SelectItem>
                    <SelectItem value="250000">250000</SelectItem>
                    <SelectItem value="9600">9600</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />
              
              <div>
                <h4 className="font-medium mb-4 text-sm">프린터 크기</h4>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="dim-x" className="text-sm">X축 (mm)</Label>
                    <Input
                      id="dim-x"
                      type="number"
                      value={config.printer.dimensions.x}
                      onChange={(e) => updateConfig('printer.dimensions.x', parseInt(e.target.value))}
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dim-y" className="text-sm">Y축 (mm)</Label>
                    <Input
                      id="dim-y"
                      type="number"
                      value={config.printer.dimensions.y}
                      onChange={(e) => updateConfig('printer.dimensions.y', parseInt(e.target.value))}
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dim-z" className="text-sm">Z축 (mm)</Label>
                    <Input
                      id="dim-z"
                      type="number"
                      value={config.printer.dimensions.z}
                      onChange={(e) => updateConfig('printer.dimensions.z', parseInt(e.target.value))}
                      className="h-12 text-base"
                    />
                  </div>
                </div>
              </div>

              <Separator />
              
              <div>
                <h4 className="font-medium mb-4 text-sm">익스트루더 설정</h4>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="extruder-count" className="text-sm">익스트루더 개수</Label>
                    <Input
                      id="extruder-count"
                      type="number"
                      value={config.printer.extruder.count}
                      onChange={(e) => updateConfig('printer.extruder.count', parseInt(e.target.value))}
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hotend-temp" className="text-sm">핫엔드 최대 온도</Label>
                    <Input
                      id="hotend-temp"
                      type="number"
                      value={config.printer.extruder.hotend_temp_max}
                      onChange={(e) => updateConfig('printer.extruder.hotend_temp_max', parseInt(e.target.value))}
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bed-temp" className="text-sm">베드 최대 온도</Label>
                    <Input
                      id="bed-temp"
                      type="number"
                      value={config.printer.extruder.bed_temp_max}
                      onChange={(e) => updateConfig('printer.extruder.bed_temp_max', parseInt(e.target.value))}
                      className="h-12 text-base"
                    />
                  </div>
                </div>
              </div>

              <Separator />
              
              <div>
                <h4 className="font-medium mb-4 text-sm">기능 설정</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <Label htmlFor="auto-leveling" className="text-sm">자동 레벨링</Label>
                    <Switch
                      id="auto-leveling"
                      checked={config.printer.features.auto_leveling}
                      onCheckedChange={(checked) => updateConfig('printer.features.auto_leveling', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <Label htmlFor="filament-sensor" className="text-sm">필라멘트 센서</Label>
                    <Switch
                      id="filament-sensor"
                      checked={config.printer.features.filament_sensor}
                      onCheckedChange={(checked) => updateConfig('printer.features.filament_sensor', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <Label htmlFor="power-recovery" className="text-sm">정전 복구</Label>
                    <Switch
                      id="power-recovery"
                      checked={config.printer.features.power_recovery}
                      onCheckedChange={(checked) => updateConfig('printer.features.power_recovery', checked)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="camera" className="space-y-4 pt-4">
            <div className="flex items-center justify-between py-3">
              <Label htmlFor="camera-enabled" className="text-sm font-medium">카메라 활성화</Label>
              <Switch
                id="camera-enabled"
                checked={config.camera.enabled}
                onCheckedChange={(checked) => updateConfig('camera.enabled', checked)}
              />
            </div>
            
            {config.camera.enabled && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="camera-resolution" className="text-sm font-medium">해상도</Label>
                  <Select
                    value={config.camera.resolution}
                    onValueChange={(value) => updateConfig('camera.resolution', value)}
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="640x480">640x480</SelectItem>
                      <SelectItem value="1280x720">1280x720</SelectItem>
                      <SelectItem value="1920x1080">1920x1080</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="camera-fps" className="text-sm font-medium">프레임율 (FPS)</Label>
                  <Input
                    id="camera-fps"
                    type="number"
                    value={config.camera.framerate}
                    onChange={(e) => updateConfig('camera.framerate', parseInt(e.target.value))}
                    className="h-12 text-base"
                  />
                </div>
              </div>
            )}
          </TabsContent>

         </Tabs>
         
         <div className="mt-6 pt-4 border-t">
           <Button onClick={saveConfiguration} disabled={isSaving} className="w-full h-12 text-base">
             <Save className="h-4 w-4 mr-2" />
             {isSaving ? '저장 중...' : '설정 저장'}
           </Button>
         </div>
       </CardContent>
     </Card>
   );
};