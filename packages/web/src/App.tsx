import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Header } from "@/components/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
// import { AIAssistantSidebar } from "@/components/AIAssistantSidebar"; // AI 비활성화
import { AISidebarProvider } from "@/contexts/AISidebarContext";
import { useState } from "react";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const [aiSidebarCollapsed, setAiSidebarCollapsed] = useState(true);
  const [aiSidebarWidth, setAiSidebarWidth] = useState(384);
  
  // AI 어시스턴트/작업공간 비활성화: 사이드바 표시 끔
  const showAISidebar = false;
  
  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* 헤더를 모든 페이지에 통합 */}
      <Header />
      
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
