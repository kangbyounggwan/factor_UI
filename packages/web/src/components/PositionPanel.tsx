import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";
import { useWebSocket } from "@shared/hooks/useWebSocket";

export const PositionPanel = () => {
  const { position } = useWebSocket();
  
  // 기본값 설정
  const feedrate = 100; // mm/min
  const flowrate = 100; // %
  const fan_speed = 128; // 0-255
  const fanPercent = Math.round((fan_speed / 255) * 100);

  return (
    <Card className="h-full flex flex-col">{/* 높이 조정 */}
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Settings className="h-4 w-4" />
          위치 및 설정
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4 overflow-y-auto">{/* 스크롤 가능 */}
        <div>
          <h4 className="text-sm font-medium mb-2">현재 위치</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">X축:</span>
              <span className="font-mono">{(position.x ?? 0).toFixed(2)}mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Y축:</span>
              <span className="font-mono">{(position.y ?? 0).toFixed(2)}mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Z축:</span>
              <span className="font-mono">{(position.z ?? 0).toFixed(2)}mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">E축:</span>
              <span className="font-mono">{(position.e ?? 0).toFixed(2)}mm</span>
            </div>
          </div>
        </div>

        <div className="border-t pt-3">
          <h4 className="text-sm font-medium mb-2">제어 설정</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">피드레이트:</span>
              <span className="font-mono">{feedrate.toFixed(0)} mm/min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">플로우 비율:</span>
              <span className="font-mono">{flowrate.toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">팬 속도:</span>
              <span className="font-mono">{fanPercent}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};