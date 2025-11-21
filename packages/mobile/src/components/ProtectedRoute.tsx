import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, needsProfileSetup, profileCheckComplete } = useAuth();
  const location = useLocation();

  console.log('ProtectedRoute 상태:', { loading, user: !!user, needsProfileSetup, profileCheckComplete });

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

  // 프로필 설정이 필요하고, 현재 프로필 설정 페이지가 아니면 리다이렉트
  if (needsProfileSetup && location.pathname !== '/profile-setup') {
    console.log('ProtectedRoute: 프로필 설정 필요, /profile-setup으로 리다이렉트');
    return <Navigate to="/profile-setup" replace />;
  }

  console.log('ProtectedRoute: 사용자 인증됨, 페이지 렌더링');
  return <>{children}</>;
};