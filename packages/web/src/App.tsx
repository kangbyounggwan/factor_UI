import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

// Import test utilities in development
if (import.meta.env.DEV) {
  import("@/utils/testNotifications");
}

// Lazy load all pages for route-based code splitting
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PrinterDetail = lazy(() => import("./pages/PrinterDetail"));
const UserSettings = lazy(() => import("./pages/UserSettings"));
const Subscription = lazy(() => import("./pages/Subscription"));
const SupportedPrinters = lazy(() => import("./pages/SupportedPrinters"));
const AI = lazy(() => import("./pages/AI"));
const AIChat = lazy(() => import("./pages/AIChat"));
// TODO: AI 고장 해결 - 개발 중
// const AITroubleshooting = lazy(() => import("./pages/AITroubleshooting"));
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const DeviceRegister = lazy(() => import("./pages/DeviceRegister"));
const DeviceSetup = lazy(() => import("./pages/DeviceSetup"));
const EmailVerification = lazy(() => import("./pages/EmailVerification"));
const PaymentCheckout = lazy(() => import("./pages/PaymentCheckout"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentFail = lazy(() => import("./pages/PaymentFail"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const GCodeAPITest = lazy(() => import("./pages/GCodeAPITest"));

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // OAuth 해시 토큰 감지 및 /auth/callback으로 리다이렉트
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      // 해시에 OAuth 토큰이 있으면 /auth/callback으로 리다이렉트
      console.log('[App] OAuth hash token detected, redirecting to /auth/callback');
      navigate(`/auth/callback${hash}`, { replace: true });
    }
  }, [navigate]);

  // Header를 표시하지 않을 페이지 경로들 (자체 헤더 사용)
  const hideHeaderPaths = [
    '/ai-chat',
    '/user-settings',
    '/dashboard',
    '/create',
    '/printer',
    '/admin'
  ];

  // 현재 경로가 Header를 숨겨야 하는 경로인지 확인
  const shouldHideHeader = hideHeaderPaths.some(path => location.pathname.startsWith(path));

  // Footer를 표시하지 않을 페이지 경로들
  const hideFooterPaths = [
    '/dashboard',
    '/printer',
    '/create',
    '/ai-chat',
    // '/ai-troubleshooting', // TODO: AI 고장 해결 - 개발 중
    '/user-settings',
    '/admin',
    '/auth'
  ];

  // 현재 경로가 Footer를 숨겨야 하는 경로인지 확인
  const shouldHideFooter = hideFooterPaths.some(path => location.pathname.startsWith(path));

  return (
    <div className="flex flex-col min-h-screen bg-background transition-colors">
      {/* 페이지 이동 시 스크롤 최상단으로 */}
      <ScrollToTop />

      {/* 헤더를 모든 페이지에 통합 (ai-chat 제외) */}
      {!shouldHideHeader && <Header />}

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        }>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/email-verification" element={<EmailVerification />} />
            <Route path="/profile-setup" element={
              <ProtectedRoute>
                <ProfileSetup />
              </ProtectedRoute>
            } />
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/printer/:id" element={
              <ProtectedRoute>
                <PrinterDetail />
              </ProtectedRoute>
            } />
            <Route path="/user-settings" element={
              <ProtectedRoute>
                <UserSettings />
              </ProtectedRoute>
            } />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/supported-printers" element={<SupportedPrinters />} />
            <Route path="/create" element={<AI />} />
            <Route path="/ai-chat" element={<AIChat />} />
            {/* TODO: AI 고장 해결 - 개발 중 */}
            {/* <Route path="/ai-troubleshooting" element={<AITroubleshooting />} /> */}
            <Route path="/admin" element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            } />
            <Route path="/admin/users" element={
              <AdminRoute>
                <AdminUsers />
              </AdminRoute>
            } />
            <Route path="/admin/device/register" element={
              <AdminRoute>
                <DeviceRegister />
              </AdminRoute>
            } />
            <Route path="/setup/:uuid" element={<DeviceSetup />} />
            <Route path="/payment/checkout" element={<PaymentCheckout />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/fail" element={<PaymentFail />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/refund" element={<RefundPolicy />} />
            <Route path="/test/gcode-api" element={<GCodeAPITest />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>

      {/* 풋터를 특정 페이지에만 표시 */}
      {!shouldHideFooter && <Footer />}
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
