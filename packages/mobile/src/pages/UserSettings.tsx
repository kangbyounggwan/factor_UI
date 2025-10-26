import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@shared/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@shared/integrations/supabase/client";
import {
  User,
  Mail,
  Lock,
  Bell,
  CreditCard,
  Trash2,
  ChevronRight,
  Crown,
  AlertTriangle,
  Camera,
  Check,
  Link as LinkIcon,
  Unlink,
  RefreshCw,
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

// Google Logo SVG Component
const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.20443C17.64 8.56625 17.5827 7.95262 17.4764 7.36353H9V10.8449H13.8436C13.635 11.9699 13.0009 12.9231 12.0477 13.5613V15.8194H14.9564C16.6582 14.2526 17.64 11.9453 17.64 9.20443Z" fill="#4285F4"/>
    <path d="M8.99976 18C11.4298 18 13.467 17.1941 14.9561 15.8195L12.0475 13.5613C11.2416 14.1013 10.2107 14.4204 8.99976 14.4204C6.65567 14.4204 4.67158 12.8372 3.96385 10.71H0.957031V13.0418C2.43794 15.9831 5.48158 18 8.99976 18Z" fill="#34A853"/>
    <path d="M3.96409 10.7098C3.78409 10.1698 3.68182 9.59301 3.68182 8.99983C3.68182 8.40665 3.78409 7.82983 3.96409 7.28983V4.95801H0.957273C0.347727 6.17301 0 7.54755 0 8.99983C0 10.4521 0.347727 11.8266 0.957273 13.0416L3.96409 10.7098Z" fill="#FBBC05"/>
    <path d="M8.99976 3.57955C10.3211 3.57955 11.5075 4.03364 12.4402 4.92545L15.0216 2.34409C13.4629 0.891818 11.4257 0 8.99976 0C5.48158 0 2.43794 2.01682 0.957031 4.95818L3.96385 7.29C4.67158 5.16273 6.65567 3.57955 8.99976 3.57955Z" fill="#EA4335"/>
  </svg>
);

