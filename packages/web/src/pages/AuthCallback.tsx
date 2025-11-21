import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@shared/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

/**
 * OAuth 콜백 핸들러
 * detectSessionInUrl: true 설정으로 Supabase가 자동으로 code exchange 처리
 * 이 페이지는 세션 완료를 대기하고 적절한 페이지로 리다이렉트
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // URL에서 에러 확인
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');

    if (errorDesc) {
      setError(errorDesc);
      return;
    }

    // 리다이렉트 처리 함수
    const handleRedirect = async (session: Session | null) => {
      if (!session?.user) {
        navigate('/auth', { replace: true });
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, phone')
          .eq('user_id', session.user.id)
          .maybeSingle();

        const needsSetup = !profile || !profile.display_name || !profile.phone;
        console.log('[AuthCallback] Redirecting to:', needsSetup ? '/profile-setup' : '/dashboard');
        navigate(needsSetup ? '/profile-setup' : '/dashboard', { replace: true });
      } catch {
        navigate('/dashboard', { replace: true });
      }
    };

    // Supabase가 자동으로 code exchange 처리 (detectSessionInUrl: true)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthCallback] Auth state change:', event);

      if (event === 'SIGNED_IN') {
        subscription.unsubscribe(); // 즉시 구독 해제
        handleRedirect(session);
      }
    });

    // 이미 세션이 있는 경우 확인 (약간의 지연 후)
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        console.log('[AuthCallback] Existing session found');
        subscription.unsubscribe();
        handleRedirect(session);
      }
    }, 500);

    // 타임아웃: 15초 후에도 처리되지 않으면 auth로 리다이렉트
    const timeout = setTimeout(() => {
      console.log('[AuthCallback] Timeout reached');
      navigate('/auth', { replace: true });
    }, 15000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
      clearTimeout(timeout);
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="text-destructive text-lg mb-4">로그인 실패</div>
        <div className="text-muted-foreground mb-4">{error}</div>
        <button
          onClick={() => navigate('/auth', { replace: true })}
          className="text-primary underline"
        >
          로그인 페이지로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <div className="text-muted-foreground">로그인 처리 중...</div>
    </div>
  );
};

export default AuthCallback;
