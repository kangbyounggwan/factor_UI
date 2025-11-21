import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@shared/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // PKCE 흐름: URL에서 code를 추출하여 세션으로 교환
        const url = window.location.href;
        const hasCode = url.includes('code=');
        const hasAccessToken = url.includes('access_token=');

        console.log('[AuthCallback] Processing OAuth callback', { hasCode, hasAccessToken });

        if (hasCode) {
          // PKCE 흐름 - code를 세션으로 교환
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(url);

          if (exchangeError) {
            console.error('[AuthCallback] Code exchange error:', exchangeError);
            setError(exchangeError.message);
            return;
          }

          if (data.session?.user) {
            console.log('[AuthCallback] Session obtained via PKCE');
            await handleSuccessfulAuth(data.session.user.id);
          }
        } else if (hasAccessToken) {
          // Implicit 흐름 (fallback) - getSession으로 세션 확인
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            console.error('[AuthCallback] Session error:', sessionError);
            setError(sessionError.message);
            return;
          }

          if (session?.user) {
            console.log('[AuthCallback] Session obtained via implicit flow');
            await handleSuccessfulAuth(session.user.id);
          }
        } else {
          // 기존 세션 확인 (이미 로그인된 경우)
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            console.log('[AuthCallback] Existing session found');
            await handleSuccessfulAuth(session.user.id);
          } else {
            console.log('[AuthCallback] No session found, redirecting to auth');
            navigate('/auth', { replace: true });
          }
        }
      } catch (err) {
        console.error('[AuthCallback] Unexpected error:', err);
        setError('인증 처리 중 오류가 발생했습니다.');
      }
    };

    const handleSuccessfulAuth = async (userId: string) => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, phone')
          .eq('user_id', userId)
          .maybeSingle();

        const needsSetup = !profile || !profile.display_name || !profile.phone;

        if (needsSetup) {
          console.log('[AuthCallback] Profile setup needed');
          navigate('/profile-setup', { replace: true });
        } else {
          console.log('[AuthCallback] Redirecting to dashboard');
          navigate('/dashboard', { replace: true });
        }
      } catch {
        console.log('[AuthCallback] Profile check failed, redirecting to dashboard');
        navigate('/dashboard', { replace: true });
      }
    };

    handleOAuthCallback();

    // 타임아웃: 15초 후에도 처리되지 않으면 auth로 리다이렉트
    const timeout = setTimeout(() => {
      console.log('[AuthCallback] Timeout reached');
      navigate('/auth', { replace: true });
    }, 15000);

    return () => {
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
