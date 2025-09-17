import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Thermometer } from "lucide-react";

interface TemperatureData {
  actual: number;
  target: number;
  offset?: number;
}

interface TemperaturePanelProps {
  tool: TemperatureData;
  bed: TemperatureData;
  chamber?: TemperatureData;
}

const getTemperatureColor = (actual: number, target: number) => {
  const ratio = target > 0 ? (actual / target) * 100 : 0;
  if (ratio < 50) return "bg-temperature-cold";
  if (ratio < 90) return "bg-temperature-warm";
  return "bg-temperature-hot";
};

const TemperatureItem = ({ label, data }: { label: string; data: TemperatureData }) => {
  const progress = data.target > 0 ? Math.min((data.actual / data.target) * 100, 100) : 0;
  const colorClass = getTemperatureColor(data.actual, data.target);
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {data.actual.toFixed(1)}°C / {data.target.toFixed(1)}°C
        </span>
      </div>
      <div className="space-y-1">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0°C</span>
          <span className="font-medium">목표: {data.target.toFixed(1)}°C</span>
          <span>300°C</span>
        </div>
      </div>
    </div>
  );
};

export const TemperaturePanel = ({ tool, bed, chamber }: TemperaturePanelProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Thermometer className="h-4 w-4" />
          온도 모니터링
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <TemperatureItem label="익스트루더" data={tool} />
        <TemperatureItem label="히팅베드" data={bed} />
        {chamber && <TemperatureItem label="챔버" data={chamber} />}
      </CardContent>
    </Card>
  );
};