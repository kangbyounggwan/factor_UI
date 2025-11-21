import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@shared/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Toast } from "@capacitor/toast";

/**
 * OAuth 콜백 핸들러 (모바일)
 * detectSessionInUrl: true 설정으로 Supabase가 자동으로 code exchange 처리
 * 이 페이지는 세션 완료를 대기하고 적절한 페이지로 리다이렉트
 *
 * iOS에서는 신규 사용자 소셜 로그인을 차단 (웹에서 먼저 회원가입 필요)
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  // 플랫폼 한 번만 읽기
  const platform = Capacitor.getPlatform();

  useEffect(() => {
    // URL에서 에러 확인
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');

    if (errorDesc) {
      setError(errorDesc);
      return;
    }

    let handled = false;

    // 리다이렉트 처리 함수
    const handleRedirect = async (session: Session | null) => {
      if (!session?.user) {
        navigate('/', { replace: true });
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, phone')
          .eq('user_id', session.user.id)
          .maybeSingle();

        const needsSetup = !profile || !profile.display_name || !profile.phone;

        // iOS에서 신규 사용자(프로필 없음)인 경우 → Toast 표시 후 로그아웃 및 리다이렉트
        if (needsSetup && platform === 'ios') {
          console.log('[AuthCallback] iOS new user detected, redirecting to login...');

          // Toast 표시 (비동기 기다리지 않음 - UI 블로킹 방지)
          Toast.show({
            text: '신규 가입은 웹에서만 가능합니다. 웹사이트에서 먼저 가입해주세요.',
            duration: 'long',
            position: 'bottom',
          });

          // 로그아웃 먼저 (await 없이 시작)
          const signOutPromise = supabase.auth.signOut();

          // 로그인 화면으로 즉시 리다이렉트
          navigate('/', { replace: true });

          // 백그라운드에서 로그아웃 완료 대기
          signOutPromise.catch(console.error);
          return;
        }

        console.log('[AuthCallback] Redirecting to:', needsSetup ? '/profile-setup' : '/dashboard');
        navigate(needsSetup ? '/profile-setup' : '/dashboard', { replace: true });
      } catch {
        navigate('/dashboard', { replace: true });
      }
    };

    // 즉시 세션 확인 (딥링크에서 setSession 후 바로 올 수 있음)
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && !handled) {
        console.log('[AuthCallback] Existing session found immediately');
        handled = true;
        handleRedirect(session);
        return true;
      }
      return false;
    };

    checkExistingSession();

    // Supabase가 자동으로 code exchange 처리 (detectSessionInUrl: true)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthCallback] Auth state change:', event);

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user && !handled) {
        handled = true;
        subscription.unsubscribe();
        handleRedirect(session);
      }
    });

    // 이미 세션이 있는 경우 재확인 (약간의 지연 후)
    const timer = setTimeout(async () => {
      if (!handled) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          console.log('[AuthCallback] Existing session found after delay');
          handled = true;
          subscription.unsubscribe();
          handleRedirect(session);
        }
      }
    }, 500);

    // 타임아웃: 15초 후에도 처리되지 않으면 auth로 리다이렉트
    const timeout = setTimeout(() => {
      if (!handled) {
        console.log('[AuthCallback] Timeout reached');
        handled = true;
        subscription.unsubscribe();
        navigate('/', { replace: true });
      }
    }, 15000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
      clearTimeout(timeout);
    };
  }, [navigate, platform]);

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
