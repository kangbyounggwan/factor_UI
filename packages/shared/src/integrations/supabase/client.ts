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
// - detectSessionInUrl: false - 모바일/딥링크 직접 처리를 위해 비활성화
//   (Supabase가 자동으로 URL 분석해서 세션 생성하면 딥링크 핸들러와 충돌)
// - flowType: 'implicit' - URL hash로 직접 access_token 반환 (code_verifier 불필요)
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // 모바일 딥링크에서 직접 setSession() 호출하므로 비활성화
    flowType: 'implicit',
  },
});


