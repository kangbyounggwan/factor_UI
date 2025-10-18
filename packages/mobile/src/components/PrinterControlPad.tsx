import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Play,
  Pause,
  Square,
  RotateCcw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { publishDashboardMove, publishDashboardSetTemperature, publishControlHome, publishControlPause, publishControlResume, publishControlCancel } from "@shared/services/mqttService";
import { useTranslation } from "react-i18next";
import { getPrinterStatusInfo, type PrinterState, type PrinterStateFlags } from "@shared";

interface PrinterControlPadProps {
  isConnected: boolean;
  isPrinting: boolean;
  deviceUuid?: string | null;
  printerState?: PrinterState;
  flags?: PrinterStateFlags;
}

export const PrinterControlPad = ({ isConnected, isPrinting, deviceUuid, printerState, flags }: PrinterControlPadProps) => {
  const { t } = useTranslation();
  const [moveDistance, setMoveDistance] = useState(10);
  const [extruderTemp, setExtruderTemp] = useState(210);
  const [bedTemp, setBedTemp] = useState(60);
  const [extrudeAmount, setExtrudeAmount] = useState(10);
  const { toast } = useToast();

  // shared 유틸리티를 사용하여 상태 정보 가져오기
  const statusInfo = getPrinterStatusInfo(printerState, flags, {
    idle: t('printerDetail.idle'),
    printing: t('printer.statusPrinting'),
    paused: t('printerDetail.paused'),
    error: t('printerDetail.error'),
    connecting: t('printerDetail.connecting'),
    disconnected: t('printerDetail.disconnected')
  });

  const handleAxisMove = async (axis: 'X' | 'Y' | 'Z' | 'E', direction: '+' | '-') => {
    const base = axis === 'E' ? extrudeAmount : moveDistance;
    const distance = direction === '+' ? base : -base;
    console.log(`Moving ${axis} axis by ${distance}mm`);
    try {
      if (!deviceUuid) throw new Error('no device');
      const key = axis.toLowerCase() as 'x' | 'y' | 'z' | 'e';
      await publishDashboardMove(deviceUuid, { mode: 'relative', [key]: distance });
      toast({
        title: t('control.axisMove'),
        description: `${axis}${t('control.axis')} ${distance}mm ${t('control.moving')}`,
      });
    } catch {
      toast({ title: t('control.requestFailed'), variant: "destructive" });
    }
  };

  const handleHomeAxis = async (axis?: 'X' | 'Y' | 'Z' | 'ALL') => {
    const axisText = axis === 'ALL' ? t('control.allAxes') : `${axis}${t('control.axis')}`;
    console.log(`Homing ${axis || 'ALL'}`);
    try {
      const axes = axis === 'ALL' ? 'XYZ' : (axis ?? 'XYZ');
      if (deviceUuid) await publishControlHome(deviceUuid, axes);
      toast({ title: t('control.homeRequest'), description: `${axisText} ${t('control.moveRequestSent')}` });
    } catch {
      toast({ title: t('control.requestFailed'), variant: "destructive" });
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
      const deviceName = type === 'extruder' ? t('printerDetail.extruder') : t('printerDetail.heatingBed');
      toast({
        title: t('control.temperatureSet'),
        description: `${deviceName} ${t('control.temperatureTo')} ${temp}°C${wait ? ` (${t('control.wait')})` : ''}.`,
      });
    } catch {
      toast({ title: t('control.requestFailed'), variant: "destructive" });
    }
  };

  

  const handlePrintControl = async (action: 'pause' | 'resume' | 'stop') => {
    console.log(`Print ${action}`);
    try {
      if (!deviceUuid) throw new Error('no device');
      if (action === 'pause') await publishControlPause(deviceUuid);
      else if (action === 'resume') await publishControlResume(deviceUuid);
      else await publishControlCancel(deviceUuid);
      const actionText = action === 'pause' ? t('printerDetail.pause') : action === 'resume' ? t('printerDetail.resume') : t('printerDetail.cancel');
      toast({ title: t('control.controlRequest'), description: `${t('control.print')} ${actionText} ${t('control.requestSent')}` });
    } catch {
      toast({ title: t('control.requestFailed'), variant: "destructive" });
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Settings className="h-4 w-4" />
          {t('control.title')}
          <div className={`ml-auto px-2 py-1 rounded-md text-xs font-medium ${statusInfo.badgeClass}`}>
            {statusInfo.label}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4 text-xs overflow-hidden">
        {/* 프린트 제어 - 상단 고정 */}
        <div className="space-y-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Play className="h-3 w-3" />
            <span className="font-medium">{t('control.printControl')}</span>
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
                  <span className="font-medium">{t('control.axisControl')}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs min-w-[60px]">{t('control.moveDistance')}</Label>
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
                  <span className="font-medium">{t('control.temperatureControl')}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs min-w-[50px]">{t('printerDetail.extruder')}</Label>
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
                      {t('control.set')}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs min-w-[50px]">{t('printerDetail.heatingBed')}</Label>
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
                      {t('control.set')}
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
                  <span className="font-medium">{t('control.extruder')}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs min-w-[40px]">{t('control.length')}</Label>
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
                      {t('control.extrude')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAxisMove('E', '-')}
                      disabled={!isConnected}
                      className="flex-1 h-7 text-xs"
                    >
                      {t('control.retract')}
                    </Button>
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