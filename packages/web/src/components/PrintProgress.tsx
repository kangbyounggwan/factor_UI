import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock } from "lucide-react";
import { useWebSocket } from "@shared/hooks/useWebSocket";

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}시간 ${minutes}분 ${secs}초`;
  }
  return `${minutes}분 ${secs}초`;
};

const formatFileSize = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

export const PrintProgress = () => {
  const { printProgress } = useWebSocket();
  
  const completionPercent = Math.round(printProgress.completion * 100);
  const fileProgress = printProgress.file_size > 0 ? (printProgress.file_position / printProgress.file_size) * 100 : 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          프린트 진행상황
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">전체 진행률</span>
            <span className="text-2xl font-bold text-primary">{completionPercent}%</span>
          </div>
          <Progress value={completionPercent} className="h-3" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">파일 진행률</span>
            <span className="text-sm text-muted-foreground">
              {formatFileSize(printProgress.file_position)} / {formatFileSize(printProgress.file_size)}
            </span>
          </div>
          <Progress value={fileProgress} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">경과 시간</div>
            <div className="font-medium">{formatTime(printProgress.print_time)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">남은 시간</div>
            <div className="font-medium">{formatTime(printProgress.print_time_left)}</div>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">사용된 필라멘트</span>
            <span className="font-medium">{(printProgress.filament_used / 1000).toFixed(2)}m</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};