const UserSettings = () => {
  const { user, signOut, linkGoogleAccount, unlinkProvider } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form states
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [bio, setBio] = useState(user?.user_metadata?.bio || "");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
  const googleIdentity = user?.identities?.find(id => id.provider === 'google');
  const isGoogleLinked = !!googleIdentity;

  // Subscription state
  const [currentPlan, setCurrentPlan] = useState<{
    name: string;
    price: number;
    billingCycle: string;
    nextBillingDate: string | null;
    maxPrinters: number;
  } | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  // Load subscription data from Supabase
  useEffect(() => {
    const loadSubscription = async () => {
      if (!user) return;

      try {
        setLoadingPlan(true);

        // user_subscriptions 테이블에서 현재 활성 구독 가져오기
        const { data: subscription, error } = await supabase
          .from('user_subscriptions')
          .select(`
            *,
            subscription_plans (
              name,
              price_monthly,
              price_yearly,
              max_printers
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (error) {
          console.error('Error loading subscription:', error);
          // 구독이 없는 경우 기본 플랜 표시
          setCurrentPlan({
            name: 'Basic',
            price: 0,
            billingCycle: 'monthly',
            nextBillingDate: null,
            maxPrinters: 2
          });
          return;
        }

        if (subscription) {
          const planData = subscription.subscription_plans as any;
          setCurrentPlan({
            name: planData?.name || 'Unknown',
            price: subscription.billing_cycle === 'yearly'
              ? planData?.price_yearly || 0
              : planData?.price_monthly || 0,
            billingCycle: subscription.billing_cycle || 'monthly',
            nextBillingDate: subscription.current_period_end || null,
            maxPrinters: planData?.max_printers || 2
          });
        }
      } catch (error) {
        console.error('Failed to load subscription:', error);
      } finally {
        setLoadingPlan(false);
      }
    };

    loadSubscription();
  }, [user]);

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
          title: "오류",
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
          title: "성공",
          description: "알림 설정이 저장되었습니다.",
        });
      }
    } catch (error) {
      console.error("Error updating notification settings:", error);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // 파일 크기 체크 (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "파일 크기 초과",
        description: "프로필 사진은 2MB 이하여야 합니다.",
        variant: "destructive",
      });
      return;
    }

    // 파일 타입 체크
    if (!file.type.startsWith('image/')) {
      toast({
        title: "잘못된 파일 형식",
        description: "이미지 파일만 업로드할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingAvatar(true);

      // 파일명 생성 (user_id + timestamp)
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Supabase Storage에 업로드
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Public URL 가져오기
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 사용자 메타데이터 업데이트
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast({
        title: "프로필 사진 변경 완료",
        description: "프로필 사진이 성공적으로 변경되었습니다.",
      });
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({
        title: "업로드 실패",
        description: "프로필 사진 업로드에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: displayName,
          bio: bio
        }
      });

      if (error) throw error;

      toast({
        title: "프로필 업데이트 완료",
        description: "프로필 정보가 성공적으로 업데이트되었습니다.",
      });
      setIsEditingProfile(false);
    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        title: "업데이트 실패",
        description: "프로필 정보 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleLinkGoogle = async () => {
    const { error } = await linkGoogleAccount();
    if (error) {
      console.error("Failed to link Google account:", error);
      toast({
        title: "연동 실패",
        description: "Google 계정 연동에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  const handleUnlinkGoogle = async () => {
    const { error } = await unlinkProvider('google');
    if (error) {
      console.error("Failed to unlink Google account:", error);
      toast({
        title: "연결 해제 실패",
        description: "Google 계정 연결 해제에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "연결 해제 완료",
        description: "Google 계정 연결이 해제되었습니다.",
      });
      // Reload user data
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const handleDeleteAccount = async () => {
    // TODO: Implement account deletion logic
    console.log("Deleting account...");
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-9 w-9"
            >
              <ChevronRight className="h-5 w-5 rotate-180" />
            </Button>
            <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {t("settings.profile")}
                </CardTitle>
                <CardDescription>
                  {t("settings.profileDescription")}
                </CardDescription>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("settings.resetProfileTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("settings.resetProfileDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        setDisplayName(user?.user_metadata?.full_name || "");
                        setBio(user?.user_metadata?.bio || "");
                        setIsEditingProfile(false);
                      }}
                    >
                      {t("settings.reset")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center w-20 h-20 bg-primary rounded-full">
                    <User className="w-10 h-10 text-primary-foreground" />
                  </div>
                )}
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <label htmlFor="avatar-upload">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full shadow-md cursor-pointer"
                    asChild
                    disabled={uploadingAvatar}
                  >
                    <span>
                      {uploadingAvatar ? (
                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </span>
                  </Button>
                </label>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{t("settings.profilePicture")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.profilePictureDesc")}</p>
              </div>
            </div>

            <Separator />

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName">{t("settings.name")}</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setIsEditingProfile(true);
                }}
                placeholder={t("settings.namePlaceholder")}
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">{t("settings.email")}</Label>
              <div className="relative">
                <Input
                  id="email"
                  value={email}
                  disabled
                  className="pr-20"
                />
                <Badge
                  variant="secondary"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                >
                  <Check className="h-3 w-3 mr-1" />
                  {t("settings.verified")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("settings.emailChangeNote")}
              </p>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">{t("settings.bio")}</Label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value);
                  setIsEditingProfile(true);
                }}
                placeholder={t("settings.bioPlaceholder")}
                className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground text-right">
                {bio.length}/200
              </p>
            </div>

            {isEditingProfile && (
              <div className="flex justify-end">
                <Button onClick={handleSaveProfile}>
                  {t("settings.saveChanges")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Linking */}
        <Card>
          <CardHeader>
            <div className="space-y-3">
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                {t("settings.socialAccounts")}
              </CardTitle>
              <CardDescription>
                {t("settings.socialAccountsDescription")}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Google Account Linking */}
            {isGoogleLinked ? (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-background">
                    <GoogleLogo />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Google</p>
                    <p className="text-xs text-muted-foreground">
                      {googleIdentity?.identity_data?.email || '연동됨'}
                    </p>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Unlink className="h-4 w-4 mr-1" />
                      연결 해제
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Google 계정 연결을 해제하시겠습니까?</AlertDialogTitle>
                      <AlertDialogDescription>
                        연결 해제 후에도 이메일과 비밀번호로 로그인할 수 있습니다.
                        다른 로그인 방법이 없다면 연결 해제를 권장하지 않습니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleUnlinkGoogle}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        연결 해제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start h-auto p-3"
                onClick={handleLinkGoogle}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-background">
                    <GoogleLogo />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">Google 계정 연결</p>
                    <p className="text-xs text-muted-foreground">
                      Google로 간편하게 로그인하세요
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Button>
            )}

            <Separator />

            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-start gap-2">
                <Lock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium">계정 보안 안내</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    소셜 계정 연동은 안전하게 암호화되어 저장됩니다. 언제든지 연결을 해제할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader>
            <div className="space-y-3">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t("settings.subscription")}
              </CardTitle>
              <CardDescription>
                {t("settings.subscriptionDescription")}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingPlan ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-sm text-muted-foreground">로딩 중...</div>
              </div>
            ) : currentPlan ? (
              <div className="flex items-start justify-between p-4 rounded-lg bg-muted/50">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="text-sm px-2 py-1">
                      <Crown className="h-3 w-3 mr-1" />
                      {currentPlan.name} 플랜
                    </Badge>
                  </div>
                  {currentPlan.price > 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {currentPlan.billingCycle === 'yearly' ? '연' : '월'} ₩{currentPlan.price.toLocaleString()}
                      </p>
                      {currentPlan.nextBillingDate && (
                        <p className="text-xs text-muted-foreground">
                          다음 결제일: {new Date(currentPlan.nextBillingDate).toLocaleDateString('ko-KR')}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-base font-semibold text-muted-foreground">
                      무료 플랜
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    최대 2대 프린터 연결 가능
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/subscription")}
                >
                  플랜 변경
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center p-8">
                <div className="text-sm text-muted-foreground">구독 정보를 불러올 수 없습니다</div>
              </div>
            )}

            <Separator />

            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => {
                // TODO: Navigate to billing history
                console.log("View billing history");
              }}
            >
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                결제 내역
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>

            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => {
                // TODO: Navigate to payment method
                console.log("Manage payment method");
              }}
            >
              <span className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                결제 수단 관리
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  {t("settings.notificationSettings")}
                </CardTitle>
                <CardDescription>
                  {t("settings.notificationDescription")}
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
          <CardContent className="space-y-4">
            {/* Push Notifications */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-notif" className="text-sm font-medium">
                  {t("settings.pushNotifications")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.pushNotificationsDesc")}
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
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="print-complete" className="text-sm font-medium">
                  {t("settings.printComplete")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.printCompleteDesc")}
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
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="error-notif" className="text-sm font-medium">
                  {t("settings.errorNotifications")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.errorNotificationsDesc")}
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
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="email-notif" className="text-sm font-medium">
                    {t("settings.emailNotifications")}
                  </Label>
                  <Badge
                    className="text-xs bg-gradient-to-r from-blue-600 to-blue-500 text-white border-0"
                    style={{
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                    }}
                  >
                    <Crown className="h-3 w-3 mr-1" />
                    Pro
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("settings.emailNotificationsDesc")}
                </p>
              </div>
              <Switch
                id="email-notif"
                checked={emailNotifications}
                onCheckedChange={(value) => {
                  setEmailNotifications(value);
                  setIsEditingNotifications(true);
                }}
                disabled={loadingNotifications}
              />
            </div>

            <Separator />

            {/* Weekly Report */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="weekly-report" className="text-sm font-medium">
                    {t("settings.weeklyReport")}
                  </Label>
                  <Badge
                    className="text-xs bg-gradient-to-r from-blue-600 to-blue-500 text-white border-0"
                    style={{
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                    }}
                  >
                    <Crown className="h-3 w-3 mr-1" />
                    Pro
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("settings.weeklyReportDesc")}
                </p>
              </div>
              <Switch
                id="weekly-report"
                checked={weeklyReport}
                onCheckedChange={(value) => {
                  setWeeklyReport(value);
                  setIsEditingNotifications(true);
                }}
                disabled={loadingNotifications}
              />
            </div>

            {isEditingNotifications && (
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSaveNotifications}>
                  {t("common.save")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="space-y-3">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {t("settings.dangerZone")}
              </CardTitle>
              <CardDescription>
                {t("settings.dangerZoneDescription")}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("settings.deleteAccount")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("settings.deleteAccountConfirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>{t("settings.deleteAccountWarning")}</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>{t("settings.deleteWarning1")}</li>
                      <li>{t("settings.deleteWarning2")}</li>
                      <li>{t("settings.deleteWarning3")}</li>
                      <li>{t("settings.deleteWarning4")}</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t("settings.deleteAccount")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserSettings;
