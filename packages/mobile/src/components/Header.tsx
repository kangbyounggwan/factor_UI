import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Monitor, Settings, Menu, Activity, LogOut, Sun, Moon, BookOpen, ShoppingCart, CreditCard, Code2, Layers, Shield } from "lucide-react";
import { useAuth } from "@shared/contexts/AuthContext";
import { useTheme } from "next-themes";
import { supabase } from "@shared/integrations/supabase/client";
import { onDashStatusMessage } from "@shared/services/mqttService";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

export const Header = ({ onBack }: { onBack?: () => void }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    connectedPrinters: 0,
    activePrints: 0,
    totalPrinters: 0
  });
  // 실시간 연결/프린팅 집계용 맵
  const [connectedMap, setConnectedMap] = useState<Record<string, boolean>>({});
  const [printingMap, setPrintingMap] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const { user, signOut, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();

  // Navigation arrays with translation keys
  const navigation = [
    { nameKey: "nav.dashboard", href: "/dashboard", icon: Monitor },
    { nameKey: "nav.ai", href: "/create", icon: Layers },
    { nameKey: "nav.settings", href: "/settings", icon: Settings },
  ];

  const homeNavigation = [
    { nameKey: "nav.features", href: "#features", icon: BookOpen },
    { nameKey: "nav.supportedPrinters", href: "#printers", icon: Settings },
    { nameKey: "nav.marketplace", href: "#marketplace", icon: ShoppingCart },
    { nameKey: "nav.pricing", href: "/subscription", icon: CreditCard },
    { nameKey: "nav.api", href: "#api", icon: Code2 },
  ];

  // 안전영역 상단 패딩 계산 (추가 마진 제거)
  const safeTop = typeof window !== 'undefined'
    ? 'env(safe-area-inset-top, 0px)'
    : '0px';

  // MQTT dash_status 수신 → 연결/프린팅 집계 반영
  useEffect(() => {
    const off = onDashStatusMessage((uuid, data) => {
      if (!uuid) return;
      setConnectedMap((prev) => (
        prev[uuid] === !!data?.connected ? prev : { ...prev, [uuid]: !!data?.connected }
      ));
      const isPrinting = !!(data?.printer_status?.printing);
      setPrintingMap((prev) => (
        prev[uuid] === isPrinting ? prev : { ...prev, [uuid]: isPrinting }
      ));
    });
    return () => { off(); };
  }, []);

  const liveConnectedCount = Object.values(connectedMap).filter(Boolean).length;
  const livePrintingCount = Object.values(printingMap).filter(Boolean).length;

  const loadPrinterStatus = useCallback(async () => {
    if (!user) return;

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
  }, [user]);

  // 실제 프린터 상태 로드
  useEffect(() => {
    if (user) {
      loadPrinterStatus();
    }
  }, [user, loadPrinterStatus]);

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const isHomePage = location.pathname === "/home";
  const currentNavigation = isHomePage ? homeNavigation : navigation;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" style={{ paddingTop: safeTop }}>
      <div className="container flex h-20 items-center justify-between px-4">
        {/* 로고 (왼쪽) */}
        <Link to="/dashboard" className="flex items-center space-x-3">
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

        {/* 데스크톱 네비게이션 (요청에 따라 숨김) */}
        <nav className="hidden">
          {currentNavigation.map((item) => {
            const Icon = item.icon;
            const isHashLink = item.href.startsWith('#');

            if (isHashLink) {
              return (
                <a
                  key={item.nameKey}
                  href={item.href}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <Icon className="w-4 h-4" />
                  <span>{t(item.nameKey)}</span>
                </a>
              );
            }

            return (
              <Link
                key={item.nameKey}
                to={item.href}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t(item.nameKey)}</span>
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

        {/* 상태 표시 및 사용자 메뉴 (요청에 따라 숨김) */}
        <div className="hidden">
          {!isHomePage && (
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                {t('nav.connected')}: {liveConnectedCount}/{systemStatus.totalPrinters}
              </Badge>
              <Badge
                variant={livePrintingCount > 0 ? "default" : "secondary"}
                className="text-xs"
              >
                {t('nav.printing')}: {livePrintingCount}
              </Badge>
            </div>
          )}
          
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
                onClick={async () => {
                  await signOut();
                  navigate("/", { replace: true });
                }}
                className="text-xs"
              >
                <LogOut className="h-3 w-3 mr-1" />
                {t('nav.logout')}
              </Button>
            </div>
          ) : (
            <div className="pl-4 border-l">
              <Button asChild variant="outline" size="sm">
                <Link to="/" className="text-xs">
                  <LogOut className="h-3 w-3 mr-1" />
                  {t('nav.login')}
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* 언어 선택 및 메뉴 버튼 - 오른쪽 끝에 고정 */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-4 w-4" />
                <span className="sr-only">{t('nav.openMenu')}</span>
              </Button>
            </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[400px] flex flex-col">
            {/* 접근성: DialogTitle 요구 충족 (시각적으로 숨김) */}
            <SheetHeader>
              <SheetTitle className="sr-only">{t('nav.openMenu')}</SheetTitle>
            </SheetHeader>
            {/* 모바일 로고 - 고정 */}
            <Link
              to="/dashboard"
              className="flex items-center space-x-3 pb-4 border-b flex-shrink-0"
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

            {/* 스크롤 가능한 컨텐츠 영역 */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col space-y-4 pb-6 pt-4">

              {/* 모바일 상태 표시 */}
              {!isHomePage && (
                <div className="flex flex-col space-y-2 pb-4 border-b">
                  <h3 className="text-sm font-medium">{t('nav.systemStatus')}</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">
                      {t('nav.connected')}: {liveConnectedCount}/{systemStatus.totalPrinters}
                    </Badge>
                    <Badge
                      variant={livePrintingCount > 0 ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {t('nav.printing')}: {livePrintingCount}
                    </Badge>
                  </div>
                </div>
              )}

              {/* 모바일 네비게이션 */}
              <div className="flex flex-col space-y-3">
                <h3 className="text-sm font-medium">Contents</h3>
                <nav className="flex flex-col space-y-2">
                {currentNavigation.map((item) => {
                  const Icon = item.icon;
                  const isHashLink = item.href.startsWith('#');

                  if (isHashLink) {
                    return (
                      <a
                        key={item.nameKey}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center space-x-3 px-3 py-3 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        <Icon className="w-5 h-5" />
                        <span>{t(item.nameKey)}</span>
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={item.nameKey}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center space-x-3 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{t(item.nameKey)}</span>
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
              </div>

              {/* 모바일 사용자 메뉴 */}
              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium mb-3">User</h3>
                {user ? (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      {user?.email}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        await signOut();
                        navigate("/", { replace: true });
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
                    <Link to="/">
                      <LogOut className="h-4 w-4 mr-2" />
                      {t('nav.login')}
                    </Link>
                  </Button>
                )}
              </div>

              {/* 언어 설정 섹션 */}
              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium mb-3">Language</h3>
                <div className="w-full">
                  <LanguageSwitcher />
                </div>
              </div>

              {/* 모드 설정 섹션 */}
              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium mb-3">Interface</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="w-full justify-start"
                >
                  <Sun className="h-4 w-4 mr-2 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute ml-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="ml-2">
                    {theme === "dark" ? t('nav.lightMode') : t('nav.darkMode')}
                  </span>
                </Button>
              </div>
              </div>
            </div>
          </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};