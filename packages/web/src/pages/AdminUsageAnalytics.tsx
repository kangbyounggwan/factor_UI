import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  RefreshCw,
  ArrowLeft,
  Zap,
  HardDrive,
  Users,
  TrendingUp,
  Box,
  MessageSquare,
  FileCode,
  Image,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { supabase } from '@shared/integrations/supabase/client';
import { useAuth } from '@shared/contexts/AuthContext';
import { AppHeader } from '@/components/common/AppHeader';
import { AppSidebar } from '@/components/common/AppSidebar';
import { useSidebarState } from '@/hooks/useSidebarState';

interface AIStats {
  chat: {
    totalSessions: number;
    totalMessages: number;
    sessionsLastWeek: number;
  };
  troubleshoot: {
    totalSessions: number;
    resolvedSessions: number;
    resolutionRate: number;
  };
  aiModels: {
    total: number;
    textTo3d: number;
    imageTo3d: number;
    textToImage: number;
    lastWeek: number;
  };
  gcode: {
    totalReports: number;
    avgScore: number;
  };
  usage: {
    totalModelGenerations: number;
    totalImageGenerations: number;
  };
}

interface DailyUsage {
  date: string;
  chat_sessions: number;
  chat_messages: number;
  troubleshoot_sessions: number;
  model_generations: number;
  gcode_analyses: number;
}

interface TopUser {
  user_id: string;
  email: string;
  display_name: string;
  total_chat_sessions: number;
  total_models_generated: number;
  total_gcode_analyses: number;
  total_activity: number;
}

