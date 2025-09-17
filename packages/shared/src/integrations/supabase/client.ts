import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

console.log('Supabase 환경 변수 확인:', {
  url: SUPABASE_URL ? '설정됨' : '누락됨',
  key: SUPABASE_PUBLISHABLE_KEY ? '설정됨' : '누락됨',
  urlValue: SUPABASE_URL,
  keyValue: SUPABASE_PUBLISHABLE_KEY?.substring(0, 20) + '...'
});

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('Supabase 환경 변수 누락:', {
    VITE_SUPABASE_URL: SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: SUPABASE_PUBLISHABLE_KEY
  });
  throw new Error("Missing Supabase environment variables. Please check your .env file.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});


