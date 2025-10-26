import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [printCompleteNotif, setPrintCompleteNotif] = useState(true);
  const [errorNotif, setErrorNotif] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);

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

        const { data: subscription, error } = await supabase
          .from('user_subscriptions')
          .select(`
            *,
            subscription_plans (
              name,
              price,
              interval,
              max_printers
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (error || !subscription) {
          // No active subscription - use Basic plan
          setCurrentPlan({
            name: 'Basic',
            price: 0,
            billingCycle: 'free',
            nextBillingDate: null,
            maxPrinters: 1,
          });
          return;
        }

        const planData = subscription.subscription_plans as any;
        setCurrentPlan({
          name: planData.name,
          price: planData.price || 0,
          billingCycle: planData.interval || 'month',
          nextBillingDate: subscription.current_period_end,
          maxPrinters: planData.max_printers || 1,
        });
      } catch (error) {
        console.error('Error loading subscription:', error);
        setCurrentPlan({
          name: 'Basic',
          price: 0,
          billingCycle: 'free',
          nextBillingDate: null,
          maxPrinters: 1,
        });
      } finally {
        setLoadingPlan(false);
      }
    };

    loadSubscription();
  }, [user]);

  const handleSaveProfile = async () => {
    // TODO: Implement profile update logic with Supabase
    console.log("Saving profile:", { displayName, bio });
    setIsEditingProfile(false);
    toast({
      title: "프로필 업데이트",
      description: "프로필이 성공적으로 업데이트되었습니다.",
    });
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
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const handleDeleteAccount = async () => {
    console.log("Deleting account...");
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">사용자 설정</h1>
        <p className="text-muted-foreground mt-2">
          계정 정보 및 환경 설정을 관리합니다
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            프로필
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <Shield className="h-4 w-4" />
            계정
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="h-4 w-4" />
            구독
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            알림
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>프로필 정보</CardTitle>
              <CardDescription>
                공개적으로 표시되는 프로필 정보를 관리합니다
              </CardDescription>
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
                  <h3 className="font-medium">프로필 사진</h3>
                  <p className="text-sm text-muted-foreground">
                    JPG, PNG 또는 GIF 형식 (최대 2MB)
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">업로드</Button>
                    <Button size="sm" variant="ghost">삭제</Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Form */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="displayName">이름</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      setIsEditingProfile(true);
                    }}
                    placeholder="이름을 입력하세요"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
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
                      인증됨
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="bio">소개</Label>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => {
                      setBio(e.target.value);
                      setIsEditingProfile(true);
                    }}
                    placeholder="간단한 소개를 입력하세요"
                    className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {bio.length}/200
                  </p>
                </div>
              </div>

              {isEditingProfile && (
                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDisplayName(user?.user_metadata?.full_name || "");
                      setBio(user?.user_metadata?.bio || "");
                      setIsEditingProfile(false);
                    }}
                  >
                    취소
                  </Button>
                  <Button onClick={handleSaveProfile}>
                    변경사항 저장
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
              <CardTitle>소셜 계정 연동</CardTitle>
              <CardDescription>
                소셜 계정을 연동하여 간편하게 로그인하세요
              </CardDescription>
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
                        {googleIdentity?.identity_data?.email || '연동됨'}
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
                        연결 해제
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Google 계정 연결을 해제하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                          연결 해제 후에도 이메일과 비밀번호로 로그인할 수 있습니다.
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
                  className="w-full justify-start h-auto p-4"
                  onClick={handleLinkGoogle}
                >
                  <div className="flex items-center gap-4 w-full">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                      <GoogleLogo />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">Google 계정 연결</p>
                      <p className="text-sm text-muted-foreground">
                        Google로 간편하게 로그인하세요
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
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                위험 구역
              </CardTitle>
              <CardDescription>
                아래 작업은 되돌릴 수 없으니 신중하게 진행하세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="h-4 w-4 mr-2" />
                    계정 영구 삭제
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>정말 계정을 삭제하시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>이 작업은 되돌릴 수 없습니다. 계정을 삭제하면:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>모든 프린터 데이터가 영구적으로 삭제됩니다</li>
                        <li>출력 기록 및 통계가 삭제됩니다</li>
                        <li>구독이 즉시 취소됩니다</li>
                        <li>저장된 모든 파일이 삭제됩니다</li>
                      </ul>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      계정 삭제
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
              <CardTitle>현재 플랜</CardTitle>
              <CardDescription>
                구독 플랜 및 결제 정보를 관리합니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingPlan ? (
                <div className="flex items-center justify-center p-12">
                  <div className="text-sm text-muted-foreground">로딩 중...</div>
                </div>
              ) : currentPlan ? (
                <>
                  <div className="flex items-center justify-between p-6 rounded-lg border bg-muted/50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <Badge className="text-base px-3 py-1">
                          <Crown className="h-4 w-4 mr-2" />
                          {currentPlan.name} 플랜
                        </Badge>
                      </div>
                      {currentPlan.price > 0 ? (
                        <>
                          <p className="text-2xl font-bold">
                            ₩{currentPlan.price.toLocaleString()}
                            <span className="text-sm font-normal text-muted-foreground ml-1">
                              / {currentPlan.billingCycle === 'year' ? '년' : '월'}
                            </span>
                          </p>
                          {currentPlan.nextBillingDate && (
                            <p className="text-sm text-muted-foreground">
                              다음 결제일: {new Date(currentPlan.nextBillingDate).toLocaleDateString('ko-KR')}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xl font-semibold text-muted-foreground">무료 플랜</p>
                      )}
                      <p className="text-sm text-muted-foreground pt-2">
                        최대 {currentPlan.maxPrinters}대 프린터 연결 가능
                      </p>
                    </div>
                    <Button
                      size="lg"
                      onClick={() => navigate("/subscription")}
                    >
                      플랜 업그레이드
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
                        <span>결제 내역 확인</span>
                      </span>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-between h-auto py-3"
                      onClick={() => console.log("Manage payment method")}
                    >
                      <span className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span>결제 수단 관리</span>
                      </span>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center p-12 text-sm text-muted-foreground">
                  구독 정보를 불러올 수 없습니다
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>알림 환경설정</CardTitle>
              <CardDescription>
                알림 수신 방법 및 종류를 설정합니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Push Notifications */}
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="push-notif" className="text-base font-medium cursor-pointer">
                      푸시 알림
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      브라우저 알림을 받습니다
                    </p>
                  </div>
                  <Switch
                    id="push-notif"
                    checked={pushNotifications}
                    onCheckedChange={setPushNotifications}
                  />
                </div>

                <Separator />

                {/* Print Complete */}
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="print-complete" className="text-base font-medium cursor-pointer">
                      출력 완료 알림
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      3D 프린팅이 완료되면 알림을 받습니다
                    </p>
                  </div>
                  <Switch
                    id="print-complete"
                    checked={printCompleteNotif}
                    onCheckedChange={setPrintCompleteNotif}
                  />
                </div>

                <Separator />

                {/* Error Notifications */}
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="error-notif" className="text-base font-medium cursor-pointer">
                      오류 알림
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      프린터 오류 발생 시 즉시 알림을 받습니다
                    </p>
                  </div>
                  <Switch
                    id="error-notif"
                    checked={errorNotif}
                    onCheckedChange={setErrorNotif}
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
                          currentPlan?.name === 'Basic' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                        }`}
                      >
                        이메일 알림
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
                    <p className={`text-sm text-muted-foreground ${
                      currentPlan?.name === 'Basic' ? 'opacity-50' : ''
                    }`}>
                      중요한 업데이트를 이메일로 받습니다
                    </p>
                  </div>
                  <Switch
                    id="email-notif"
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                    disabled={currentPlan?.name === 'Basic'}
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
                          currentPlan?.name === 'Basic' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                        }`}
                      >
                        주간 리포트
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
                    <p className={`text-sm text-muted-foreground ${
                      currentPlan?.name === 'Basic' ? 'opacity-50' : ''
                    }`}>
                      매주 프린터 사용 통계를 이메일로 받습니다
                    </p>
                  </div>
                  <Switch
                    id="weekly-report"
                    checked={weeklyReport}
                    onCheckedChange={setWeeklyReport}
                    disabled={currentPlan?.name === 'Basic'}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserSettings;
