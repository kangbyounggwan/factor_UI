import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@shared/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { startDashStatusSubscriptionsForUser } from "@shared/component/mqtt";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@shared/integrations/supabase/client";

const Auth = () => {
  const { t } = useTranslation();
  const { user, signIn, signUp, signInWithGoogle, loading } = useAuth();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);

  // 페이지 진입 시 스크롤 초기화
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });

  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
  });

  // 로그인된 사용자는 대시보드로 리다이렉트
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const { error } = await signIn(signInData.email, signInData.password);

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setError(t('auth.invalidCredentials'));
        } else if (error.message.includes("Email not confirmed")) {
          setError(t('auth.emailNotConfirmed'));
        } else {
          setError(error.message);
        }
      } else {
        toast({
          title: t('auth.loginSuccess'),
          description: t('auth.welcomeMessage'),
        });
        // 로그인 성공 시점: MQTT dash_status 구독 시작
        try {
          const uid = await supabase.auth.getUser().then(r => r.data.user?.id);
          if (uid) startDashStatusSubscriptionsForUser(uid);
        } catch (error) {
          console.warn('Failed to start MQTT subscriptions:', error);
        }
      }
    } catch (err) {
      setError(t('auth.loginError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    if (signUpData.password !== signUpData.confirmPassword) {
      setError(t('auth.passwordMismatch'));
      setIsSubmitting(false);
      return;
    }

    if (signUpData.password.length < 6) {
      setError(t('auth.passwordTooShort'));
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await signUp(
        signUpData.email,
        signUpData.password,
        signUpData.displayName
      );

      if (error) {
        if (error.message.includes("User already registered")) {
          setError(t('auth.emailAlreadyExists'));
        } else if (error.message.includes("Password should be at least 6 characters")) {
          setError(t('auth.passwordTooShort'));
        } else {
          setError(error.message);
        }
      } else {
        toast({
          title: t('auth.signupSuccess'),
          description: t('auth.signupSuccessMessage'),
        });
        setSignUpData({ email: "", password: "", confirmPassword: "", displayName: "" });
        setIsSignUp(false);
      }
    } catch (err) {
      setError(t('auth.signupError'));
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background safe-area-top safe-area-bottom">
        <div className="h-full flex items-center justify-center px-6">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">{t('common.loading', '로딩 중...')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-6 overflow-y-auto relative">
      {/* 배경 장식 - 미묘한 그라데이션 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="absolute top-0 left-0 w-full h-full">
          <svg className="absolute bottom-0 w-full opacity-5" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path
              fill="currentColor"
              fillOpacity="1"
              className="text-primary"
              d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,122.7C672,117,768,139,864,138.7C960,139,1056,117,1152,106.7C1248,96,1344,96,1392,96L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            />
          </svg>
        </div>
      </div>

      {/* 메인 카드 */}
      <Card className="w-full max-w-md bg-white/95 dark:bg-card/95 backdrop-blur-xl border-0 shadow-2xl relative z-10 my-8">
        <CardContent className="p-8 pt-6">
          {/* 언어 전환 버튼 - 오른쪽 상단 */}
          <div className="flex justify-end mb-2">
            <LanguageSwitcher />
          </div>
          {/* 로고 */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 mb-4 flex items-center justify-center bg-primary/10 rounded-3xl">
              <Lock className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {isSignUp ? t('auth.createAccount') : t('auth.welcomeBack')}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {isSignUp ? t('auth.joinPlatform') : t('auth.signInToContinue')}
            </p>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 로그인 폼 */}
          {!isSignUp ? (
            <form onSubmit={handleSignIn} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">
                  {t('auth.username')}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={t('auth.enterEmail')}
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    className="pl-10 h-12 bg-muted/50 border-muted"
                    required
                    disabled={isSubmitting}
                    readOnly={false}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground font-medium">
                    {t('auth.password')}
                  </Label>
                  <button
                    type="button"
                    className="text-sm text-primary hover:text-primary/80 font-medium"
                    onClick={() => toast({ title: t('auth.featureComingSoon'), description: t('auth.passwordResetComingSoon') })}
                  >
                    {t('auth.forgotPassword')}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    inputMode="text"
                    autoComplete="current-password"
                    placeholder={t('auth.enterPassword')}
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    className="pl-10 pr-10 h-12 bg-muted/50 border-muted"
                    required
                    disabled={isSubmitting}
                    readOnly={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t('auth.loggingIn')}
                  </>
                ) : (
                  t('auth.login')
                )}
              </Button>

              <div className="text-center pt-4">
                <span className="text-sm text-muted-foreground">{t('auth.newUser')} </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError("");
                  }}
                  className="text-sm text-primary hover:text-primary/80 font-semibold"
                >
                  {t('auth.signup')}
                </button>
              </div>
            </form>
          ) : (
            /* 회원가입 폼 */
            <form onSubmit={handleSignUp} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-foreground font-medium">
                  {t('auth.username')}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder={t('auth.enterName')}
                    value={signUpData.displayName}
                    onChange={(e) => setSignUpData({ ...signUpData, displayName: e.target.value })}
                    className="pl-10 h-12 bg-muted/50 border-muted"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-foreground font-medium">
                  {t('auth.email')}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={t('auth.enterEmail')}
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    className="pl-10 h-12 bg-muted/50 border-muted"
                    required
                    disabled={isSubmitting}
                    readOnly={false}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-foreground font-medium">
                  {t('auth.password')}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    inputMode="text"
                    autoComplete="new-password"
                    placeholder={t('auth.createPassword')}
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    className="pl-10 pr-10 h-12 bg-muted/50 border-muted"
                    required
                    disabled={isSubmitting}
                    readOnly={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-confirm" className="text-foreground font-medium">
                  {t('auth.confirmPassword')}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="signup-confirm"
                    type={showPassword ? "text" : "password"}
                    inputMode="text"
                    autoComplete="new-password"
                    placeholder={t('auth.confirmYourPassword')}
                    value={signUpData.confirmPassword}
                    onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                    className="pl-10 pr-10 h-12 bg-muted/50 border-muted"
                    required
                    disabled={isSubmitting}
                    readOnly={false}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t('auth.creatingAccount')}
                  </>
                ) : (
                  t('auth.createAccount')
                )}
              </Button>

              <div className="text-center pt-4">
                <span className="text-sm text-muted-foreground">{t('auth.alreadyHaveAccount')} </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setError("");
                  }}
                  className="text-sm text-primary hover:text-primary/80 font-semibold"
                >
                  {t('auth.login')}
                </button>
              </div>
            </form>
          )}

          {/* 소셜 로그인 */}
          {!isSignUp && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-muted"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-card px-2 text-muted-foreground">{t('auth.orSignInWith')}</span>
                </div>
              </div>

              <div className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 text-base font-medium border-2"
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
