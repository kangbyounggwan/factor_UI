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
  needsProfileSetup: boolean;
  profileCheckComplete: boolean;  // 프로필 체크가 완료되었는지 여부
  signUp: (email: string, password: string, displayName?: string, phone?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithApple: () => Promise<{ error: any }>;
  linkGoogleAccount: () => Promise<{ error: any }>;
  unlinkProvider: (provider: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  checkProfileSetup: () => Promise<void>;
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
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [profileCheckComplete, setProfileCheckComplete] = useState(false);
  // refs to avoid stale closures and double-subscribe
  const currentUserIdRef = useRef<string | null>(null);
  const subscribedUserIdRef = useRef<string | null>(null);
  const ctrlUnsubRef = useRef<null | (() => Promise<void>)>(null);
  const aiCompletedUnsubRef = useRef<null | (() => Promise<void>)>(null);
  const aiFailedUnsubRef = useRef<null | (() => Promise<void>)>(null);
  const lastRoleLoadedUserIdRef = useRef<string | null>(null);

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


  // 프로필 설정 필요 여부 체크 (display_name과 phone 모두 필수)
  const checkProfileSetup = async () => {
    if (!user) {
      setNeedsProfileSetup(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, phone")
        .eq("user_id", user.id)
        .maybeSingle();

      // 프로필이 없거나 display_name 또는 phone이 없으면 설정 필요
      if (error || !data || !data.display_name || !data.phone) {
        console.log('[Auth] Profile setup needed for user:', user.id, {
          hasProfile: !!data,
          hasDisplayName: !!data?.display_name,
          hasPhone: !!data?.phone
        });
        setNeedsProfileSetup(true);
      } else {
        setNeedsProfileSetup(false);
      }
    } catch (err) {
      console.error('[Auth] Error checking profile:', err);
      setNeedsProfileSetup(false);
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

    // 모바일 환경에서 푸시 알림 자동 초기화
    if (variant === "mobile" && Capacitor.isNativePlatform()) {
      try {
        console.log('[AuthContext] Initializing push notifications for mobile...');

        // 사용자의 푸시 알림 설정 확인
        const { data: settings } = await supabase
          .from('user_notification_settings')
          .select('push_notifications')
          .eq('user_id', userId)
          .maybeSingle();

        // 푸시 알림이 활성화되어 있으면 초기화
        if (settings?.push_notifications !== false) {
          // 동적 import로 모바일 전용 모듈 로드
          // Note: 이 import는 모바일 앱에서만 실행됨 (variant === "mobile" && Capacitor.isNativePlatform())
          try {
            const base = '@mobile';
            const path = '/services/pushNotificationService';
            const { pushNotificationService } = await import(
              /* @vite-ignore */
              base + path
            );

            if (pushNotificationService) {
              await pushNotificationService.initialize(userId);
              console.log('[AuthContext] Push notification service initialized');
            }
          } catch (importError) {
            console.log('[AuthContext] Push notification service not available (web platform)');
          }
        } else {
          console.log('[AuthContext] Push notifications disabled by user');
        }
      } catch (e) {
        console.warn('[AuthContext] Failed to initialize push notifications:', e);
      }
    }

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


  // ============================================
  // Phase 1: onAuthStateChange - 세션/유저 상태만 관리
  // ============================================
  useEffect(() => {
    console.log('[Auth] Setting up auth state listener');
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;

      const nextUserId = nextSession?.user?.id || null;
      const prevUserId = currentUserIdRef.current;

      console.log('[Auth] State change:', { event, prevUserId, nextUserId });

      // SIGNED_OUT: 상태 완전 초기화
      if (event === 'SIGNED_OUT') {
        console.log('[Auth] Signed out, clearing state');
        setUser(null);
        setSession(null);
        setUserRole(null);
        setNeedsProfileSetup(false);
        setProfileCheckComplete(true);
        setLoading(false);
        currentUserIdRef.current = null;
        return;
      }

      // 중복 SIGNED_IN 방지: 이미 같은 유저로 로그인된 상태면 무시
      if (event === 'SIGNED_IN' && nextUserId && nextUserId === prevUserId) {
        console.log('[Auth] Already signed in with same user, ignoring duplicate');
        return;
      }

      // TOKEN_REFRESHED: 세션만 업데이트
      if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] Token refreshed, updating session only');
        setSession(nextSession);
        return;
      }

      // INITIAL_SESSION: 이미 같은 유저가 있으면 무시
      if (event === 'INITIAL_SESSION' && prevUserId && nextUserId === prevUserId) {
        console.log('[Auth] Initial session with existing user, ignoring');
        setLoading(false);
        return;
      }

      // 상태 업데이트
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      currentUserIdRef.current = nextUserId;
      setLoading(false);
    });

    // 초기 세션 체크 (onAuthStateChange가 INITIAL_SESSION을 보내지 않는 경우 대비)
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.log('[Auth] Session error:', error.message);
          const msg = String(error.message || "");
          // Invalid Token 에러: 로컬 상태만 초기화 (signOut 호출 안 함)
          if (msg.includes("Invalid Refresh Token") || msg.includes("Refresh Token Not Found")) {
            console.log('[Auth] Session expired, clearing local state only');
            setUser(null);
            setSession(null);
            setUserRole(null);
            setNeedsProfileSetup(false);
            setProfileCheckComplete(true);
            setLoading(false);
            currentUserIdRef.current = null;
            return;
          }
        }

        if (isMounted && session?.user && !currentUserIdRef.current) {
          console.log('[Auth] Initial session found:', session.user.id);
          setSession(session);
          setUser(session.user);
          currentUserIdRef.current = session.user.id;
        }
      } catch (err) {
        console.warn('[Auth] Init session error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initSession();

    return () => {
      isMounted = false;
      console.log('[Auth] Cleaning up auth state listener');
      subscription.unsubscribe();
    };
  }, []);

  // ============================================
  // Phase 2: user.id 변경 시 프로필/Role 로드
  // ============================================
  useEffect(() => {
    if (!user?.id) {
      setUserRole(null);
      setNeedsProfileSetup(false);
      setProfileCheckComplete(true);
      return;
    }

    let cancelled = false;

    const loadUserData = async () => {
      setProfileCheckComplete(false);

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, display_name, phone, role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error('[Auth] Error loading profile:', error);
          setNeedsProfileSetup(false);
          setUserRole('user');
        } else {
          setNeedsProfileSetup(!profile?.display_name || !profile?.phone);
          setUserRole(profile?.role || 'user');
          lastRoleLoadedUserIdRef.current = user.id;
        }
      } catch (err) {
        console.error('[Auth] Error loading user data:', err);
        if (!cancelled) {
          setNeedsProfileSetup(false);
          setUserRole('user');
        }
      } finally {
        if (!cancelled) {
          setProfileCheckComplete(true);
        }
      }
    };

    loadUserData();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // ============================================
  // Phase 3: user.id 변경 시 MQTT 설정
  // ============================================
  useEffect(() => {
    if (!user?.id) {
      teardownSubscriptions();
      return;
    }

    let cancelled = false;

    const setupMqtt = async () => {
      try {
        await ensureSubscriptions(user.id);
      } catch (err) {
        if (!cancelled) {
          console.warn('[Auth] MQTT setup failed:', err);
        }
      }
    };

    setupMqtt();

    return () => {
      cancelled = true;
      teardownSubscriptions();
    };
  }, [user?.id]);

  // 포커스/온라인 복귀 시 MQTT 재연결
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

  // ============================================
  // Phase 6: storage 이벤트 리스너 제거
  // Supabase multiTab: true 설정으로 탭 간 세션 동기화 자동 처리
  // ============================================

  const signUp = async (email: string, password: string, displayName?: string, phone?: string) => {
    const redirectUrl = ((import.meta as any).env?.VITE_AUTH_REDIRECT_URL as string) || `${window.location.origin}/`;

    console.log('[SignUp] 회원가입 시작:', { email, displayName, phone, redirectUrl });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName || email.split("@")[0],
          phone: phone || null,
        }
      },
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

        // 프로필 생성 (이메일 회원가입 시 phone 포함)
        const profileResult = await supabase.from('profiles').insert({
          user_id: data.user.id,
          display_name: displayName || email.split("@")[0],
          phone: phone || null,
          role: 'user',
        }).select().maybeSingle();

        if (profileResult.error) {
          console.error('[SignUp] 프로필 생성 실패:', profileResult.error);
        } else {
          console.log('[SignUp] 프로필 생성 성공');
        }

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
          plan_name: 'free',   // 'basic' → 'free'로 변경 (PLAN_FEATURES와 일치)
          status: 'trial',     // 'trialing' → 'trial'로 변경 (DB CHECK constraint와 일치)
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
    // 이미 로그인된 경우 기존 세션 확인
    const { data: { session: existingSession } } = await supabase.auth.getSession();
    if (existingSession?.user) {
      console.log('[Auth] Already logged in, skipping signIn');
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithGoogle = async () => {
    // 모바일 환경 감지 (안전하게 체크)
    let isNativeMobile = false;
    try {
      isNativeMobile = Capacitor.isNativePlatform();
    } catch (e) {
      console.log('[AuthContext] Capacitor not available, assuming web');
      isNativeMobile = false;
    }

    if (!isNativeMobile) {
      // 웹에서는 같은 창에서 OAuth 진행 (새 탭 열지 않음)
      const redirectUrl = (((import.meta as any).env?.VITE_AUTH_REDIRECT_URL as string) || `${window.location.origin}/auth/callback`);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false, // 같은 창에서 리다이렉트
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      return { error };
    }

    // 모바일: 플랫폼별 redirect URL 설정
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
      // 웹에서는 같은 창에서 OAuth 진행 (새 탭 열지 않음)
      const redirectUrl = (((import.meta as any).env?.VITE_AUTH_REDIRECT_URL as string) || `${window.location.origin}/auth/callback`);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false, // 같은 창에서 리다이렉트
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

  // ============================================
  // Phase 5: signOut 함수 개선 (scope: local 기본)
  // ============================================
  const signOut = async (options?: { global?: boolean }) => {
    try {
      // 로컬 상태 먼저 정리
      setUser(null);
      setSession(null);
      setUserRole(null);
      setNeedsProfileSetup(false);
      setProfileCheckComplete(true);
      currentUserIdRef.current = null;

      // MQTT client ID 삭제 및 구독 해제
      if (user?.id) {
        clearMqttClientId(user.id);
      }
      await teardownSubscriptions();
      try { await disconnectSharedMqtt(); } catch {}

      // Supabase 로그아웃 (기본: local - 현재 탭만)
      const scope = options?.global ? 'global' : 'local';
      await supabase.auth.signOut({ scope });

      console.log('[Auth] Sign out complete, scope:', scope);
    } catch (err) {
      console.error('[Auth] Sign out error:', err);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    userRole,
    isAdmin: userRole === "admin",
    loading,
    needsProfileSetup,
    profileCheckComplete,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    linkGoogleAccount,
    unlinkProvider,
    signOut,
    checkProfileSetup,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


