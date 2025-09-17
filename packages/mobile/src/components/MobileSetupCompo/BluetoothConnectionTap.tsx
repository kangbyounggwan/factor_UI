import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bluetooth, BluetoothConnected, Wifi } from 'lucide-react';
import { bluetoothService, RaspberryPiDevice } from '@/lib/bluetoothService';
import { useToast } from '@/hooks/use-toast';

export const BluetoothConnection = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<RaspberryPiDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<RaspberryPiDevice | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  // 이름이 비었거나, 언노운 패턴이면 제외
  const isUnknownName = (name: string) => {
    const n = (name || "").trim().toLowerCase();
    if (!n) return true;
    return n === "unknown" || n === "unnamed" || n === "n/a" || n === "device" || /^unknown/.test(n);
  };

  useEffect(() => {
    initializeBluetooth();
  }, []);

  const initializeBluetooth = async () => {
    try {
      await bluetoothService.initialize();
      // await bluetoothService.requestPermissions();
      setIsInitialized(true);
      toast({
        title: '블루투스 준비 완료',
        description: '블루투스가 성공적으로 초기화되었습니다.',
      });
    } catch (error) {
      toast({
        title: '블루투스 초기화 실패',
        description: '블루투스를 사용할 수 없습니다.',
        variant: 'destructive',
      });
    }
  };

  const startScanning = async () => {
    if (!isInitialized) return;
    
    setIsScanning(true);
    setDevices([]);
    try {
      const lastId = (() => {
        try { return localStorage.getItem('ble:lastDeviceId') || undefined; } catch { return undefined; }
      })();
      await bluetoothService.scanWithReset({
        knownDeviceId: lastId,
        services: [],
        scanWindowMs: 10000,
        onDeviceFound: (device) => {
          const name = (device.name ?? '').trim();
          if (isUnknownName(name)) return; // 이름 없음/언노운 제외
          setDevices(prev => {
            const exists = prev.find(d => d.deviceId === device.deviceId);
            if (!exists) {
              return [...prev, { ...device, name }];
            }
            return prev;
          });
        }
      });
    } catch (error) {
      toast({
        title: '스캔 실패',
        description: '장치 검색 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const connectToDevice = async (device: RaspberryPiDevice) => {
    try {
      const success = await bluetoothService.connectToDevice(device.deviceId, {
        connectMs: 15000,
        servicesMs: 15000,
        settleMs: 500,
      });
      if (success) {
        setConnectedDevice({ ...device, connected: true });
        // 이벤트 기반 자동 진행을 위한 CustomEvent 디스패치
        try {
          window.dispatchEvent(
            new CustomEvent('ble:connected', {
              detail: { deviceId: device.deviceId, name: device.name },
            })
          )
        } catch {}
        toast({
          title: '연결 성공',
          description: `${device.name}에 연결되었습니다.`,
        });
      } else {
        toast({
          title: '연결 실패',
          description: '장치 연결에 실패했습니다.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '연결 오류',
        description: '연결 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const disconnect = async () => {
    try {
      await bluetoothService.disconnect();
      setConnectedDevice(null);
      try {
        window.dispatchEvent(new CustomEvent('ble:disconnected'))
      } catch {}
      toast({
        title: '연결 해제',
        description: '장치 연결이 해제되었습니다.',
      });
    } catch (error) {
      toast({
        title: '연결 해제 실패',
        description: '연결 해제 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bluetooth className="h-5 w-5" />
          블루투스 연결
        </CardTitle>
        <CardDescription className="text-sm">
          라즈베리파이 장치를 검색하고 연결하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        {!isInitialized ? (
          <div className="text-center py-6">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">블루투스 초기화 중...</p>
          </div>
        ) : (
          <>
            {connectedDevice ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 p-4 border rounded-xl bg-primary/10">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <BluetoothConnected className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{connectedDevice.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{connectedDevice.deviceId}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">연결됨</Badge>
                  </div>
                </div>
                <Button onClick={disconnect} variant="outline" className="w-full h-12 text-base">
                  연결 해제
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Button 
                  onClick={startScanning} 
                  disabled={isScanning}
                  className="w-full h-12 text-base"
                >
                  {isScanning && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {isScanning ? '스캔 중...' : '장치 검색'}
                </Button>

                {devices.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">발견된 장치</h4>
                    {devices.map((device) => (
                      <div
                        key={device.deviceId}
                        className="flex items-start gap-3 p-3 border rounded-xl hover:bg-accent/50 transition-colors"
                      >
                        <Wifi className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{device.name}</p>
                          <p className="text-xs text-muted-foreground">
                            신호: {device.rssi}dBm
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {device.deviceId}
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => connectToDevice(device)}
                          className="flex-shrink-0"
                        >
                          연결
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {!isScanning && devices.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      장치를 찾을 수 없습니다.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      장치 검색을 눌러 다시 시도하세요.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};