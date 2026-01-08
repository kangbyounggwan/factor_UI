import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Brain,
  RefreshCw,
  MessageSquare,
  Box,
  BarChart3,
  ChevronRight,
  Cloud,
} from 'lucide-react';
import { supabase } from '@shared/integrations/supabase/client';
import { useAuth } from '@shared/contexts/AuthContext';
import { AppHeader } from '@/components/common/AppHeader';
import { AppSidebar } from '@/components/common/AppSidebar';
import { useSidebarState } from '@/hooks/useSidebarState';
import {
  KeywordCloud,
  KeywordSourceFilter,
  StatsSummaryCards,
  DailyUsageChart,
  ToolUsageChart,
  TopUsersList,
  PopularPromptsList,
} from '@/components/admin/ai-analytics';

// 타입 정의
interface AIStats {
  chat: {
    totalSessions: number;
    totalMessages: number;
    sessionsLastWeek: number;
  };
  troubleshoot: {
    totalSessions: number;
    totalMessages: number;
    sessionsLastWeek: number;
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

interface KeywordData {
  keyword: string;
  count: number;
  source_type: string;
}

interface DailyUsage {
  date: string;
  chat_sessions: number;
  chat_messages: number;
  troubleshoot_sessions: number;
  model_generations: number;
  gcode_analyses: number;
}

interface ToolUsage {
  tool_type: string;
  session_count: number;
  message_count: number;
  avg_messages_per_session: number;
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

interface PopularPrompt {
  prompt: string;
  generation_type: string;
  usage_count: number;
  success_rate: number;
}

const AdminAIAnalytics = () => {
  const { user, signOut } = useAuth();
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarState();

  // 상태
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(30);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  // 데이터
  const [stats, setStats] = useState<AIStats | null>(null);
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [toolUsage, setToolUsage] = useState<ToolUsage[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [popularPrompts, setPopularPrompts] = useState<PopularPrompt[]>([]);

  // API 호출 함수
  const callAnalyticsAPI = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const response = await supabase.functions.invoke('admin-ai-analytics', {
      body: { action, ...params },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (response.error) {
      console.error(`API error for ${action}:`, response.error);
      throw response.error;
    }

    return response.data;
  }, []);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 병렬로 모든 데이터 로드
      const [
        statsData,
        keywordsData,
        dailyData,
        toolData,
        topUsersData,
        promptsData,
      ] = await Promise.all([
        callAnalyticsAPI('stats'),
        callAnalyticsAPI('keywords', { days, source_type: sourceFilter, limit: 100 }),
        callAnalyticsAPI('daily-usage', { days }),
        callAnalyticsAPI('tool-usage', { days }),
        callAnalyticsAPI('top-users', { limit: 10 }),
        callAnalyticsAPI('popular-prompts', { days, limit: 10 }),
      ]);

      setStats(statsData);
      setKeywords(keywordsData?.keywords || []);
      setDailyUsage(dailyData?.dailyUsage || []);
      setToolUsage(toolData?.toolUsage || []);
      setTopUsers(topUsersData?.topUsers || []);
      setPopularPrompts(promptsData?.popularPrompts || []);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  }, [callAnalyticsAPI, days, sourceFilter]);

  // 새로고침
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // 키워드 필터 변경 시 키워드만 다시 로드
  const handleSourceFilterChange = async (source: string | null) => {
    setSourceFilter(source);
    try {
      const keywordsData = await callAnalyticsAPI('keywords', {
        days,
        source_type: source,
        limit: 100,
      });
      setKeywords(keywordsData?.keywords || []);
    } catch (error) {
      console.error('Error loading keywords:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 키워드 클릭 핸들러
  const handleKeywordClick = (keyword: string) => {
    // TODO: 해당 키워드가 포함된 채팅/프롬프트 검색
    console.log('Keyword clicked:', keyword);
  };

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
                <p className="mt-4 text-muted-foreground">AI 분석 데이터를 불러오는 중...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Brain className="h-8 w-8 text-primary" />
                  AI 분석 대시보드
                </h1>
                <p className="text-muted-foreground">
                  AI 기능 사용량과 키워드 분석을 확인할 수 있습니다.
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

            {/* 요약 통계 카드 */}
            <StatsSummaryCards stats={stats} loading={loading} />

            {/* 키워드 클라우드 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  검색 키워드 클라우드
                </CardTitle>
                <KeywordSourceFilter
                  selectedSource={sourceFilter}
                  onSourceChange={handleSourceFilterChange}
                />
              </CardHeader>
              <CardContent>
                <KeywordCloud
                  keywords={keywords}
                  maxFontSize={48}
                  minFontSize={12}
                  onKeywordClick={handleKeywordClick}
                  className="min-h-[250px]"
                />
              </CardContent>
            </Card>

            {/* 일별 사용량 추이 */}
            <DailyUsageChart data={dailyUsage} loading={loading} chartType="area" />

            {/* 2열 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 도구별 사용량 */}
              <ToolUsageChart data={toolUsage} loading={loading} chartType="pie" />

              {/* 인기 프롬프트 */}
              <PopularPromptsList prompts={popularPrompts} loading={loading} />
            </div>

            {/* 상위 사용자 */}
            <TopUsersList users={topUsers} loading={loading} />

            {/* 상세 분석 링크 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link to="/admin/ai-analytics/chat">
                <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <MessageSquare className="h-6 w-6 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium">채팅 분석</p>
                        <p className="text-sm text-muted-foreground">대화 패턴 상세 분석</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </CardContent>
                </Card>
              </Link>

              <Link to="/admin/ai-analytics/models">
                <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-violet-500/10">
                        <Box className="h-6 w-6 text-violet-500" />
                      </div>
                      <div>
                        <p className="font-medium">모델 생성 분석</p>
                        <p className="text-sm text-muted-foreground">AI 모델 생성 통계</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </CardContent>
                </Card>
              </Link>

              <Link to="/admin/ai-analytics/usage">
                <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <BarChart3 className="h-6 w-6 text-emerald-500" />
                      </div>
                      <div>
                        <p className="font-medium">사용량 분석</p>
                        <p className="text-sm text-muted-foreground">리소스 사용 현황</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAIAnalytics;
