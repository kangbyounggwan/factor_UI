import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Monitor, Settings, Menu, Activity, LogOut, Sun, Moon, BookOpen, ShoppingCart, CreditCard, Code2, Layers, Shield, User, Globe, Check, Bell, MessageSquare, Lightbulb, AlertTriangle, Upload, X, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@shared/contexts/AuthContext";
import { useDashboardSummary } from "@shared/component/dashboardSummary";
import { useTheme } from "next-themes";
import { supabase } from "@shared/integrations/supabase/client";
import type { Notification } from "@shared/services/supabaseService/notifications";
import type { PrinterStatusInfo } from "@shared/types/printerType";
import LanguageSwitcher from "./LanguageSwitcher";
import { submitFeedback } from "@shared/services/supabaseService/feedback";
import { useToast } from "@/hooks/use-toast";

export const Header = () => {
  const { t, i18n } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    connectedPrinters: 0,
    activePrints: 0,
    totalPrinters: 0
  });
  const [userPlan, setUserPlan] = useState<string>('basic');
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);

  // 현재 언어에 따라 메시지 선택
  const getLocalizedMessage = (notification: Notification) => {
    const currentLang = i18n.language;
    if (currentLang === 'en' && notification.message_en) {
      return notification.message_en;
    }
    return notification.message;
  };
  const [feedbackType, setFeedbackType] = useState<'issue' | 'idea' | null>(null);
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackDescription, setFeedbackDescription] = useState('');
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [printers, setPrinters] = useState<PrinterStatusInfo[]>([]);
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isAdmin, needsProfileSetup } = useAuth();
  const { theme, setTheme } = useTheme();
  const summary = useDashboardSummary();
  const { toast } = useToast();

  const currentLanguage = i18n.language || 'ko';

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // 동적 네비게이션 메뉴
  const navigation = [
    { name: t('nav.dashboard'), href: "/dashboard", icon: Monitor },
    { name: t('nav.ai'), href: "/create", icon: Layers },
    { name: t('nav.settings'), href: "/settings", icon: Settings },
  ];

  const homeNavigation = [
    { name: t('nav.features'), href: "#features", icon: BookOpen },
    { name: t('nav.supportedPrinters'), href: "#printers", icon: Settings },
    { name: t('nav.marketplace'), href: "#marketplace", icon: ShoppingCart },
    { name: t('nav.pricing'), href: "/subscription", icon: CreditCard },
    { name: t('nav.api'), href: "#api", icon: Code2 },
  ];

  // 실제 프린터 상태 로드 (프로필 설정이 완료된 경우에만)
  useEffect(() => {
    if (user && !needsProfileSetup) {
      loadPrinterStatus();
      loadUserPlan();
      loadNotifications();

      // 실시간 알림 구독
      const notificationSubscription = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('New notification:', payload);
            setNotifications((prev) => [payload.new, ...prev]);
            setUnreadNotifications((prev) => prev + 1);
          }
        )
        .subscribe();

      return () => {
        notificationSubscription.unsubscribe();
      };
    }
  }, [user, needsProfileSetup]);

  const loadPrinterStatus = async () => {
    try {
      const { data: printerData, error } = await supabase
        .from('printers')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading printer status:', error);
        return;
      }

      if (printerData) {
        setPrinters(printerData); // 프린터 목록 저장

        const total = printerData.length;
        const connected = printerData.filter(p => p.status === 'connected').length;
        const printing = printerData.filter(p => p.status === 'printing').length;

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

  const loadUserPlan = async () => {
    try {
      const { data: subscription, error } = await supabase
        .from('user_subscriptions')
        .select('plan_name, status')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading user subscription:', error);
        setUserPlan('basic'); // 기본값
        return;
      }

      if (subscription && (subscription.status === 'active' || subscription.status === 'trialing')) {
        setUserPlan(subscription.plan_name);
      } else {
        setUserPlan('basic');
      }
    } catch (error) {
      console.error('Error loading user subscription:', error);
      setUserPlan('basic');
    }
  };

  const loadNotifications = async () => {
    try {
      // 최근 5일간의 알림 가져오기
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const { data: notificationData, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', fiveDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading notifications:', error);
        return;
      }

      if (notificationData) {
        setNotifications(notificationData);
        // 안읽은 알림 개수만 카운트
        const unreadCount = notificationData.filter(n => !n.read).length;
        setUnreadNotifications(unreadCount);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files).filter((file) => {
        // 이미지 파일만 허용
        if (!file.type.startsWith('image/')) {
          console.warn('이미지 파일만 업로드 가능합니다:', file.name);
          return false;
        }
        // 파일 크기 제한 (5MB)
        if (file.size > 5 * 1024 * 1024) {
          console.warn('파일 크기는 5MB를 초과할 수 없습니다:', file.name);
          return false;
        }
        return true;
      });

      setAttachedImages((prev) => [...prev, ...newImages].slice(0, 5)); // 최대 5개
    }
  };

  const removeImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNotificationClick = async (notification: Notification) => {
    // 알림을 읽음 처리
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }

    // 슬라이싱 완료 알림인 경우 Create 페이지로 이동하고 모델 정보 전달
    if (notification.metadata?.model_id && notification.metadata?.gcode_url) {
      navigate('/create', {
        state: {
          autoLoadGCode: {
            modelId: notification.metadata.model_id,
            gcodeUrl: notification.metadata.gcode_url,
            printerModelId: notification.metadata.printer_model_id, // 프린터 모델 ID 전달
          }
        }
      });
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase.rpc('mark_notification_as_read', {
        notification_id: notificationId,
      });

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      // 읽은 알림은 목록에 유지하되 read 상태만 업데이트
      setNotifications((prev) => prev.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadNotifications((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
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

          {/* 비로그인 상태: 언어 및 테마 표시 */}
          {!user && (
            <>
              <LanguageSwitcher />
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
            </>
          )}

          {/* 알림 및 사용자 프로필 */}
          {user ? (
            <div className="flex items-center gap-2 pl-4 border-l">
              {/* 피드백 버튼 */}
              <Dialog
                open={feedbackDialogOpen}
                onOpenChange={(open) => {
                  setFeedbackDialogOpen(open);
                  if (!open) {
                    setFeedbackType(null);
                    setFeedbackTitle('');
                    setFeedbackDescription('');
                    setSelectedPrinter('');
                    setAttachedImages([]);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 bg-yellow-600 hover:bg-yellow-700 text-white dark:bg-yellow-700 dark:hover:bg-yellow-800"
                  >
                    <span className="text-sm font-medium">Feedback</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  {feedbackType === null ? (
                    <>
                      <DialogHeader>
                        <DialogTitle>{t('feedback.whatToShare')}</DialogTitle>
                        <DialogDescription>
                          {t('feedback.chooseType')}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4 py-4">
                        <button
                          onClick={() => setFeedbackType('issue')}
                          className="flex flex-col items-center justify-center gap-4 p-6 rounded-lg border-2 border-border hover:border-destructive hover:bg-destructive/5 transition-colors"
                        >
                          <AlertTriangle className="h-12 w-12 text-destructive" />
                          <div className="text-center">
                            <p className="text-lg font-semibold">{t('feedback.issue')}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t('feedback.issueDescription')}</p>
                          </div>
                        </button>
                        <button
                          onClick={() => setFeedbackType('idea')}
                          className="flex flex-col items-center justify-center gap-4 p-6 rounded-lg border-2 border-border hover:border-yellow-500 hover:bg-yellow-500/5 transition-colors"
                        >
                          <Lightbulb className="h-12 w-12 text-yellow-500" />
                          <div className="text-center">
                            <p className="text-lg font-semibold">{t('feedback.idea')}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t('feedback.ideaDescription')}</p>
                          </div>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <DialogHeader>
                        <DialogTitle>
                          {feedbackType === 'issue' ? t('feedback.reportIssue') : t('feedback.shareIdea')}
                        </DialogTitle>
                        <DialogDescription>
                          {feedbackType === 'issue'
                            ? t('feedback.issuePrompt')
                            : t('feedback.ideaPrompt')}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {feedbackType === 'issue' && printers.length > 0 && (
                          <div>
                            <label className="text-sm font-medium">{t('feedback.selectPrinter')}</label>
                            <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                              <SelectTrigger className="w-full mt-2">
                                <SelectValue placeholder={t('feedback.selectPrinterPlaceholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                {printers.map((printer) => {
                                  const displayName = printer.name || `Printer ${printer.id.slice(0, 8)}`;
                                  const displayModel = printer.model || 'Unknown Model';
                                  return (
                                    <SelectItem key={printer.id} value={printer.id}>
                                      {displayName} ({displayModel})
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div>
                          <label className="text-sm font-medium">{t('feedback.titleLabel')}</label>
                          <input
                            type="text"
                            value={feedbackTitle}
                            onChange={(e) => setFeedbackTitle(e.target.value)}
                            placeholder={feedbackType === 'issue' ? t('feedback.issueTitlePlaceholder') : t('feedback.ideaTitlePlaceholder')}
                            className="w-full mt-2 px-3 py-2 border rounded-md bg-background"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">{t('feedback.descriptionLabel')}</label>
                          <textarea
                            value={feedbackDescription}
                            onChange={(e) => setFeedbackDescription(e.target.value)}
                            placeholder={feedbackType === 'issue' ? t('feedback.issueDescriptionPlaceholder') : t('feedback.ideaDescriptionPlaceholder')}
                            rows={5}
                            className="w-full mt-2 px-3 py-2 border rounded-md bg-background resize-none"
                          />
                        </div>

                        {/* 이미지 첨부 (아이디어 타입에만 표시) */}
                        {feedbackType === 'idea' && (
                          <div>
                            <label className="text-sm font-medium">{t('feedback.attachImages')}</label>
                            <div className="mt-2 space-y-3">
                              {/* 이미지 업로드 버튼 */}
                              <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors">
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={handleImageUpload}
                                  className="hidden"
                                />
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Upload className="h-4 w-4" />
                                  <span>{t('feedback.uploadImages')}</span>
                                </div>
                              </label>

                              {/* 첨부된 이미지 미리보기 */}
                              {attachedImages.length > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                  {attachedImages.map((image, index) => (
                                    <div
                                      key={index}
                                      className="relative aspect-square rounded-lg border overflow-hidden group"
                                    >
                                      <img
                                        src={URL.createObjectURL(image)}
                                        alt={`Preview ${index + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                      <button
                                        onClick={() => removeImage(index)}
                                        className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {attachedImages.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {t('feedback.imageCount', { count: attachedImages.length, max: 5 })}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setFeedbackType(null);
                              setFeedbackTitle('');
                              setFeedbackDescription('');
                              setSelectedPrinter('');
                              setAttachedImages([]);
                              setFeedbackDialogOpen(false);
                            }}
                          >
                            {t('feedback.cancel')}
                          </Button>
                          <Button
                            onClick={async () => {
                              // Validate input
                              if (!feedbackTitle.trim() || !feedbackDescription.trim()) {
                                toast({
                                  title: t('feedback.error'),
                                  description: t('feedback.fillRequired'),
                                  variant: "destructive",
                                });
                                return;
                              }

                              // Show loading toast
                              toast({
                                title: t('feedback.submitting'),
                                description: t('feedback.pleaseWait'),
                              });

                              // Submit feedback
                              const result = await submitFeedback({
                                type: feedbackType!,
                                title: feedbackTitle,
                                description: feedbackDescription,
                                printerId: selectedPrinter || undefined,
                                imageFiles: attachedImages.length > 0 ? attachedImages : undefined,
                              });

                              if (result.success) {
                                toast({
                                  title: t('feedback.success'),
                                  description: t('feedback.thankYou'),
                                });

                                // Reset form
                                setFeedbackType(null);
                                setFeedbackTitle('');
                                setFeedbackDescription('');
                                setSelectedPrinter('');
                                setAttachedImages([]);
                                setFeedbackDialogOpen(false);
                              } else {
                                toast({
                                  title: t('feedback.error'),
                                  description: result.error || t('feedback.submitFailed'),
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            {t('feedback.submit')}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </DialogContent>
              </Dialog>

              {/* 알림 드롭다운 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative h-9 w-9 p-0"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadNotifications > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                        {unreadNotifications > 9 ? '9+' : unreadNotifications}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>알림</span>
                    {unreadNotifications > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {unreadNotifications}개의 새 알림
                      </Badge>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      {t('notifications.noNotifications')}
                    </div>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto">
                      {(() => {
                        // 일자별로 그룹화
                        const groupedByDate: Record<string, Notification[]> = {};
                        notifications.forEach((notification) => {
                          const dateKey = new Date(notification.created_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          });
                          if (!groupedByDate[dateKey]) {
                            groupedByDate[dateKey] = [];
                          }
                          groupedByDate[dateKey].push(notification);
                        });

                        return Object.entries(groupedByDate).map(([date, dateNotifications], dateIndex) => (
                          <div key={date}>
                            {/* 날짜 구분선 */}
                            {dateIndex > 0 && <DropdownMenuSeparator />}
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                              {date}
                            </div>
                            {dateNotifications.map((notification) => (
                              <DropdownMenuItem
                                key={notification.id}
                                className={`flex flex-col items-start p-3 cursor-pointer hover:bg-accent ${
                                  notification.read ? 'opacity-60' : ''
                                }`}
                                onClick={() => handleNotificationClick(notification)}
                              >
                                <div className="flex items-start gap-2 w-full">
                                  <div className="flex-1">
                                    <p className={`text-sm font-medium ${
                                      notification.read
                                        ? 'text-muted-foreground'
                                        : 'text-foreground dark:text-foreground'
                                    }`}>
                                      {notification.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {getLocalizedMessage(notification)}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {new Date(notification.created_at).toLocaleTimeString('ko-KR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                  </div>
                                  {!notification.read && (
                                    <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                                  )}
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 프로필 드롭다운 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full hover:bg-accent"
                  >
                    {user?.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt="Profile"
                        className="w-8 h-8 rounded-full object-cover border-2 border-primary"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-full">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium leading-none">
                          {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                        </p>
                        <Badge variant={userPlan === 'basic' ? 'secondary' : 'default'} className="text-xs capitalize">
                          {userPlan}
                        </Badge>
                      </div>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* 사용자 설정 */}
                  <DropdownMenuItem asChild>
                    <Link to="/user-settings" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>{t('nav.userSettings')}</span>
                    </Link>
                  </DropdownMenuItem>

                  {/* 구독 관리 */}
                  <DropdownMenuItem asChild>
                    <Link to="/subscription" className="cursor-pointer">
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span>{t('nav.subscriptionManagement')}</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* 테마 설정 서브메뉴 */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <div className="relative mr-2 h-4 w-4">
                        <Sun className="absolute h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                      </div>
                      <span>{t('nav.theme')}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => setTheme('light')}>
                        <Sun className="mr-2 h-4 w-4" />
                        <span>{t('nav.themeLight')}</span>
                        {theme === 'light' && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('dark')}>
                        <Moon className="mr-2 h-4 w-4" />
                        <span>{t('nav.themeDark')}</span>
                        {theme === 'dark' && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('system')}>
                        <Monitor className="mr-2 h-4 w-4" />
                        <span>{t('nav.themeSystem')}</span>
                        {theme === 'system' && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {/* 언어 설정 서브메뉴 */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Globe className="mr-2 h-4 w-4" />
                      <span>{t('nav.language')}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => changeLanguage('ko')}>
                        <span>한국어</span>
                        {currentLanguage === 'ko' && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => changeLanguage('en')}>
                        <span>English</span>
                        {currentLanguage === 'en' && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator />

                  {/* 로그아웃 */}
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onClick={signOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('nav.logout')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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