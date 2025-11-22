import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, needsProfileSetup, profileCheckComplete, signOut } = useAuth();
  const location = useLocation();
  const [isHandlingIosProfileSetup, setIsHandlingIosProfileSetup] = useState(false);

  console.log('ProtectedRoute 상태:', { loading, user: !!user, needsProfileSetup, profileCheckComplete });

  // iOS에서 프로필 설정이 필요한 경우 로그아웃 후 로그인 화면으로
  useEffect(() => {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios' && needsProfileSetup && !isHandlingIosProfileSetup) {
      console.log('[ProtectedRoute] iOS: 프로필 없음, 로그아웃 후 로그인 화면으로 이동');
      setIsHandlingIosProfileSetup(true);

      // 로그인 화면에서 경고 표시하도록 플래그 설정
      localStorage.setItem('iosProfileSetupRequired', 'true');

      signOut().then(() => {
        console.log('[ProtectedRoute] iOS: 로그아웃 완료');
        // signOut이 완료되면 자동으로 Navigate to="/" 실행됨
      });
    }
  }, [needsProfileSetup, signOut, isHandlingIosProfileSetup]);

  // 로딩 중이거나 프로필 체크가 완료되지 않은 경우 로딩 화면 표시
  if (loading || (user && !profileCheckComplete)) {
    console.log('ProtectedRoute: 로딩 중... (profileCheckComplete:', profileCheckComplete, ')');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    console.log('ProtectedRoute: 사용자 없음, /로 리다이렉트');
    return <Navigate to="/" replace />;
  }

  // Android: 프로필 설정이 필요하면 프로필 설정 페이지로
  const platform = Capacitor.getPlatform();
  if (platform === 'android' && needsProfileSetup && location.pathname !== '/profile-setup') {
    console.log('ProtectedRoute: Android - 프로필 설정 필요, /profile-setup으로 리다이렉트');
    return <Navigate to="/profile-setup" replace />;
  }

  // iOS: needsProfileSetup이면 위 useEffect에서 로그아웃 처리 중
  if (platform === 'ios' && needsProfileSetup) {
    console.log('ProtectedRoute: iOS - 프로필 설정 필요, 로그아웃 처리 중...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  console.log('ProtectedRoute: 사용자 인증됨, 페이지 렌더링');
  return <>{children}</>;
};