interface ToolUsage {
  tool_type: string;
  session_count: number;
  message_count: number;
  avg_messages_per_session: number;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const AdminUsageAnalytics = () => {
  const { user, signOut } = useAuth();
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarState();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(30);

  const [stats, setStats] = useState<AIStats | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [toolUsage, setToolUsage] = useState<ToolUsage[]>([]);

  const callAnalyticsAPI = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const response = await supabase.functions.invoke('admin-ai-analytics', {
      body: { action, ...params },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (response.error) throw response.error;
    return response.data;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, dailyData, topUsersData, toolData] = await Promise.all([
        callAnalyticsAPI('stats', { days }),
        callAnalyticsAPI('daily-usage', { days }),
        callAnalyticsAPI('top-users', { limit: 10, days }),
        callAnalyticsAPI('tool-usage', { days }),
      ]);

      setStats(statsData);
      setDailyUsage(dailyData?.dailyUsage || []);
      setTopUsers(topUsersData?.topUsers || []);
      setToolUsage(toolData?.toolUsage || []);
    } catch (error) {
      console.error('Error loading usage analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [callAnalyticsAPI, days]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !stats) {
    return (
      <div className="h-screen flex overflow-hidden">
        <AppSidebar
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
          user={user}
          onSignOut={signOut}
          mode="admin"
        />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader sidebarOpen={sidebarOpen} />
          <div className="flex-1 overflow-y-auto bg-background p-6">
            <div className="max-w-7xl mx-auto">
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="mt-4 text-muted-foreground">사용량 분석 데이터를 불러오는 중...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 일별 총 활동량 계산
  const dailyTotalActivity = dailyUsage.map((d) => ({
    ...d,
    total: d.chat_sessions + d.troubleshoot_sessions + d.model_generations + d.gcode_analyses,
  }));

  // 카테고리별 통계
  const categoryStats = [
    {
      name: '채팅',
      value: stats?.chat.totalSessions || 0,
      icon: MessageSquare,
      color: '#3b82f6',
    },
    {
      name: '문제진단',
      value: stats?.troubleshoot.totalSessions || 0,
      icon: Zap,
      color: '#f59e0b',
    },
    {
      name: '모델 생성',
      value: stats?.aiModels.total || 0,
      icon: Box,
      color: '#8b5cf6',
    },
    {
      name: 'G-code 분석',
      value: stats?.gcode.totalReports || 0,
      icon: FileCode,
      color: '#10b981',
    },
  ];

  const toolLabels: Record<string, string> = {
    general: '일반 채팅',
    troubleshoot: '문제진단',
    gcode: 'G-code',
    ai_model: 'AI 모델 생성',
    comparison: '비교 분석',
    price_comparison: '가격 비교',
  };

  const toolColors: Record<string, string> = {
    general: '#3b82f6',
    troubleshoot: '#f59e0b',
    gcode: '#10b981',
    ai_model: '#8b5cf6',
    comparison: '#6b7280',
    price_comparison: '#ec4899',
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <AppSidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        user={user}
        onSignOut={signOut}
        mode="admin"
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader sidebarOpen={sidebarOpen} />

        <div className="flex-1 overflow-y-auto bg-background p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* 페이지 헤더 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Link to="/admin/ai-analytics">
                    <Button variant="ghost" size="icon">
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                  </Link>
                  <h1 className="text-3xl font-bold flex items-center gap-2">
                    <BarChart3 className="h-8 w-8 text-emerald-500" />
                    사용량 분석
                  </h1>
                </div>
                <p className="text-muted-foreground ml-10">
                  전체 AI 기능 사용량과 리소스 현황을 분석합니다.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Select
                  value={days.toString()}
                  onValueChange={(v) => setDays(parseInt(v))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">최근 7일</SelectItem>
                    <SelectItem value="14">최근 14일</SelectItem>
                    <SelectItem value="30">최근 30일</SelectItem>
                    <SelectItem value="90">최근 90일</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  새로고침
                </Button>
              </div>
            </div>

            {/* 카테고리별 요약 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categoryStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.name}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${stat.color}20` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: stat.color }} />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{formatNumber(stat.value)}</p>
                          <p className="text-sm text-muted-foreground">{stat.name}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* 사용량 생성 통계 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-500/10">
                      <Box className="h-5 w-5 text-violet-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">총 모델 생성</p>
                        <p className="text-xl font-bold">
                          {formatNumber(stats?.usage.totalModelGenerations || 0)}
                        </p>
                      </div>
                      <Progress
                        value={Math.min(100, ((stats?.usage.totalModelGenerations || 0) / 1000) * 100)}
                        className="h-2 mt-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-pink-500/10">
                      <Image className="h-5 w-5 text-pink-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">총 이미지 생성</p>
                        <p className="text-xl font-bold">
                          {formatNumber(stats?.usage.totalImageGenerations || 0)}
                        </p>
                      </div>
                      <Progress
                        value={Math.min(100, ((stats?.usage.totalImageGenerations || 0) / 500) * 100)}
                        className="h-2 mt-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 일별 총 활동량 추이 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  일별 총 AI 활동량
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyTotalActivity}>
                      <defs>
                        <linearGradient id="gradientTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        name="총 활동"
                        stroke="#10b981"
                        fill="url(#gradientTotal)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 도구별 사용량 & 상위 사용자 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 도구별 사용량 바 차트 */}
              <Card>
                <CardHeader>
                  <CardTitle>도구별 세션 사용량</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={toolUsage} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          type="number"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis
                          dataKey="tool_type"
                          type="category"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={(value) => toolLabels[value] || value}
                          width={80}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number) => [`${value}회`, '세션']}
                        />
                        <Bar dataKey="session_count" name="세션 수" radius={[0, 4, 4, 0]}>
                          {toolUsage.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={toolColors[entry.tool_type] || '#6b7280'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* 상위 사용자 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    활발한 사용자 TOP 10
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {topUsers.map((topUser, index) => (
                      <div
                        key={topUser.user_id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50"
                      >
                        <Badge
                          variant={index < 3 ? 'default' : 'outline'}
                          className="w-6 h-6 rounded-full p-0 flex items-center justify-center"
                        >
                          {index + 1}
                        </Badge>
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-primary text-sm font-medium">
                            {(topUser.display_name || topUser.email)?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {topUser.display_name || topUser.email || '알 수 없음'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="text-blue-500">{topUser.total_chat_sessions} 채팅</span>
                            <span className="text-violet-500">{topUser.total_models_generated} 모델</span>
                            <span className="text-emerald-500">{topUser.total_gcode_analyses} 분석</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{topUser.total_activity}</p>
                        </div>
                      </div>
                    ))}

                    {topUsers.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>사용자 데이터가 없습니다</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 일별 상세 추이 */}
            <Card>
              <CardHeader>
                <CardTitle>일별 카테고리별 사용량 추이</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyUsage}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="chat_sessions"
                        name="채팅"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="troubleshoot_sessions"
                        name="문제진단"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="model_generations"
                        name="모델 생성"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="gcode_analyses"
                        name="G-code 분석"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsageAnalytics;
