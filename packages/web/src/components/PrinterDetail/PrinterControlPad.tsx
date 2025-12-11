import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Gauge
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { publishControlHome, publishControlPause, publishControlResume, publishControlCancel, publishDashboardMove, publishDashboardSetTemperature, publishSetFeedRate } from "@shared/services/mqttService";
import { useTranslation } from "react-i18next";

interface TemperatureData {
  tool: { actual: number; target: number };
  bed: { actual: number; target: number };
}

interface PrinterControlPadProps {
  isConnected: boolean;
  isPrinting: boolean;
  deviceUuid?: string | null;
  temperature?: TemperatureData;
  currentFeedrate?: number;
}

export const PrinterControlPad = ({ isConnected, isPrinting, deviceUuid, temperature, currentFeedrate = 100 }: PrinterControlPadProps) => {
  const { t } = useTranslation();
  const [moveDistance, setMoveDistance] = useState(10);
  const [extruderTemp, setExtruderTemp] = useState(210);
  const [bedTemp, setBedTemp] = useState(60);
  const [extrudeAmount, setExtrudeAmount] = useState(10);
  const [feedRate, setFeedRate] = useState(100);
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
        title: t('control.axisMove'),
        description: t('control.axisMoveDesc', { axis, distance }),
      });
    } catch {
      toast({ title: t('control.requestFailed'), variant: "destructive" });
    }
  };

  const handleHomeAxis = async (axis?: 'X' | 'Y' | 'Z' | 'ALL') => {
    const axisText = axis === 'ALL' ? t('control.allAxes') : `${axis}`;
    console.log(`Homing ${axis || 'ALL'}`);
    try {
      const axes = axis === 'ALL' ? 'XYZ' : (axis ?? 'XYZ');
      if (deviceUuid) await publishControlHome(deviceUuid, axes);
      toast({ title: t('control.homeRequest'), description: t('control.homeRequestDesc', { axis: axisText }) });
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
      toast({
        title: t('control.temperatureSetting'),
        description: t('control.temperatureSettingDesc', {
          type: type === 'extruder' ? t('control.extruder') : t('control.heatingBed'),
          temp,
          wait: wait ? t('control.wait') : ''
        }),
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
      const actionText = action === 'pause' ? t('control.pauseRequest') : action === 'resume' ? t('control.resumeRequest') : t('control.cancelRequest');
      toast({ title: t('control.controlRequest'), description: actionText });
    } catch {
      toast({ title: t('control.requestFailed'), variant: "destructive" });
    }
  };

  const handleFeedRateSet = async () => {
    console.log(`Setting feed rate to ${feedRate}%`);
    try {
      if (!deviceUuid) throw new Error('no device');
      await publishSetFeedRate(deviceUuid, feedRate);
      toast({
        title: t('control.feedRateSetting'),
        description: t('control.feedRateSettingDesc', { value: feedRate }),
      });
    } catch {
      toast({ title: t('control.requestFailed'), variant: "destructive" });
    }
  };

  return (
    <Card className="h-full flex flex-col border border-border/50 shadow-card bg-card rounded-2xl">
      <CardHeader className="pb-3 flex-shrink-0 border-b border-border/50">
        <CardTitle className="text-base font-semibold flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings className="h-4 w-4 text-primary" />
          </div>
          {t('control.title')}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col pt-3 overflow-hidden">
        {/* 프린트 제어 - 상단 고정 */}
        <div className="space-y-2 flex-shrink-0 pb-3 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Play className="h-3.5 w-3.5" />
            <span>{t('control.printControl')}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={() => handlePrintControl('pause')}
              disabled={!isConnected || !isPrinting}
              className="h-10 gap-1.5 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/50 transition-colors"
            >
              <Pause className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePrintControl('resume')}
              disabled={!isConnected || isPrinting}
              className="h-10 gap-1.5 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/50 transition-colors"
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePrintControl('stop')}
              disabled={!isConnected}
              className="h-10 gap-1.5 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/50 transition-colors"
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 프린팅 중: 온도 제어 + Feed Rate 제어 */}
        {isPrinting ? (
          <ScrollArea className="flex-1 mt-2">
            <div className="space-y-3">
              {/* 온도 제어 - 프린팅 중에도 사용 가능 */}
              <div className="border rounded-xl px-3 py-3 bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <Thermometer className="h-3.5 w-3.5 text-orange-500" />
                  <span className="font-medium text-xs">{t('control.temperatureControl')}</span>
                </div>
                <div className="space-y-3">
                  {/* 익스트루더 온도 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">{t('control.extruder')}</Label>
                      <span className="text-xs text-muted-foreground">
                        {t('common.current')}: <span className="text-orange-500 font-medium">{temperature?.tool.actual.toFixed(0) ?? '--'}°C</span>
                        {temperature?.tool.target ? ` / ${temperature.tool.target}°C` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={extruderTemp}
                        onChange={(e) => setExtruderTemp(Number(e.target.value))}
                        className="h-8 text-xs flex-1"
                        min="0"
                        max="300"
                        disabled={!isConnected}
                      />
                      <span className="text-xs text-muted-foreground">°C</span>
                      <Button
                        size="sm"
                        onClick={() => handleTemperatureSet('extruder')}
                        disabled={!isConnected}
                        className="h-8 px-3 text-xs"
                      >
                        {t('control.set')}
                      </Button>
                    </div>
                  </div>

                  {/* 베드 온도 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">{t('control.heatingBed')}</Label>
                      <span className="text-xs text-muted-foreground">
                        {t('common.current')}: <span className="text-orange-500 font-medium">{temperature?.bed.actual.toFixed(0) ?? '--'}°C</span>
                        {temperature?.bed.target ? ` / ${temperature.bed.target}°C` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={bedTemp}
                        onChange={(e) => setBedTemp(Number(e.target.value))}
                        className="h-8 text-xs flex-1"
                        min="0"
                        max="120"
                        disabled={!isConnected}
                      />
                      <span className="text-xs text-muted-foreground">°C</span>
                      <Button
                        size="sm"
                        onClick={() => handleTemperatureSet('bed')}
                        disabled={!isConnected}
                        className="h-8 px-3 text-xs"
                      >
                        {t('control.set')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feed Rate 제어 (M220) - 플러그인 범위: 10-500% */}
              <div className="border rounded-xl px-3 py-3 bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-3.5 w-3.5 text-blue-500" />
                    <span className="font-medium text-xs">{t('control.feedRate')}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t('common.current')}: <span className="text-blue-500 font-medium">{currentFeedrate}%</span>
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={feedRate}
                      onChange={(e) => setFeedRate(Number(e.target.value))}
                      className="h-8 text-xs flex-1"
                      min="10"
                      max="500"
                      disabled={!isConnected}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    <Button
                      size="sm"
                      onClick={handleFeedRateSet}
                      disabled={!isConnected}
                      className="h-8 px-3 text-xs"
                    >
                      {t('control.set')}
                    </Button>
                  </div>
                  {/* 프리셋 버튼 */}
                  <div className="flex gap-1">
                    {[50, 75, 100, 150, 200].map((val) => (
                      <Button
                        key={val}
                        variant={feedRate === val ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFeedRate(val)}
                        disabled={!isConnected}
                        className="flex-1 h-7 text-xs"
                      >
                        {val}%
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <>
            {/* 축 제어 - 프린팅 중이 아닐 때만 표시 */}
            <div className="py-3 border-b border-border/50 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                <Move3D className="h-3.5 w-3.5 text-blue-500" />
                <span>{t('control.axisControl')}</span>
              </div>

              {/* 이동거리 설정 */}
              <div className="flex items-center gap-2 mb-3">
                <Label className="text-xs font-medium min-w-[55px]">{t('control.moveDistance')}</Label>
                <Input
                  type="number"
                  value={moveDistance}
                  onChange={(e) => setMoveDistance(Number(e.target.value))}
                  className="h-8 text-xs flex-1"
                  min="0.1"
                  max="100"
                  step="0.1"
                  disabled={!isConnected}
                />
                <span className="text-xs text-muted-foreground">mm</span>
              </div>

              {/* XY + Z 제어 - 균형 잡힌 레이아웃 */}
              <div className="flex gap-4">
                {/* XY 그리드 */}
                <div className="grid grid-cols-3 gap-2 flex-1">
                  <div></div>
                  <Button
                    variant="outline"
                    onClick={() => handleAxisMove('Y', '+')}
                    disabled={!isConnected}
                    className="h-11 hover:bg-blue-500/10 hover:border-blue-500/50"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </Button>
                  <div></div>

                  <Button
                    variant="outline"
                    onClick={() => handleAxisMove('X', '-')}
                    disabled={!isConnected}
                    className="h-11 hover:bg-blue-500/10 hover:border-blue-500/50"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleHomeAxis('ALL')}
                    disabled={!isConnected}
                    className="h-11 hover:bg-primary/10 hover:border-primary/50"
                  >
                    <Home className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleAxisMove('X', '+')}
                    disabled={!isConnected}
                    className="h-11 hover:bg-blue-500/10 hover:border-blue-500/50"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </Button>

                  <div></div>
                  <Button
                    variant="outline"
                    onClick={() => handleAxisMove('Y', '-')}
                    disabled={!isConnected}
                    className="h-11 hover:bg-blue-500/10 hover:border-blue-500/50"
                  >
                    <ArrowDown className="h-5 w-5" />
                  </Button>
                  <div></div>
                </div>

                {/* Z 컨트롤 - 균형 맞춤 */}
                <div className="flex flex-col gap-2 w-20">
                  <Button
                    variant="outline"
                    onClick={() => handleAxisMove('Z', '+')}
                    disabled={!isConnected}
                    className="h-[72px] text-sm font-medium hover:bg-violet-500/10 hover:border-violet-500/50 flex flex-col gap-1"
                  >
                    <ChevronUp className="h-5 w-5" />
                    <span>Z+</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleAxisMove('Z', '-')}
                    disabled={!isConnected}
                    className="h-[72px] text-sm font-medium hover:bg-violet-500/10 hover:border-violet-500/50 flex flex-col gap-1"
                  >
                    <span>Z-</span>
                    <ChevronDown className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* 스크롤 가능한 추가 컨트롤들 - 프린팅 중이 아닐 때만 */}
            <ScrollArea className="flex-1 mt-2">
              <Accordion type="multiple" defaultValue={["temperature"]} className="space-y-2">
                {/* 온도 제어 */}
                <AccordionItem value="temperature" className="border rounded-xl px-3 bg-muted/30">
                  <AccordionTrigger className="py-2 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-3.5 w-3.5 text-orange-500" />
                      <span className="font-medium text-xs">{t('control.temperatureControl')}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <div className="space-y-2">
                      {/* 익스트루더 온도 */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-medium min-w-[55px]">{t('control.extruder')}</Label>
                        <Input
                          type="number"
                          value={extruderTemp}
                          onChange={(e) => setExtruderTemp(Number(e.target.value))}
                          className="h-8 text-xs flex-1"
                          min="0"
                          max="300"
                          disabled={!isConnected}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleTemperatureSet('extruder')}
                          disabled={!isConnected}
                          className="h-8 px-3 text-xs"
                        >
                          {t('control.set')}
                        </Button>
                      </div>

                      {/* 베드 온도 */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-medium min-w-[55px]">{t('control.heatingBed')}</Label>
                        <Input
                          type="number"
                          value={bedTemp}
                          onChange={(e) => setBedTemp(Number(e.target.value))}
                          className="h-8 text-xs flex-1"
                          min="0"
                          max="120"
                          disabled={!isConnected}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleTemperatureSet('bed')}
                          disabled={!isConnected}
                          className="h-8 px-3 text-xs"
                        >
                          {t('control.set')}
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 익스트루더 제어 */}
                <AccordionItem value="extruder" className="border rounded-xl px-3 bg-muted/30">
                  <AccordionTrigger className="py-2 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="font-medium text-xs">{t('control.extruderControl')}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <div className="space-y-2">
                      {/* 압출 길이 */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-medium min-w-[40px]">{t('control.length')}</Label>
                        <Input
                          type="number"
                          value={extrudeAmount}
                          onChange={(e) => setExtrudeAmount(Number(e.target.value))}
                          className="h-8 text-xs flex-1"
                          min="1"
                          max="100"
                          disabled={!isConnected}
                        />
                        <span className="text-xs text-muted-foreground">mm</span>
                      </div>

                      {/* 압출/후퇴 버튼 */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAxisMove('E', '+')}
                          disabled={!isConnected}
                          className="flex-1 h-8 text-xs gap-1 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                        >
                          <RotateCcw className="h-3 w-3" />
                          {t('control.extrude')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAxisMove('E', '-')}
                          disabled={!isConnected}
                          className="flex-1 h-8 text-xs gap-1 hover:bg-amber-500/10 hover:border-amber-500/50"
                        >
                          <RotateCcw className="h-3 w-3 rotate-180" />
                          {t('control.retract')}
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
};
