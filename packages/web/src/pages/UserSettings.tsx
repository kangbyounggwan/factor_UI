import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@shared/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@shared/integrations/supabase/client";
import { PLAN_FEATURES, type SubscriptionPlan } from "@shared/types/subscription";
import { getUserPaymentHistory, type PaymentHistory } from "@shared/services/supabaseService/subscription";
import { getUserPaymentMethods, type PaymentMethod } from "@shared/services/supabaseService/paymentMethod";
import {
  User,
  Mail,
  Bell,
  CreditCard,
  Trash2,
  Crown,
  AlertTriangle,
  Camera,
  Check,
  Link as LinkIcon,
  Unlink,
  Shield,
  LogOut,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

// Google Logo SVG Component
const GoogleLogo = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M17.64 9.20443C17.64 8.56625 17.5827 7.95262 17.4764 7.36353H9V10.8449H13.8436C13.635 11.9699 13.0009 12.9231 12.0477 13.5613V15.8194H14.9564C16.6582 14.2526 17.64 11.9453 17.64 9.20443Z"
      fill="#4285F4"
    />
    <path
      d="M8.99976 18C11.4298 18 13.467 17.1941 14.9561 15.8195L12.0475 13.5613C11.2416 14.1013 10.2107 14.4204 8.99976 14.4204C6.65567 14.4204 4.67158 12.8372 3.96385 10.71H0.957031V13.0418C2.43794 15.9831 5.48158 18 8.99976 18Z"
      fill="#34A853"
    />
    <path
      d="M3.96409 10.7098C3.78409 10.1698 3.68182 9.59301 3.68182 8.99983C3.68182 8.40665 3.78409 7.82983 3.96409 7.28983V4.95801H0.957273C0.347727 6.17301 0 7.54755 0 8.99983C0 10.4521 0.347727 11.8266 0.957273 13.0416L3.96409 10.7098Z"
      fill="#FBBC05"
    />
    <path
      d="M8.99976 3.57955C10.3211 3.57955 11.5075 4.03364 12.4402 4.92545L15.0216 2.34409C13.4629 0.891818 11.4257 0 8.99976 0C5.48158 0 2.43794 2.01682 0.957031 4.95818L3.96385 7.29C4.67158 5.16273 6.65567 3.57955 8.99976 3.57955Z"
      fill="#EA4335"
    />
  </svg>
);

