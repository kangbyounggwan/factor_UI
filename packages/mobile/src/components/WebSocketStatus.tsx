import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useWebSocket } from "@shared/hooks/useWebSocket";

export const WebSocketStatus = () => {
  const { isConnected, connectionState, connect, disconnect } = useWebSocket();

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'connected': return 'bg-success text-success-foreground';
      case 'connecting': return 'bg-warning text-warning-foreground';
      case 'disconnected': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (state: string) => {
    switch (state) {
      case 'connected': return '연결됨';
      case 'connecting': return '연결중';
      case 'disconnected': return '연결끊김';
      default: return '알 수 없음';
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-success" />
          ) : (
            <WifiOff className="h-4 w-4 text-destructive" />
          )}
          웹소켓 연결 상태
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">상태:</span>
            <Badge className={getStatusColor(connectionState)}>
              {getStatusLabel(connectionState)}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">연결:</span>
            <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-success' : 'bg-destructive'}`} />
          </div>
        </div>

        <div className="flex gap-2 mt-auto">
          {isConnected ? (
            <Button
              size="sm"
              variant="outline"
              onClick={disconnect}
              className="flex-1"
            >
              <WifiOff className="h-3 w-3 mr-1" />
              연결 해제
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={connect}
              className="flex-1"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              연결 시도
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
