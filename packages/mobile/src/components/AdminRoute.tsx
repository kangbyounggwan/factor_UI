import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@shared/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2 } from 'lucide-react';

interface AdminRouteProps {
  children: ReactNode;
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user } = useAuth();
  const { isAdmin, loading } = useUserRole();

  // 로그인하지 않은 경우 인증 페이지로 리다이렉트
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // 역할 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">권한을 확인하는 중...</p>
        </div>
      </div>
    );
  }

  // 관리자가 아닌 경우 접근 거부
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <Alert className="border-destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-center">
              <div className="space-y-2">
                <p className="font-semibold">접근 권한이 없습니다</p>
                <p className="text-sm">이 페이지는 관리자만 접근할 수 있습니다.</p>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};