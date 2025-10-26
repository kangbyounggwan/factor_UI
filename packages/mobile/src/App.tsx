import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { I18nextProvider } from "react-i18next";
import i18n from "@shared/i18n";
import { Header } from "@/components/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
// import { AIAssistantSidebar } from "@/components/AIAssistantSidebar"; // AI 비활성화
import { AISidebarProvider } from "@/contexts/AISidebarContext";

// Lazy load all pages for code splitting
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PrinterDetail = lazy(() => import("./pages/PrinterDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const UserSettings = lazy(() => import("./pages/UserSettings"));
const Subscription = lazy(() => import("./pages/Subscription"));
const PaymentCheckout = lazy(() => import("./pages/PaymentCheckout"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentFail = lazy(() => import("./pages/PaymentFail"));
const SupportedPrinters = lazy(() => import("./pages/SupportedPrinters"));
const AI = lazy(() => import("./pages/AI"));
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const DeviceRegister = lazy(() => import("./pages/DeviceRegister"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [aiSidebarCollapsed, setAiSidebarCollapsed] = useState(true);
  const [aiSidebarWidth, setAiSidebarWidth] = useState(384);
  const { theme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 테마 변경에 따라 상태바 아이콘/배경 동적 적용 (Android)
  useEffect(() => {
    const applyStatusBar = async () => {
      if (Capacitor.getPlatform() !== "android") return;
      const isDark = theme === "dark";
      try {
        // 사용자의 요청에 따라 다크/라이트 매핑을 반대로 적용
        await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
        await StatusBar.setBackgroundColor({ color: isDark ? "#FFFFFF" : "#0B0F17" });
      } catch (_) {
        // no-op
      }
    };
    applyStatusBar();
  }, [theme]);
  
  // AI 어시스턴트/작업공간 비활성화: 사이드바 표시 끔
  const showAISidebar = false;

  // 페이지 이동 경로 스택 저장 (세션 스토리지)
  useEffect(() => {
    const key = "nav:history";
    const stored = sessionStorage.getItem(key);
    const history: string[] = stored ? JSON.parse(stored) : [];
    if (history.length === 0 || history[history.length - 1] !== location.pathname) {
      history.push(location.pathname);
      sessionStorage.setItem(key, JSON.stringify(history.slice(-50)));
    }
  }, [location.pathname]);

  // 경로 변경 시 메인 스크롤 컨테이너 스크롤 초기화
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  // 전역 뒤로가기 헬퍼: 홈("/") 도달 시 스택 리셋
  const handleGlobalBack = () => {
    const key = "nav:history";
    const stored = sessionStorage.getItem(key);
    const history: string[] = stored ? JSON.parse(stored) : [];
    // 현재 경로 제거
    history.pop();
    const prev = history.pop();
    if (prev) {
      sessionStorage.setItem(key, JSON.stringify(history));
      navigate(prev, { replace: true });
    } else {
      sessionStorage.setItem(key, JSON.stringify([]));
      navigate("/", { replace: true });
    }
  };
  
  // 헤더를 숨길 경로들 (Auth 페이지)
  const hideHeaderPaths = ["/"];
  const shouldShowHeader = !hideHeaderPaths.includes(location.pathname);

  return (
    <div className="h-full flex flex-col bg-background transition-colors overflow-hidden">
      {/* 헤더를 조건부로 표시 - 고정 */}
      {shouldShowHeader && <Header onBack={handleGlobalBack} />}

      {/* 메인 컨텐츠 영역 - 스크롤 가능 */}
      <div
        id="app-scroll"
        ref={scrollRef}
        className="flex-1 overflow-y-auto transition-all duration-300"
        style={{
          marginRight: showAISidebar && !aiSidebarCollapsed ? `${aiSidebarWidth}px` : '0px'
        }}
      >
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/home" element={<Home />} />
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
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/user-settings" element={
              <ProtectedRoute>
                <UserSettings />
              </ProtectedRoute>
            } />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/payment/checkout" element={
              <ProtectedRoute>
                <PaymentCheckout />
              </ProtectedRoute>
            } />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/fail" element={<PaymentFail />} />
            <Route path="/supported-printers" element={<SupportedPrinters />} />
            <Route path="/create" element={
              <ProtectedRoute>
                <AI />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            } />
            <Route path="/admin/device/register" element={
              <AdminRoute>
                <DeviceRegister />
              </AdminRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
      
      {/* AI 어시스턴트 사이드바 비활성화 */}
      {/**
      {showAISidebar && (
        <AIAssistantSidebar
          isCollapsed={aiSidebarCollapsed}
          onToggle={() => setAiSidebarCollapsed(!aiSidebarCollapsed)}
          width={aiSidebarWidth}
          onWidthChange={setAiSidebarWidth}
        />
      )}
      **/}
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nextProvider i18n={i18n}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider>
          <AISidebarProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </AISidebarProvider>
        </TooltipProvider>
      </ThemeProvider>
    </I18nextProvider>
  </QueryClientProvider>
);

export default App;
