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
  Box,
  RefreshCw,
  ArrowLeft,
  Image,
  CheckCircle,
  XCircle,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { supabase } from '@shared/integrations/supabase/client';
import { useAuth } from '@shared/contexts/AuthContext';
import { AppHeader } from '@/components/common/AppHeader';
import { AppSidebar } from '@/components/common/AppSidebar';
import { useSidebarState } from '@/hooks/useSidebarState';
import { KeywordCloud } from '@/components/admin/ai-analytics';

interface ModelStats {
  generation_type: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  avg_file_size: number;
}

interface DailyUsage {
  date: string;
  model_generations: number;
}

interface PopularPrompt {
  prompt: string;
  generation_type: string;
  usage_count: number;
  success_rate: number;
}

interface KeywordData {
  keyword: string;
  count: number;
  source_type: string;
}

const typeConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  text_to_3d: { label: 'Text to 3D', color: '#8b5cf6', icon: Box },
  image_to_3d: { label: 'Image to 3D', color: '#ec4899', icon: Image },
  text_to_image: { label: 'Text to Image', color: '#3b82f6', icon: Image },
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const AdminModelAnalytics = () => {
  const { user, signOut } = useAuth();
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarState();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(30);

  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [popularPrompts, setPopularPrompts] = useState<PopularPrompt[]>([]);
  const [keywords, setKeywords] = useState<KeywordData[]>([]);

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
      const [modelData, dailyData, promptsData, keywordsData] = await Promise.all([
        callAnalyticsAPI('model-stats', { days }),
        callAnalyticsAPI('daily-usage', { days }),
        callAnalyticsAPI('popular-prompts', { days, limit: 15 }),
        callAnalyticsAPI('keywords', { days, source_type: 'model_prompt', limit: 60 }),
      ]);

      setModelStats(modelData?.modelStats || []);
      setDailyUsage(dailyData?.dailyUsage || []);
      setPopularPrompts(promptsData?.popularPrompts || []);
      setKeywords(keywordsData?.keywords || []);
    } catch (error) {
      console.error('Error loading model analytics:', error);
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

  if (loading && modelStats.length === 0) {
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
                <p className="mt-4 text-muted-foreground">모델 생성 분석 데이터를 불러오는 중...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 전체 통계 계산
  const totalModels = modelStats.reduce((sum, s) => sum + s.total_count, 0);
  const totalSuccess = modelStats.reduce((sum, s) => sum + s.success_count, 0);
  const totalFailed = modelStats.reduce((sum, s) => sum + s.failed_count, 0);
  const overallSuccessRate = totalModels > 0 ? Math.round((totalSuccess / totalModels) * 100) : 0;

  // 파이 차트 데이터
  const pieData = modelStats.map((stat) => ({
    name: typeConfig[stat.generation_type]?.label || stat.generation_type,
    value: stat.total_count,
    color: typeConfig[stat.generation_type]?.color || '#6b7280',
  }));

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
                    <Box className="h-8 w-8 text-violet-500" />
                    모델 생성 분석
                  </h1>
                </div>
                <p className="text-muted-foreground ml-10">
                  AI 3D 모델 및 이미지 생성 통계를 분석합니다.
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

            {/* 요약 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-500/10">
                      <Box className="h-5 w-5 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalModels}</p>
                      <p className="text-sm text-muted-foreground">총 생성 수</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalSuccess}</p>
                      <p className="text-sm text-muted-foreground">성공</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <XCircle className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalFailed}</p>
                      <p className="text-sm text-muted-foreground">실패</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{overallSuccessRate}%</p>
                      <p className="text-sm text-muted-foreground">성공률</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 프롬프트 키워드 클라우드 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  프롬프트 키워드
                </CardTitle>
              </CardHeader>
              <CardContent>
                <KeywordCloud
                  keywords={keywords}
                  maxFontSize={36}
                  minFontSize={12}
                  className="min-h-[180px]"
                />
              </CardContent>
            </Card>

            {/* 차트 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 생성 타입별 분포 */}
              <Card>
                <CardHeader>
                  <CardTitle>생성 타입별 분포</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* 타입별 상세 통계 */}
              <Card>
                <CardHeader>
                  <CardTitle>타입별 상세 통계</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {modelStats.map((stat) => {
                      const config = typeConfig[stat.generation_type] || {
                        label: stat.generation_type,
                        color: '#6b7280',
                        icon: Box,
                      };
                      const successRate = stat.total_count > 0
                        ? Math.round((stat.success_count / stat.total_count) * 100)
                        : 0;

                      return (
                        <div key={stat.generation_type} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: config.color }}
                              />
                              <span className="font-medium">{config.label}</span>
                            </div>
                            <Badge variant="outline">{stat.total_count}회</Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">성공: </span>
                              <span className="text-green-500">{stat.success_count}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">실패: </span>
                              <span className="text-red-500">{stat.failed_count}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">크기: </span>
                              <span>{formatFileSize(stat.avg_file_size)}</span>
                            </div>
                          </div>
                          <div className="mt-2">
                            <Progress value={successRate} className="h-2" />
                            <p className="text-xs text-muted-foreground mt-1">
                              성공률 {successRate}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 일별 생성 추이 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  일별 모델 생성 추이
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyUsage}>
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
                      <Bar
                        dataKey="model_generations"
                        name="모델 생성"
                        fill="#8b5cf6"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 인기 프롬프트 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-500" />
                  인기 프롬프트 TOP 15
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {popularPrompts.map((prompt, index) => {
                    const config = typeConfig[prompt.generation_type] || {
                      label: prompt.generation_type,
                      color: '#6b7280',
                    };

                    return (
                      <div
                        key={`${prompt.prompt}-${index}`}
                        className="p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm flex-1 line-clamp-2">
                            "{prompt.prompt}"
                          </p>
                          <Badge variant="outline" className="shrink-0">
                            {prompt.usage_count}회
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <Badge
                            variant="secondary"
                            style={{
                              backgroundColor: `${config.color}20`,
                              color: config.color,
                            }}
                          >
                            {config.label}
                          </Badge>
                          <span className="text-muted-foreground">
                            성공률 {prompt.success_rate}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminModelAnalytics;
