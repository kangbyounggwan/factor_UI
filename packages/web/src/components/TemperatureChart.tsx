import { useState } from "react";
import { Thermometer } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

/**
 * 온도 그래프 컴포넌트
 * 노즐/베드 실제 온도와 타겟 온도를 표시
 */
export function TemperatureChart({ data, className }: TemperatureChartProps) {
  const [visibleLines, setVisibleLines] = useState({
    toolTemp: true,
    toolTarget: true,
    bedTemp: true,
    bedTarget: true
  });

  const toggleLine = (lineKey: keyof typeof visibleLines) => {
    setVisibleLines(prev => ({ ...prev, [lineKey]: !prev[lineKey] }));
  };

  return (
    <div className={`h-[380px] bg-card border rounded-lg p-6 ${className || ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <Thermometer className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">온도 그래프</h3>
        <span className="text-xs text-muted-foreground ml-auto">최근 30분</span>
      </div>

      {/* 커스텀 범례 - 클릭 가능 */}
      <div className="flex gap-3 mb-3 text-sm">
        <button
          onClick={() => toggleLine('toolTemp')}
          className={`flex items-center gap-2 px-2 py-1 rounded transition-opacity ${!visibleLines.toolTemp ? 'opacity-40' : 'opacity-100'}`}
        >
          <div className="w-8 h-0.5 bg-[#3b82f6] rounded"></div>
          <span className="text-muted-foreground font-medium">노즐 실제</span>
        </button>
        <button
          onClick={() => toggleLine('toolTarget')}
          className={`flex items-center gap-2 px-2 py-1 rounded transition-opacity ${!visibleLines.toolTarget ? 'opacity-40' : 'opacity-100'}`}
        >
          <svg width="32" height="2" className="flex-shrink-0">
            <line x1="0" y1="1" x2="32" y2="1" stroke="#60a5fa" strokeWidth="2" strokeDasharray="4 2" />
          </svg>
          <span className="text-muted-foreground font-medium">노즐 타겟</span>
        </button>
        <button
          onClick={() => toggleLine('bedTemp')}
          className={`flex items-center gap-2 px-2 py-1 rounded transition-opacity ${!visibleLines.bedTemp ? 'opacity-40' : 'opacity-100'}`}
        >
          <div className="w-8 h-0.5 bg-[#ef4444] rounded"></div>
          <span className="text-muted-foreground font-medium">베드 실제</span>
        </button>
        <button
          onClick={() => toggleLine('bedTarget')}
          className={`flex items-center gap-2 px-2 py-1 rounded transition-opacity ${!visibleLines.bedTarget ? 'opacity-40' : 'opacity-100'}`}
        >
          <svg width="32" height="2" className="flex-shrink-0">
            <line x1="0" y1="1" x2="32" y2="1" stroke="#f87171" strokeWidth="2" strokeDasharray="4 2" />
          </svg>
          <span className="text-muted-foreground font-medium">베드 타겟</span>
        </button>
      </div>

      <div className="h-[calc(100%-7rem)]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-20" />
            <XAxis
              dataKey="time"
              stroke="currentColor"
              className="opacity-60"
              style={{ fontSize: '13px', fontWeight: 500 }}
            />
            <YAxis
              stroke="currentColor"
              className="opacity-60"
              style={{ fontSize: '13px', fontWeight: 500 }}
              label={{ value: '°C', position: 'insideLeft', style: { fontSize: '12px' } }}
              domain={[0, 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500
              }}
            />
            {visibleLines.toolTemp && (
              <Line
                type="monotone"
                dataKey="toolTemp"
                stroke="#3b82f6"
                strokeWidth={2.5}
                name="노즐 실제"
                dot={false}
              />
            )}
            {visibleLines.toolTarget && (
              <Line
                type="monotone"
                dataKey="toolTarget"
                stroke="#60a5fa"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="노즐 타겟"
                dot={false}
              />
            )}
            {visibleLines.bedTemp && (
              <Line
                type="monotone"
                dataKey="bedTemp"
                stroke="#ef4444"
                strokeWidth={2.5}
                name="베드 실제"
                dot={false}
              />
            )}
            {visibleLines.bedTarget && (
              <Line
                type="monotone"
                dataKey="bedTarget"
                stroke="#f87171"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="베드 타겟"
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
