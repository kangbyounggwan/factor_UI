import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('Supabase 환경 변수 누락:');
  throw new Error("Missing Supabase environment variables. Please check your .env file.");
}

// Supabase 클라이언트 설정
// - persistSession: 세션을 localStorage에 저장
// - autoRefreshToken: 토큰 자동 갱신
// - detectSessionInUrl: false - 콜백 페이지에서 수동으로 exchangeCodeForSession 호출
// - flowType: 'pkce' - OAuth PKCE 흐름 사용 (보안 강화)
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // 중복 호출 방지: AuthCallback에서 직접 처리
    flowType: 'pkce',
    // storageKey, storage 커스텀 제거 - Supabase 기본값 사용
  },
});


