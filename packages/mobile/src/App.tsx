import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Toast as CapacitorToast } from "@capacitor/toast";
import { I18nextProvider } from "react-i18next";
import i18n from "@shared/i18n";
import { i18nReady } from './i18n';
import { supabase } from "@shared/integrations/supabase/client";
import { BottomNavigation } from "@/components/BottomNavigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
// import { AIAssistantSidebar } from "@/components/AIAssistantSidebar"; // AI 비활성화
import { AISidebarProvider } from "@/contexts/AISidebarContext";
import { useToast } from "@/hooks/use-toast";
import { pushNotificationService } from "@/services/pushNotificationService";
import { useDeepLinkHandler } from "@/hooks/useDeepLinkHandler";
import { useKeyboardVisible } from "@/hooks/usePlatform";

// Lazy load all pages for code splitting
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PrinterDetail = lazy(() => import("./pages/PrinterDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const UserSettings = lazy(() => import("./pages/UserSettings"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const LanguageSettings = lazy(() => import("./pages/LanguageSettings"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const Notifications = lazy(() => import("./pages/Notifications"));
const SocialAccountLinking = lazy(() => import("./pages/SocialAccountLinking"));
const ThemeSettings = lazy(() => import("./pages/ThemeSettings"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const Subscription = lazy(() => import("./pages/Subscription"));
const SupportedPrinters = lazy(() => import("./pages/SupportedPrinters"));
const AI = lazy(() => import("./pages/AI"));
const AIChat = lazy(() => import("./pages/AIChat"));
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const DeviceRegister = lazy(() => import("./pages/DeviceRegister"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));

const queryClient = new QueryClient();

const AppContent = () => {
  console.log('[App] AppContent component mounted');
  const location = useLocation();
  const navigate = useNavigate();
  const [aiSidebarCollapsed, setAiSidebarCollapsed] = useState(true);
  const [aiSidebarWidth, setAiSidebarWidth] = useState(384);
  const { theme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // iOS 플랫폼 체크
  const isIOS = Capacitor.getPlatform() === 'ios';

  // 키보드 상태 감지 (키보드가 올라오면 BottomNavigation 숨김)
  const isKeyboardVisible = useKeyboardVisible();

  // 딥링크 처리 (제일 먼저 실행되어야 함)
  useDeepLinkHandler();

  // OAuth 리다이렉트 처리 (localStorage에서 postAuthRedirect 확인)
  useEffect(() => {
    const redirectPath = localStorage.getItem('postAuthRedirect');
    if (redirectPath) {
      console.log('[App] Found postAuthRedirect, navigating to:', redirectPath);
      localStorage.removeItem('postAuthRedirect');
      navigate(redirectPath, { replace: true });
    }
  }, [navigate]);

  // 푸시 알림 로그아웃 시 토큰 비활성화만 처리
  // (초기화는 Dashboard에서 프로필 확인 후 진행)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let currentUserId: string | null = null;

    // 현재 유저 ID 가져오기 (로그아웃 처리용)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) currentUserId = user.id;
    });

    // 로그아웃 시에만 FCM 토큰 비활성화
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        currentUserId = session.user.id;
        // 푸시 알림 초기화는 Dashboard에서 처리
      } else if (event === 'SIGNED_OUT') {
        console.log('[App] User signed out, deactivating FCM token');
        if (currentUserId) {
          await pushNotificationService.deactivateCurrentToken(currentUserId);
          currentUserId = null;
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 테마 변경에 따라 상태바 스타일 동적 적용 (iOS & Android)
  useEffect(() => {
    const applyStatusBar = async () => {
      if (!Capacitor.isNativePlatform()) return;

      const isDark = theme === "dark";
      const platform = Capacitor.getPlatform();

      try {
        // 다크 모드: 흰색 텍스트 (Style.Dark), 라이트 모드: 검은색 텍스트 (Style.Light)
        await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });

        // Android만 배경색 설정 (iOS는 투명 오버레이 사용)
        if (platform === "android") {
          await StatusBar.setBackgroundColor({ color: isDark ? "#0B0F17" : "#FFFFFF" });
        }
      } catch (_) {
        // no-op
      }
    };
    applyStatusBar();
  }, [theme]);

  // Android 하드웨어 백 버튼 처리
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let lastBackPress = 0;
    const DOUBLE_PRESS_DELAY = 1500; // 1.5초

    // Bottom Navigation의 메인 페이지들
    const mainPages = ['/dashboard', '/create', '/settings', '/user-settings'];

    let backButtonListener: { remove: () => Promise<void> } | null = null;

    const setupBackButtonListener = async () => {
      backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        const currentPath = location.pathname;
        const currentSearch = location.search;

        // 현재 페이지가 메인 페이지(Bottom Navigation) 중 하나인지 확인
        const isMainPage = mainPages.includes(currentPath);

        if (isMainPage) {
          // Settings 페이지에서 모달(쿼리 파라미터)이 열려있는지 확인
          if (currentPath === '/settings' && currentSearch) {
            const params = new URLSearchParams(currentSearch);
            if (params.has('addGroup') || params.has('editGroup') ||
                params.has('addPrinter') || params.has('editPrinter')) {
              // 모달이 열려있으면 뒤로가기로 모달 닫기
              window.history.back();
              return;
            }
          }

          // AI Studio 페이지에서 내부 단계가 있는지 확인
          if (currentPath === '/create') {
            // AI Studio의 내부 단계를 확인하기 위해 CustomEvent 발생
            const hasInternalState = window.dispatchEvent(
              new CustomEvent('ai-studio-back', { cancelable: true })
            );

            // 이벤트가 preventDefault()로 취소되었으면 내부 단계가 있다는 의미
            if (!hasInternalState) {
              return; // AI Studio 내부에서 뒤로가기 처리됨
            }
          }

          // 메인 페이지에서는 히스토리 무시하고 무조건 앱 종료 동작만 수행
          // 2초 내 두 번 누르면 앱 종료
          const currentTime = new Date().getTime();

          if (currentTime - lastBackPress < DOUBLE_PRESS_DELAY) {
            // 두 번째 백 버튼 누름 - 앱 종료
            CapacitorApp.exitApp();
          } else {
            // 첫 번째 백 버튼 누름 - 네이티브 토스트 메시지 표시
            lastBackPress = currentTime;

            // 네이티브 토스트 표시
            CapacitorToast.show({
              text: '한 번 더 누르면 앱이 종료됩니다',
              duration: 'short',
              position: 'bottom'
            });
          }
          // 메인 페이지에서는 여기서 종료 - 페이지 이동 없음
          return;
        }

        // 메인 페이지가 아닌 경우에만 뒤로가기 처리
        if (canGoBack) {
          // 히스토리가 있으면 뒤로가기
          window.history.back();
        } else {
          // 히스토리가 없으면 대시보드로 이동
          navigate('/dashboard', { replace: true });
        }
      });
    };

    setupBackButtonListener();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, [location.pathname, location.search, navigate, toast]);

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
  
  // 하단 네비게이션을 숨길 경로들 (Auth, Admin, 상세 페이지)
  const hideBottomNavPaths = ["/", "/subscription", "/payment/checkout", "/payment/success", "/payment/fail", "/language-settings", "/notification-settings", "/social-account-linking", "/theme-settings", "/change-password", "/privacy", "/terms"];
  const hideBottomNavStartsWith = ["/admin", "/user-profile"];

  // Settings 페이지에서 그룹/프린터 추가/수정 중인지 확인
  const searchParams = new URLSearchParams(location.search);
  const isSettingsSubPage = location.pathname === "/settings" && (
    searchParams.has('addGroup') ||
    searchParams.has('editGroup') ||
    searchParams.has('addPrinter') ||
    searchParams.has('editPrinter')
  );

  const shouldShowBottomNav = !hideBottomNavPaths.includes(location.pathname) &&
    !hideBottomNavStartsWith.some(path => location.pathname.startsWith(path)) &&
    !isSettingsSubPage;

  // 고정 레이아웃 페이지들 (h-full/h-screen 사용): 자체적으로 스크롤 관리, padding 불필요
  const fixedLayoutPaths = ["/create", "/user-settings", "/ai-chat"];

  const shouldApplyPadding = shouldShowBottomNav && !fixedLayoutPaths.includes(location.pathname);

  return (
    <div className="h-full flex flex-col bg-background transition-colors overflow-hidden">
      {/* 메인 컨텐츠 영역 - 스크롤 가능 */}
      <div
        id="app-scroll"
        ref={scrollRef}
        className="flex-1 overflow-y-auto transition-all duration-300"
        style={{
          marginRight: showAISidebar && !aiSidebarCollapsed ? `${aiSidebarWidth}px` : '0px',
          paddingBottom: shouldApplyPadding ? '64px' : '0px'
        }}
      >
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/home" element={<Home />} />
            <Route path="/profile-setup" element={
              <ProtectedRoute>
                <ProfileSetup />
              </ProtectedRoute>
            } />
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
            <Route path="/user-profile/:userId" element={
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            } />
            <Route path="/language-settings" element={
              <ProtectedRoute>
                <LanguageSettings />
              </ProtectedRoute>
            } />
            <Route path="/notification-settings" element={
              <ProtectedRoute>
                <NotificationSettings />
              </ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            } />
            <Route path="/social-account-linking" element={
              <ProtectedRoute>
                <SocialAccountLinking />
              </ProtectedRoute>
            } />
            <Route path="/theme-settings" element={
              <ProtectedRoute>
                <ThemeSettings />
              </ProtectedRoute>
            } />
            <Route path="/change-password" element={
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            } />
            {/* iOS에서는 구독/결제 라우트 완전 차단 (Apple IAP 정책 준수) */}
            {!isIOS && (
              <Route path="/subscription" element={<Subscription />} />
            )}
            <Route path="/supported-printers" element={<SupportedPrinters />} />
            <Route path="/create" element={
              <ProtectedRoute>
                <AI />
              </ProtectedRoute>
            } />
            <Route path="/ai-chat" element={
              <AIChat />
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
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
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

      {/* 하단 네비게이션 바 (키보드가 올라오면 숨김) */}
      {shouldShowBottomNav && !isKeyboardVisible && <BottomNavigation />}
    </div>
  );
};

const App = () => {
  const [i18nInitialized, setI18nInitialized] = useState(false);

  useEffect(() => {
    i18nReady.then(() => {
      setI18nInitialized(true);
    });
  }, []);

  if (!i18nInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
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
};

export default App;
