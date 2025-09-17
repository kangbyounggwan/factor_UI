// 네트워크 탭 UI
import { useState, useEffect, useRef } from 'react';
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wifi, Cable, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { networkConfigService, WiFiNetwork } from '@/lib/networkConfigService';
import { bluetoothService } from '@/lib/bluetoothService';
import { useToast } from '@/hooks/use-toast';

export const NetworkConfiguration = () => {
  const [wifiNetworks, setWifiNetworks] = useState<WiFiNetwork[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<any>(null);
  
  // WiFi Static IP Settings
  const [wifiUseDHCP, setWifiUseDHCP] = useState(true);
  const [wifiStaticIP, setWifiStaticIP] = useState('');
  const [wifiGateway, setWifiGateway] = useState('');
  const [wifiDNS, setWifiDNS] = useState('');
  
  // Ethernet Static IP Settings
  const [ethernetUseDHCP, setEthernetUseDHCP] = useState(true);
  const [ethernetStaticIP, setEthernetStaticIP] = useState('');
  const [ethernetGateway, setEthernetGateway] = useState('');
  const [ethernetDNS, setEthernetDNS] = useState('');
  
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);

  // 키보드가 올라와도 레이아웃이 밀리지 않도록 리사이즈 모드 고정
  useEffect(() => {
    try {
      if (Capacitor.getPlatform() !== 'web') {
        (Keyboard as any).setResizeMode?.({ mode: 'none' });
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadNetworkStatus();
  }, []);

  const loadNetworkStatus = async () => {
    try {
      const status = await networkConfigService.getNetworkStatus();
      setNetworkStatus(status);
    } catch (error) {
      console.error('네트워크 상태 로드 실패:', error);
    }
  };

  const scanWiFiNetworks = async () => {
    setIsScanning(true);
    try {
      // 라즈베리파이에게 블루투스로 WiFi 스캔 요청
      const networks = await networkConfigService.scanWiFiNetworks();
      
      setWifiNetworks(networks);
      toast({
        title: 'WiFi 스캔 완료',
        description: `${networks.length}개의 네트워크를 찾았습니다.`,
      });
    } catch (error) {
      toast({
        title: 'WiFi 스캔 실패',
        description: '네트워크 스캔 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleWiFiConnect = async () => {
    if (!selectedNetwork || !wifiPassword) {
      toast({ title: '입력 오류', description: '네트워크와 비밀번호를 모두 입력해주세요.', variant: 'destructive' });
      return;
    }
    // 간단 검증: 스캔 목록에 존재하는 SSID인지, WPA2 기준 8자 이상
    const exists = wifiNetworks.some(n => n.ssid === selectedNetwork);
    if (!exists) {
      toast({ title: 'SSID 확인', description: '스캔 목록에 존재하지 않는 SSID입니다.', variant: 'destructive' });
      return;
    }
    if (wifiPassword.length < 8) {
      toast({ title: '비밀번호 확인', description: '비밀번호는 8자 이상이어야 합니다.', variant: 'destructive' });
      return;
    }

    try {
      if (!bluetoothService.isConnected()) {
        toast({ title: '블루투스 미연결', description: 'BLE 장치와 먼저 연결해주세요.', variant: 'destructive' });
        return;
      }
      
      setIsConnecting(true);
      // networkConfigService를 통해 WiFi 연결 요청
      const success = await networkConfigService.connectToWiFi(selectedNetwork, wifiPassword);
      
      // 응답 로깅 추가
      console.log('[WiFi Register Response]', JSON.stringify({ ssid: selectedNetwork, success }));

      if (success) {
        try { window.dispatchEvent(new CustomEvent('network:applied', { detail: { ssid: selectedNetwork } })); } catch {}
        toast({ title: 'Wi‑Fi 연결 완료', description: `${selectedNetwork} 연결을 완료했습니다.` });
        setWifiPassword('');
        // 연결 완료 후 네트워크 상태 업데이트 및 스크롤 맨 위로
        setTimeout(() => { 
          loadNetworkStatus(); 
          // 스크롤을 맨 위로 올리기
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 1000);
      } else {
        toast({ title: '연결 실패', description: '비밀번호 또는 설정을 확인해주세요.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: '전송 실패', description: '블루투스 전송에 실패했습니다.', variant: 'destructive' });
    } finally {
      setIsConnecting(false);
    }
  };

  const applyWiFiIPSettings = async () => {
    try {
      if (wifiUseDHCP) {
        const success = await networkConfigService.enableDHCP('wifi');
        if (success) {
          toast({
            title: 'WiFi DHCP 설정 완료',
            description: 'DHCP가 활성화되었습니다.',
          });
        }
      } else {
        if (!wifiStaticIP || !wifiGateway || !wifiDNS) {
          toast({
            title: '입력 오류',
            description: '모든 필드를 입력해주세요.',
            variant: 'destructive',
          });
          return;
        }

        const success = await networkConfigService.setStaticIP({
          networkInterface: 'wifi',
          ip: wifiStaticIP,
          gateway: wifiGateway,
          dns: wifiDNS,
        });

        if (success) {
          try {
            window.dispatchEvent(new CustomEvent('network:applied', { detail: { type: 'wifi' } }))
          } catch {}
          toast({
            title: 'WiFi 고정 IP 설정 완료',
            description: '고정 IP가 설정되었습니다.',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'WiFi 설정 실패',
        description: 'IP 설정 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const applyEthernetIPSettings = async () => {
    try {
      if (ethernetUseDHCP) {
        const success = await networkConfigService.enableDHCP('ethernet');
        if (success) {
          toast({
            title: '이더넷 DHCP 설정 완료',
            description: 'DHCP가 활성화되었습니다.',
          });
        }
      } else {
        if (!ethernetStaticIP || !ethernetGateway || !ethernetDNS) {
          toast({
            title: '입력 오류',
            description: '모든 필드를 입력해주세요.',
            variant: 'destructive',
          });
          return;
        }

        const success = await networkConfigService.setStaticIP({
          networkInterface: 'ethernet',
          ip: ethernetStaticIP,
          gateway: ethernetGateway,
          dns: ethernetDNS,
        });

        if (success) {
          try {
            window.dispatchEvent(new CustomEvent('network:applied', { detail: { type: 'ethernet' } }))
          } catch {}
          toast({
            title: '이더넷 고정 IP 설정 완료',
            description: '고정 IP가 설정되었습니다.',
          });
        }
      }
    } catch (error) {
      toast({
        title: '이더넷 설정 실패',
        description: 'IP 설정 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const restartNetworking = async () => {
    try {
      const success = await networkConfigService.restartNetworking();
      if (success) {
        toast({
          title: '네트워킹 재시작 완료',
          description: '네트워크 설정이 적용되었습니다.',
        });
        setTimeout(() => loadNetworkStatus(), 3000);
      }
    } catch (error) {
      toast({
        title: '네트워킹 재시작 실패',
        description: '재시작 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">네트워크 설정</CardTitle>
        <CardDescription className="text-sm">
          WiFi 연결 및 이더넷 설정을 관리하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {networkStatus && (() => {
          const wifi = (networkStatus?.wifi ?? {}) as any;
          const eth = (networkStatus?.ethernet ?? networkStatus?.lan ?? networkStatus?.eth ?? {}) as any;
          const wifiConnected = Boolean(wifi?.connected);
          const ethConnected = Boolean(eth?.connected);

          return (
            <div className="mb-4 grid gap-3">
              <div className="rounded-md border p-3 cursor-pointer hover:bg-accent/40" onClick={() => { setActiveTab('wifi'); setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className={`h-2.5 w-2.5 rounded-full ${wifiConnected ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                  <span>Wi‑Fi {wifiConnected ? '연결됨' : '연결 안됨'}</span>
                </div>
                <div className="mt-2 text-sm space-y-1">
                  <div>SSID : {wifi?.ssid ?? '-'}</div>
                  <div>IP : {wifi?.ip ?? '-'}</div>
                  <div>GW : {wifi?.gateway ?? '-'}</div>
                </div>
              </div>

              <div className="rounded-md border p-3 cursor-pointer hover:bg-accent/40" onClick={() => { setActiveTab('ethernet'); setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className={`h-2.5 w-2.5 rounded-full ${ethConnected ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                  <span>이더넷 {ethConnected ? '연결됨' : '연결 안됨'}</span>
                </div>
                <div className="mt-2 text-sm space-y-1">
                  <div>SSID : -</div>
                  <div>IP : {eth?.ip ?? '-'}</div>
                  <div>GW : {eth?.gateway ?? '-'}</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 사용 가능한 네트워크 섹션 제거됨 */}

        <div ref={tabsRef} />
        <Tabs value={activeTab ?? undefined} onValueChange={setActiveTab as any} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="wifi" className="flex items-center gap-2 text-sm">
              <Wifi className="h-4 w-4" />
              <span>WiFi</span>
            </TabsTrigger>
            <TabsTrigger value="ethernet" className="flex items-center gap-2 text-sm">
              <Cable className="h-4 w-4" />
              <span>이더넷</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wifi" className={`space-y-4 ${activeTab === 'wifi' ? '' : 'hidden'}`}>
            <div className="space-y-4">
              <Button 
                onClick={scanWiFiNetworks} 
                disabled={isScanning}
                className="w-full h-12 text-base"
              >
                {isScanning && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                WiFi 네트워크 스캔
              </Button>

              {wifiNetworks.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">네트워크 선택</Label>
                  {wifiNetworks.map((network) => (
                    <div
                      key={network.ssid}
                      className={`p-4 border rounded-xl transition-colors ${
                        selectedNetwork === network.ssid
                          ? 'border-primary bg-primary/10'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <div
                        className="flex items-start justify-between cursor-pointer"
                        onClick={() => {
                          if (selectedNetwork === network.ssid) {
                            setSelectedNetwork('');
                            setWifiPassword('');
                          } else {
                            setSelectedNetwork(network.ssid);
                            setWifiPassword('');
                          }
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{network.ssid}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {network.security} • 신호: {network.signal}%
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          {isConnecting && selectedNetwork === network.ssid && (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          )}
                          {network.connected && (
                            <Badge variant="default" className="text-xs">연결됨</Badge>
                          )}
                        </div>
                      </div>

                      {selectedNetwork === network.ssid && (
                        <div className="mt-4 space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor={`wifi-password-${network.ssid}`} className="text-sm font-medium">비밀번호</Label>
                            <div className="relative">
                              <Input
                                id={`wifi-password-${network.ssid}`}
                                type={showPassword ? 'text' : 'password'}
                                value={wifiPassword}
                                onChange={(e) => setWifiPassword(e.target.value)}
                                placeholder="WiFi 비밀번호 입력"
                                className="h-12 text-base pr-12"
                                autoComplete="off"
                                autoCorrect={false as any}
                                inputMode="text"
                                autoFocus
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                                onClick={(e) => { e.stopPropagation(); setShowPassword(!showPassword); }}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                          <Button 
                            onClick={(e) => { e.stopPropagation(); handleWiFiConnect(); }} 
                            disabled={isConnecting}
                            className="w-full h-10 text-sm"
                          >
                            {isConnecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            연결
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-6 space-y-4">
                <h4 className="font-medium text-sm">WiFi IP 설정</h4>
                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="wifi-dhcp" className="text-sm">DHCP 사용</Label>
                  <Switch
                    id="wifi-dhcp"
                    checked={wifiUseDHCP}
                    onCheckedChange={setWifiUseDHCP}
                  />
                </div>
                
                {!wifiUseDHCP && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="wifi-static-ip" className="text-sm">고정 IP</Label>
                      <Input
                        id="wifi-static-ip"
                        value={wifiStaticIP}
                        onChange={(e) => setWifiStaticIP(e.target.value)}
                        placeholder="예: 192.168.1.100"
                        className="h-12 text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wifi-gateway" className="text-sm">게이트웨이</Label>
                      <Input
                        id="wifi-gateway"
                        value={wifiGateway}
                        onChange={(e) => setWifiGateway(e.target.value)}
                        placeholder="예: 192.168.1.1"
                        className="h-12 text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wifi-dns" className="text-sm">DNS</Label>
                      <Input
                        id="wifi-dns"
                        value={wifiDNS}
                        onChange={(e) => setWifiDNS(e.target.value)}
                        placeholder="예: 8.8.8.8"
                        className="h-12 text-base"
                      />
                    </div>
                  </div>
                )}
                
                <Button onClick={applyWiFiIPSettings} variant="outline" className="w-full h-12 text-base">
                  WiFi IP 설정 적용
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ethernet" className={`space-y-4 ${activeTab === 'ethernet' ? '' : 'hidden'}`}>
            <div className="space-y-4">
              <h4 className="font-medium text-sm">이더넷 IP 설정</h4>
              <div className="flex items-center justify-between py-2">
                <Label htmlFor="ethernet-dhcp" className="text-sm">DHCP 사용</Label>
                <Switch
                  id="ethernet-dhcp"
                  checked={ethernetUseDHCP}
                  onCheckedChange={setEthernetUseDHCP}
                />
              </div>
              
              {!ethernetUseDHCP && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ethernet-static-ip" className="text-sm">고정 IP</Label>
                    <Input
                      id="ethernet-static-ip"
                      value={ethernetStaticIP}
                      onChange={(e) => setEthernetStaticIP(e.target.value)}
                      placeholder="예: 192.168.1.100"
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ethernet-gateway" className="text-sm">게이트웨이</Label>
                    <Input
                      id="ethernet-gateway"
                      value={ethernetGateway}
                      onChange={(e) => setEthernetGateway(e.target.value)}
                      placeholder="예: 192.168.1.1"
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ethernet-dns" className="text-sm">DNS</Label>
                    <Input
                      id="ethernet-dns"
                      value={ethernetDNS}
                      onChange={(e) => setEthernetDNS(e.target.value)}
                      placeholder="예: 8.8.8.8"
                      className="h-12 text-base"
                    />
                  </div>
                </div>
              )}
              
              <Button onClick={applyEthernetIPSettings} variant="outline" className="w-full h-12 text-base">
                이더넷 IP 설정 적용
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="border-t pt-6 mt-6">
          <Button 
            onClick={restartNetworking}
            variant="outline" 
            className="w-full h-12 flex items-center gap-2 text-base"
          >
            <RefreshCw className="h-4 w-4" />
            네트워킹 재시작
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};