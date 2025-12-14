import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@shared/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

/**
 * OAuth 콜백 핸들러
 * detectSessionInUrl: false이므로 URL hash에서 토큰을 직접 파싱하여 세션 설정
 * implicit flow에서는 access_token이 URL hash로 전달됨
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processOAuthCallback = async () => {
      // URL에서 에러 확인
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const searchParams = new URLSearchParams(window.location.search);
      const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');

      if (errorDesc) {
        console.error('[AuthCallback] OAuth error:', errorDesc);
        setError(errorDesc);
        return;
      }

      // implicit flow: hash에서 access_token 추출
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      console.log('[AuthCallback] Hash params:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        hash: window.location.hash.substring(0, 50) + '...',
      });

      // 리다이렉트 처리 함수
      const handleRedirect = async (session: Session | null) => {
        if (!session?.user) {
          console.log('[AuthCallback] No session, redirecting to /auth');
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
        } catch (err) {
          console.error('[AuthCallback] Profile check error:', err);
          navigate('/dashboard', { replace: true });
        }
      };

      // access_token이 있으면 setSession으로 세션 설정
      if (accessToken) {
        console.log('[AuthCallback] Setting session from hash tokens...');
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (sessionError) {
          console.error('[AuthCallback] setSession error:', sessionError);
          setError(sessionError.message);
          return;
        }

        console.log('[AuthCallback] Session set successfully');
        handleRedirect(data.session);
        return;
      }

      // hash에 토큰이 없는 경우: 기존 세션 확인
      console.log('[AuthCallback] No hash token, checking existing session...');
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        console.log('[AuthCallback] Existing session found');
        handleRedirect(session);
        return;
      }

      // 세션도 없고 토큰도 없으면 auth 이벤트 대기
      console.log('[AuthCallback] No session, waiting for auth state change...');
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
        console.log('[AuthCallback] Auth state change:', event);
        if (event === 'SIGNED_IN') {
          subscription.unsubscribe();
          handleRedirect(sess);
        }
      });

      // 타임아웃: 10초 후에도 처리되지 않으면 auth로 리다이렉트
      setTimeout(() => {
        console.log('[AuthCallback] Timeout reached, redirecting to /auth');
        subscription.unsubscribe();
        navigate('/auth', { replace: true });
      }, 10000);
    };

    processOAuthCallback();
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
