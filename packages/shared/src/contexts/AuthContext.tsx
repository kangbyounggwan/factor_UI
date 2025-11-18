import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";
import { startDashStatusSubscriptionsForUser, stopDashStatusSubscriptions, subscribeControlResultForUser, clearMqttClientId, subscribeAIModelCompleted, subscribeAIModelFailed } from "../component/mqtt";
import { disconnectSharedMqtt } from "../component/mqtt";
import { createSharedMqttClient } from "../component/mqtt";
import { sha256 } from 'js-sha256';
import { Capacitor, registerPlugin } from '@capacitor/core';

// SignInWithApple 플러그인 인터페이스 정의
interface SignInWithApplePlugin {
  authorize(options: {
    clientId: string;
    redirectURI: string;
    scopes: string;
    nonce: string;
  }): Promise<{
    response: {
      identityToken?: string;
      user?: string;
      email?: string;
    };
  }>;
}

// 플러그인 등록
const SignInWithApple = registerPlugin<SignInWithApplePlugin>('SignInWithApple');

type AppVariant = "web" | "mobile";

// Deep link redirect URLs
const IOS_REDIRECT = "com.byeonggwan.factor://auth/callback";
const ANDROID_REDIRECT = "com.factor.app://auth/callback";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: "admin" | "user" | null;
  isAdmin: boolean;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithApple: () => Promise<{ error: any }>;
  linkGoogleAccount: () => Promise<{ error: any }>;
  unlinkProvider: (provider: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

export function AuthProvider({ children, variant = "web" }: { children: React.ReactNode; variant?: AppVariant }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "user" | null>(null);
  const [loading, setLoading] = useState(true);
  // refs to avoid stale closures and double-subscribe
  const initializedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const subscribedUserIdRef = useRef<string | null>(null);
  const ctrlUnsubRef = useRef<null | (() => Promise<void>)>(null);
  const aiCompletedUnsubRef = useRef<null | (() => Promise<void>)>(null);
  const aiFailedUnsubRef = useRef<null | (() => Promise<void>)>(null);
  const lastRoleLoadedUserIdRef = useRef<string | null>(null);
  const signOutInProgressRef = useRef(false);
  const authEventReceivedRef = useRef(false);

  // 개발 환경에서만 렌더링 로그
  if (import.meta.env.DEV) {
    console.log('[AuthProvider] Rendering:', {
      variant,
      loading,
      user: !!user,
      session: !!session,
      timestamp: new Date().toISOString()
    });
  }

  const loadUserRole = async (userId: string) => {
    if (lastRoleLoadedUserIdRef.current === userId) return;
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      setUserRole(!error && data ? data.role : "user");
      lastRoleLoadedUserIdRef.current = userId;
    } catch {
      setUserRole("user");
    }
  };

  async function teardownSubscriptions() {
    try { await stopDashStatusSubscriptions(); } catch {}
    try { if (ctrlUnsubRef.current) await ctrlUnsubRef.current(); } catch {}
    try { if (aiCompletedUnsubRef.current) await aiCompletedUnsubRef.current(); } catch {}
    try { if (aiFailedUnsubRef.current) await aiFailedUnsubRef.current(); } catch {}
    ctrlUnsubRef.current = null;
    aiCompletedUnsubRef.current = null;
    aiFailedUnsubRef.current = null;
    subscribedUserIdRef.current = null;
  }

  async function ensureSubscriptions(userId: string) {
    if (!userId) return;

    if (subscribedUserIdRef.current === userId) {
      try {
        // console.log('[ENSURE] enter', { userId, subscribed: subscribedUserIdRef.current });
        const ok = await createSharedMqttClient().connect().then(() => true).catch(() => false);
        if (ok) {
          // console.log('[ENSURE] done', { userId, connected: true });
          return; // 이미 연결되어 있으면 스킵
        }
      } catch {}
    }

    await teardownSubscriptions();

    try {
      await startDashStatusSubscriptionsForUser(userId);
    } catch (e) {
      console.warn("[MQTT] startDashStatusSubscriptionsForUser failed:", e);
      return; // 실패 시 표시 갱신 금지 → 다음 이벤트/포커스 때 재시도
    }

    try {
      const cr = await subscribeControlResultForUser(userId).catch(() => null);
      if (cr) ctrlUnsubRef.current = cr;
    } catch (e) {
      console.warn("[MQTT] subscribeControlResultForUser failed:", e);
    }

    // AI 모델 완료 알림 구독
    try {
      const aiCompleted = await subscribeAIModelCompleted(
        userId,
        (payload) => {
          console.log('[AI-MODEL] Completed:', payload);
          // 브로드캐스트 이벤트로 전파하여 AI 페이지에서 처리
          window.dispatchEvent(new CustomEvent('ai-model-completed', { detail: payload }));
        }
      ).catch(() => null);
      if (aiCompleted) aiCompletedUnsubRef.current = aiCompleted;
    } catch (e) {
      console.warn("[MQTT] subscribeAIModelCompleted failed:", e);
    }

    // AI 모델 실패 알림 구독
    try {
      const aiFailed = await subscribeAIModelFailed(
        userId,
        (payload) => {
          console.log('[AI-MODEL] Failed:', payload);
          // 브로드캐스트 이벤트로 전파하여 AI 페이지에서 처리
          window.dispatchEvent(new CustomEvent('ai-model-failed', { detail: payload }));
        }
      ).catch(() => null);
      if (aiFailed) aiFailedUnsubRef.current = aiFailed;
    } catch (e) {
      console.warn("[MQTT] subscribeAIModelFailed failed:", e);
    }

    subscribedUserIdRef.current = userId; // 성공했을 때만 표시
    try {
      const ok2 = await createSharedMqttClient().connect().then(() => true).catch(() => false);
      console.log('[ENSURE] done', { userId, connected: ok2 });
    } catch {}
  }

  const setReadyOnce = () => {
    if (!initializedRef.current) {
      setLoading(false);
      initializedRef.current = true;
    }
  };

  useEffect(() => {
    console.log('AuthProvider useEffect 시작');
    let isMounted = true; // 컴포넌트가 마운트된 상태인지 확인
    let sessionKickTimer: number | null = null; // onAuth 이벤트가 1초 내 없으면 getSession 실행
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!isMounted) return; // 컴포넌트가 언마운트된 경우 중단
      authEventReceivedRef.current = true; // 인증 이벤트 수신됨
      if (sessionKickTimer) { try { clearTimeout(sessionKickTimer); } catch {} sessionKickTimer = null; }
      
      console.log('Auth 상태 변경:', { event, user: !!nextSession?.user, variant });
      const prevUserId = currentUserIdRef.current;
      const nextUserId = nextSession?.user?.id || null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      currentUserIdRef.current = nextUserId;

      if (nextUserId) {
        setTimeout(() => { if (isMounted) loadUserRole(nextUserId); }, 0);
        // 기다리지 말고 백그라운드 실행하여 UI 로딩을 즉시 종료
        (async () => {
          try {
            // 타임박스가 필요하면 Promise.race로 감싸기
            const ENSURE_TMO = 7000;
            await Promise.race([
              ensureSubscriptions(nextUserId),
              new Promise((res) => setTimeout(res, ENSURE_TMO)),
            ]);
          } catch (e) {
            console.warn('[MQTT] ensure failed', e);
          }
        })();
      } else {
        if (isMounted) setUserRole(null);
      }
      setReadyOnce();
      
      if (event === 'SIGNED_OUT') {
        // MQTT 구독 해제
        await teardownSubscriptions();
        
        // 사용자별 MQTT client ID 삭제
        if (prevUserId) { try { clearMqttClientId(prevUserId); } catch {} }
        try { await disconnectSharedMqtt(); } catch {}
      }
    });

    // 1초 안에 onAuth 이벤트가 안 오면 그때만 getSession 시도
    sessionKickTimer = window.setTimeout(async () => {
      if (!isMounted) return;
      if (authEventReceivedRef.current) {
        console.log('onAuthStateChange 이벤트 수신됨(지연 1초 내) → getSession 생략');
        setReadyOnce();
        return;
      }
      try {
        console.log('세션 확인 시작(지연 1초 후)');
        console.log('Supabase 클라이언트 상태:', supabase);
        const TIMEOUT_MS = 15000; // 15초로 완화
        const result = await Promise.race([
          supabase.auth.getSession().then((r) => ({ type: 'session', r })).catch((e) => ({ type: 'error', e })),
          new Promise((res) => setTimeout(() => res({ type: 'timeout' }), TIMEOUT_MS)),
        ]) as any;

        if (!isMounted) return;

        if (result?.type === 'session') {
          const { data: { session }, error } = result.r || {};
          console.log('세션 확인 결과:', { session: !!session, error: !!error, variant });
          if (error) {
            console.log('세션 에러:', error?.message);
            const msg = String(error?.message || "");
            if (msg.includes("Invalid Refresh Token") || msg.includes("Refresh Token Not Found")) {
              if (!signOutInProgressRef.current) {
                signOutInProgressRef.current = true;
                setUser(null);
                setSession(null);
                setUserRole(null);
                setReadyOnce();
                try {
                  Object.keys(localStorage)
                    .filter((k) => k.startsWith("sb-"))
                    .forEach((k) => localStorage.removeItem(k));
                } catch {}
                try { await supabase.auth.signOut(); } finally {
                  signOutInProgressRef.current = false;
                }
              }
            }
          }

        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          currentUserIdRef.current = session.user.id;
          await loadUserRole(session.user.id);
          await ensureSubscriptions(session.user.id);
        } else {
          setUserRole(null);
        }
        } else if (result?.type === 'timeout') {
          console.log('세션 느림 → 이벤트 대기 모드 전환 (timeout)');
          const uid = currentUserIdRef.current;
          if (uid && authEventReceivedRef.current) {
            try { await ensureSubscriptions(uid); } catch {}
          }
        } else if (result?.type === 'error') {
          console.log('세션 확인 중 네트워크/일시 오류 → 이벤트 대기 모드 전환', result.e);
        }
      } finally {
        if (isMounted) {
          setReadyOnce();
          console.log('AuthProvider 로딩 완료:', { loading: false, user: !!user });
        }
      }
    }, 1000);

    return () => {
      isMounted = false; // 컴포넌트 언마운트 시 플래그 설정
      subscription.unsubscribe();
      if (sessionKickTimer) { try { clearTimeout(sessionKickTimer); } catch {} }
    };
  }, []);

  // 포커스/온라인 복귀 시 재시도 훅
  useEffect(() => {
    const kick = () => {
      const uid = currentUserIdRef.current;
      if (uid) ensureSubscriptions(uid);
    };
    window.addEventListener("focus", kick);
    window.addEventListener("online", kick);
    return () => {
      window.removeEventListener("focus", kick);
      window.removeEventListener("online", kick);
    };
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const redirectUrl = ((import.meta as any).env?.VITE_AUTH_REDIRECT_URL as string) || `${window.location.origin}/`;

    console.log('[SignUp] 회원가입 시작:', { email, displayName, redirectUrl });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { display_name: displayName || email.split("@")[0] } },
    });

    console.log('[SignUp] Supabase Auth 응답:', {
      success: !error,
      error: error ? {
        message: error.message,
        status: error.status,
        name: error.name,
        details: error
      } : null,
      userId: data?.user?.id
    });

    // 회원가입 성공 시 기본 설정 생성 (트리거 대신 애플리케이션 레벨에서 처리)
    if (!error && data?.user) {
      try {
        console.log('[SignUp] 사용자 생성 완료, 기본 설정 생성 시작:', data.user.id);

        // 기본 알림 설정 생성
        const notificationResult = await supabase.from('user_notification_settings').insert({
          user_id: data.user.id,
          push_notifications: true,
          print_complete_notifications: true,
          error_notifications: true,
          email_notifications: false,
          weekly_report: false,
          notification_sound: true,
          notification_frequency: 'immediate',
          quiet_hours_enabled: false,
        }).select().maybeSingle();

        if (notificationResult.error) {
          console.error('[SignUp] 알림 설정 생성 실패:', notificationResult.error);
          throw notificationResult.error;
        }
        console.log('[SignUp] 알림 설정 생성 성공');

        // 기본 구독 정보 생성 (14일 무료 체험)
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14);

        const subscriptionResult = await supabase.from('user_subscriptions').insert({
          user_id: data.user.id,
          plan_name: 'basic',
          status: 'trial',
          current_period_start: new Date().toISOString(),
          current_period_end: trialEndDate.toISOString(),
          cancel_at_period_end: false,
        }).select().maybeSingle();

        if (subscriptionResult.error) {
          console.error('[SignUp] 구독 정보 생성 실패:', subscriptionResult.error);
          throw subscriptionResult.error;
        }
        console.log('[SignUp] 구독 정보 생성 성공');
      } catch (setupError) {
        console.error('[SignUp] 회원가입 후 기본 설정 생성 실패:', setupError);
        // 설정 생성 실패는 무시 - 나중에 사용자가 직접 생성 가능
      }
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithGoogle = async () => {
    // 모바일 환경 감지 (Capacitor)
    const isNativeMobile = typeof (window as any).Capacitor !== 'undefined';

    if (!isNativeMobile) {
      // 웹에서는 기본 OAuth
      const redirectUrl = (((import.meta as any).env?.VITE_AUTH_REDIRECT_URL as string) || `${window.location.origin}/`);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      return { error };
    }

    // 모바일: 플랫폼별 redirect URL 설정
    const { Capacitor } = await import('@capacitor/core');
    const platform = Capacitor.getPlatform();

    let redirectUrl: string;
    if (platform === 'ios') {
      redirectUrl = IOS_REDIRECT;
    } else if (platform === 'android') {
      redirectUrl = ANDROID_REDIRECT;
    } else {
      redirectUrl = `${window.location.origin}/`;
    }

    console.log('[AuthContext] Platform:', platform);
    console.log('[AuthContext] Redirect URL:', redirectUrl);

    // 모바일에서는 skipBrowserRedirect를 true로 설정하여 직접 처리
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true, // 모바일에서는 직접 브라우저 관리
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    // 모바일에서 직접 브라우저 열기
    if (data?.url) {
      try {
        const { Browser } = await import('@capacitor/browser');
        console.log('[AuthContext] Opening browser with URL:', data.url);

        await Browser.open({
          url: data.url,
          presentationStyle: 'popover', // iOS에서 popover 스타일
        });

        console.log('[AuthContext] Browser opened successfully');
      } catch (err) {
        console.error('[AuthContext] Failed to open browser:', err);
        return { error: err };
      }
    }

    return { error };
  };

  const signInWithApple = async () => {
    // 모바일 환경 감지 (Capacitor)
    const isNativeMobile = Capacitor.isNativePlatform();

    if (isNativeMobile) {
      // iOS Native Sign in with Apple
      try {
        // 1) raw nonce 생성 (원본)
        const rawNonce = Math.random().toString(36).substring(2, 15);
        // 2) SHA-256 해시 (Apple에 보낼 값)
        const hashedNonce = sha256(rawNonce);

        console.log('[AuthContext] Nonce generated:', { rawNonce, hashedNonce });

        // registerPlugin으로 등록된 플러그인 사용
        const result = await SignInWithApple.authorize({
          clientId: 'com.byeonggwan.factor',
          redirectURI: 'https://ecmrkjwsjkthurwljhvp.supabase.co/auth/v1/callback',
          scopes: 'email name',
          nonce: hashedNonce,  // ✅ 해시된 값을 Apple에 보냄
        });

        const identityToken = result.response.identityToken;
        if (!identityToken) {
          throw new Error('No identity token returned from Apple');
        }

        console.log('[AuthContext] Apple Sign In result:', {
          identityToken: 'present',
          user: result.response.user,
          email: result.response.email,
        });

        // Supabase에 Apple ID 토큰으로 로그인
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: identityToken,
          nonce: rawNonce,  // ✅ 원본 nonce를 Supabase에 보냄
        });

        return { error };
      } catch (err: any) {
        // 더 자세한 에러 로깅
        console.error('[AuthContext] Apple Sign In failed:', {
          error: err,
          errorType: typeof err,
          errorKeys: err ? Object.keys(err) : [],
          errorMessage: err?.message,
          errorCode: err?.code || err?.errorCode,
          errorStack: err?.stack,
          errorString: JSON.stringify(err)
        });

        // Apple Sign In 에러 처리
        let errorMessage = 'appleSignInFailed';

        // 에러 코드가 있는 경우
        if (err.code !== undefined || err.errorCode !== undefined) {
          const errorCode = err.code || err.errorCode;
          if (errorCode === 1000 || errorCode === '1000') {
            // 사용자가 취소한 경우
            errorMessage = 'appleSignInCancelled';
          } else if (errorCode === 1001 || errorCode === '1001') {
            errorMessage = 'appleSignInFailed';
          }
        }

        // 에러 메시지에 "cancel"이 포함된 경우
        if (err.message && (err.message.toLowerCase().includes('cancel') || err.message.toLowerCase().includes('취소'))) {
          errorMessage = 'appleSignInCancelled';
        }

        // 플러그인이 구현되지 않은 경우
        if (err.message && err.message.includes('not implemented')) {
          errorMessage = 'appleSignInNotAvailable';
        }

        return {
          error: {
            message: errorMessage,
            originalError: err
          }
        };
      }
    } else {
      // 웹에서는 OAuth 방식 사용
      const redirectUrl = (((import.meta as any).env?.VITE_AUTH_REDIRECT_URL as string) || `${window.location.origin}/`);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUrl,
        },
      });

      return { error };
    }
  };

  const linkGoogleAccount = async () => {
    // 모바일 환경 감지
    const isNativeMobile = typeof (window as any).Capacitor !== 'undefined';

    let redirectUrl: string;
    if (isNativeMobile) {
      const { Capacitor } = await import('@capacitor/core');
      const platform = Capacitor.getPlatform();

      if (platform === 'ios') {
        redirectUrl = IOS_REDIRECT;
      } else if (platform === 'android') {
        redirectUrl = ANDROID_REDIRECT;
      } else {
        redirectUrl = `${window.location.origin}/user-settings`;
      }
    } else {
      redirectUrl = `${window.location.origin}/user-settings`;
    }

    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    return { error };
  };

  const unlinkProvider = async (provider: string) => {
    if (!user) return { error: new Error("No user logged in") };

    const identity = user.identities?.find(id => id.provider === provider);
    if (!identity) return { error: new Error("Provider not linked") };

    const { data, error } = await supabase.auth.unlinkIdentity(identity);
    return { error };
  };

  const signOut = async () => {
    setUserRole(null);
    try {
      // 현재 사용자의 MQTT client ID 삭제
      if (user) { clearMqttClientId(user.id); }

      if (!signOutInProgressRef.current) {
        signOutInProgressRef.current = true;
        // 즉시 상태 클리어로 UI 전환
        setUser(null);
        setSession(null);
        setUserRole(null);
        setReadyOnce();
        await supabase.auth.signOut();
        try { await disconnectSharedMqtt(); } catch {}
        signOutInProgressRef.current = false;
      }
    } finally {
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb-"))
          .forEach((k) => localStorage.removeItem(k));
      } catch {}
      await teardownSubscriptions();
    }
  };

  const value: AuthContextType = {
    user,
    session,
    userRole,
    isAdmin: userRole === "admin",
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    linkGoogleAccount,
    unlinkProvider,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


