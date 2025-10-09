import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Header } from "@/components/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
// import { AIAssistantSidebar } from "@/components/AIAssistantSidebar"; // AI 비활성화
import { AISidebarProvider } from "@/contexts/AISidebarContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import PrinterDetail from "./pages/PrinterDetail";
import Settings from "./pages/Settings";
import Subscription from "./pages/Subscription";
import SupportedPrinters from "./pages/SupportedPrinters";
// import AI from "./pages/AI"; // AI 비활성화
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import DeviceRegister from "./pages/DeviceRegister";
import MobileSetup from "./pages/MobileSetup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [aiSidebarCollapsed, setAiSidebarCollapsed] = useState(true);
  const [aiSidebarWidth, setAiSidebarWidth] = useState(384);
  const { theme } = useTheme();

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
  
  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* 헤더를 모든 페이지에 통합 */}
      <Header onBack={handleGlobalBack} />
      
      {/* 메인 컨텐츠 영역 */}
      <div 
        className="transition-all duration-300" 
        style={{ 
          marginRight: showAISidebar && !aiSidebarCollapsed ? `${aiSidebarWidth}px` : '0px' 
        }}
      >
        <Routes>
          <Route path="/auth" element={<Auth />} />
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
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/supported-printers" element={<SupportedPrinters />} />
          <Route path="/mobile-setup" element={
            <ProtectedRoute>
              <MobileSetup />
            </ProtectedRoute>
          } />
          {/** AI 작업공간 라우트 비활성화 **/}
          {/**
          <Route path="/ai" element={
            <ProtectedRoute>
              <AI />
            </ProtectedRoute>
          } />
          **/}
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
  </QueryClientProvider>
);

export default App;
