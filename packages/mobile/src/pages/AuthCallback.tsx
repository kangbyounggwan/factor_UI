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
        // URL에서 토큰 추출 (hash fragment 또는 query params)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);

        const access_token = hashParams.get('access_token') || queryParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const error_description = hashParams.get('error_description') || queryParams.get('error_description');

        if (error_description) {
          setError(error_description);
          return;
        }

        // 토큰이 있으면 세션 설정
        if (access_token && refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token
          });

          if (sessionError) {
            console.error('[AuthCallback] Session error:', sessionError);
            setError('인증 처리 중 오류가 발생했습니다.');
            return;
          }
        }

        // 현재 사용자 가져오기
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          // 세션이 없으면 로그인 페이지로
          navigate('/', { replace: true });
          return;
        }

        console.log('[AuthCallback] User authenticated:', user.id);

        // 프로필 확인
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, phone')
          .eq('user_id', user.id)
          .maybeSingle();

        // 프로필이 없거나 필수 정보가 없으면 프로필 설정 페이지로
        const needsSetup = !profile || !profile.display_name || !profile.phone;

        if (needsSetup) {
          console.log('[AuthCallback] Profile setup needed, redirecting to /profile-setup');
          navigate('/profile-setup', { replace: true });
        } else {
          console.log('[AuthCallback] Profile complete, redirecting to /dashboard');
          navigate('/dashboard', { replace: true });
        }
      } catch (err) {
        console.error('[AuthCallback] Error:', err);
        setError('인증 처리 중 오류가 발생했습니다.');
      }
    };

    handleCallback();
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
