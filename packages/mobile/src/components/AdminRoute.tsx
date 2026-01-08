import { ReactNode } from 'react';
import { AdminRoute as SharedAdminRoute } from '@shared/components/AdminRoute';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2 } from 'lucide-react';

interface AdminRouteProps {
  children: ReactNode;
}

const LoadingUI = (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
      <p className="text-muted-foreground">권한을 확인하는 중...</p>
    </div>
  </div>
);

const AccessDeniedUI = (
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

export const AdminRoute = ({ children }: AdminRouteProps) => (
  <SharedAdminRoute
    redirectTo="/"
    loadingComponent={LoadingUI}
    accessDeniedComponent={AccessDeniedUI}
  >
    {children}
  </SharedAdminRoute>
);
