import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Settings, 
  Home, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight,
  Move3D,
  Thermometer,
  Fan,
  Play,
  Pause,
  Square,
  RotateCcw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { publishDashboardMove, publishDashboardSetTemperature, publishControlHome, publishControlPause, publishControlResume, publishControlCancel } from "@shared/services/mqttService";

interface PrinterControlPadProps {
  isConnected: boolean;
  isPrinting: boolean;
  deviceUuid?: string | null;
}

export const PrinterControlPad = ({ isConnected, isPrinting, deviceUuid }: PrinterControlPadProps) => {
  const [moveDistance, setMoveDistance] = useState(10);
  const [extruderTemp, setExtruderTemp] = useState(210);
  const [bedTemp, setBedTemp] = useState(60);
  const [fanSpeed, setFanSpeed] = useState([50]);
  const [extrudeAmount, setExtrudeAmount] = useState(10);
  const { toast } = useToast();

  const handleAxisMove = async (axis: 'X' | 'Y' | 'Z' | 'E', direction: '+' | '-') => {
    const base = axis === 'E' ? extrudeAmount : moveDistance;
    const distance = direction === '+' ? base : -base;
    console.log(`Moving ${axis} axis by ${distance}mm`);
    try {
      if (!deviceUuid) throw new Error('no device');
      const key = axis.toLowerCase() as 'x' | 'y' | 'z' | 'e';
      await publishDashboardMove(deviceUuid, { mode: 'relative', [key]: distance });
      toast({
        title: "축 이동 명령",
        description: `${axis}축을 ${distance}mm 이동합니다.`,
      });
    } catch {
      toast({ title: "요청 실패", variant: "destructive" });
    }
  };

  const handleHomeAxis = async (axis?: 'X' | 'Y' | 'Z' | 'ALL') => {
    const axisText = axis === 'ALL' ? '모든 축' : `${axis}축`;
    console.log(`Homing ${axis || 'ALL'}`);
    try {
      const axes = axis === 'ALL' ? 'XYZ' : (axis ?? 'XYZ');
      if (deviceUuid) await publishControlHome(deviceUuid, axes);
      toast({ title: "홈 이동 요청", description: `${axisText} 이동 요청을 보냈습니다.` });
    } catch {
      toast({ title: "요청 실패", variant: "destructive" });
    }
  };

  const handleTemperatureSet = async (type: 'extruder' | 'bed', opts?: { wait?: boolean; toolIndex?: number }) => {
    const temp = type === 'extruder' ? extruderTemp : bedTemp;
    console.log(`Setting ${type} temperature to ${temp}°C`);
    try {
      if (!deviceUuid) throw new Error('no device');
      const tool = type === 'bed' ? -1 : (opts?.toolIndex ?? 0);
      const wait = opts?.wait ?? false;
      await publishDashboardSetTemperature(deviceUuid, { tool, temperature: temp, wait });
      toast({
        title: "온도 설정",
        description: `${type === 'extruder' ? '익스트루더' : '히팅베드'} 온도를 ${temp}°C로 설정합니다${wait ? ' (대기)' : ''}.`,
      });
    } catch {
      toast({ title: "요청 실패", variant: "destructive" });
    }
  };

  

  const handlePrintControl = async (action: 'pause' | 'resume' | 'stop') => {
    console.log(`Print ${action}`);
    try {
      if (!deviceUuid) throw new Error('no device');
      if (action === 'pause') await publishControlPause(deviceUuid);
      else if (action === 'resume') await publishControlResume(deviceUuid);
      else await publishControlCancel(deviceUuid);
      toast({ title: "제어 요청", description: `프린트를 ${action === 'pause' ? '일시정지' : action === 'resume' ? '재개' : '완전 취소'} 요청을 보냈습니다.` });
    } catch {
      toast({ title: "요청 실패", variant: "destructive" });
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Settings className="h-4 w-4" />
          프린터 원격 제어
          <Badge variant={isConnected ? "default" : "secondary"} className="ml-auto">
            {isConnected ? "연결됨" : "연결끊김"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4 text-xs overflow-hidden">
        {/* 프린트 제어 - 상단 고정 */}
        <div className="space-y-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Play className="h-3 w-3" />
            <span className="font-medium">프린트 제어</span>
          </div>
          
          <div className="grid grid-cols-3 gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePrintControl('pause')}
              disabled={!isConnected || !isPrinting}
              className="h-8 p-1"
            >
              <Pause className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePrintControl('resume')}
              disabled={!isConnected || isPrinting}
              className="h-8 p-1"
            >
              <Play className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePrintControl('stop')}
              disabled={!isConnected}
              className="h-8 p-1"
            >
              <Square className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* 스크롤 가능한 아코디언 컨트롤들 */}
        <ScrollArea className="flex-1">
          <Accordion type="multiple" defaultValue={["axis"]} className="space-y-2">
            {/* 축 제어 */}
            <AccordionItem value="axis" className="border rounded-lg px-3">
              <AccordionTrigger className="py-2 text-xs">
                <div className="flex items-center gap-2">
                  <Move3D className="h-3 w-3" />
                  <span className="font-medium">축 제어</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs min-w-[60px]">이동거리</Label>
                    <Input
                      type="number"
                      value={moveDistance}
                      onChange={(e) => setMoveDistance(Number(e.target.value))}
                      className="h-7 text-xs"
                      min="0.1"
                      max="100"
                      step="0.1"
                      disabled={!isConnected}
                    />
                    <span className="text-xs text-muted-foreground">mm</span>
                  </div>
                  
                  {/* XY 제어 */}
                  <div className="grid grid-cols-3 gap-1">
                    <div></div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAxisMove('Y', '+')}
                      disabled={!isConnected || isPrinting}
                      className="h-8 p-1"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <div></div>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAxisMove('X', '-')}
                      disabled={!isConnected || isPrinting}
                      className="h-8 p-1"
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleHomeAxis('ALL')}
                      disabled={!isConnected || isPrinting}
                      className="h-8 p-1"
                    >
                      <Home className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAxisMove('X', '+')}
                      disabled={!isConnected || isPrinting}
                      className="h-8 p-1"
                    >
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                    
                    <div></div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAxisMove('Y', '-')}
                      disabled={!isConnected || isPrinting}
                      className="h-8 p-1"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <div></div>
                  </div>
                  
                  {/* Z 제어 */}
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAxisMove('Z', '+')}
                      disabled={!isConnected || isPrinting}
                      className="flex-1 h-7 text-xs"
                    >
                      Z+
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAxisMove('Z', '-')}
                      disabled={!isConnected || isPrinting}
                      className="flex-1 h-7 text-xs"
                    >
                      Z-
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 온도 제어 */}
            <AccordionItem value="temperature" className="border rounded-lg px-3">
              <AccordionTrigger className="py-2 text-xs">
                <div className="flex items-center gap-2">
                  <Thermometer className="h-3 w-3" />
                  <span className="font-medium">온도 제어</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs min-w-[50px]">익스트루더</Label>
                    <Input
                      type="number"
                      value={extruderTemp}
                      onChange={(e) => setExtruderTemp(Number(e.target.value))}
                      className="h-7 text-xs flex-1"
                      min="0"
                      max="300"
                      disabled={!isConnected}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTemperatureSet('extruder')}
                      disabled={!isConnected}
                      className="h-7 px-2 text-xs"
                    >
                      설정
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label className="text-xs min-w-[50px]">히팅베드</Label>
                    <Input
                      type="number"
                      value={bedTemp}
                      onChange={(e) => setBedTemp(Number(e.target.value))}
                      className="h-7 text-xs flex-1"
                      min="0"
                      max="120"
                      disabled={!isConnected}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTemperatureSet('bed')}
                      disabled={!isConnected}
                      className="h-7 px-2 text-xs"
                    >
                      설정
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 익스트루더 제어 */}
            <AccordionItem value="extruder" className="border rounded-lg px-3">
              <AccordionTrigger className="py-2 text-xs">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-3 w-3" />
                  <span className="font-medium">익스트루더</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs min-w-[40px]">길이</Label>
                    <Input
                      type="number"
                      value={extrudeAmount}
                      onChange={(e) => setExtrudeAmount(Number(e.target.value))}
                      className="h-7 text-xs"
                      min="1"
                      max="100"
                      disabled={!isConnected}
                    />
                    <span className="text-xs text-muted-foreground">mm</span>
                  </div>
                  
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAxisMove('E', '+')}
                      disabled={!isConnected}
                      className="flex-1 h-7 text-xs"
                    >
                      압출
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAxisMove('E', '-')}
                      disabled={!isConnected}
                      className="flex-1 h-7 text-xs"
                    >
                      후퇴
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 팬 제어 */}
            <AccordionItem value="fan" className="border rounded-lg px-3">
              <AccordionTrigger className="py-2 text-xs">
                <div className="flex items-center gap-2">
                  <Fan className="h-3 w-3" />
                  <span className="font-medium">팬 속도</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-2">
                  <Slider
                    value={fanSpeed}
                    onValueChange={setFanSpeed}
                    max={100}
                    step={1}
                    disabled={!isConnected}
                    className="w-full"
                  />
                  <div className="text-xs text-muted-foreground text-center">
                    {fanSpeed[0]}%
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};