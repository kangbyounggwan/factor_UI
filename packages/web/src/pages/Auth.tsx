import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, User, Lock, Mail, Activity, Moon, Sun } from "lucide-react";
import { useAuth } from "@shared/contexts/AuthContext";
import { startDashStatusSubscriptionsForUser, subscribeControlResultForUser } from "@shared/component/mqtt";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";


const Auth = () => {
  const { t } = useTranslation();
  const { user, signIn, signUp, loading } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
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
  });

  // 로그인된 사용자는 메인 페이지로 리다이렉트
  if (user) {
    return <Navigate to="/" replace />;
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

    try {
      const { error } = await signUp(
        signUpData.email,
        signUpData.password,
        signUpData.displayName
      );
      
      if (error) {
        if (error.message.includes("User already registered")) {
          setError(t('auth.userAlreadyRegistered', 'This email is already registered.'));
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
              </TabsContent>

                  <TabsContent value="signup" className="space-y-6 mt-6">
                    <form onSubmit={handleSignUp} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">{t('auth.email', 'Email')}</Label>
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
                        <Label htmlFor="signup-displayname">{t('auth.displayName', 'Display Name')}</Label>
                        <Input
                          id="signup-displayname"
                          type="text"
                          placeholder="사용자명을 입력하세요"
                          value={signUpData.displayName}
                          onChange={(e) =>
                            setSignUpData({ ...signUpData, displayName: e.target.value })
                          }
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">{t('auth.password', 'Password')}</Label>
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
                        <Label htmlFor="signup-confirm-password">{t('auth.confirmPassword', 'Confirm Password')}</Label>
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
    </div>
  );
};

export default Auth;