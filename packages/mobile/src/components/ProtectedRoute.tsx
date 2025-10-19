import { Navigate } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  console.log('ProtectedRoute 상태:', { loading, user: !!user });

  if (loading) {
    console.log('ProtectedRoute: 로딩 중...');
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

  console.log('ProtectedRoute: 사용자 인증됨, 페이지 렌더링');
  return <>{children}</>;
};