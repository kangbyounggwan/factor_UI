import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, ArrowRight, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import { PLAN_DISPLAY_PRICES } from "@/lib/paddleService";

const PaymentSuccess = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);

  const plan = searchParams.get("plan") || "pro";

  useEffect(() => {
    // Paddle 결제는 Webhook에서 처리됨 - 프론트엔드에서는 UI만 표시
    if (user) {
      console.log("[PaymentSuccess] Paddle payment - webhook handles DB update");
      setVerifying(false);
    }
  }, [user]);

  if (verifying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
            <h2 className="text-2xl font-bold mb-2">{t("payment.verifying")}</h2>
            <p className="text-muted-foreground text-center">
              {t("payment.verifyingDescription")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-green-50/20 dark:to-green-950/10 flex items-center justify-center p-6">
      <Card className="w-full max-w-lg border-green-200 dark:border-green-800/50 shadow-2xl">
        <CardHeader className="text-center pb-8 pt-8">
          {/* Success Icon with Animation */}
          <div className="mx-auto mb-6 relative">
            <div className="absolute inset-0 h-20 w-20 mx-auto rounded-full bg-green-500/20 dark:bg-green-500/10 animate-ping" />
            <div className="relative h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 flex items-center justify-center shadow-lg">
              <CheckCircle2 className="h-12 w-12 text-white" strokeWidth={2.5} />
            </div>
          </div>

          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-700 dark:from-green-400 dark:to-green-500 bg-clip-text text-transparent">
            {t("payment.successTitle", "Payment Successful!")}
          </CardTitle>
          <p className="text-muted-foreground mt-3 text-base">
            {t("payment.successDescription", "Thank you for subscribing to Factor Hibrid Pro.")}
          </p>
        </CardHeader>

        <CardContent className="space-y-6 pb-8">
          {/* 결제 정보 */}
          <div className="rounded-xl bg-gradient-to-br from-muted/50 to-muted border border-border/50 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <span className="text-sm font-medium text-muted-foreground">{t("payment.plan", "Plan")}</span>
              <span className="font-semibold text-primary capitalize">{plan} Plan</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-muted-foreground">{t("payment.provider", "Payment Provider")}</span>
              <span className="font-semibold">Paddle</span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <span className="text-sm font-medium text-muted-foreground">{t("payment.status", "Status")}</span>
              <span className="inline-flex items-center gap-1.5 text-green-600 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                {t("payment.completed", "Completed")}
              </span>
            </div>
          </div>

          {/* 안내 메시지 */}
          <div className="rounded-xl border border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
                {t("payment.receiptEmail", "A receipt has been sent to your email. You can manage your subscription from your account settings.")}
              </p>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="space-y-3 pt-2">
            <Button
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 dark:from-green-600 dark:to-green-700 shadow-lg hover:shadow-xl transition-all"
              size="lg"
              onClick={() => navigate("/dashboard")}
            >
              {t("payment.goToDashboard", "Go to Dashboard")}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 text-base font-medium border-2 hover:bg-muted/50"
              onClick={() => navigate("/user-settings")}
            >
              {t("payment.manageSubscription", "Manage Subscription")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