const UserSettings = () => {
  const { user, signOut, linkGoogleAccount, unlinkProvider } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Get tab from URL parameter, default to 'profile'
  const defaultTab = searchParams.get('tab') || 'profile';
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Form states
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name || "",
  );
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [originalProfile, setOriginalProfile] = useState({ displayName: "", phone: "" });

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [printCompleteNotif, setPrintCompleteNotif] = useState(true);
  const [errorNotif, setErrorNotif] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [isEditingNotifications, setIsEditingNotifications] = useState(false);

  // Original notification settings for cancel functionality
  const [originalNotifications, setOriginalNotifications] = useState({
    email: false,
    push: true,
    printComplete: true,
    error: true,
    weekly: false,
  });

  // Check if Google is linked
  const googleIdentity = user?.identities?.find(
    (id) => id.provider === "google",
  );
  const isGoogleLinked = !!googleIdentity;

  // Subscription state
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan>('free');
  const [subscriptionData, setSubscriptionData] = useState<{
    price: number;
    billingCycle: string;
    nextBillingDate: string | null;
  } | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  // Modal states
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [showBillingHistoryModal, setShowBillingHistoryModal] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showRefundPolicyModal, setShowRefundPolicyModal] = useState(false);
  const [showDowngradeWarningModal, setShowDowngradeWarningModal] = useState(false);

  // Payment data states
  const [allPaymentHistory, setAllPaymentHistory] = useState<PaymentHistory[]>([]); // 전체 데이터 캐시
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPaymentData, setLoadingPaymentData] = useState(false);
  const [paymentHistoryPage, setPaymentHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // 클라이언트 사이드 페이지네이션 - 현재 페이지의 데이터만 계산
  const paginatedPaymentHistory = allPaymentHistory.slice(
    (paymentHistoryPage - 1) * ITEMS_PER_PAGE,
    paymentHistoryPage * ITEMS_PER_PAGE
  );

  // Load profile data from DB (including phone)
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setLoadingProfile(false);
        return;
      }

      try {
        setLoadingProfile(true);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('display_name, phone, avatar_url')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && profile) {
          const name = profile.display_name || "";
          const ph = profile.phone || "";
          setDisplayName(name);
          setPhone(ph);
          if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
          setOriginalProfile({ displayName: name, phone: ph });
        } else {
          // Fallback to user_metadata
          const name = user.user_metadata?.full_name || "";
          setDisplayName(name);
          if (user.user_metadata?.avatar_url) setAvatarUrl(user.user_metadata.avatar_url);
          setOriginalProfile({ displayName: name, phone: "" });
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, [user]);

  // Load subscription data from Supabase
  useEffect(() => {
    const loadSubscription = async () => {
      if (!user) return;

      try {
        setLoadingPlan(true);

        const { data: subscription, error } = await supabase
          .from("user_subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (error || !subscription) {
          // No active subscription - use free plan
          setCurrentPlan('free');
          setSubscriptionData({
            price: 0,
            billingCycle: "free",
            nextBillingDate: null,
          });
          return;
        }

        // Map plan from database to SubscriptionPlan type
        const planName = subscription.plan_name?.toLowerCase() || 'free';
        const validPlan: SubscriptionPlan = ['free', 'pro', 'enterprise'].includes(planName)
          ? planName as SubscriptionPlan
          : 'free';

        // Plan pricing info
        const planPricing = {
          free: { price: 0 },
          pro: { price: 19900 },
          enterprise: { price: 99000 }
        };

        setCurrentPlan(validPlan);
        setSubscriptionData({
          price: planPricing[validPlan].price,
          billingCycle: subscription.current_period_end ? "month" : "free",
          nextBillingDate: subscription.current_period_end,
        });
      } catch (error) {
        console.error("Error loading subscription:", error);
        setCurrentPlan('free');
        setSubscriptionData({
          price: 0,
          billingCycle: "free",
          nextBillingDate: null,
        });
      } finally {
        setLoadingPlan(false);
      }
    };

    loadSubscription();
  }, [user]);

  // Load payment data (history and methods) - 한 번만 로드
  useEffect(() => {
    const loadPaymentData = async () => {
      if (!user || !subscriptionData || subscriptionData.price === 0) {
        // No paid subscription, no need to load payment data
        setAllPaymentHistory([]);
        setPaymentMethods([]);
        return;
      }

      try {
        setLoadingPaymentData(true);

        // Load ALL payment history (최대 100개) and methods in parallel
        const [historyResult, methodsResult] = await Promise.all([
          getUserPaymentHistory(user.id, 100, 0),
          getUserPaymentMethods(user.id),
        ]);

        setAllPaymentHistory(historyResult.data);
        setPaymentMethods(methodsResult);
      } catch (error) {
        console.error("Error loading payment data:", error);
      } finally {
        setLoadingPaymentData(false);
      }
    };

    loadPaymentData();
  }, [user, subscriptionData]); // paymentHistoryPage 제거 - 페이지 변경 시 재로드 안함

  // Load notification settings from Supabase
  useEffect(() => {
    const loadNotificationSettings = async () => {
      if (!user) return;

      try {
        setLoadingNotifications(true);

        const { data, error } = await supabase
          .from("user_notification_settings")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Error loading notification settings:", error);
          return;
        }

        if (data) {
          const settings = {
            push: data.push_notifications ?? true,
            printComplete: data.print_complete_notifications ?? true,
            error: data.error_notifications ?? true,
            email: data.email_notifications ?? false,
            weekly: data.weekly_report ?? false,
          };

          setPushNotifications(settings.push);
          setPrintCompleteNotif(settings.printComplete);
          setErrorNotif(settings.error);
          setEmailNotifications(settings.email);
          setWeeklyReport(settings.weekly);
          setOriginalNotifications(settings);
        }
      } catch (error) {
        console.error("Error loading notification settings:", error);
      } finally {
        setLoadingNotifications(false);
      }
    };

    loadNotificationSettings();
  }, [user]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "잘못된 파일 형식",
        description: "이미지 파일만 업로드할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "파일 크기 초과",
        description: "최대 2MB까지 업로드할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingAvatar(true);

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateError) throw updateError;

      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (profileError) {
        console.error('Error updating profile avatar:', profileError);
      }

      // Refresh user metadata
      await supabase.auth.getUser();

      setAvatarUrl(publicUrl);
      toast({
        title: "프로필 사진 업데이트 완료",
        description: "프로필 사진이 성공적으로 변경되었습니다.",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "업로드 실패",
        description: "프로필 사진 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      // 1. Update auth user_metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: displayName,
        }
      });

      if (authError) throw authError;

      // 2. Update profiles table (including phone)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          display_name: displayName,
          phone: phone || null,
        }, {
          onConflict: 'user_id'
        });

      if (profileError) throw profileError;

      setIsEditingProfile(false);
      toast({
        title: t("userSettings.profileUpdated"),
        description: t("userSettings.profileUpdatedDesc"),
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "업데이트 실패",
        description: "프로필 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleLinkGoogle = async () => {
    const { error } = await linkGoogleAccount();
    if (error) {
      console.error("Failed to link Google account:", error);
      toast({
        title: t("userSettings.linkFailed"),
        description: t("userSettings.linkFailedDescription"),
        variant: "destructive",
      });
    }
  };

  const handleUnlinkGoogle = async () => {
    const { error } = await unlinkProvider("google");
    if (error) {
      console.error("Failed to unlink Google account:", error);
      toast({
        title: t("userSettings.unlinkFailed"),
        description: t("userSettings.unlinkFailedDescription"),
        variant: "destructive",
      });
    } else {
      toast({
        title: t("userSettings.unlinkSuccess"),
        description: t("userSettings.unlinkSuccessDescription"),
      });
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const handleDeleteAccount = async () => {
    console.log("Deleting account...");
    await signOut();
    navigate("/", { replace: true });
  };

  // Save notification settings to Supabase
  const handleSaveNotifications = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_notification_settings")
        .update({
          push_notifications: pushNotifications,
          print_complete_notifications: printCompleteNotif,
          error_notifications: errorNotif,
          email_notifications: emailNotifications,
          weekly_report: weeklyReport,
        })
        .eq("user_id", user.id);

      if (error) {
        console.error("Error updating notification settings:", error);
        toast({
          title: t("common.error"),
          description: "알림 설정 업데이트에 실패했습니다.",
          variant: "destructive",
        });
      } else {
        setOriginalNotifications({
          email: emailNotifications,
          push: pushNotifications,
          printComplete: printCompleteNotif,
          error: errorNotif,
          weekly: weeklyReport,
        });
        setIsEditingNotifications(false);
        toast({
          title: t("common.success"),
          description: "알림 설정이 저장되었습니다.",
        });
      }
    } catch (error) {
      console.error("Error updating notification settings:", error);
    }
  };

  return (
    <div className="min-h-screen pt-16">
      {/* Left Sidebar Navigation */}
      <aside
        className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-background border-r z-40"
      >
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-6">
            {t("userSettings.title")}
          </h2>
        </div>
        <nav className="space-y-1 px-2">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                activeTab === 'profile'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <User className="h-4 w-4 shrink-0" />
              <span>{t("userSettings.profile")}</span>
            </button>

            <button
              onClick={() => setActiveTab('account')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                activeTab === 'account'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span>{t("userSettings.account")}</span>
            </button>

            <button
              onClick={() => setActiveTab('subscription')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                activeTab === 'subscription'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <CreditCard className="h-4 w-4 shrink-0" />
              <span>{t("userSettings.subscription")}</span>
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                activeTab === 'notifications'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <Bell className="h-4 w-4 shrink-0" />
              <span>{t("userSettings.notifications")}</span>
            </button>
          </nav>
      </aside>

      {/* Main Content Area */}
      <div className="ml-64 flex justify-center">
        <div className="py-8 px-8 w-full max-w-5xl">

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Header Section */}
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">{t("userSettings.profileInfo")}</h2>
              <p className="text-muted-foreground">
                {t("userSettings.profileDescription")}
              </p>
            </div>

          <Card className="overflow-hidden border-2">
            <CardContent className="p-8 space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                />
                <label htmlFor="avatar-upload" className="cursor-pointer">
                  <div className="relative group">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Profile"
                        className="w-24 h-24 rounded-full object-cover border-2 border-primary"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-24 h-24 bg-primary rounded-full border-2 border-primary">
                        <User className="w-12 h-12 text-primary-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-6 w-6 text-white" />
                    </div>
                    {uploadingAvatar && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                      </div>
                    )}
                  </div>
                </label>
                <div className="space-y-2">
                  <h3 className="font-medium">
                    {t("userSettings.profilePicture")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    JPG, PNG or GIF format (max 2MB)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    프로필 사진을 클릭하여 변경하세요
                  </p>
                </div>
              </div>

              <Separator />

              {/* Form */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="displayName">{t("userSettings.name")}</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      setIsEditingProfile(true);
                    }}
                    placeholder={t("userSettings.namePlaceholder")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t("userSettings.email")}</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      value={email}
                      disabled
                      className="pr-24"
                    />
                    <Badge
                      variant="secondary"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      {t("userSettings.verified")}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{t("userSettings.phone", "휴대폰 번호")}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setIsEditingProfile(true);
                    }}
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>

              {isEditingProfile && (
                <div className="flex justify-between items-center pt-6 border-t">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        초기화
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>프로필 정보 초기화</AlertDialogTitle>
                        <AlertDialogDescription>
                          정말로 프로필 정보를 초기화하시겠습니까? 변경된 내용이 모두 삭제됩니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            setDisplayName(originalProfile.displayName);
                            setPhone(originalProfile.phone);
                            setIsEditingProfile(false);
                          }}
                        >
                          초기화
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button onClick={handleSaveProfile}>
                    {t("userSettings.saveChanges")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        )}

        {/* Account Tab */}
        {activeTab === 'account' && (
          <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="space-y-3">
                <CardTitle>{t("userSettings.socialAccounts")}</CardTitle>
                <CardDescription>
                  {t("userSettings.socialAccountsDescription")}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Google Account Linking */}
              {isGoogleLinked ? (
                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                      <GoogleLogo />
                    </div>
                    <div>
                      <p className="font-medium">Google</p>
                      <p className="text-sm text-muted-foreground">
                        {googleIdentity?.identity_data?.email ||
                          t("userSettings.linkedAccount")}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        <Unlink className="h-4 w-4 mr-2" />
                        {t("userSettings.unlinkAccount")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t("userSettings.unlinkConfirmTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("userSettings.unlinkConfirmDescription")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleUnlinkGoogle}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t("userSettings.unlinkAccount")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={handleLinkGoogle}
                >
                  <div className="flex items-center gap-4 w-full">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                      <GoogleLogo />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">
                        {t("userSettings.linkGoogleAccount")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("userSettings.linkGoogleDescription")}
                      </p>
                    </div>
                  </div>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive">
            <CardHeader>
              <div className="space-y-3">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  {t("userSettings.dangerZone")}
                </CardTitle>
                <CardDescription>
                  {t("userSettings.dangerZoneDescription")}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("userSettings.deleteAccount")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("userSettings.deleteAccountConfirmTitle")}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>{t("userSettings.deleteAccountWarning")}</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>{t("userSettings.deleteWarning1")}</li>
                        <li>{t("userSettings.deleteWarning2")}</li>
                        <li>{t("userSettings.deleteWarning3")}</li>
                        <li>{t("userSettings.deleteWarning4")}</li>
                      </ul>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("userSettings.deleteAccount")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className="space-y-8">
            {loadingPlan ? (
              <Card>
                <CardContent className="flex items-center justify-center p-12">
                  <div className="text-sm text-muted-foreground">
                    {t("userSettings.loadingSubscription")}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Current Plan Section */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight">{t("userSettings.currentPlan")}</h2>
                    <p className="text-muted-foreground">
                      {t("userSettings.subscriptionDescription")}
                    </p>
                  </div>

                  <Card className="overflow-hidden border-2">
                    <CardContent className="p-0">
                      <div className="p-8 bg-gradient-to-br from-primary/5 to-primary/10">
                        <div className="flex items-center justify-between mb-6">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <Badge className="text-base px-4 py-1.5 capitalize bg-primary hover:bg-primary">
                                <Crown className="h-4 w-4 mr-2" />
                                {currentPlan} {t("userSettings.plan")}
                              </Badge>
                            </div>
                            {subscriptionData && subscriptionData.price > 0 ? (
                              <>
                                <p className="text-3xl font-bold">
                                  ₩{subscriptionData.price.toLocaleString()}
                                  <span className="text-base font-normal text-muted-foreground ml-2">
                                    /{" "}
                                    {subscriptionData.billingCycle === "year"
                                      ? t("userSettings.perYear")
                                      : t("userSettings.perMonth")}
                                  </span>
                                </p>
                                {subscriptionData.nextBillingDate && (
                                  <p className="text-sm text-muted-foreground">
                                    {t("userSettings.nextBillingDate")}:{" "}
                                    {new Date(
                                      subscriptionData.nextBillingDate,
                                    ).toLocaleDateString("ko-KR")}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-3xl font-bold">
                                ₩0
                                <span className="text-base font-normal text-muted-foreground ml-2">
                                  / 월
                                </span>
                              </p>
                            )}
                          </div>
                          <Button size="lg" onClick={() => setShowChangePlanModal(true)} className="h-11">
                            {currentPlan === 'free' ? t("userSettings.upgradePlan") : t("subscription.viewAllPlans")}
                          </Button>
                        </div>

                        {/* Plan Features */}
                        <div className="border-t pt-6">
                          <h4 className="font-semibold mb-4 text-sm text-muted-foreground">플랜 포함 사항</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {currentPlan === 'free' && (
                              <>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>{PLAN_FEATURES.free.maxPrinters}대의 3D 프린터 연결</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>무제한 웹캠 스트리밍</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>기본 출력 모니터링</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>커뮤니티 지원</span>
                                </div>
                              </>
                            )}
                            {currentPlan === 'pro' && (
                              <>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>최대 {PLAN_FEATURES.pro.maxPrinters}대의 3D 프린터 연결</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>무제한 웹캠 스트리밍</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>월 {PLAN_FEATURES.pro.aiModelGeneration}회 AI 모델 생성</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>고급 분석 대시보드</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>API 액세스</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>이메일 우선 지원</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>7일 로그 보관</span>
                                </div>
                              </>
                            )}
                            {currentPlan === 'enterprise' && (
                              <>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>무제한 3D 프린터 연결</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>무제한 AI 모델 생성</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>AI 어시스턴트</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>고급 분석 대시보드</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>전용 API 지원</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>24/7 전담 지원</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>무제한 로그 보관</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>맞춤형 통합 지원</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Refund Policy Link */}
                  <div className="flex justify-center">
                    <Button
                      variant="link"
                      className="text-sm text-muted-foreground"
                      onClick={() => setShowRefundPolicyModal(true)}
                    >
                      {t('userSettings.refundPolicyButton')}
                    </Button>
                  </div>
                </div>

                {/* Billing Management Section */}
                {subscriptionData && (
                  <>
                    {/* Past Invoices */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-semibold tracking-tight">{t('userSettings.billingHistory')}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('userSettings.billingHistoryDesc')}
                        </p>
                      </div>

                      <Card>
                        <CardContent className="p-0">
                          {loadingPaymentData ? (
                            <div className="p-8 text-center text-muted-foreground">
                              {t('userSettings.loadingPaymentData')}
                            </div>
                          ) : allPaymentHistory.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                              {t('userSettings.noPaymentHistory')}
                            </div>
                          ) : (
                            <>
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="border-b bg-muted/50">
                                      <th className="text-left p-4 font-medium text-sm">{t('userSettings.date')}</th>
                                      <th className="text-left p-4 font-medium text-sm">{t('userSettings.amount')}</th>
                                      <th className="text-left p-4 font-medium text-sm">{t('userSettings.invoiceNumber')}</th>
                                      <th className="text-left p-4 font-medium text-sm">{t('userSettings.status')}</th>
                                      <th className="text-right p-4 font-medium text-sm"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {paginatedPaymentHistory.map((payment) => (
                                      <tr key={payment.id} className="border-b hover:bg-muted/30">
                                        <td className="p-4 text-sm">
                                          {new Date(payment.paid_at || payment.created_at).toLocaleDateString("ko-KR", {
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric"
                                          })}
                                        </td>
                                        <td className="p-4 text-sm">
                                          ₩{payment.amount.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-sm font-mono">
                                          {payment.order_id || payment.id.slice(0, 8).toUpperCase()}
                                        </td>
                                        <td className="p-4">
                                          <Badge
                                            variant={
                                              payment.status === 'success' ? 'default' :
                                              payment.status === 'pending' ? 'secondary' :
                                              payment.status === 'failed' ? 'destructive' :
                                              payment.status === 'refunded' ? 'outline' :
                                              'secondary'
                                            }
                                            className="text-xs"
                                          >
                                            {payment.status === 'success' ? '완료' :
                                             payment.status === 'pending' ? '대기중' :
                                             payment.status === 'failed' ? '실패' :
                                             payment.status === 'refunded' ? '환불' :
                                             payment.status === 'canceled' ? '취소' :
                                             payment.status}
                                          </Badge>
                                        </td>
                                        <td className="p-4 text-right">
                                          {payment.receipt_url && (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => window.open(payment.receipt_url!, '_blank')}
                                            >
                                              영수증
                                            </Button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="p-4 border-t">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-muted-foreground">
                                    Showing {((paymentHistoryPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(paymentHistoryPage * ITEMS_PER_PAGE, allPaymentHistory.length)} out of {allPaymentHistory.length} invoices
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setPaymentHistoryPage(prev => Math.max(1, prev - 1))}
                                      disabled={paymentHistoryPage === 1}
                                    >
                                      <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setPaymentHistoryPage(prev => prev + 1)}
                                      disabled={paymentHistoryPage * ITEMS_PER_PAGE >= allPaymentHistory.length}
                                    >
                                      <ChevronRight className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Payment Methods */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-semibold tracking-tight">{t('userSettings.paymentMethods')}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('userSettings.paymentMethodsDesc')}
                        </p>
                      </div>

                      <Card>
                        <CardContent className="p-6">
                          {loadingPaymentData ? (
                            <div className="p-8 text-center text-muted-foreground">
                              {t('userSettings.loadingPaymentMethods')}
                            </div>
                          ) : paymentMethods.length === 0 ? (
                            <div className="p-8 text-center">
                              <p className="text-muted-foreground mb-4">{t('userSettings.noPaymentMethods')}</p>
                              <Button
                                variant="outline"
                                onClick={() => setShowPaymentMethodModal(true)}
                              >
                                {t('userSettings.addPaymentMethod')}
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="space-y-3">
                                {paymentMethods.map((method) => (
                                  <div
                                    key={method.id}
                                    className="flex items-center justify-between p-4 rounded-lg border"
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className="h-10 w-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
                                        <CreditCard className="h-5 w-5 text-white" />
                                      </div>
                                      <div>
                                        <p className="font-medium">{method.card_number}</p>
                                        <p className="text-sm text-muted-foreground">
                                          {method.card_company && `${method.card_company} · `}만료: {method.card_expiry}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {method.is_default && (
                                        <Badge className="bg-green-500 hover:bg-green-500">기본</Badge>
                                      )}
                                      <Button variant="ghost" size="icon">
                                        <span className="text-xl">⋯</span>
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <Button
                                variant="outline"
                                className="w-full mt-4"
                                onClick={() => setShowPaymentMethodModal(true)}
                              >
                                + 새 카드 추가
                              </Button>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Credit Balance */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-semibold tracking-tight">{t('userSettings.creditBalance')}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('userSettings.creditBalanceDesc')}
                        </p>
                      </div>

                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">잔액</p>
                              <p className="text-3xl font-bold">₩0.00</p>
                            </div>
                            <Button variant="outline">충전하기</Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Email Recipient */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-semibold tracking-tight">이메일 수신자</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          모든 청구 관련 안내는 이 이메일로 발송됩니다.
                        </p>
                      </div>

                      <Card>
                        <CardContent className="p-6 space-y-4">
                          <div>
                            <Label htmlFor="email">이메일 주소</Label>
                            <Input
                              id="email"
                              type="email"
                              value={user?.email || ''}
                              disabled
                              className="mt-2"
                            />
                          </div>

                          <div>
                            <Label htmlFor="additional-emails">추가 이메일</Label>
                            <Input
                              id="additional-emails"
                              type="email"
                              placeholder="추가 수신자 입력"
                              className="mt-2"
                            />
                          </div>

                          <div className="flex gap-2 justify-end pt-4">
                            <Button variant="outline">취소</Button>
                            <Button>저장</Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <CardTitle>{t("userSettings.notificationSettings")}</CardTitle>
                  <CardDescription>
                    {t("userSettings.notificationDescription")}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setPushNotifications(originalNotifications.push);
                    setPrintCompleteNotif(originalNotifications.printComplete);
                    setErrorNotif(originalNotifications.error);
                    setEmailNotifications(originalNotifications.email);
                    setWeeklyReport(originalNotifications.weekly);
                    setIsEditingNotifications(false);
                  }}
                  className="h-9 w-9 shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Push Notifications */}
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="push-notif"
                      className="text-base font-medium cursor-pointer"
                    >
                      {t("userSettings.pushNotifications")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t("userSettings.pushNotificationsDesc")}
                    </p>
                  </div>
                  <Switch
                    id="push-notif"
                    checked={pushNotifications}
                    onCheckedChange={(value) => {
                      setPushNotifications(value);
                      setIsEditingNotifications(true);
                    }}
                    disabled={loadingNotifications}
                  />
                </div>

                <Separator />

                {/* Print Complete */}
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="print-complete"
                      className="text-base font-medium cursor-pointer"
                    >
                      {t("userSettings.printComplete")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t("userSettings.printCompleteDesc")}
                    </p>
                  </div>
                  <Switch
                    id="print-complete"
                    checked={printCompleteNotif}
                    onCheckedChange={(value) => {
                      setPrintCompleteNotif(value);
                      setIsEditingNotifications(true);
                    }}
                    disabled={loadingNotifications}
                  />
                </div>

                <Separator />

                {/* Error Notifications */}
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="error-notif"
                      className="text-base font-medium cursor-pointer"
                    >
                      {t("userSettings.errorNotifications")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t("userSettings.errorNotificationsDesc")}
                    </p>
                  </div>
                  <Switch
                    id="error-notif"
                    checked={errorNotif}
                    onCheckedChange={(value) => {
                      setErrorNotif(value);
                      setIsEditingNotifications(true);
                    }}
                    disabled={loadingNotifications}
                  />
                </div>

                <Separator />

                {/* Email Notifications */}
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="email-notif"
                        className={`text-base font-medium ${
                          currentPlan === "free"
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer"
                        }`}
                      >
                        {t("userSettings.emailNotifications")}
                      </Label>
                      <Badge
                        className="text-xs bg-gradient-to-r from-blue-600 to-blue-500 text-white border-0"
                        style={{
                          boxShadow:
                            "0 2px 8px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                        }}
                      >
                        <Crown className="h-3 w-3 mr-1" />
                        Pro
                      </Badge>
                    </div>
                    <p
                      className={`text-sm text-muted-foreground ${
                        currentPlan === "free" ? "opacity-50" : ""
                      }`}
                    >
                      {t("userSettings.emailNotificationsDesc")}
                    </p>
                  </div>
                  <Switch
                    id="email-notif"
                    checked={emailNotifications}
                    onCheckedChange={(value) => {
                      setEmailNotifications(value);
                      setIsEditingNotifications(true);
                    }}
                    disabled={currentPlan === "free" || loadingNotifications}
                  />
                </div>

                <Separator />

                {/* Weekly Report */}
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="weekly-report"
                        className={`text-base font-medium ${
                          currentPlan === "free"
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer"
                        }`}
                      >
                        {t("userSettings.weeklyReport")}
                      </Label>
                      <Badge
                        className="text-xs bg-gradient-to-r from-blue-600 to-blue-500 text-white border-0"
                        style={{
                          boxShadow:
                            "0 2px 8px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                        }}
                      >
                        <Crown className="h-3 w-3 mr-1" />
                        Pro
                      </Badge>
                    </div>
                    <p
                      className={`text-sm text-muted-foreground ${
                        currentPlan === "free" ? "opacity-50" : ""
                      }`}
                    >
                      {t("userSettings.weeklyReportDesc")}
                    </p>
                  </div>
                  <Switch
                    id="weekly-report"
                    checked={weeklyReport}
                    onCheckedChange={(value) => {
                      setWeeklyReport(value);
                      setIsEditingNotifications(true);
                    }}
                    disabled={currentPlan === "free" || loadingNotifications}
                  />
                </div>
              </div>

              {isEditingNotifications && (
                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={handleSaveNotifications}>
                    {t("userSettings.saveChanges")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        )}

        </div>
        {/* End Inner Container */}
      </div>
      {/* End Main Content Area */}

      {/* Downgrade Warning Dialog */}
      <Dialog open={showDowngradeWarningModal} onOpenChange={setShowDowngradeWarningModal}>
        <DialogContent className="max-w-2xl">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-bold mb-2">Free 플랜으로 다운그레이드 확인</h2>
              <p className="text-sm text-muted-foreground">
                Free 플랜으로 변경 시 일부 기능이 제한됩니다.
              </p>
            </div>

            <Separator />

            {/* Warning Boxes */}
            <div className="space-y-4">
              {/* Main Warning */}
              <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                      Free 플랜으로 다운그레이드 시 제한 사항
                    </h3>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      현재 사용 중인 리소스가 Free 플랜의 제한을 초과할 경우, 일부 프린터가 비활성화되거나 읽기 전용 모드로 전환될 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* Affected Features */}
              <div className="bg-muted/50 border rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-500 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h3 className="font-semibold">영향을 받는 기능</h3>
                    <ul className="text-sm text-muted-foreground space-y-1.5">
                      <li>• <strong className="text-foreground">프린터 연결:</strong> 최대 1대로 제한 (현재 {currentPlan === 'pro' ? '5대' : '무제한'} 사용 가능)</li>
                      <li>• <strong className="text-foreground">AI 모델 생성:</strong> 사용 불가</li>
                      <li>• <strong className="text-foreground">고급 분석:</strong> 사용 불가</li>
                      <li>• <strong className="text-foreground">API 액세스:</strong> 사용 불가</li>
                      <li>• <strong className="text-foreground">우선 지원:</strong> 커뮤니티 지원으로 전환</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="space-y-3 text-sm">
              <h3 className="font-semibold">다운그레이드 전 고려사항:</h3>
              <ul className="space-y-2 text-muted-foreground ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-foreground mt-0.5">•</span>
                  <span>연결된 프린터가 2대 이상인 경우, 1대만 활성 상태로 유지됩니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-foreground mt-0.5">•</span>
                  <span>프리미엄 기능을 사용하는 프로젝트는 읽기 전용으로 전환될 수 있습니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-foreground mt-0.5">•</span>
                  <span>다운그레이드 후에도 현재 결제 주기가 끝날 때까지 프리미엄 기능을 사용할 수 있습니다.</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDowngradeWarningModal(false)}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowDowngradeWarningModal(false);
                  toast({
                    title: "다운그레이드 요청",
                    description: "고객 지원팀에 다운그레이드 요청이 전달되었습니다.",
                  });
                }}
              >
                확인 및 다운그레이드
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Refund Policy Dialog */}
      <Dialog open={showRefundPolicyModal} onOpenChange={setShowRefundPolicyModal}>
        <DialogContent className="max-w-3xl h-[85vh] p-0 gap-0 flex flex-col">
          {/* Fixed Header */}
          <div className="px-6 pt-6 pb-4 border-b bg-background shrink-0">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">월 구독 플랜 환불 정책</h2>
                <p className="text-sm text-muted-foreground">
                  시행일: 2025년 11월 10일 | 적용 대상: FACTOR 3D의 월 구독 플랜
                </p>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">

            <div className="space-y-5">
              {/* 1. 기본 원칙 */}
              <section className="space-y-2">
                <h3 className="text-lg font-semibold">1. 기본 원칙</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground leading-relaxed ml-2">
                  <li>구독은 월 단위 선결제이며, 결제 즉시 프리미엄 기능이 활성화됩니다.</li>
                  <li>환불은 아래 기준에 따라 처리되며, 부분 사용분 공제 또는 일할 계산이 적용될 수 있습니다.</li>
                  <li>자동 갱신 전 언제든 해지 가능하며, 해지 시 다음 결제부터 청구되지 않습니다.</li>
                </ul>
              </section>

              {/* 2. 결제 직후 철회 */}
              <section className="space-y-2">
                <h3 className="text-lg font-semibold">2. 결제 직후 철회(변심) - 쿨링오프</h3>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    결제 후 <strong className="text-foreground">7일 이내</strong>이고, 실질적 사용(대량 사용·다운로드·크레딧 소진 등)이 없을 경우 <strong className="text-foreground">전액 환불</strong>합니다.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    사용 이력이 일부라도 있는 경우, 일할 차감 또는 사용량 차감 후 환불합니다.
                  </p>
                  <div className="bg-muted p-3 rounded text-sm">
                    <strong>예시:</strong> 월 30일 기준 3일 사용 시 → 결제금액 × (30-3)/30 환불
                  </div>
                </div>
              </section>

              {/* 3. 무료 체험 */}
              <section className="space-y-2">
                <h3 className="text-lg font-semibold">3. 무료 체험(Trial)·프로모션</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground leading-relaxed ml-2">
                  <li>무료 체험 기간 중에는 언제든 해지 가능하며 청구·환불 없음</li>
                  <li>체험 종료 후 유료 전환·청구가 발생한 뒤에는 본 정책 2)~10) 조항 적용</li>
                </ul>
              </section>

              {/* 4. 중도 해지 */}
              <section className="space-y-2">
                <h3 className="text-lg font-semibold">4. 중도 해지(월 구독 기간 내)</h3>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    해지 즉시 미사용 기간에 대해 일할 계산하여 <strong className="text-foreground">영업일 5~10일</strong> 내 결제 수단으로 환불합니다.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    해지 후에도 현재 결제 주기 종료일까지 서비스 이용 가능합니다.
                  </p>
                </div>
              </section>

              {/* 5. 장애·품질 문제 */}
              <section className="space-y-2">
                <h3 className="text-lg font-semibold">5. 장애·품질 문제로 인한 환불</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground leading-relaxed ml-2">
                  <li>연속 12시간 이상 중대한 서비스 장애 발생 시, 고객 요청에 따라 장애시간 비례 금액을 크레딧/연장 또는 환불 중 선택 제공</li>
                  <li>장애 통지 및 보상 요청은 발생일로부터 14일 이내 고객센터로 접수</li>
                </ul>
              </section>

              {/* 6. 과금 오류 */}
              <section className="space-y-2">
                <h3 className="text-lg font-semibold">6. 과금 오류·중복 결제</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  중복 결제 또는 명백한 과금 오류 확인 시 전액 환불. 영수증/거래 내역 확인 후 영업일 5~10일 내 결제 수단으로 환불 처리.
                </p>
              </section>

              {/* 7. 결제 실패 */}
              <section className="space-y-2">
                <h3 className="text-lg font-semibold">7. 결제 실패·미수금</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  결제 실패 시 3~7일 간 재시도하며, 실패 지속 시 자동 해지 또는 기능 제한이 적용됩니다.
                  미수금 해소 시 서비스가 재개되며, 사용하지 못한 기간에 대한 자동 환불은 없습니다.
                </p>
              </section>

              {/* 8. 남용·사기 방지 */}
              <section className="space-y-2">
                <h3 className="text-lg font-semibold">8. 남용·사기 방지</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  불법 사용, 환불 남용이 확인될 경우 환불 제한·계정 제한이 적용될 수 있습니다.
                </p>
              </section>

              {/* 9. 환불 절차 */}
              <section className="space-y-2">
                <h3 className="text-lg font-semibold">9. 환불 절차</h3>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <p><strong className="text-foreground">요청 경로:</strong> tlvh109@gmail.com</p>
                    <p><strong className="text-foreground">필수 정보:</strong> 결제 이메일/아이디, 결제일, 금액, 사유, 영수증</p>
                    <p><strong className="text-foreground">처리 기한:</strong> 요청 수신 후 영업일 5~10일 내 승인/반려 안내</p>
                    <p><strong className="text-foreground">표시 반영:</strong> 카드사 정책에 따라 실 반영까지 최대 14일 소요</p>
                  </div>
                </div>
              </section>

              {/* 10. 세금·수수료 */}
              <section className="space-y-2">
                <h3 className="text-lg font-semibold">10. 세금·수수료</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground leading-relaxed ml-2">
                  <li>환불 시 결제 대행 수수료·환전 수수료 등이 발생하면, 법령 허용 범위 내에서 실비 공제가 적용될 수 있습니다</li>
                  <li>국외 결제의 경우 환율 변동으로 환불 금액이 결제 금액과 다를 수 있습니다</li>
                </ul>
              </section>

              {/* 11. 정책 변경 */}
              <section className="space-y-2">
                <h3 className="text-lg font-semibold">11. 정책 변경</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  본 정책은 사전 고지 후 변경될 수 있습니다. 중대한 변경 시 시행 7일 전 이메일/공지로 안내합니다.
                </p>
              </section>

              {/* 문의처 */}
              <section className="space-y-2">
                <h3 className="text-lg font-semibold">12. 문의처</h3>
                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-2">
                  <p className="text-sm">
                    <strong>이메일:</strong> tlvh109@gmail.com
                  </p>
                  <p className="text-sm">
                    <strong>운영 시간:</strong> 평일 10:00 - 18:00 KST
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    상세한 환불 정책 및 문의사항은 위 이메일로 연락 주시기 바랍니다.
                  </p>
                </div>
              </section>

              {/* 요약 박스 */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 text-sm">빠른 요약</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  월 구독은 선결제이며, <strong>7일 이내 미사용 시 전액 환불</strong> / <strong>중도 해지 시 미사용분 일할 환불</strong>을 제공합니다.
                  환불 문의: tlvh109@gmail.com
                </p>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="px-6 py-4 border-t bg-background shrink-0">
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowRefundPolicyModal(false)}
              >
                취소
              </Button>
              <Button onClick={() => setShowRefundPolicyModal(false)}>
                확인
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Plan Sheet */}
      <Sheet open={showChangePlanModal} onOpenChange={setShowChangePlanModal}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto z-50">
          <SheetHeader>
            <SheetTitle>{user?.email}님의 구독 플랜 변경</SheetTitle>
            <SheetDescription>
              3D 프린터 팜 규모와 필요한 기능에 따라 적합한 플랜을 선택하세요. 언제든지 변경 가능합니다.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-6">
            {/* Free Plan */}
            <div className={`relative border rounded-lg p-6 hover:border-primary/50 transition-colors ${currentPlan === 'free' ? 'border-primary border-2 bg-primary/5' : 'border-border'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold">FREE</h3>
                    {currentPlan === 'free' && (
                      <Badge className="bg-primary">현재 플랜</Badge>
                    )}
                  </div>
                  <p className="text-3xl font-bold mt-3">₩0 <span className="text-base font-normal text-muted-foreground">/ 월</span></p>
                </div>
              </div>

              {currentPlan !== 'free' && (
                <Button
                  variant="outline"
                  className="w-full mb-4"
                  onClick={() => {
                    setShowDowngradeWarningModal(true);
                  }}
                >
                  Free 플랜으로 변경
                </Button>
              )}
              {currentPlan === 'free' && (
                <Button
                  variant="outline"
                  className="w-full mb-4"
                  onClick={() => {
                    // Keep modal open and switch to subscription tab
                    setActiveTab('subscription');
                  }}
                >
                  Manage in Settings
                </Button>
              )}

              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground mb-3">개인 사용자 및 소규모 프로젝트에 적합합니다.</p>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>{PLAN_FEATURES.free.maxPrinters}대의 3D 프린터 연결</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>무제한 웹캠 스트리밍</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>기본 출력 모니터링</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>커뮤니티 지원</span>
                </div>
              </div>
            </div>

            {/* Pro Plan */}
            <div className={`relative border rounded-lg p-6 hover:border-primary/50 transition-colors ${currentPlan === 'pro' ? 'border-primary border-2 bg-primary/5' : 'border-border'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold">PRO</h3>
                    {currentPlan === 'pro' && (
                      <Badge className="bg-primary">현재 플랜</Badge>
                    )}
                  </div>
                  <p className="text-3xl font-bold mt-3">₩19,900 <span className="text-base font-normal text-muted-foreground">/ 월</span></p>
                </div>
              </div>

              {currentPlan !== 'pro' && (
                <Button
                  className="w-full mb-4 bg-primary hover:bg-primary/90"
                  onClick={() => {
                    window.location.href = '/payment/checkout?plan=pro&cycle=monthly';
                  }}
                >
                  Pro 플랜으로 업그레이드
                </Button>
              )}
              {currentPlan === 'pro' && (
                <Button
                  variant="outline"
                  className="w-full mb-4"
                  onClick={() => {
                    // Keep modal open and switch to subscription tab
                    setActiveTab('subscription');
                  }}
                >
                  Manage in Settings
                </Button>
              )}

              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground mb-3">중소규모 프린터 팜을 운영하는 전문가에게 적합합니다.</p>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>최대 {PLAN_FEATURES.pro.maxPrinters}대의 3D 프린터 연결</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>무제한 웹캠 스트리밍</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>월 50회 AI 모델 생성</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>고급 분석 대시보드</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>API 액세스</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>이메일 우선 지원</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>7일 로그 보관</span>
                </div>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className={`relative border rounded-lg p-6 hover:border-primary/50 transition-colors ${currentPlan === 'enterprise' ? 'border-primary border-2 bg-primary/5' : 'border-border'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold">ENTERPRISE</h3>
                    {currentPlan === 'enterprise' && (
                      <Badge className="bg-primary">현재 플랜</Badge>
                    )}
                  </div>
                  <p className="text-3xl font-bold mt-3">₩99,000 <span className="text-base font-normal text-muted-foreground">/ 월</span></p>
                  <p className="text-xs text-muted-foreground mt-1">또는 맞춤형 견적</p>
                </div>
              </div>

              {currentPlan !== 'enterprise' && (
                <Button
                  className="w-full mb-4 bg-primary hover:bg-primary/90"
                  onClick={() => {
                    window.open('mailto:contact@factor.io.kr?subject=엔터프라이즈 플랜 문의', '_blank');
                  }}
                >
                  영업팀 문의하기
                </Button>
              )}
              {currentPlan === 'enterprise' && (
                <Button
                  variant="outline"
                  className="w-full mb-4"
                  onClick={() => {
                    // Keep modal open and switch to subscription tab
                    setActiveTab('subscription');
                  }}
                >
                  Manage in Settings
                </Button>
              )}

              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground mb-3">대규모 프린터 팜과 맞춤형 솔루션이 필요한 기업에 적합합니다.</p>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>무제한 3D 프린터 연결</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>무제한 AI 모델 생성</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>AI 어시스턴트</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>ERP/MES 시스템 통합</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>전담 고객 성공 매니저</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>온프레미스 배포 지원</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>24시간 프리미엄 기술 지원</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>맞춤형 교육 및 컨설팅</span>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Billing History Modal */}
      <Dialog open={showBillingHistoryModal} onOpenChange={setShowBillingHistoryModal}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("userSettings.viewBillingHistory")}</DialogTitle>
            <DialogDescription>
              View your past invoices and payment history
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No billing history available yet</p>
              <p className="text-sm mt-2">Your payment history will appear here once you make a purchase</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Method Modal */}
      <Dialog open={showPaymentMethodModal} onOpenChange={setShowPaymentMethodModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("userSettings.managePaymentMethod")}</DialogTitle>
            <DialogDescription>
              Add or update your payment method
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payment method added</p>
              <p className="text-sm mt-2">Add a payment method to manage your subscription</p>
            </div>
            <Button className="w-full" onClick={() => {
              toast({
                title: "Coming Soon",
                description: "Payment method management will be available soon",
              });
            }}>
              Add Payment Method
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* End Root Container */}
    </div>
  );
};

export default UserSettings;
