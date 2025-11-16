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
import { Capacitor } from "@capacitor/core";
import { useSafeAreaStyle } from "@/hooks/usePlatform";

const Auth = () => {
  const { t } = useTranslation();
  const { user, signIn, signUp, signInWithGoogle, signInWithApple, loading } = useAuth();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);

  // iOS 플랫폼 체크 (Apple Sign In은 iOS에서만 지원)
  const isIOS = Capacitor.getPlatform() === 'ios';

  // 상하단 Safe Area 패딩 (Android: 상단 2rem, iOS: safe-area-inset + 2rem)
  const safeAreaStyle = useSafeAreaStyle({
    top: true,
    bottom: true,
    topPadding: '2rem',
    bottomPadding: '1rem',
  });

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

  const handleAppleSignIn = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      const { error } = await signInWithApple();

      if (error) {
        // 에러 메시지가 i18n 키인지 확인하고 번역
        const errorMessage = error.message;
        const translatedError = t(`auth.${errorMessage}`, errorMessage);

        setError(translatedError);
        toast({
          title: t('auth.loginError'),
          description: translatedError,
          variant: "destructive",
        });
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" style={safeAreaStyle}>
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">{t('common.loading', '로딩 중...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center px-4 relative"
      style={safeAreaStyle}
    >
      {/* 배경 장식 - 미묘한 그라데이션 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
      </div>

      {/* 메인 카드 */}
      <Card className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl bg-white/95 dark:bg-card/95 backdrop-blur-xl border-0 shadow-2xl relative z-10">
        <CardContent className="p-5 pt-3 sm:p-6 sm:pt-4 md:p-8 md:pt-5 lg:p-10 lg:pt-6">
          {/* 언어 전환 버튼 - 오른쪽 상단 */}
          <div className="flex justify-end mb-2 md:mb-3">
            <LanguageSwitcher />
          </div>
          {/* 로고 */}
          <div className="flex flex-col items-center mb-4 md:mb-6 lg:mb-8">
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mb-2 md:mb-3 flex items-center justify-center bg-primary/10 rounded-2xl">
              <Lock className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-primary" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
              {isSignUp ? t('auth.createAccount') : t('auth.welcomeBack')}
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-0.5 md:mt-1">
              {isSignUp ? t('auth.joinPlatform') : t('auth.signInToContinue')}
            </p>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <Alert variant="destructive" className="mb-4 py-2">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {/* 로그인 폼 */}
          {!isSignUp ? (
            <form onSubmit={handleSignIn} className="space-y-3 md:space-y-4">
              <div className="space-y-1 md:space-y-2">
                <Label htmlFor="email" className="text-sm md:text-base text-foreground font-medium">
                  {t('auth.username')}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={t('auth.enterEmail')}
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    className="pl-9 md:pl-11 h-10 md:h-12 lg:h-14 bg-muted/50 border-muted text-sm md:text-base"
                    required
                    disabled={isSubmitting}
                    readOnly={false}
                  />
                </div>
              </div>

              <div className="space-y-1 md:space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm md:text-base text-foreground font-medium">
                    {t('auth.password')}
                  </Label>
                  <button
                    type="button"
                    className="text-xs md:text-sm text-primary hover:text-primary/80 font-medium"
                    onClick={() => toast({ title: t('auth.featureComingSoon'), description: t('auth.passwordResetComingSoon') })}
                  >
                    {t('auth.forgotPassword')}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    inputMode="text"
                    autoComplete="current-password"
                    placeholder={t('auth.enterPassword')}
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    className="pl-9 md:pl-11 pr-9 md:pr-11 h-10 md:h-12 lg:h-14 bg-muted/50 border-muted text-sm md:text-base"
                    required
                    disabled={isSubmitting}
                    readOnly={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 md:h-5 md:w-5" /> : <Eye className="h-4 w-4 md:h-5 md:w-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-10 md:h-12 lg:h-14 text-sm md:text-base lg:text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                    {t('auth.loggingIn')}
                  </>
                ) : (
                  t('auth.login')
                )}
              </Button>

              <div className="text-center pt-2 md:pt-3">
                <span className="text-xs md:text-sm text-muted-foreground">{t('auth.newUser')} </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError("");
                  }}
                  className="text-xs md:text-sm text-primary hover:text-primary/80 font-semibold"
                >
                  {t('auth.signup')}
                </button>
              </div>
            </form>
          ) : (
            /* 회원가입 폼 */
            <form onSubmit={handleSignUp} className="space-y-3 md:space-y-4">
              <div className="space-y-1 md:space-y-2">
                <Label htmlFor="signup-name" className="text-sm md:text-base text-foreground font-medium">
                  {t('auth.username')}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder={t('auth.enterName')}
                    value={signUpData.displayName}
                    onChange={(e) => setSignUpData({ ...signUpData, displayName: e.target.value })}
                    className="pl-9 md:pl-11 h-10 md:h-12 lg:h-14 bg-muted/50 border-muted text-sm md:text-base"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-1 md:space-y-2">
                <Label htmlFor="signup-email" className="text-sm md:text-base text-foreground font-medium">
                  {t('auth.email')}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={t('auth.enterEmail')}
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    className="pl-9 md:pl-11 h-10 md:h-12 lg:h-14 bg-muted/50 border-muted text-sm md:text-base"
                    required
                    disabled={isSubmitting}
                    readOnly={false}
                  />
                </div>
              </div>

              <div className="space-y-1 md:space-y-2">
                <Label htmlFor="signup-password" className="text-sm md:text-base text-foreground font-medium">
                  {t('auth.password')}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    inputMode="text"
                    autoComplete="new-password"
                    placeholder={t('auth.createPassword')}
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    className="pl-9 md:pl-11 pr-9 md:pr-11 h-10 md:h-12 lg:h-14 bg-muted/50 border-muted text-sm md:text-base"
                    required
                    disabled={isSubmitting}
                    readOnly={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 md:h-5 md:w-5" /> : <Eye className="h-4 w-4 md:h-5 md:w-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1 md:space-y-2">
                <Label htmlFor="signup-confirm" className="text-sm md:text-base text-foreground font-medium">
                  {t('auth.confirmPassword')}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  <Input
                    id="signup-confirm"
                    type={showPassword ? "text" : "password"}
                    inputMode="text"
                    autoComplete="new-password"
                    placeholder={t('auth.confirmYourPassword')}
                    value={signUpData.confirmPassword}
                    onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                    className="pl-9 md:pl-11 pr-9 md:pr-11 h-10 md:h-12 lg:h-14 bg-muted/50 border-muted text-sm md:text-base"
                    required
                    disabled={isSubmitting}
                    readOnly={false}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-10 md:h-12 lg:h-14 text-sm md:text-base lg:text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                    {t('auth.creatingAccount')}
                  </>
                ) : (
                  t('auth.createAccount')
                )}
              </Button>

              <div className="text-center pt-2 md:pt-3">
                <span className="text-xs md:text-sm text-muted-foreground">{t('auth.alreadyHaveAccount')} </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setError("");
                  }}
                  className="text-xs md:text-sm text-primary hover:text-primary/80 font-semibold"
                >
                  {t('auth.login')}
                </button>
              </div>
            </form>
          )}

          {/* 소셜 로그인 */}
          {!isSignUp && (
            <div className="mt-4 md:mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-muted"></div>
                </div>
                <div className="relative flex justify-center text-xs md:text-sm uppercase">
                  <span className="bg-white dark:bg-card px-2 text-muted-foreground">{t('auth.orSignInWith')}</span>
                </div>
              </div>

              <div className="mt-4 md:mt-6 space-y-2 md:space-y-3">
                {/* Apple Sign In - iOS에서만 표시 */}
                {isIOS && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-10 md:h-12 lg:h-14 text-sm md:text-base font-medium border-2"
                    onClick={handleAppleSignIn}
                    disabled={isSubmitting}
                  >
                    <svg className="mr-2 h-4 w-4 md:h-5 md:w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    {t('auth.appleSignIn')}
                  </Button>
                )}

                {/* Google Sign In - 모든 플랫폼에서 표시 */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 md:h-12 lg:h-14 text-sm md:text-base font-medium border-2"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting}
                >
                  <svg className="mr-2 h-4 w-4 md:h-5 md:w-5" viewBox="0 0 24 24">
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
