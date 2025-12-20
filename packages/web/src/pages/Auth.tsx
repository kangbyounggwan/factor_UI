import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, User, Lock, Mail, Activity, Moon, Sun, Phone, AlertTriangle } from "lucide-react";
import { useAuth } from "@shared/contexts/AuthContext";
import { startDashStatusSubscriptionsForUser, subscribeControlResultForUser } from "@shared/component/mqtt";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { supabase } from "@shared/integrations/supabase/client";

// Google Logo SVG
const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// Apple Logo SVG
const AppleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);


const Auth = () => {
  const { t } = useTranslation();
  const { user, signIn, signUp, signInWithGoogle, signInWithApple, loading, needsProfileSetup, profileCheckComplete } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });
  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
    phone: "",
  });

  // 계정 통합 모달 상태
  const [showAccountLinkModal, setShowAccountLinkModal] = useState(false);
  const [existingAccountProvider, setExistingAccountProvider] = useState<string | null>(null);
  const [pendingSignUpEmail, setPendingSignUpEmail] = useState<string>("");

  // 기존 계정 확인은 signUp 에러로 처리 (Edge Function 제거)

  // URL 파라미터에서 이메일 가져와서 자동 입력
  useEffect(() => {
    const emailFromUrl = searchParams.get('email');
    if (emailFromUrl) {
      setSignInData(prev => ({ ...prev, email: emailFromUrl }));
    }
  }, [searchParams]);

  // OAuth 팝업/새탭에서 메시지 수신 리스너 (postMessage + localStorage 방식)
  useEffect(() => {
    // postMessage 방식
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'OAUTH_SUCCESS') {
        console.log('[Auth] Received OAuth success message via postMessage');
        window.location.reload();
      }
    };

    // localStorage 방식 (다른 탭에서 storage 변경 감지)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'oauth_complete' && event.newValue) {
        console.log('[Auth] Received OAuth success via localStorage');
        try {
          const data = JSON.parse(event.newValue);
          console.log('[Auth] OAuth complete data:', data);
          // 페이지 새로고침하여 세션 반영
          window.location.reload();
        } catch (e) {
          console.error('[Auth] Error parsing oauth_complete:', e);
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('message', handleOAuthMessage);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 로그인된 사용자는 프로필 설정 필요 여부에 따라 리다이렉트
  const redirectPath = searchParams.get('redirect') || '/';
  if (user && profileCheckComplete) {
    if (needsProfileSetup) {
      return <Navigate to="/profile-setup" replace />;
    }
    return <Navigate to={redirectPath} replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const { error } = await signIn(signInData.email, signInData.password);
      
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setError(t('auth.invalidCredentials', 'Invalid email or password.'));
        } else if (error.message.includes("Email not confirmed")) {
          setError(t('auth.emailNotConfirmed', 'Email verification required. Please check your inbox.'));
        } else {
          setError(error.message);
        }
      } else {
        toast({
          title: t('auth.loginSuccess', 'Login successful'),
          description: t('auth.welcome', 'Welcome!'),
        });
        // 로그인 성공 시점: MQTT dash_status 구독 시작 + SD 전역 구독
        try {
          const uid = (await import("@shared/integrations/supabase/client")).supabase.auth.getUser().then(r=>r.data.user?.id);
          Promise.resolve(uid).then((id)=>{
            if (id) startDashStatusSubscriptionsForUser(id);
          });



        } catch (mqttError) { console.warn('MQTT subscription error:', mqttError); }
      }
    } catch (err) {
      setError(t('auth.loginFailed', 'Login failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    // 1. 기본 유효성 검사
    if (signUpData.password !== signUpData.confirmPassword) {
      setError(t('auth.passwordMismatch', 'Passwords do not match.'));
      setIsSubmitting(false);
      return;
    }

    if (signUpData.password.length < 6) {
      setError(t('auth.passwordTooShort', 'Password must be at least 6 characters.'));
      setIsSubmitting(false);
      return;
    }

    if (!signUpData.phone.trim()) {
      setError(t('auth.phoneRequired', '전화번호를 입력해주세요.'));
      setIsSubmitting(false);
      return;
    }

    try {
      // 회원가입 시도 - 중복 이메일은 signUp 에러로 확인
      const { error } = await signUp(
        signUpData.email,
        signUpData.password,
        signUpData.displayName,
        signUpData.phone
      );

      if (error) {
        console.log('[Auth] SignUp error:', error.message);

        if (error.message.includes("User already registered")) {
          // 이미 가입된 이메일 - 계정 통합 모달 표시
          setPendingSignUpEmail(signUpData.email);
          setExistingAccountProvider('existing'); // 정확한 provider는 알 수 없음
          setShowAccountLinkModal(true);
          setError(""); // 에러 메시지 숨기고 모달로 안내
        } else if (error.message.includes("Password should be at least 6 characters")) {
          setError(t('auth.passwordTooShort', 'Password must be at least 6 characters.'));
        } else {
          setError(error.message);
        }
      } else {
        // 회원가입 성공 시 메일 인증 페이지로 이동
        navigate(`/email-verification?email=${encodeURIComponent(signUpData.email)}`);
      }
    } catch (err) {
      setError(t('auth.signupFailed', 'Sign up failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      const { error } = await signInWithGoogle();

      if (error) {
        setError(error.message);
        toast({
          title: t('auth.loginError'),
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (err) {
      setError(t('auth.loginError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      const { error } = await signInWithApple();

      if (error) {
        setError(error.message);
        toast({
          title: t('auth.loginError'),
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (err) {
      setError(t('auth.loginError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 중복된 헤더 제거 - Header 컴포넌트가 App.tsx에서 처리함 */}

      {/* 메인 컨텐츠 */}
      <div className="flex min-h-[calc(100vh-4rem)] justify-center lg:justify-between">
        {/* 왼쪽 로그인 폼 */}
        <div className="w-full lg:w-3/5 flex items-center justify-center p-8 lg:p-12">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl mx-auto flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                {t('auth.welcomeBack', 'Welcome back')}
              </h1>
              <p className="text-muted-foreground">
                {t('auth.signInSubtitle', 'Sign in to your FACTOR account')}
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Card className="border-0 shadow-2xl bg-card/50 backdrop-blur-xl">
              <CardContent className="p-8">
                <Tabs defaultValue="signin" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/50">
                    <TabsTrigger value="signin" className="h-10 text-sm font-medium">{t('auth.login', 'Login')}</TabsTrigger>
                    <TabsTrigger value="signup" className="h-10 text-sm font-medium">{t('auth.signup', 'Sign Up')}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin" className="space-y-6 mt-6">
                    <form onSubmit={handleSignIn} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">{t('auth.email', 'Email')}</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signInData.email}
                      onChange={(e) =>
                        setSignInData({ ...signInData, email: e.target.value })
                      }
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">{t('auth.password', 'Password')}</Label>
                      <button
                        type="button"
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {t('auth.forgotPassword', 'Forgot Password?')}
                      </button>
                    </div>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={signInData.password}
                      onChange={(e) =>
                        setSignInData({ ...signInData, password: e.target.value })
                      }
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('auth.signingIn', 'Signing in...')}
                      </>
                    ) : (
                      t('auth.login', 'Sign In')
                    )}
                  </Button>
                </form>

                {/* Google 로그인 버튼 */}
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-muted"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">{t('auth.orSignInWith')}</span>
                    </div>
                  </div>

                  {/* Apple Sign In */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleAppleSignIn}
                    disabled={isSubmitting}
                  >
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    {t('auth.appleSignIn', 'Apple로 로그인')}
                  </Button>

                  {/* Google Sign In */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isSubmitting}
                  >
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    {t('auth.googleSignIn')}
                  </Button>
                </div>
              </TabsContent>

                  <TabsContent value="signup" className="space-y-6 mt-6">
                    <form onSubmit={handleSignUp} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">
                          {t('auth.email', 'Email')}
                          <span className="text-destructive ml-1">*</span>
                        </Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="you@example.com"
                          value={signUpData.email}
                          onChange={(e) =>
                            setSignUpData({ ...signUpData, email: e.target.value })
                          }
                          required
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-displayname">
                          {t('auth.displayName', 'Display Name')}
                          <span className="text-destructive ml-1">*</span>
                        </Label>
                        <Input
                          id="signup-displayname"
                          type="text"
                          placeholder="사용자명을 입력하세요"
                          value={signUpData.displayName}
                          onChange={(e) =>
                            setSignUpData({ ...signUpData, displayName: e.target.value })
                          }
                          required
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-phone" className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {t('auth.phone', '전화번호')}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="signup-phone"
                          type="tel"
                          placeholder="010-0000-0000"
                          value={signUpData.phone}
                          onChange={(e) =>
                            setSignUpData({ ...signUpData, phone: e.target.value })
                          }
                          required
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">
                          {t('auth.password', 'Password')}
                          <span className="text-destructive ml-1">*</span>
                        </Label>
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="Create a password (6자 이상)"
                          value={signUpData.password}
                          onChange={(e) =>
                            setSignUpData({ ...signUpData, password: e.target.value })
                          }
                          required
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-confirm-password">
                          {t('auth.confirmPassword', 'Confirm Password')}
                          <span className="text-destructive ml-1">*</span>
                        </Label>
                        <Input
                          id="signup-confirm-password"
                          type="password"
                          placeholder="Confirm your password"
                          value={signUpData.confirmPassword}
                          onChange={(e) =>
                            setSignUpData({
                              ...signUpData,
                              confirmPassword: e.target.value,
                            })
                          }
                          required
                          disabled={isSubmitting}
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('auth.creatingAccount', 'Creating account...')}
                          </>
                        ) : (
                          t('auth.signup', 'Sign Up')
                        )}
                      </Button>
                    </form>

                    {/* 소셜 로그인으로 가입하기 */}
                    <div className="space-y-4">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-muted"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">{t('auth.orSignUpWith', '또는 소셜 계정으로 가입')}</span>
                        </div>
                      </div>

                      {/* Apple Sign Up */}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleAppleSignIn}
                        disabled={isSubmitting}
                      >
                        <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                        </svg>
                        {t('auth.appleSignUp', 'Apple로 가입하기')}
                      </Button>

                      {/* Google Sign Up */}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleGoogleSignIn}
                        disabled={isSubmitting}
                      >
                        <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        {t('auth.googleSignUp', 'Google로 가입하기')}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground">
              <p>
                {t('auth.byContinuing', 'By continuing, you agree to our')}{" "}
                <a href="#" className="underline hover:text-foreground">
                  {t('auth.termsOfService', 'Terms of Service')}
                </a>{" "}
                {t('auth.and', 'and')}{" "}
                <a href="#" className="underline hover:text-foreground">
                  {t('auth.privacyPolicy', 'Privacy Policy')}
                </a>
                .
              </p>
            </div>
          </div>
        </div>

        {/* 오른쪽 광고/마케팅 배너 */}
        <div className="hidden lg:flex w-2/5 bg-gradient-to-br from-primary/10 to-primary/5 items-center justify-center p-8">
          <div className="max-w-md text-center space-y-6">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-primary rounded-2xl mx-auto flex items-center justify-center">
                <Activity className="w-8 h-8 text-primary-foreground" />
              </div>
              <h2 className="text-3xl font-bold text-foreground">
                {t('auth.marketing.titleLine1', 'A new experience for')}<br />
                {t('auth.marketing.titleLine2', '3D printer farms')}
              </h2>
            </div>
            
            <div className="space-y-4 text-muted-foreground">
              <p className="text-lg">
                {t('auth.marketing.subtitleLine1', 'Start smarter 3D printing with')}<br />
                {t('auth.marketing.subtitleLine2', 'real-time monitoring and remote control')}
              </p>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>{t('auth.marketing.feature1', 'Real-time temperature and progress monitoring')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>{t('auth.marketing.feature2', 'Remote printer control and G-code upload')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>{t('auth.marketing.feature3', 'Live camera feed for real-time view')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>{t('auth.marketing.feature4', 'Environment monitoring via IoT sensors')}</span>
                </div>
              </div>
            </div>
            
            <div className="pt-6">
              <div className="bg-background/50 backdrop-blur-sm rounded-lg p-4 border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-success-foreground">✓</span>
                  </div>
                  <span className="font-medium">{t('auth.marketing.ctaTitle', 'Start free now')}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('auth.marketing.ctaDescLine1', 'Cloud-based 3D printer management solution')}<br />
                  {t('auth.marketing.ctaDescLine2', 'ready to use without complex setup')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 계정 통합 모달 */}
      <Dialog open={showAccountLinkModal} onOpenChange={setShowAccountLinkModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <AlertTriangle className="h-7 w-7 text-yellow-600 dark:text-yellow-500" />
            </div>
            <DialogTitle className="text-center text-xl">
              {t('auth.accountExists', '이미 가입된 계정이 있습니다')}
            </DialogTitle>
            <DialogDescription className="text-center">
              <span className="font-semibold text-foreground">{pendingSignUpEmail}</span>
              {existingAccountProvider === 'google' && (
                <span>{t('auth.accountExistsGoogle', ' 이메일은 Google 계정으로 가입되어 있습니다.')}</span>
              )}
              {existingAccountProvider === 'apple' && (
                <span>{t('auth.accountExistsApple', ' 이메일은 Apple 계정으로 가입되어 있습니다.')}</span>
              )}
              {existingAccountProvider === 'email' && (
                <span>{t('auth.accountExistsEmail', ' 이메일은 이미 가입되어 있습니다. 로그인해주세요.')}</span>
              )}
              {existingAccountProvider === 'email_unconfirmed' && (
                <span>{t('auth.accountExistsUnconfirmed', ' 이메일로 가입했지만 인증이 완료되지 않았습니다. 이메일을 확인해주세요.')}</span>
              )}
              {(existingAccountProvider === 'existing' || !existingAccountProvider) && (
                <span>{t('auth.accountExistsDesc', ' 이메일로 이미 가입된 계정이 존재합니다. 기존 계정으로 로그인하시겠습니까?')}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {/* Google 로그인 버튼 - Google로 가입된 경우 강조 */}
            <Button
              variant={existingAccountProvider === 'google' ? 'default' : 'outline'}
              className="w-full h-12 text-base"
              onClick={() => {
                setShowAccountLinkModal(false);
                handleGoogleSignIn();
              }}
            >
              <GoogleLogo />
              <span className="ml-2">{t('auth.signInWithGoogle', 'Google 계정으로 로그인')}</span>
              {existingAccountProvider === 'google' && (
                <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded">
                  {t('auth.recommended', '추천')}
                </span>
              )}
            </Button>

            {/* Apple 로그인 버튼 - Apple로 가입된 경우 강조 */}
            <Button
              variant={existingAccountProvider === 'apple' ? 'default' : 'outline'}
              className="w-full h-12 text-base"
              onClick={() => {
                setShowAccountLinkModal(false);
                handleAppleSignIn();
              }}
            >
              <AppleLogo />
              <span className="ml-2">{t('auth.signInWithApple', 'Apple 계정으로 로그인')}</span>
              {existingAccountProvider === 'apple' && (
                <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded">
                  {t('auth.recommended', '추천')}
                </span>
              )}
            </Button>

            {/* 이메일 로그인 버튼 - 이메일로 가입된 경우 강조 */}
            <Button
              variant={existingAccountProvider === 'email' || existingAccountProvider === 'email_unconfirmed' ? 'default' : 'outline'}
              className="w-full h-12 text-base"
              onClick={() => {
                setShowAccountLinkModal(false);
                // 로그인 탭으로 전환하고 이메일 자동 입력
                setSignInData(prev => ({ ...prev, email: pendingSignUpEmail }));
                // Tabs를 signin으로 변경하는 것은 DOM에서 직접 처리
                const signinTab = document.querySelector('[value="signin"]') as HTMLButtonElement;
                if (signinTab) signinTab.click();
              }}
            >
              <Mail className="h-5 w-5 mr-2" />
              {existingAccountProvider === 'email_unconfirmed'
                ? t('auth.checkEmailVerification', '이메일 인증 확인')
                : t('auth.signInWithEmail', '이메일로 로그인')}
              {(existingAccountProvider === 'email' || existingAccountProvider === 'email_unconfirmed') && (
                <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded">
                  {t('auth.recommended', '추천')}
                </span>
              )}
            </Button>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setShowAccountLinkModal(false)}
            >
              {t('common.cancel', '취소')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;