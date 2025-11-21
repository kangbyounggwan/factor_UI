import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@shared/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * OAuth 콜백 핸들러 (모바일)
 * Supabase에서 리다이렉트된 후 세션을 설정하고
 * 프로필 설정이 필요한지 확인하여 적절한 페이지로 이동
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const url = window.location.href;
        const hasCode = url.includes('code=');
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hasAccessToken = hashParams.get('access_token');

        console.log('[AuthCallback] Processing callback', { hasCode, hasAccessToken: !!hasAccessToken });

        const error_description = hashParams.get('error_description') || new URLSearchParams(window.location.search).get('error_description');
        if (error_description) {
          setError(error_description);
          return;
        }

        let userId: string | null = null;

        if (hasCode) {
          // PKCE 흐름 - code를 세션으로 교환
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(url);

          if (exchangeError) {
            console.error('[AuthCallback] Code exchange error:', exchangeError);
            setError(exchangeError.message);
            return;
          }

          userId = data.session?.user?.id || null;
          console.log('[AuthCallback] Session obtained via PKCE');
        } else if (hasAccessToken) {
          // Implicit 흐름 (fallback)
          const refresh_token = hashParams.get('refresh_token');
          if (hasAccessToken && refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: hasAccessToken,
              refresh_token
            });

            if (sessionError) {
              console.error('[AuthCallback] Session error:', sessionError);
              setError('인증 처리 중 오류가 발생했습니다.');
              return;
            }
          }

          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id || null;
          console.log('[AuthCallback] Session obtained via implicit flow');
        } else {
          // 기존 세션 확인
          const { data: { session } } = await supabase.auth.getSession();
          userId = session?.user?.id || null;
        }

        if (!userId) {
          console.log('[AuthCallback] No session found, redirecting to auth');
          navigate('/', { replace: true });
          return;
        }

        console.log('[AuthCallback] User authenticated:', userId);

        // 프로필 확인
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
      } catch (err) {
        console.error('[AuthCallback] Error:', err);
        setError('인증 처리 중 오류가 발생했습니다.');
      }
    };

    handleCallback();

    // 타임아웃
    const timeout = setTimeout(() => {
      console.log('[AuthCallback] Timeout reached');
      navigate('/', { replace: true });
    }, 15000);

    return () => clearTimeout(timeout);
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 safe-area-inset">
        <div className="text-destructive text-lg mb-4">로그인 실패</div>
        <div className="text-muted-foreground mb-4">{error}</div>
        <button
          onClick={() => navigate('/', { replace: true })}
          className="text-primary underline"
        >
          로그인 페이지로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background safe-area-inset">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <div className="text-muted-foreground">로그인 처리 중...</div>
    </div>
  );
};

export default AuthCallback;
