import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, RefreshCw, ArrowLeft } from "lucide-react";
import { useAuth } from "@shared/contexts/AuthContext";

const EmailVerification = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // 이미 로그인된 사용자는 대시보드로 리다이렉트
  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  // 재전송 대기 타이머
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleResendEmail = async () => {
    // TODO: 실제 메일 재전송 로직 구현
    // await resendVerificationEmail(email);
    setCountdown(60);
    setCanResend(false);
    console.log("Resending verification email to:", email);
  };

  const handleBackToLogin = () => {
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-2xl bg-card/50 backdrop-blur-xl">
          <CardContent className="p-8 space-y-6">
            {/* 아이콘 */}
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <Mail className="w-10 h-10 text-primary" />
              </div>
            </div>

            {/* 제목 */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold">
                {t('emailVerification.title', '이메일을 확인해주세요')}
              </h1>
              <p className="text-muted-foreground text-sm">
                {t('emailVerification.subtitle', '인증 링크가 포함된 이메일을 발송했습니다')}
              </p>
            </div>

            {/* 이메일 주소 표시 */}
            {email && (
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  {t('emailVerification.sentTo', '발송된 이메일 주소')}
                </p>
                <p className="font-medium">{email}</p>
              </div>
            )}

            {/* 안내 메시지 */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  {t('emailVerification.step1', '이메일 받은편지함을 확인하세요')}
                </p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  {t('emailVerification.step2', '인증 링크를 클릭하여 계정을 활성화하세요')}
                </p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  {t('emailVerification.step3', '인증 완료 후 로그인하세요')}
                </p>
              </div>
            </div>

            {/* 스팸 메일함 안내 */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                {t('emailVerification.checkSpam', '이메일이 보이지 않나요? 스팸 메일함을 확인해보세요')}
              </p>
            </div>

            {/* 액션 버튼들 */}
            <div className="space-y-3">
              <Button
                onClick={handleResendEmail}
                disabled={!canResend}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${!canResend ? 'animate-spin' : ''}`} />
                {canResend
                  ? t('emailVerification.resendEmail', '인증 이메일 재전송')
                  : t('emailVerification.resendCountdown', '재전송 대기중 ({{countdown}}초)', { countdown })}
              </Button>

              <Button
                onClick={handleBackToLogin}
                variant="ghost"
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('emailVerification.backToLogin', '로그인 페이지로 돌아가기')}
              </Button>
            </div>

            {/* 도움말 */}
            <div className="text-center text-sm text-muted-foreground">
              <p>
                {t('emailVerification.needHelp', '도움이 필요하신가요?')}{" "}
                <a href="#" className="text-primary hover:underline">
                  {t('emailVerification.contactSupport', '고객지원 문의')}
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailVerification;
