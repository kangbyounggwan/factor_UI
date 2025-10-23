import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Header } from "@/components/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { AIAssistantSidebar } from "@/components/AIAssistantSidebar";
import { AISidebarProvider } from "@/contexts/AISidebarContext";
import { useState, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy load all pages for route-based code splitting
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PrinterDetail = lazy(() => import("./pages/PrinterDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const Subscription = lazy(() => import("./pages/Subscription"));
const SupportedPrinters = lazy(() => import("./pages/SupportedPrinters"));
const AI = lazy(() => import("./pages/AI"));
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const DeviceRegister = lazy(() => import("./pages/DeviceRegister"));
const EmailVerification = lazy(() => import("./pages/EmailVerification"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const AppContent = () => {
  const [aiSidebarCollapsed, setAiSidebarCollapsed] = useState(true);
  const [aiSidebarWidth, setAiSidebarWidth] = useState(384);
  
  // AI 어시스턴트/작업공간 활성화
  const showAISidebar = true;
  
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
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        }>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/email-verification" element={<EmailVerification />} />
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
      
      {showAISidebar && (
        <AIAssistantSidebar
          isCollapsed={aiSidebarCollapsed}
          onToggle={() => setAiSidebarCollapsed(!aiSidebarCollapsed)}
          width={aiSidebarWidth}
          onWidthChange={setAiSidebarWidth}
        />
      )}
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
