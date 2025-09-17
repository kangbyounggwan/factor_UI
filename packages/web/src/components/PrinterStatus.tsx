import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Monitor, Thermometer, Wifi, WifiOff } from "lucide-react";
import { useWebSocket } from "@shared/hooks/useWebSocket";

interface TemperatureData {
  actual: number;
  target: number;
  offset?: number;
}

const statusConfig = {
  idle: { color: "bg-muted text-muted-foreground", label: "대기" },
  printing: { color: "bg-success text-success-foreground", label: "프린팅" },
  paused: { color: "bg-warning text-warning-foreground", label: "일시정지" },
  error: { color: "bg-destructive text-destructive-foreground", label: "오류" },
  connecting: { color: "bg-primary text-primary-foreground", label: "연결중" },
  disconnected: { color: "bg-muted text-muted-foreground", label: "연결끊김" }
};

const TemperatureItem = ({ label, data }: { label: string; data: TemperatureData }) => {
  const progress = data.target > 0 ? Math.min((data.actual / data.target) * 100, 100) : 0;
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {data.actual.toFixed(1)}°C / {data.target.toFixed(1)}°C
        </span>
      </div>
      <Progress value={progress} className="h-1.5" />
    </div>
  );
};

export const PrinterStatus = () => {
  const { isConnected, connectionState, printerStatus, temperature } = useWebSocket();
  
  const config = statusConfig[printerStatus.status];
  
  // 웹소켓 온도 데이터를 컴포넌트 형식에 맞게 변환
  const convertedTemperature = {
    tool: { actual: temperature.tool.current, target: temperature.tool.target },
    bed: { actual: temperature.bed.current, target: temperature.bed.target }
  };
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Monitor className="h-4 w-4" />
          프린터 상태
        </CardTitle>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="h-3 w-3 text-success" />
          ) : (
            <WifiOff className="h-3 w-3 text-destructive" />
          )}
          <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-success' : 'bg-destructive'}`} />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          <div className="space-y-2">
            <Badge className={config.color}>
              {config.label}
            </Badge>
            {printerStatus.error_message && (
              <p className="text-sm text-destructive">{printerStatus.error_message}</p>
            )}
            <div className="text-xs text-muted-foreground space-y-1">
              <div>연결: {isConnected ? "연결됨" : "연결끊김"}</div>
              <div>프린팅: {printerStatus.printing ? "진행중" : "중지"}</div>
              <div>상태: {connectionState}</div>
            </div>
          </div>

          {/* 온도 모니터링 섹션 */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Thermometer className="h-3 w-3" />
              <span className="text-xs font-medium">온도 모니터링</span>
            </div>
            <div className="space-y-2">
              <TemperatureItem label="익스트루더" data={convertedTemperature.tool} />
              <TemperatureItem label="히팅베드" data={convertedTemperature.bed} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};