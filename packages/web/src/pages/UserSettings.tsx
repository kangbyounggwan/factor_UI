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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@shared/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@shared/integrations/supabase/client";
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

  // Form states
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name || "",
  );
  const [email, setEmail] = useState(user?.email || "");
  const [bio, setBio] = useState(user?.user_metadata?.bio || "");
  const [isEditingProfile, setIsEditingProfile] = useState(false);

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

        const { data: subscription, error } = await supabase
          .from("user_subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (error || !subscription) {
          // No active subscription - use Basic plan
          setCurrentPlan({
            name: "Basic",
            price: 0,
            billingCycle: "free",
            nextBillingDate: null,
            maxPrinters: 2,
          });
          return;
        }

        // Plan 정보 매핑
        const planName = subscription.plan_name?.toLowerCase() || 'basic';
        const planInfo = {
          basic: { name: "Basic", price: 0, maxPrinters: 2 },
          pro: { name: "Pro", price: 19900, maxPrinters: 10 },
          enterprise: { name: "Enterprise", price: 99000, maxPrinters: 100 }
        };

        const plan = planInfo[planName as keyof typeof planInfo] || planInfo.basic;

        setCurrentPlan({
          name: plan.name,
          price: plan.price,
          billingCycle: subscription.current_period_end ? "month" : "free",
          nextBillingDate: subscription.current_period_end,
          maxPrinters: plan.maxPrinters,
        });
      } catch (error) {
        console.error("Error loading subscription:", error);
        setCurrentPlan({
          name: "Basic",
          price: 0,
          billingCycle: "free",
          nextBillingDate: null,
          maxPrinters: 1,
        });
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

  const handleSaveProfile = async () => {
    // TODO: Implement profile update logic with Supabase
    console.log("Saving profile:", { displayName, bio });
    setIsEditingProfile(false);
    toast({
      title: t("userSettings.profileUpdated"),
      description: t("userSettings.profileUpdatedDesc"),
    });
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
    <div className="container mx-auto py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("userSettings.title")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t("userSettings.description")}
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            {t("userSettings.profile")}
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <Shield className="h-4 w-4" />
            {t("userSettings.account")}
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="h-4 w-4" />
            {t("userSettings.subscription")}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            {t("userSettings.notifications")}
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <CardTitle>{t("userSettings.profileInfo")}</CardTitle>
                  <CardDescription>
                    {t("userSettings.profileDescription")}
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
                      <AlertDialogTitle>프로필 정보 초기화</AlertDialogTitle>
                      <AlertDialogDescription>
                        정말로 프로필 정보를 초기화하시겠습니까? 변경된 내용이 모두 삭제됩니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          setDisplayName(user?.user_metadata?.full_name || "");
                          setBio(user?.user_metadata?.bio || "");
                          setIsEditingProfile(false);
                        }}
                      >
                        초기화
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="flex items-center justify-center w-24 h-24 bg-primary rounded-full">
                    <User className="w-12 h-12 text-primary-foreground" />
                  </div>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full shadow-lg"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">
                    {t("userSettings.profilePicture")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("userSettings.profilePictureDesc")}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      {t("userSettings.uploadPhoto")}
                    </Button>
                    <Button size="sm" variant="ghost">
                      {t("userSettings.deletePhoto")}
                    </Button>
                  </div>
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

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="bio">{t("userSettings.bio")}</Label>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => {
                      setBio(e.target.value);
                      setIsEditingProfile(true);
                    }}
                    placeholder={t("userSettings.bioPlaceholder")}
                    className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {bio.length}/200
                  </p>
                </div>
              </div>

              {isEditingProfile && (
                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={handleSaveProfile}>
                    {t("userSettings.saveChanges")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
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
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="space-y-3">
                <CardTitle>{t("userSettings.currentPlan")}</CardTitle>
                <CardDescription>
                  {t("userSettings.subscriptionDescription")}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingPlan ? (
                <div className="flex items-center justify-center p-12">
                  <div className="text-sm text-muted-foreground">
                    {t("userSettings.loadingSubscription")}
                  </div>
                </div>
              ) : currentPlan ? (
                <>
                  <div className="flex items-center justify-between p-6 rounded-lg border bg-muted/50">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Badge className="text-base px-3 py-1">
                          <Crown className="h-4 w-4 mr-2" />
                          {currentPlan.name} {t("userSettings.plan")}
                        </Badge>
                      </div>
                      {currentPlan.price > 0 ? (
                        <>
                          <p className="text-2xl font-bold">
                            ₩{currentPlan.price.toLocaleString()}
                            <span className="text-sm font-normal text-muted-foreground ml-1">
                              /{" "}
                              {currentPlan.billingCycle === "year"
                                ? t("userSettings.perYear")
                                : t("userSettings.perMonth")}
                            </span>
                          </p>
                          {currentPlan.nextBillingDate && (
                            <p className="text-sm text-muted-foreground">
                              {t("userSettings.nextBillingDate")}:{" "}
                              {new Date(
                                currentPlan.nextBillingDate,
                              ).toLocaleDateString("ko-KR")}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xl font-semibold text-muted-foreground">
                          {t("userSettings.freePlan")}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {t("userSettings.maxPrinters")}
                      </p>
                    </div>
                    <Button size="lg" onClick={() => navigate("/subscription")}>
                      {t("userSettings.upgradePlan")}
                    </Button>
                  </div>

                  <Separator />

                  <div className="grid gap-3">
                    <Button
                      variant="outline"
                      className="w-full justify-between h-auto py-3"
                      onClick={() => console.log("View billing history")}
                    >
                      <span className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{t("userSettings.viewBillingHistory")}</span>
                      </span>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-between h-auto py-3"
                      onClick={() => console.log("Manage payment method")}
                    >
                      <span className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span>{t("userSettings.managePaymentMethod")}</span>
                      </span>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center p-12 text-sm text-muted-foreground">
                  {t("userSettings.subscriptionLoadFailed")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
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
                          currentPlan?.name === "Basic"
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
                        currentPlan?.name === "Basic" ? "opacity-50" : ""
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
                    disabled={currentPlan?.name === "Basic" || loadingNotifications}
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
                          currentPlan?.name === "Basic"
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
                        currentPlan?.name === "Basic" ? "opacity-50" : ""
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
                    disabled={currentPlan?.name === "Basic" || loadingNotifications}
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserSettings;
