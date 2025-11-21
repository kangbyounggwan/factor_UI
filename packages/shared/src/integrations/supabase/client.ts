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
// - detectSessionInUrl: true - Supabase가 URL에서 자동으로 token 처리
// - flowType: 'implicit' - URL hash로 직접 access_token 반환 (code_verifier 불필요)
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // Supabase가 URL hash에서 자동으로 token 처리
    flowType: 'implicit',
  },
});


