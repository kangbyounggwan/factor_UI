import { useState } from "react";
import { Thermometer, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useTranslation } from "react-i18next";

export interface TemperatureDataPoint {
  time: string;
  toolTemp: number;
  toolTarget: number;
  bedTemp: number;
  bedTarget: number;
}

interface TemperatureChartProps {
  data: TemperatureDataPoint[];
  className?: string;
}

// 커스텀 범례 버튼 컴포넌트
const LegendButton = ({
  active,
  onClick,
  color,
  dashed,
  label
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  dashed?: boolean;
  label: string;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 border ${
      active
        ? 'bg-muted/80 shadow-sm border-border'
        : 'opacity-40 hover:opacity-60 border-border/50'
    }`}
  >
    {dashed ? (
      <svg width="24" height="3" className="flex-shrink-0">
        <line x1="0" y1="1.5" x2="24" y2="1.5" stroke={color} strokeWidth="2.5" strokeDasharray="4 3" strokeLinecap="round" />
      </svg>
    ) : (
      <div className="w-6 h-1 rounded-full" style={{ backgroundColor: color }} />
    )}
    <span className="text-sm font-medium">{label}</span>
  </button>
);

// 커스텀 툴팁 컴포넌트
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-xl p-4 shadow-xl">
      <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
        <Clock className="h-3.5 w-3.5" />
        {label}
      </p>
      <div className="space-y-2">
        {payload.map((item: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm">{item.name}</span>
            </div>
            <span className="text-sm font-bold tabular-nums">
              {item.value?.toFixed(1)}°C
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 온도 그래프 컴포넌트
 * 노즐/베드 실제 온도와 타겟 온도를 표시
 */
export function TemperatureChart({ data, className }: TemperatureChartProps) {
  const { t } = useTranslation();
  const [visibleLines, setVisibleLines] = useState({
    toolTemp: true,
    toolTarget: true,
    bedTemp: true,
    bedTarget: true
  });

  const toggleLine = (lineKey: keyof typeof visibleLines) => {
    setVisibleLines(prev => ({ ...prev, [lineKey]: !prev[lineKey] }));
  };

  // 색상 정의
  const colors = {
    toolTemp: '#3b82f6',    // blue-500
    toolTarget: '#93c5fd',  // blue-300
    bedTemp: '#ef4444',     // red-500
    bedTarget: '#fca5a5',   // red-300
  };

  return (
    <div className={`h-[380px] bg-card border-2 border-border shadow-sm rounded-2xl p-6 ${className || ''}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <Thermometer className="h-5 w-5 text-orange-500" />
          </div>
          <h3 className="text-lg font-semibold">{t('printerDetail.temperatureChart')}</h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{t('printerDetail.last30Minutes')}</span>
        </div>
      </div>

      {/* 커스텀 범례 - 클릭 가능 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <LegendButton
          active={visibleLines.toolTemp}
          onClick={() => toggleLine('toolTemp')}
          color={colors.toolTemp}
          label={t('printerDetail.nozzleActual')}
        />
        <LegendButton
          active={visibleLines.toolTarget}
          onClick={() => toggleLine('toolTarget')}
          color={colors.toolTarget}
          dashed
          label={t('printerDetail.nozzleTarget')}
        />
        <LegendButton
          active={visibleLines.bedTemp}
          onClick={() => toggleLine('bedTemp')}
          color={colors.bedTemp}
          label={t('printerDetail.bedActual')}
        />
        <LegendButton
          active={visibleLines.bedTarget}
          onClick={() => toggleLine('bedTarget')}
          color={colors.bedTarget}
          dashed
          label={t('printerDetail.bedTarget')}
        />
      </div>

      {/* 차트 영역 */}
      <div className="h-[calc(100%-8rem)]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="toolGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.toolTemp} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={colors.toolTemp} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="bedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.bedTemp} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={colors.bedTemp} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="opacity-10"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              stroke="currentColor"
              className="opacity-40"
              style={{ fontSize: '11px' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="currentColor"
              className="opacity-40"
              style={{ fontSize: '11px' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}°`}
              domain={[0, 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* 실제 온도 라인 (두껍고 선명) */}
            {visibleLines.toolTemp && (
              <Line
                type="monotone"
                dataKey="toolTemp"
                stroke={colors.toolTemp}
                strokeWidth={2.5}
                name={t('printerDetail.nozzleActual')}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: 'white' }}
              />
            )}
            {visibleLines.bedTemp && (
              <Line
                type="monotone"
                dataKey="bedTemp"
                stroke={colors.bedTemp}
                strokeWidth={2.5}
                name={t('printerDetail.bedActual')}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: 'white' }}
              />
            )}

            {/* 타겟 온도 라인 (점선, 연함) */}
            {visibleLines.toolTarget && (
              <Line
                type="monotone"
                dataKey="toolTarget"
                stroke={colors.toolTarget}
                strokeWidth={2}
                strokeDasharray="6 4"
                name={t('printerDetail.nozzleTarget')}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 1.5, fill: 'white' }}
              />
            )}
            {visibleLines.bedTarget && (
              <Line
                type="monotone"
                dataKey="bedTarget"
                stroke={colors.bedTarget}
                strokeWidth={2}
                strokeDasharray="6 4"
                name={t('printerDetail.bedTarget')}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 1.5, fill: 'white' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
