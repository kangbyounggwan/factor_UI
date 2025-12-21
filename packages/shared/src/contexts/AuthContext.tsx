import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";
import { Capacitor, registerPlugin } from '@capacitor/core';
import { PLAN_CODES, SUBSCRIPTION_STATUS } from "../types/subscription";

// MQTT functions are loaded dynamically to reduce initial bundle size (~266KB savings)
// These will be imported on-demand when user logs in
type MqttModule = typeof import("../component/mqtt");

// Web Crypto API based SHA-256 (replaces js-sha256 to save ~26KB)
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
  setSessionFromDeepLink: (accessToken: string, refreshToken: string) => Promise<{ error: any }>;
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

  // Lazy-loaded MQTT module reference
  const mqttModuleRef = useRef<MqttModule | null>(null);

  // Dynamically load MQTT module
  async function getMqttModule(): Promise<MqttModule> {
    if (!mqttModuleRef.current) {
      mqttModuleRef.current = await import("../component/mqtt");
    }
    return mqttModuleRef.current;
  }

  async function teardownSubscriptions() {
    try {
      const mqtt = await getMqttModule();
      await mqtt.stopDashStatusSubscriptions();
    } catch {}
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

    const mqtt = await getMqttModule();

    if (subscribedUserIdRef.current === userId) {
      try {
        // console.log('[ENSURE] enter', { userId, subscribed: subscribedUserIdRef.current });
        const ok = await mqtt.createSharedMqttClient().connect().then(() => true).catch(() => false);
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
      await mqtt.startDashStatusSubscriptionsForUser(userId);
    } catch (e) {
      console.warn("[MQTT] startDashStatusSubscriptionsForUser failed:", e);
      return; // 실패 시 표시 갱신 금지 → 다음 이벤트/포커스 때 재시도
    }

    try {
      const cr = await mqtt.subscribeControlResultForUser(userId).catch(() => null);
      if (cr) ctrlUnsubRef.current = cr;
    } catch (e) {
      console.warn("[MQTT] subscribeControlResultForUser failed:", e);
    }

    // AI 모델 완료 알림 구독
    try {
      const aiCompleted = await mqtt.subscribeAIModelCompleted(
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
      const aiFailed = await mqtt.subscribeAIModelFailed(
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
      const ok2 = await mqtt.createSharedMqttClient().connect().then(() => true).catch(() => false);
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
  // Phase 2: user.id 변경 시 프로필/Role 로드 및 기본 설정 생성
  // ============================================
  useEffect(() => {
    if (!user?.id) {
      setUserRole(null);
      setNeedsProfileSetup(false);
      setProfileCheckComplete(true);
      return;
    }

    let cancelled = false;

    // 기본 설정 생성 함수 (프로필, 알림, 구독)
    const ensureUserSettings = async (userId: string) => {
      console.log('[Auth] Ensuring user settings for:', userId);

      // user_metadata에서 이메일 회원가입 시 저장된 정보 가져오기
      const metadata = user.user_metadata || {};
      const displayName = metadata.display_name || user.email?.split('@')[0] || 'User';
      const phone = metadata.phone || null;

      // 1. 프로필 생성 (없으면)
      try {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingProfile) {
          console.log('[Auth] Creating profile for user:', userId);
          await supabase.from('profiles').insert({
            user_id: userId,
            display_name: displayName,
            phone: phone,
            role: 'user',
          });
        }
      } catch (err) {
        console.warn('[Auth] Error ensuring profile:', err);
      }

      // 2. 알림 설정 생성 (없으면)
      try {
        const { data: existingSettings } = await supabase
          .from('user_notification_settings')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingSettings) {
          console.log('[Auth] Creating notification settings for user:', userId);
          await supabase.from('user_notification_settings').insert({
            user_id: userId,
            push_notifications: true,
            print_complete_notifications: true,
            error_notifications: true,
            email_notifications: false,
            weekly_report: false,
            notification_sound: true,
            notification_frequency: 'immediate',
            quiet_hours_enabled: false,
          });
        }
      } catch (err) {
        console.warn('[Auth] Error ensuring notification settings:', err);
      }

      // 3. 구독 정보 생성 (없으면) - Free 플랜 자동 할당
      try {
        const { data: existingSubscription } = await supabase
          .from('user_subscriptions')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingSubscription) {
          console.log('[Auth] Creating subscription for user:', userId);

          // Free 플랜 ID 가져오기
          const { data: freePlan } = await supabase
            .from('subscription_plans')
            .select('id')
            .eq('plan_code', 'free')
            .eq('is_active', true)
            .single();

          if (!freePlan) {
            console.error('[Auth] Free plan not found in subscription_plans table');
          }

          // Free 플랜은 100년 후 만료 (실질적으로 무제한)
          const freeEndDate = new Date();
          freeEndDate.setFullYear(freeEndDate.getFullYear() + 100);

          await supabase.from('user_subscriptions').insert({
            user_id: userId,
            plan_id: freePlan?.id || null,
            plan_name: PLAN_CODES.FREE,
            status: SUBSCRIPTION_STATUS.ACTIVE,
            provider: 'paddle',
            current_period_start: new Date().toISOString(),
            current_period_end: freeEndDate.toISOString(),
            cancel_at_period_end: false,
          });
        }
      } catch (err) {
        console.warn('[Auth] Error ensuring subscription:', err);
      }

      // 4. 사용량 정보 생성 (없으면)
      try {
        const { data: existingUsage } = await supabase
          .from('user_usage')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingUsage) {
          console.log('[Auth] Creating user usage for user:', userId);
          const now = new Date();
          await supabase.from('user_usage').insert({
            user_id: userId,
            period_year: now.getFullYear(),
            period_month: now.getMonth() + 1,
            ai_model_generation: 0,
            ai_image_generation: 0,
            printer_count: 0,
            storage_bytes: 0,
            api_calls: 0,
          });
        }
      } catch (err) {
        console.warn('[Auth] Error ensuring user usage:', err);
      }
    };

    const loadUserData = async () => {
      setProfileCheckComplete(false);

      try {
        // 먼저 기본 설정 확인/생성
        await ensureUserSettings(user.id);

        // 그 다음 프로필 로드
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
      userId: data?.user?.id,
      identities: data?.user?.identities?.length ?? 'none'
    });

    // 이미 가입된 사용자 체크 (Email Enumeration Protection이 켜져 있을 때)
    // Supabase는 이미 가입된 이메일로 signUp 시 에러 대신 빈 identities 배열을 반환
    if (!error && data?.user && data.user.identities?.length === 0) {
      console.log('[SignUp] 이미 가입된 이메일:', email);
      return {
        error: {
          message: 'User already registered',
          status: 400,
          name: 'AuthApiError'
        } as any
      };
    }

    // 이메일 회원가입 성공: 이메일 인증 전까지는 세션이 없으므로 DB 작업 불가
    // 프로필/알림/구독 설정은 이메일 인증 후 첫 로그인 시 ensureUserSettings()에서 생성됨
    if (!error && data?.user) {
      console.log('[SignUp] 회원가입 성공, 이메일 인증 필요:', data.user.id);
      console.log('[SignUp] user_metadata에 저장됨:', { display_name: displayName, phone });
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
      // 로그인 후 돌아갈 페이지 저장 (현재 페이지가 /auth가 아닌 경우에만)
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== '/auth' && currentPath !== '/auth/callback') {
        localStorage.setItem('auth_redirect_path', currentPath);
      }

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

    // 모바일: 외부 브라우저로 OAuth 진행 후 딥링크로 복귀
    const platform = Capacitor.getPlatform();
    console.log('[AuthContext] Platform:', platform);

    // 플랫폼별 딥링크 URL
    const redirectUrl = platform === 'ios' ? IOS_REDIRECT : ANDROID_REDIRECT;
    console.log('[AuthContext] Redirect URL (deep link):', redirectUrl);

    // skipBrowserRedirect: true로 설정하여 URL을 가져온 후 외부 브라우저로 열기
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      return { error };
    }

    // 외부 브라우저로 OAuth URL 열기
    if (data?.url) {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: data.url });
    }

    return { error: null };
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
        const hashedNonce = await sha256(rawNonce);

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
      // 로그인 후 돌아갈 페이지 저장 (현재 페이지가 /auth가 아닌 경우에만)
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== '/auth' && currentPath !== '/auth/callback') {
        localStorage.setItem('auth_redirect_path', currentPath);
      }

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
        try {
          const mqtt = await getMqttModule();
          mqtt.clearMqttClientId(user.id);
        } catch {}
      }
      await teardownSubscriptions();
      try {
        const mqtt = await getMqttModule();
        await mqtt.disconnectSharedMqtt();
      } catch {}

      // Supabase 로그아웃 (기본: local - 현재 탭만)
      const scope = options?.global ? 'global' : 'local';
      await supabase.auth.signOut({ scope });

      console.log('[Auth] Sign out complete, scope:', scope);
    } catch (err) {
      console.error('[Auth] Sign out error:', err);
    }
  };

  // ============================================
  // Mobile OAuth Deep Link Handler
  // singleTask 모드에서 setSession API가 응답하지 않는 문제 해결:
  // localStorage에 저장하고 페이지 새로고침으로 Supabase 초기화 시 자동 복구
  // ============================================
  const setSessionFromDeepLink = async (accessToken: string, refreshToken: string) => {
    console.log('[Auth] setSessionFromDeepLink called');

    try {
      // Supabase localStorage 키 형식: sb-{project-ref}-auth-token
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
      const storageKey = `sb-${projectRef}-auth-token`;

      // Supabase 세션 형식으로 저장
      const sessionData = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: null, // Supabase 초기화 시 자동으로 채워짐
      };

      localStorage.setItem(storageKey, JSON.stringify(sessionData));
      console.log('[Auth] Session saved to localStorage:', storageKey);

      // 목표 경로를 localStorage에 저장 (새로고침 후 이동)
      localStorage.setItem('postAuthRedirect', '/dashboard');
      console.log('[Auth] Reloading to apply session...');

      // 페이지 새로고침 - Supabase가 localStorage에서 자동으로 세션 복구
      window.location.reload();

      return { error: null };
    } catch (e: any) {
      console.error('[Auth] setSessionFromDeepLink exception:', e);
      setLoading(false);
      return { error: e };
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
    setSessionFromDeepLink,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


