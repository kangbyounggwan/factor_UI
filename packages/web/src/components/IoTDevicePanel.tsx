import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Thermometer, Activity, Camera, Brain, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@shared/integrations/supabase/client";

interface IoTDevice {
  id: string;
  name: string;
  type: "sensor" | "camera" | "controller";
  status: "connected" | "disconnected" | "error";
  lastSeen: string;
  batteryLevel?: number;
  signalStrength: number;
  sensorData?: {
    temperature?: number;
    humidity?: number;
    vibration?: number;
    pressure?: number;
  };
}

interface IoTDevicePanelProps {
  devices: IoTDevice[];
}

interface AIAnalysisResult {
  status: "normal" | "warning" | "critical";
  summary: string;
  recommendations: string[];
  anomalies: string[];
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "connected":
      return "bg-green-100 text-green-800 border-green-200";
    case "disconnected":
      return "bg-gray-100 text-gray-800 border-gray-200";
    case "error":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getDeviceIcon = (type: string) => {
  switch (type) {
    case "sensor":
      return <Thermometer className="h-4 w-4" />;
    case "camera":
      return <Camera className="h-4 w-4" />;
    case "controller":
      return <Activity className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
};

const getAnalysisIcon = (status: string) => {
  switch (status) {
    case "normal":
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    case "critical":
      return <AlertTriangle className="h-5 w-5 text-red-600" />;
    default:
      return <TrendingUp className="h-5 w-5 text-blue-600" />;
  }
};

export const IoTDevicePanel = ({ devices }: IoTDevicePanelProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const { toast } = useToast();

  const analyzeData = async () => {
    setIsAnalyzing(true);
    
    try {
      // 센서 데이터 수집
      const sensorData = devices
        .filter(device => device.type === "sensor" && device.status === "connected")
        .map(device => ({
          id: device.id,
          name: device.name,
          data: device.sensorData,
          batteryLevel: device.batteryLevel,
          signalStrength: device.signalStrength
        }));

      const { data, error } = await supabase.functions.invoke('analyze-iot-data', {
        body: { sensorData }
      });

      if (error) throw error;

      setAnalysisResult(data);
      
      toast({
        title: "AI 분석 완료",
        description: "센서 데이터 분석이 완료되었습니다.",
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "분석 실패",
        description: "AI 분석 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            연결된 IoT 디바이스
          </CardTitle>
          <Button
            onClick={analyzeData}
            disabled={isAnalyzing || devices.filter(d => d.type === "sensor" && d.status === "connected").length === 0}
            variant="outline"
            size="sm"
          >
            <Brain className="h-4 w-4 mr-2" />
            {isAnalyzing ? "분석 중..." : "AI 분석"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* AI 분석 결과 */}
          {analysisResult && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-3">
                {getAnalysisIcon(analysisResult.status)}
                <h3 className="font-semibold">AI 분석 결과</h3>
                <Badge variant={analysisResult.status === "normal" ? "default" : "destructive"}>
                  {analysisResult.status === "normal" ? "정상" : 
                   analysisResult.status === "warning" ? "주의" : "위험"}
                </Badge>
              </div>
              
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium mb-1">요약</h4>
                  <p className="text-sm text-muted-foreground">{analysisResult.summary}</p>
                </div>
                
                {analysisResult.anomalies.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">감지된 이상</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {analysisResult.anomalies.map((anomaly, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-red-500">•</span>
                          {anomaly}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {analysisResult.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">권장사항</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {analysisResult.recommendations.map((recommendation, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-blue-500">•</span>
                          {recommendation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 디바이스 목록 */}
          <div className="space-y-4">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(device.type)}
                    <span className="font-medium">{device.name}</span>
                  </div>
                  <Badge className={getStatusColor(device.status)}>
                    {device.status === "connected" ? "연결됨" : 
                     device.status === "disconnected" ? "연결 끊김" : "오류"}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    {device.status === "connected" ? (
                      <Wifi className="h-4 w-4" />
                    ) : (
                      <WifiOff className="h-4 w-4" />
                    )}
                    <span>{device.signalStrength}%</span>
                  </div>
                  
                  {device.batteryLevel && (
                    <div>배터리: {device.batteryLevel}%</div>
                  )}
                  
                  <div>마지막 접속: {device.lastSeen}</div>
                  
                  {/* 센서 데이터 표시 */}
                  {device.type === "sensor" && device.sensorData && (
                    <div className="flex gap-2">
                      {device.sensorData.temperature && (
                        <span>온도: {device.sensorData.temperature}°C</span>
                      )}
                      {device.sensorData.humidity && (
                        <span>습도: {device.sensorData.humidity}%</span>
                      )}
                      {device.sensorData.vibration && (
                        <span>진동: {device.sensorData.vibration}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {devices.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                연결된 IoT 디바이스가 없습니다.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};