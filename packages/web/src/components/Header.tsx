import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Monitor, Settings, Menu, Activity, LogOut, Sun, Moon, BookOpen, ShoppingCart, CreditCard, Code2, Layers, Shield } from "lucide-react";
import { useAuth } from "@shared/contexts/AuthContext";
import { useDashboardSummary } from "@shared/component/dashboardSummary";
import { useTheme } from "next-themes";
import { supabase } from "@shared/integrations/supabase/client";
import LanguageSwitcher from "./LanguageSwitcher";

export const Header = () => {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    connectedPrinters: 0,
    activePrints: 0,
    totalPrinters: 0
  });
  const location = useLocation();
  const { user, signOut, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const summary = useDashboardSummary();

  // 동적 네비게이션 메뉴
  const navigation = [
    { name: t('nav.dashboard'), href: "/dashboard", icon: Monitor },
    { name: t('nav.ai'), href: "/ai", icon: Layers },
    { name: t('nav.settings'), href: "/settings", icon: Settings },
  ];

  const homeNavigation = [
    { name: t('nav.features'), href: "#features", icon: BookOpen },
    { name: t('nav.supportedPrinters'), href: "#printers", icon: Settings },
    { name: t('nav.marketplace'), href: "#marketplace", icon: ShoppingCart },
    { name: t('nav.pricing'), href: "/subscription", icon: CreditCard },
    { name: t('nav.api'), href: "#api", icon: Code2 },
  ];

  // 실제 프린터 상태 로드
  useEffect(() => {
    if (user) {
      loadPrinterStatus();
    }
  }, [user]);

  const loadPrinterStatus = async () => {
    try {
      const { data: printers, error } = await supabase
        .from('printers')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error loading printer status:', error);
        return;
      }
      
      if (printers) {
        const total = printers.length;
        const connected = printers.filter(p => p.status === 'connected').length;
        const printing = printers.filter(p => p.status === 'printing').length;
        
        setSystemStatus({
          totalPrinters: total,
          connectedPrinters: connected,
          activePrints: printing
        });
      }
    } catch (error) {
      console.error('Error loading printer status:', error);
    }
  };

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const isHomePage = location.pathname === "/";
  const isAuthPage = location.pathname === "/auth";
  const isSubscriptionPage = location.pathname === "/subscription";
  const currentNavigation = (isHomePage || isSubscriptionPage) ? homeNavigation : navigation;


  // 로그인 페이지일 때는 간단한 헤더 표시
  if (isAuthPage) {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* 로고 */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
              <Activity className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold font-orbitron text-primary tracking-wide">
                FACTOR
              </span>
              <span className="text-xs text-muted-foreground font-inter -mt-1">
                3D PRINTER FARM
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            {/* 언어 전환 */}
            <LanguageSwitcher />

            {/* 테마 토글 버튼 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-9 h-9 p-0"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            {/* 홈으로 돌아가기 버튼 */}
            <Button asChild variant="outline" size="sm">
              <Link to="/" className="flex items-center gap-2">
                {t('nav.backToHome')}
              </Link>
            </Button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto relative flex h-16 items-center justify-between px-4">
        {/* 로고 */}
        <Link to="/" className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
            <Activity className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold font-orbitron text-primary tracking-wide">
              FACTOR
            </span>
            <span className="text-xs text-muted-foreground font-inter -mt-1">
              3D PRINTER FARM
            </span>
          </div>
        </Link>

        {/* 데스크톱 네비게이션 (유연 중앙 정렬) */}
        <nav className="hidden md:flex flex-1 items-center justify-center space-x-6">
          {currentNavigation.map((item) => {
            const Icon = item.icon;
            const isHashLink = item.href.startsWith('#');

            if (isHashLink) {
              // 홈 페이지가 아닌 곳에서는 해시링크를 홈으로 이동
              const linkHref = isHomePage ? item.href : `/${item.href}`;

              return (
                <Link
                  key={item.name}
                  to={linkHref}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            }

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
          
          {/* 관리자 메뉴 (관리자만 표시) */}
          {user && isAdmin && (
            <Link
              to="/admin"
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/admin")
                  ? "bg-warning text-warning-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>{t('nav.admin')}</span>
            </Link>
          )}
        </nav>

        {/* 상태 표시 및 사용자 메뉴 */}
        <div className="hidden lg:flex items-center space-x-4 pl-6">
          {!isHomePage && !isSubscriptionPage && (
            <div className="flex items-center space-x-2">
              <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-xs">
                {t('nav.connected')}: {summary.connected}/{summary.total}
              </div>
              <Badge className="text-xs" variant={summary.printing > 0 ? 'default' : 'secondary'}>
                {t('nav.printing')}: {summary.printing}
              </Badge>
              <Badge className="text-xs" variant={summary.error > 0 ? 'destructive' : 'secondary'}>
                {t('nav.error')}: {summary.error}
              </Badge>
            </div>
          )}
          
          {/* 언어 전환 */}
          <LanguageSwitcher />

          {/* 테마 토글 버튼 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-9 h-9 p-0"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* 사용자 정보 및 로그아웃 */}
          {user ? (
            <div className="flex items-center space-x-2 pl-4 border-l">
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="text-xs"
              >
                <LogOut className="h-3 w-3 mr-1" />
                {t('nav.logout')}
              </Button>
            </div>
          ) : (
            <div className="pl-4 border-l">
              <Button asChild variant="outline" size="sm">
                <Link to="/auth" className="text-xs">
                  <LogOut className="h-3 w-3 mr-1" />
                  {t('nav.login')}
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* 모바일 메뉴 버튼 */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="md:hidden">
              <Menu className="h-4 w-4" />
              <span className="sr-only">{t('nav.openMenu')}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[400px]">
            <div className="flex flex-col space-y-4">
              {/* 모바일 로고 */}
              <Link 
                to="/" 
                className="flex items-center space-x-3 pb-4 border-b"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
                  <Activity className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-bold font-orbitron text-primary tracking-wide">
                    FACTOR
                  </span>
                  <span className="text-xs text-muted-foreground font-inter -mt-1">
                    3D PRINTER FARM
                  </span>
                </div>
              </Link>

              {/* 모바일 상태 표시 */}
              {!isHomePage && !isSubscriptionPage && (
                <div className="flex flex-col space-y-2 pb-4 border-b">
                  <h3 className="text-sm font-medium">{t('nav.systemStatus')}</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">
                      {t('nav.connected')}: {systemStatus.connectedPrinters}/{systemStatus.totalPrinters}
                    </Badge>
                    <Badge
                      variant={systemStatus.activePrints > 0 ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {t('nav.printing')}: {systemStatus.activePrints}
                    </Badge>
                  </div>
                </div>
              )}

              {/* 모바일 네비게이션 */}
              <nav className="flex flex-col space-y-2">
                {currentNavigation.map((item) => {
                  const Icon = item.icon;
                  const isHashLink = item.href.startsWith('#');

                  if (isHashLink) {
                    // 홈 페이지가 아닌 곳에서는 해시링크를 홈으로 이동
                    const linkHref = isHomePage ? item.href : `/${item.href}`;

                    return (
                      <Link
                        key={item.name}
                        to={linkHref}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center space-x-3 px-3 py-3 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  }

                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center space-x-3 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </Link>
                  );
                  })}
                  
                  {/* 관리자 메뉴 (모바일, 관리자만 표시) */}
                  {user && isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center space-x-3 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                        isActive("/admin")
                          ? "bg-warning text-warning-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      }`}
                    >
                      <Shield className="w-5 h-5" />
                      <span>{t('nav.admin')}</span>
                    </Link>
                  )}
                </nav>

                {/* 모바일 사용자 메뉴 */}
                <div className="pt-4 border-t">
                  {user ? (
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        {user?.email}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          signOut();
                          setMobileMenuOpen(false);
                        }}
                        className="w-full justify-start"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        {t('nav.logout')}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full justify-start"
                    >
                      <Link to="/auth">
                        <LogOut className="h-4 w-4 mr-2" />
                        {t('nav.login')}
                      </Link>
                    </Button>
                  )}
                  
                  {/* 모바일 언어 전환 */}
                  <div className="pt-2">
                    <LanguageSwitcher />
                  </div>

                  {/* 모바일 테마 토글 */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="w-full justify-start mt-2"
                  >
                    <Sun className="h-4 w-4 mr-2 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute ml-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="ml-2">
                      {theme === "dark" ? t('nav.lightMode') : t('nav.darkMode')}
                    </span>
                  </Button>
                </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};