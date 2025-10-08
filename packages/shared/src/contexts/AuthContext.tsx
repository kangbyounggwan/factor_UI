import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";
import { startDashStatusSubscriptionsForUser, stopDashStatusSubscriptions, subscribeControlResultForUser, clearMqttClientId } from "../component/mqtt";
import { disconnectSharedMqtt } from "../component/mqtt";

type AppVariant = "web" | "mobile";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: "admin" | "user" | null;
  isAdmin: boolean;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
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
  const lastRoleLoadedUserIdRef = useRef<string | null>(null);
  const signOutInProgressRef = useRef(false);
  const authEventReceivedRef = useRef(false);

  console.log('AuthProvider 렌더링:', { 
    variant, 
    loading, 
    user: !!user, 
    session: !!session,
    timestamp: new Date().toISOString()
  });

  const loadUserRole = async (userId: string) => {
    if (lastRoleLoadedUserIdRef.current === userId) return;
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();
      setUserRole(!error && data ? data.role : "user");
      lastRoleLoadedUserIdRef.current = userId;
    } catch {
      setUserRole("user");
    }
  };

  async function teardownSubscriptions() {
    try { await stopDashStatusSubscriptions(); } catch {}
    try { if (ctrlUnsubRef.current) await ctrlUnsubRef.current(); } catch {}
    ctrlUnsubRef.current = null;
    subscribedUserIdRef.current = null;
  }

  async function ensureSubscriptions(userId: string) {
    if (!userId) return;
    if (subscribedUserIdRef.current === userId) return; // already subscribed for this user
    await teardownSubscriptions();
    try { await startDashStatusSubscriptionsForUser(userId); } catch {}
    try {
      const cr = await subscribeControlResultForUser(userId).catch(() => null);
      if (cr) ctrlUnsubRef.current = cr;
    } catch {}
    subscribedUserIdRef.current = userId;
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
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!isMounted) return; // 컴포넌트가 언마운트된 경우 중단
      authEventReceivedRef.current = true; // 인증 이벤트 수신됨
      
      console.log('Auth 상태 변경:', { event, user: !!nextSession?.user, variant });
      const prevUserId = currentUserIdRef.current;
      const nextUserId = nextSession?.user?.id || null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      currentUserIdRef.current = nextUserId;

      if (nextUserId) {
        setTimeout(() => { if (isMounted) loadUserRole(nextUserId); }, 0);
        await ensureSubscriptions(nextUserId);
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

    (async () => {
      try {
        console.log('세션 확인 시작');
        console.log('Supabase 클라이언트 상태:', supabase);
        
        // 타임아웃 추가
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('세션 확인 타임아웃 (5초)')), 5000)
        );
        
        const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
        const { data: { session }, error } = result;
        console.log('세션 확인 결과:', { session: !!session, error: !!error, variant });
        
        if (!isMounted) return; // 컴포넌트가 언마운트된 경우 중단
        
        if (error) {
          console.log('세션 에러:', error.message);
          const msg = String(error.message || "");
          if (msg.includes("Invalid Refresh Token") || msg.includes("Refresh Token Not Found")) {
            if (!signOutInProgressRef.current) {
              signOutInProgressRef.current = true;
              // 즉시 UI를 비로그인 상태로 전환하여 보호 라우트가 동작하도록 함
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
          await ensureSubscriptions(session.user.id); // idempotent
        } else {
          if (isMounted) setUserRole(null);
        }
      } catch (error) {
        console.log('세션 확인 중 에러:', error);
        
        if (!isMounted) return; // 컴포넌트가 언마운트된 경우 중단
        
        // 타임아웃 에러인 경우: 이미 인증 이벤트가 도착했으면 세션 초기화하지 않음
        if (error instanceof Error && error.message.includes('타임아웃')) {
          if (!authEventReceivedRef.current) {
            console.log('Supabase 연결 타임아웃 - 이벤트 없음 → 세션 없음으로 처리');
            setUser(null);
            setSession(null);
            setUserRole(null);
          } else {
            console.log('Supabase 연결 타임아웃 - 인증 이벤트 수신됨 → 세션 유지');
          }
        } else {
          // 다른 에러인 경우 비로그인 처리
          setUser(null);
          setSession(null);
          setUserRole(null);
        }
      } finally {
        if (isMounted) {
          setReadyOnce();
          console.log('AuthProvider 로딩 완료:', { loading: false, user: !!user });
        }
      }
    })();

    return () => {
      isMounted = false; // 컴포넌트 언마운트 시 플래그 설정
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const redirectUrl = ((import.meta as any).env?.VITE_AUTH_REDIRECT_URL as string) || `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { display_name: displayName || email.split("@")[0] } },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && variant === "mobile") {
      const hasClientConfig = localStorage.getItem("client_config");
      if (!hasClientConfig) {
        setTimeout(() => { window.location.href = "/mobile-setup"; }, 1000);
      }
    }
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
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


