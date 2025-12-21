// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserWithUsage {
  id: string;
  email: string;
  display_name: string | null;
  plan_name: string;
  created_at: string;
  storage_bytes: number;
  model_count: number;
  gcode_count: number;
  report_count: number;
}

interface DailySignup {
  date: string;
  count: number;
}

interface PlanUsage {
  plan: string;
  count: number;
  percentage: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 인증 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase 클라이언트 생성 (서비스 롤)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 사용자 인증 확인
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 관리자 권한 확인
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 요청 바디 파싱
    let body: { action?: string; page?: number; limit?: number } = {};
    try {
      body = await req.json();
    } catch {
      // 빈 바디 허용
    }

    const action = body.action || 'users';
    const page = body.page || 1;
    const limit = body.limit || 10;
    const offset = (page - 1) * limit;

    // 전체 사용자 수 조회
    const { count: totalUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // action이 'dashboard'인 경우 관리자 대시보드 데이터 반환
    if (action === 'dashboard') {
      // 디바이스 목록 조회
      const { data: devices } = await supabaseAdmin
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      // 사용자 role 통계
      const { data: roles } = await supabaseAdmin
        .from('profiles')
        .select('user_id, role');

      const activeDeviceCount = (devices || []).filter((d: { status: string }) => d.status === 'active').length;
      const adminCount = (roles || []).filter((r: { role: string }) => r.role === 'admin').length;

      return new Response(
        JSON.stringify({
          devices: devices || [],
          stats: {
            totalDevices: devices?.length || 0,
            activeDevices: activeDeviceCount,
            totalUsers: totalUsers || 0,
            adminUsers: adminCount,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // action이 'stats'인 경우 통계 데이터 반환
    if (action === 'stats') {
      // 일별 가입자 추이 (최근 30일)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: profilesData } = await supabaseAdmin
        .from('profiles')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      // 일별로 그룹핑
      const dailyMap = new Map<string, number>();
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyMap.set(dateStr, 0);
      }

      profilesData?.forEach((profile: { created_at: string }) => {
        const dateStr = new Date(profile.created_at).toISOString().split('T')[0];
        if (dailyMap.has(dateStr)) {
          dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
        }
      });

      const dailySignups: DailySignup[] = Array.from(dailyMap.entries()).map(([date, count]) => ({
        date: date.slice(5), // MM-DD 형식
        count,
      }));

      // 이번 달 / 이번 주 통계
      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);

      const { count: newThisMonth } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thisMonthStart.toISOString());

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { count: newThisWeek } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString());

      // 플랜별 사용량
      const { data: subscriptions } = await supabaseAdmin
        .from('user_subscriptions')
        .select('plan_name, status')
        .in('status', ['active', 'canceled', 'trial']);

      const planCounts = new Map<string, number>();
      ['free', 'starter', 'pro', 'enterprise'].forEach(plan => planCounts.set(plan, 0));

      subscriptions?.forEach((sub: { plan_name: string }) => {
        planCounts.set(sub.plan_name, (planCounts.get(sub.plan_name) || 0) + 1);
      });

      // free 사용자 = 전체 - 유료 구독자
      const paidUsers = subscriptions?.length || 0;
      planCounts.set('free', (totalUsers || 0) - paidUsers);

      const total = totalUsers || 1;
      const planUsage: PlanUsage[] = Array.from(planCounts.entries()).map(([plan, count]) => ({
        plan,
        count,
        percentage: Math.round((count / total) * 100),
      }));

      return new Response(
        JSON.stringify({
          totalUsers: totalUsers || 0,
          newUsersThisMonth: newThisMonth || 0,
          newUsersThisWeek: newThisWeek || 0,
          dailySignups,
          planUsage,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 사용자 목록 조회 (서비스 롤 사용)
    // profiles 테이블에는 email이 없으므로 user_id, display_name, created_at만 조회
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, display_name, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (profilesError) {
      console.error('Profiles query error:', profilesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profiles', details: profilesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 각 사용자별 플랜 정보와 이메일 조회
    const usersWithUsage: UserWithUsage[] = await Promise.all(
      (profiles || []).map(async (profile) => {
        let planName = 'free';
        let email = '';

        // auth.users에서 이메일 조회
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
        if (userData?.user?.email) {
          email = userData.user.email;
        }

        // 플랜 정보 조회
        const { data: subData } = await supabaseAdmin
          .from('user_subscriptions')
          .select('plan_name')
          .eq('user_id', profile.user_id)
          .in('status', ['active', 'canceled', 'trial'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (subData && subData.length > 0 && subData[0].plan_name) {
          planName = subData[0].plan_name;
        }

        return {
          id: profile.user_id,
          email: email,
          display_name: profile.display_name,
          plan_name: planName,
          created_at: profile.created_at,
          storage_bytes: 0,
          model_count: 0,
          gcode_count: 0,
          report_count: 0,
        };
      })
    );

    return new Response(
      JSON.stringify({
        users: usersWithUsage,
        totalUsers: totalUsers || 0,
        page,
        limit,
        totalPages: Math.ceil((totalUsers || 0) / limit),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
