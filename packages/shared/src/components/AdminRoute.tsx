import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserRole } from '../hooks/useUserRole';

interface AdminRouteProps {
  children: ReactNode;
  /** 비로그인 시 리다이렉트 경로 (web: /auth, mobile: /) */
  redirectTo?: string;
  /** 로딩/접근거부 UI 컴포넌트 (플랫폼별 스타일 지원) */
  loadingComponent?: ReactNode;
  accessDeniedComponent?: ReactNode;
}

export const AdminRoute = ({
  children,
  redirectTo = '/auth',
  loadingComponent,
  accessDeniedComponent
}: AdminRouteProps) => {
  const { user } = useAuth();
  const { isAdmin, loading } = useUserRole();

  // 로그인하지 않은 경우 리다이렉트
  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  // 역할 로딩 중
  if (loading) {
    if (loadingComponent) return <>{loadingComponent}</>;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin mx-auto border-4 border-primary border-t-transparent rounded-full" />
          <p className="text-muted-foreground">권한을 확인하는 중...</p>
        </div>
      </div>
    );
  }

  // 관리자가 아닌 경우 접근 거부
  if (!isAdmin) {
    if (accessDeniedComponent) return <>{accessDeniedComponent}</>;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="space-y-2">
            <p className="font-semibold">접근 권한이 없습니다</p>
            <p className="text-sm text-muted-foreground">이 페이지는 관리자만 접근할 수 있습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
