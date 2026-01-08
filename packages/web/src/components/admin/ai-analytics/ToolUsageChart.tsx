import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Wrench } from 'lucide-react';

interface ToolUsage {
  tool_type: string;
  session_count: number;
  message_count: number;
  avg_messages_per_session: number;
}

interface ToolUsageChartProps {
  data: ToolUsage[];
  loading?: boolean;
  chartType?: 'pie' | 'bar';
}

const toolLabels: Record<string, string> = {
  general: '일반 채팅',
  troubleshoot: '문제진단',
  gcode: 'G-code 분석',
  modeling: '모델링',
};

const toolColors: Record<string, string> = {
  general: '#3b82f6',
  troubleshoot: '#f59e0b',
  gcode: '#10b981',
  modeling: '#8b5cf6',
};

export function ToolUsageChart({
  data,
  loading,
  chartType = 'pie',
}: ToolUsageChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            도구별 사용량
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const processedData = data.map((item) => ({
    ...item,
    name: toolLabels[item.tool_type] || item.tool_type,
    color: toolColors[item.tool_type] || '#6b7280',
  }));

  const total = processedData.reduce((sum, item) => sum + item.session_count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          도구별 사용량
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'pie' ? (
              <PieChart>
                <Pie
                  data={processedData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="session_count"
                  nameKey="name"
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {processedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}회`, '세션 수']}
                />
                <Legend />
              </PieChart>
            ) : (
              <BarChart data={processedData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  type="number"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="session_count" name="세션 수" radius={[0, 4, 4, 0]}>
                  {processedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* 상세 통계 */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {processedData.map((item) => (
            <div
              key={item.tool_type}
              className="flex items-center justify-between p-2 rounded-lg border"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm">{item.name}</span>
              </div>
              <span className="text-sm font-medium">
                {item.session_count}회
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default ToolUsageChart;
