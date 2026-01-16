import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquare,
  RefreshCw,
  ArrowLeft,
  Image,
  Share2,
  TrendingUp,
  CheckCircle,
  Clock,
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
import { AdminSidebarContent } from '@/components/sidebar';
import { useSidebarState } from '@/hooks/useSidebarState';
import { KeywordCloud, KeywordSourceFilter } from '@/components/admin/ai-analytics';

interface ChatAnalytics {
  toolDistribution: {
    tool_type: string;
    count: number;
    percentage: number;
  }[];
  imageAttachmentRate: number;
  avgMessagesPerSession: number;
  totalSharedChats: number;
}

interface DailyUsage {
  date: string;
  chat_sessions: number;
  chat_messages: number;
  troubleshoot_sessions: number;
  model_generations: number;
  gcode_analyses: number;
}

interface KeywordData {
  keyword: string;
  count: number;
  source_type: string;
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

const AdminChatAnalytics = () => {
  const { user, signOut } = useAuth();
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarState();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(30);
  const [sourceFilter, setSourceFilter] = useState<string | null>('chat');

  const [chatAnalytics, setChatAnalytics] = useState<ChatAnalytics | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
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
      const [chatData, dailyData, keywordsData] = await Promise.all([
        callAnalyticsAPI('chat-analytics', { days }),
        callAnalyticsAPI('daily-usage', { days }),
        callAnalyticsAPI('keywords', { days, source_type: sourceFilter, limit: 80 }),
      ]);

      setChatAnalytics(chatData);
      setDailyUsage(dailyData?.dailyUsage || []);
      setKeywords(keywordsData?.keywords || []);
    } catch (error) {
      console.error('Error loading chat analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [callAnalyticsAPI, days, sourceFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSourceFilterChange = async (source: string | null) => {
    setSourceFilter(source);
    try {
      const keywordsData = await callAnalyticsAPI('keywords', {
        days,
        source_type: source,
        limit: 80,
      });
      setKeywords(keywordsData?.keywords || []);
    } catch (error) {
      console.error('Error loading keywords:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !chatAnalytics) {
    return (
      <div className="h-screen flex overflow-hidden">
        <AppSidebar
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
          user={user}
          onSignOut={signOut}
        >
          <AdminSidebarContent />
        </AppSidebar>
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader sidebarOpen={sidebarOpen} />
          <div className="flex-1 overflow-y-auto bg-background p-6">
            <div className="max-w-7xl mx-auto">
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="mt-4 text-muted-foreground">채팅 분석 데이터를 불러오는 중...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pieData = chatAnalytics?.toolDistribution?.map((item) => ({
    name: toolLabels[item.tool_type] || item.tool_type,
    value: item.count,
    color: toolColors[item.tool_type] || '#6b7280',
  })) || [];

  return (
    <div className="h-screen flex overflow-hidden">
      <AppSidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        user={user}
        onSignOut={signOut}
      >
        <AdminSidebarContent />
      </AppSidebar>

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
                    <MessageSquare className="h-8 w-8 text-blue-500" />
                    채팅 분석
                  </h1>
                </div>
                <p className="text-muted-foreground ml-10">
                  사용자 대화 패턴과 도구 사용 현황을 분석합니다.
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
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <MessageSquare className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {chatAnalytics?.avgMessagesPerSession || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">평균 메시지/세션</p>
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
                    <div>
                      <p className="text-2xl font-bold">
                        {chatAnalytics?.imageAttachmentRate || 0}%
                      </p>
                      <p className="text-sm text-muted-foreground">이미지 첨부율</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Share2 className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {chatAnalytics?.totalSharedChats || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">공유된 채팅</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <CheckCircle className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {pieData.reduce((sum, item) => sum + item.value, 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">총 세션 수</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 키워드 클라우드 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>대화 키워드</CardTitle>
                <KeywordSourceFilter
                  selectedSource={sourceFilter}
                  onSourceChange={handleSourceFilterChange}
                />
              </CardHeader>
              <CardContent>
                <KeywordCloud
                  keywords={keywords}
                  maxFontSize={40}
                  minFontSize={12}
                  className="min-h-[200px]"
                />
              </CardContent>
            </Card>

            {/* 차트 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 도구별 분포 */}
              <Card>
                <CardHeader>
                  <CardTitle>도구별 세션 분포</CardTitle>
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

              {/* 도구별 상세 */}
              <Card>
                <CardHeader>
                  <CardTitle>도구별 상세 통계</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {chatAnalytics?.toolDistribution?.map((item) => (
                      <div
                        key={item.tool_type}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: toolColors[item.tool_type] }}
                          />
                          <span className="font-medium">
                            {toolLabels[item.tool_type] || item.tool_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline">{item.count}회</Badge>
                          <span className="text-sm text-muted-foreground w-12 text-right">
                            {item.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 일별 채팅 추이 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  일별 채팅 추이
                </CardTitle>
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
                        name="채팅 세션"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="chat_messages"
                        name="채팅 메시지"
                        stroke="#60a5fa"
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

export default AdminChatAnalytics;
