import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";
import { startDashStatusSubscriptionsForUser, stopDashStatusSubscriptions, subscribeSdListResultForUser, subscribeControlResultForUser, clearMqttClientId } from "../component/mqtt";

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
  const [sdUnsub, setSdUnsub] = useState<null | (() => Promise<void>)>(null);
  const [ctrlUnsub, setCtrlUnsub] = useState<null | (() => Promise<void>)>(null);

  console.log('AuthProvider 렌더링:', { 
    variant, 
    loading, 
    user: !!user, 
    session: !!session,
    timestamp: new Date().toISOString()
  });

  const loadUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();
      setUserRole(!error && data ? data.role : "user");
    } catch {
      setUserRole("user");
    }
  };

  useEffect(() => {
    console.log('AuthProvider useEffect 시작');
    let isMounted = true; // 컴포넌트가 마운트된 상태인지 확인
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!isMounted) return; // 컴포넌트가 언마운트된 경우 중단
      
      console.log('Auth 상태 변경:', { event, user: !!nextSession?.user, variant });
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      
      if (nextSession?.user) {
        setTimeout(() => {
          if (isMounted) loadUserRole(nextSession.user!.id);
        }, 0);
        
        try {
          startDashStatusSubscriptionsForUser(nextSession.user.id);
          // SD/Control 결과 구독 시작 (유저 장치 전체)
          const sd = await subscribeSdListResultForUser(nextSession.user.id).catch(() => null);
          if (sd && isMounted) setSdUnsub(() => sd);
          const cr = await subscribeControlResultForUser(nextSession.user.id).catch(() => null);
          if (cr && isMounted) setCtrlUnsub(() => cr);
        } catch {}
      } else {
        if (isMounted) setUserRole(null);
      }
      
      if (isMounted) setLoading(false);
      
      if (event === 'SIGNED_OUT') {
        // MQTT 구독 해제
        try { await stopDashStatusSubscriptions(); } catch {}
        try { if (sdUnsub) await sdUnsub(); } catch {}
        try { if (ctrlUnsub) await ctrlUnsub(); } catch {}

        if (isMounted) {
          setSdUnsub(null);
          setCtrlUnsub(null);
        }
        
        // 사용자별 MQTT client ID 삭제
        if (nextSession?.user) {
          clearMqttClientId(nextSession.user.id);
        }
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
            try {
              Object.keys(localStorage)
                .filter((k) => k.startsWith("sb-"))
                .forEach((k) => localStorage.removeItem(k));
            } catch {}
            await supabase.auth.signOut();
          }
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await loadUserRole(session.user.id);
          // MQTT 구독은 웹에서만 동작
          try {
            startDashStatusSubscriptionsForUser(session.user.id);
            const sd = await subscribeSdListResultForUser(session.user.id).catch(() => null);
            if (sd && isMounted) setSdUnsub(() => sd);
            const cr = await subscribeControlResultForUser(session.user.id).catch(() => null);
            if (cr && isMounted) setCtrlUnsub(() => cr);
          } catch {}
        } else {
          if (isMounted) setUserRole(null);
        }
      } catch (error) {
        console.log('세션 확인 중 에러:', error);
        
        if (!isMounted) return; // 컴포넌트가 언마운트된 경우 중단
        
        // 타임아웃 에러인 경우 세션 없음으로 처리
        if (error instanceof Error && error.message.includes('타임아웃')) {
          console.log('Supabase 연결 타임아웃 - 세션 없음으로 처리');
          setUser(null);
          setSession(null);
          setUserRole(null);
        } else {
          // 다른 에러인 경우
          setUser(null);
          setSession(null);
          setUserRole(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
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
      if (user) {
        clearMqttClientId(user.id);
      }
      
      await supabase.auth.signOut();
    } finally {
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb-"))
          .forEach((k) => localStorage.removeItem(k));
      } catch {}
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


