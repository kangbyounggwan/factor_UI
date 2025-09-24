import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CameraFeed } from "@/components/CameraFeed";
import { PrinterControlPad } from "@/components/PrinterControlPad";
import { useAuth } from "@shared/contexts/AuthContext";
import { supabase } from "@shared/integrations/supabase/client"
import { onDashStatusMessage } from "@shared/services/mqttService";


// 모니터링 데이터 타입 정의
interface MonitoringData {
  printerStatus: {
    state: "idle" | "printing" | "paused" | "error" | "connecting" | "disconnected";
    timestamp: number;
    error_message?: string;
    connected: boolean;
    printing: boolean;
  };
  temperature: {
    tool: { actual: number; target: number; offset?: number };
    bed: { actual: number; target: number; offset?: number };
    chamber?: { actual: number; target: number; offset?: number };
  };
  position: {
    x: number; y: number; z: number; e: number;
  };
  printProgress: {
    completion: number;
    file_position: number;
    file_size: number;
    print_time: number;
    print_time_left: number;
    filament_used: number;
  };
  settings: {
    feedrate: number;
    flowrate: number;
    fan_speed: number;
  };
}

// 샘플 데이터 제거 - 실제 데이터로 대체
const defaultData: MonitoringData = {
  printerStatus: {
    state: "disconnected",
    timestamp: Date.now(),
    connected: false,
    printing: false
  },
  temperature: {
    tool: { actual: 25, target: 0 },
    bed: { actual: 23, target: 0 }
  },
  position: {
    x: 0, y: 0, z: 0, e: 0
  },
  printProgress: {
    completion: 0,
    file_position: 0,
    file_size: 0,
    print_time: 0,
    print_time_left: 0,
    filament_used: 0
  },
  settings: {
    feedrate: 100,
    flowrate: 100,
    fan_speed: 0
  }
};

// IoT 디바이스 타입 정의 (IoTDevicePanel과 호환되도록)
interface PrinterIoTDevice {
  id: string;
  name: string;
  type: "sensor" | "camera" | "controller";
  status: "connected" | "disconnected" | "error";
  lastSeen: string;
  batteryLevel?: number;
  signalStrength: number; // IoTDevicePanel에서 필수 필드
  sensorData?: {
    temperature?: number;
    humidity?: number;
    vibration?: number;
    pressure?: number;
  };
}

// IoT 디바이스 기본 데이터
const defaultIoTDevices: PrinterIoTDevice[] = [];

const PrinterDetail = () => {
  const { id } = useParams();
  const [data, setData] = useState<MonitoringData>(defaultData);
  const [iotDevices, setIoTDevices] = useState<PrinterIoTDevice[]>(defaultIoTDevices);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [deviceUuid, setDeviceUuid] = useState<string | null>(null);

  // 실제 프린터 데이터 로드
  useEffect(() => {
    if (id && user) {
      loadPrinterData();
    }
  }, [id, user]);

  const loadPrinterData = async () => {
    try {
      setLoading(true);
      
      // 프린터 기본 정보 로드
      const { data: printer, error } = await supabase
        .from('printers')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error loading printer:', error);
        return;
      }

      // TODO: 실제 프린터 API에서 실시간 데이터 가져오기
      // 현재는 기본값으로 설정
      setData({
        ...defaultData,
        printerStatus: {
          state: printer.status as any,
          timestamp: Date.now(),
          connected: printer.status !== 'disconnected',
          printing: printer.status === 'printing'
        }
      });

      // 실시간 MQTT 반영을 위한 device_uuid 저장
      setDeviceUuid((printer as any)?.device_uuid ?? null);

    } catch (error) {
      console.error('Error loading printer data:', error);
    } finally {
      setLoading(false);
    }
  };

  // MQTT dash_status 수신 → 데이터 반영 (UI는 그대로)
  useEffect(() => {
    if (!deviceUuid) return;
    const off = onDashStatusMessage((uuid, payload) => {
      if (uuid !== deviceUuid) return;
      setData((prev) => {
        const bed = payload?.temperature_info?.bed;
        const toolAny = payload?.temperature_info?.tool;
        const tool = toolAny?.tool0 ?? toolAny;
        return {
          ...prev,
          printerStatus: {
            state: (payload?.printer_status?.state ?? prev.printerStatus.state) as any,
            timestamp: Date.now(),
            connected: payload?.connected ?? prev.printerStatus.connected,
            printing: payload?.printer_status?.printing ?? prev.printerStatus.printing,
            error_message: payload?.printer_status?.error_message ?? prev.printerStatus.error_message,
          },
          temperature: {
            tool: {
              actual: typeof tool?.actual === 'number' ? tool.actual : prev.temperature.tool.actual,
              target: typeof tool?.target === 'number' ? tool.target : prev.temperature.tool.target,
              offset: typeof tool?.offset === 'number' ? tool.offset : prev.temperature.tool.offset,
            },
            bed: {
              actual: typeof bed?.actual === 'number' ? bed.actual : prev.temperature.bed.actual,
              target: typeof bed?.target === 'number' ? bed.target : prev.temperature.bed.target,
              offset: typeof bed?.offset === 'number' ? bed.offset : prev.temperature.bed.offset,
            },
            chamber: prev.temperature.chamber,
          },
          position: {
            x: payload?.position?.x ?? prev.position.x,
            y: payload?.position?.y ?? prev.position.y,
            z: payload?.position?.z ?? prev.position.z,
            e: payload?.position?.e ?? prev.position.e,
          },
          printProgress: {
            completion: typeof payload?.progress?.completion === 'number' ? payload.progress.completion : prev.printProgress.completion,
            file_position: payload?.progress?.file_position ?? prev.printProgress.file_position,
            file_size: payload?.progress?.file_size ?? prev.printProgress.file_size,
            print_time: payload?.progress?.print_time ?? prev.printProgress.print_time,
            print_time_left: payload?.progress?.print_time_left ?? prev.printProgress.print_time_left,
            filament_used: payload?.progress?.filament_used ?? prev.printProgress.filament_used,
          },
          settings: {
            feedrate: payload?.settings?.feedrate ?? prev.settings.feedrate,
            flowrate: payload?.settings?.flowrate ?? prev.settings.flowrate,
            fan_speed: payload?.settings?.fan_speed ?? prev.settings.fan_speed,
          },
        };
      });
    });
    return () => { off(); };
  }, [deviceUuid]);

  const completionPercent = Math.min(
    100,
    Math.max(
      0,
      Math.round(((data.printProgress?.completion ?? 0) <= 1
        ? (data.printProgress?.completion ?? 0) * 100
        : (data.printProgress?.completion ?? 0)))
    )
  );

  return (
    <div className="bg-background p-3 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* 뒤로가기 버튼 */}
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              전체 현황으로 돌아가기
            </Link>
          </Button>
          <div className="text-sm text-muted-foreground">
            진행률: <span className="font-medium text-primary">{completionPercent}%</span> / 100%
          </div>
        </div>
        {/* 상단: 카메라 피드 + 제어 패드 (카드 자체 높이에 위임) */}
        <div className="grid grid-cols-1 gap-2 pb-8">
          <div className="min-h-[320px]">
            <CameraFeed cameraId={deviceUuid || 'unknown'} isConnected={data.printerStatus.connected} resolution="1280x720" />
          </div>
          <div>
            <PrinterControlPad
              isConnected={data.printerStatus.connected}
              isPrinting={data.printerStatus.printing}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrinterDetail;