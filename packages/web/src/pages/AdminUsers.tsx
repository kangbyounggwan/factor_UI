import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  TrendingUp,
  Calendar,
  Sparkles,
  Rocket,
  Crown,
  Building2,
  HardDrive,
  Boxes,
  FileCode,
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@shared/integrations/supabase/client';
import { useAuth } from '@shared/contexts/AuthContext';
import { AppHeader } from '@/components/common/AppHeader';
import { AppSidebar } from '@/components/common/AppSidebar';
import { useSidebarState } from '@/hooks/useSidebarState';
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
} from 'recharts';

interface DailySignup {
  date: string;
  count: number;
}

interface PlanUsage {
  plan: string;
  count: number;
  percentage: number;
}

interface UserWithPlan {
  id: string;
  email: string;
  display_name?: string;
  plan_name: string;
  created_at: string;
  // 사용량 정보
  storage_bytes: number;
  model_count: number;
  gcode_count: number;
  report_count: number;
}

const planConfig = {
  free: { label: 'Free', icon: Sparkles, color: '#8b5cf6' },
  starter: { label: 'Starter', icon: Rocket, color: '#f59e0b' },
  pro: { label: 'Pro', icon: Crown, color: '#3b82f6' },
  enterprise: { label: 'Enterprise', icon: Building2, color: '#10b981' },
};

// 스토리지 용량 포맷팅
const formatStorageSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const USERS_PER_PAGE = 10;

type SortColumn = 'index' | 'display_name' | 'email' | 'plan_name' | 'created_at';
type SortDirection = 'asc' | 'desc';

const AdminUsers = () => {
  const { user, signOut } = useAuth();
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarState();
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [dailySignups, setDailySignups] = useState<DailySignup[]>([]);
  const [planUsage, setPlanUsage] = useState<PlanUsage[]>([]);
  const [allUsers, setAllUsers] = useState<UserWithPlan[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [stats, setStats] = useState({
    totalUsers: 0,
    newUsersThisMonth: 0,
    newUsersThisWeek: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  // 페이지 변경 시에만 사용자 목록 로드 (첫 페이지는 loadData에서 로드됨)
  useEffect(() => {
    if (stats.totalUsers > 0 && currentPage > 1) {
      loadUsers(currentPage);
    }
  }, [currentPage]);

  // Edge Function을 통해 관리자 통계 데이터 로드 (서비스 롤 사용)
  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No session found');
        return;
      }

      // 통계 데이터 로드
      const statsResponse = await supabase.functions.invoke('admin-users', {
        body: { action: 'stats' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('[AdminUsers] Stats response:', statsResponse);

      if (statsResponse.error) {
        console.error('Edge function stats error:', statsResponse.error);
        return;
      }

      const statsData = statsResponse.data;

      // 통계 설정
      setStats({
        totalUsers: statsData?.totalUsers || 0,
        newUsersThisMonth: statsData?.newUsersThisMonth || 0,
        newUsersThisWeek: statsData?.newUsersThisWeek || 0,
      });

      // 일별 가입자 추이
      if (statsData?.dailySignups) {
        setDailySignups(statsData.dailySignups);
      }

      // 플랜별 사용량
      if (statsData?.planUsage) {
        setPlanUsage(statsData.planUsage);
      }

      // 첫 페이지 사용자 목록 로드
      const usersResponse = await supabase.functions.invoke('admin-users', {
        body: { action: 'users', page: 1, limit: USERS_PER_PAGE },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('[AdminUsers] Users response:', usersResponse);

      if (usersResponse.error) {
        console.error('Edge function users error:', usersResponse.error);
        return;
      }

      const usersData = usersResponse.data;
      setAllUsers(usersData?.users || []);
      setTotalPages(usersData?.totalPages || 1);

    } catch (error) {
      console.error('Error loading user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // 페이지별 사용자 로드 (Edge Function 사용)
  const loadUsers = async (page: number) => {
    setUsersLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No session found');
        return;
      }

      const response = await supabase.functions.invoke('admin-users', {
        body: { page, limit: USERS_PER_PAGE },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        console.error('Edge function error:', response.error);
        return;
      }

      setAllUsers(response.data.users || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const getPlanBadge = (planName: string) => {
    const config = planConfig[planName as keyof typeof planConfig] || planConfig.free;
    const Icon = config.icon;
    return (
      <Badge
        variant="outline"
        className="flex items-center gap-1"
        style={{ borderColor: config.color, color: config.color }}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // 정렬 핸들러
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // 정렬 아이콘 렌더링
  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // 정렬된 사용자 목록
  const sortedUsers = [...allUsers].sort((a, b) => {
    const planOrder = ['free', 'starter', 'pro', 'enterprise'];
    let aVal: string | number;
    let bVal: string | number;

    switch (sortColumn) {
      case 'index':
        return sortDirection === 'asc' ? 1 : -1; // 인덱스는 서버에서 이미 정렬됨
      case 'display_name':
        aVal = (a.display_name || a.email || '').toLowerCase();
        bVal = (b.display_name || b.email || '').toLowerCase();
        break;
      case 'email':
        aVal = (a.email || '').toLowerCase();
        bVal = (b.email || '').toLowerCase();
        break;
      case 'plan_name':
        aVal = planOrder.indexOf(a.plan_name);
        bVal = planOrder.indexOf(b.plan_name);
        break;
      case 'created_at':
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) {
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">사용자 통계를 불러오는 중...</p>
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
            {/* 페이지 타이틀 */}
            <div className="space-y-1">
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Users className="h-8 w-8 text-primary" />
                사용자 통계
              </h1>
              <p className="text-muted-foreground">
                가입자 추이와 플랜별 사용량을 확인할 수 있습니다.
              </p>
            </div>

            {/* 통계 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <div className="text-3xl font-bold text-primary">{stats.totalUsers}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    전체 사용자
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <div className="text-3xl font-bold text-blue-500">{stats.newUsersThisMonth}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    이번 달 신규
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <div className="text-3xl font-bold text-green-500">{stats.newUsersThisWeek}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    이번 주 신규
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 일별 가입자 추이 차트 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  일별 가입자 추이 (최근 30일)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailySignups}>
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
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                        name="가입자 수"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 플랜별 사용량 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5" />
                    플랜별 사용자 분포
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={planUsage} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          type="number"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis
                          dataKey="plan"
                          type="category"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={(value) => planConfig[value as keyof typeof planConfig]?.label || value}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number, name: string, props: { payload: PlanUsage }) => [
                            `${value}명 (${props.payload.percentage}%)`,
                            '사용자 수'
                          ]}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {planUsage.map((entry) => (
                            <Cell
                              key={entry.plan}
                              fill={planConfig[entry.plan as keyof typeof planConfig]?.color || '#888'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* 플랜별 상세 */}
              <Card>
                <CardHeader>
                  <CardTitle>플랜별 상세</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {planUsage.map((plan) => {
                      const config = planConfig[plan.plan as keyof typeof planConfig] || planConfig.free;
                      const Icon = config.icon;
                      return (
                        <div
                          key={plan.plan}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: `${config.color}20` }}
                            >
                              <Icon className="h-5 w-5" style={{ color: config.color }} />
                            </div>
                            <div>
                              <p className="font-medium">{config.label}</p>
                              <p className="text-sm text-muted-foreground">{plan.percentage}%</p>
                            </div>
                          </div>
                          <div className="text-2xl font-bold" style={{ color: config.color }}>
                            {plan.count}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 전체 가입자 목록 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  전체 가입자
                  <span className="text-sm font-normal text-muted-foreground">
                    ({stats.totalUsers}명)
                  </span>
                </CardTitle>
                {/* 페이지네이션 컨트롤 (상단) */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {currentPage} / {totalPages} 페이지
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || usersLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || usersLoading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-sm text-muted-foreground">사용자 로딩 중...</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">
                            <button
                              className="flex items-center font-medium hover:text-primary transition-colors"
                              onClick={() => handleSort('index')}
                            >
                              #
                              {getSortIcon('index')}
                            </button>
                          </TableHead>
                          <TableHead>
                            <button
                              className="flex items-center font-medium hover:text-primary transition-colors"
                              onClick={() => handleSort('display_name')}
                            >
                              사용자
                              {getSortIcon('display_name')}
                            </button>
                          </TableHead>
                          <TableHead>
                            <button
                              className="flex items-center font-medium hover:text-primary transition-colors"
                              onClick={() => handleSort('email')}
                            >
                              이메일
                              {getSortIcon('email')}
                            </button>
                          </TableHead>
                          <TableHead className="w-[120px]">
                            <button
                              className="flex items-center font-medium hover:text-primary transition-colors"
                              onClick={() => handleSort('plan_name')}
                            >
                              플랜
                              {getSortIcon('plan_name')}
                            </button>
                          </TableHead>
                          <TableHead className="w-[120px]">
                            <button
                              className="flex items-center font-medium hover:text-primary transition-colors"
                              onClick={() => handleSort('created_at')}
                            >
                              가입일
                              {getSortIcon('created_at')}
                            </button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedUsers.map((userItem, index) => (
                          <TableRow key={userItem.id}>
                            <TableCell className="font-mono text-muted-foreground">
                              {(currentPage - 1) * USERS_PER_PAGE + index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-primary font-medium text-sm">
                                    {(userItem.display_name || userItem.email)?.[0]?.toUpperCase() || 'U'}
                                  </span>
                                </div>
                                <span className="font-medium">
                                  {userItem.display_name || '-'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {userItem.email}
                            </TableCell>
                            <TableCell>
                              {getPlanBadge(userItem.plan_name)}
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {new Date(userItem.created_at).toLocaleDateString('ko-KR')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* 페이지네이션 컨트롤 (하단) */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1 || usersLoading}
                    >
                      처음
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || usersLoading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      이전
                    </Button>
                    <span className="px-4 text-sm">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || usersLoading}
                    >
                      다음
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages || usersLoading}
                    >
                      마지막
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
