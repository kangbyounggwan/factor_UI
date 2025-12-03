import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, ArrowRight, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import { formatKRW } from "@/lib/tossPaymentsService";
import { formatUSD, PLAN_DISPLAY_PRICES } from "@/lib/paddleService";
import { upsertSubscription, createPaymentHistory } from "@shared/services/supabaseService/subscription";
import { notifyPaymentSuccess } from "@shared/services/supabaseService/notifications";

const PaymentSuccess = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // URL 파라미터에서 결제 정보 추출
  const provider = searchParams.get("provider") || "toss"; // paddle or toss
  const paymentKey = searchParams.get("paymentKey");
  const orderId = searchParams.get("orderId");
  const amount = searchParams.get("amount");
  const plan = searchParams.get("plan") || "pro";

  // Paddle 결제인지 확인
  const isPaddle = provider === "paddle";

  useEffect(() => {
    const verifyPayment = async () => {
      if (!user) {
        // user가 아직 로딩 중일 수 있으므로 기다림
        return;
      }

      // user가 있으면 에러 초기화
      setError(null);

      // Paddle 결제는 Webhook에서 처리됨 - 프론트엔드에서는 UI만 표시
      if (isPaddle) {
        console.log("[PaymentSuccess] Paddle payment - webhook handles DB update");
        setVerifying(false);
        return;
      }

      // Toss 결제 처리 (기존 로직)
      try {
        // orderId에서 플랜 정보 추출 (예: SUB-PRO-1234567890 -> pro)
        const planName = orderId?.split('-')[1]?.toLowerCase() || 'pro';

        // 결제 기간 계산 (월간/연간)
        const isYearly = orderId?.includes('YEARLY');
        const periodStart = new Date();
        const periodEnd = new Date();

        if (isYearly) {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        // 1. 구독 정보 업데이트
        const subscriptionResult = await upsertSubscription({
          userId: user.id,
          planName,
          status: 'active',
          periodStart,
          periodEnd,
          tossPaymentKey: paymentKey || undefined,
          tossOrderId: orderId || undefined,
        });

        if (!subscriptionResult.success) {
          throw new Error('Failed to update subscription');
        }

        // 2. 결제 내역 저장
        const paymentResult = await createPaymentHistory({
          userId: user.id,
          subscriptionId: subscriptionResult.subscription?.id,
          planName,
          amount: Number(amount),
          currency: 'KRW',
          status: 'success',
          paymentKey: paymentKey || undefined,
          orderId: orderId || undefined,
          paidAt: new Date(),
        });

        if (!paymentResult.success) {
          console.error('Failed to create payment history:', paymentResult.error);
          // 결제 내역 저장 실패는 치명적이지 않으므로 계속 진행
        }

        // 3. 결제 성공 알림 전송
        await notifyPaymentSuccess({
          userId: user.id,
          paymentId: paymentResult.payment?.id || subscriptionResult.subscription?.id || '',
          planName,
          amount: Number(amount),
        });

        // 성공
        console.log('결제 처리 완료:', {
          subscription: subscriptionResult.subscription,
          payment: paymentResult.payment,
        });

        setVerifying(false);
      } catch (err) {
        console.error("결제 처리 실패:", err);
        setError(t("payment.verificationFailed"));
        setVerifying(false);
      }
    };

    // Paddle: provider만 있으면 성공
    // Toss: paymentKey, orderId, amount 필요
    if (isPaddle) {
      verifyPayment();
    } else if (paymentKey && orderId && amount) {
      verifyPayment();
    } else {
      setError(t("payment.invalidParameters"));
      setVerifying(false);
    }
  }, [paymentKey, orderId, amount, user, t, isPaddle]);

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

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">{t("payment.error")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button
              className="w-full"
              onClick={() => navigate("/subscription")}
            >
              {t("payment.backToSubscription")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Paddle 결제 성공 화면
  if (isPaddle) {
    const displayAmount = PLAN_DISPLAY_PRICES.pro.monthly; // Default to monthly

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
  }

  // Toss 결제 성공 화면 (기존)
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
            {t("payment.successTitle")}
          </CardTitle>
          <p className="text-muted-foreground mt-3 text-base">
            {t("payment.successDescription")}
          </p>
        </CardHeader>

        <CardContent className="space-y-6 pb-8">
          {/* 결제 정보 - 세련된 디자인 */}
          <div className="rounded-xl bg-gradient-to-br from-muted/50 to-muted border border-border/50 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <span className="text-sm font-medium text-muted-foreground">{t("payment.orderId")}</span>
              <span className="font-mono text-sm font-semibold">{orderId}</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-muted-foreground">{t("payment.amount")}</span>
              <span className="text-2xl font-bold bg-gradient-to-r from-green-600 to-green-700 dark:from-green-400 dark:to-green-500 bg-clip-text text-transparent">
                {formatKRW(Number(amount))}
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <span className="text-sm font-medium text-muted-foreground">{t("payment.paymentKey")}</span>
              <span className="font-mono text-xs text-muted-foreground truncate max-w-[240px]">
                {paymentKey}
              </span>
            </div>
          </div>

          {/* 안내 메시지 - 개선된 디자인 */}
          <div className="rounded-xl border border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
                {t("payment.receiptEmail")}
              </p>
            </div>
          </div>

          {/* 액션 버튼 - 개선된 스타일 */}
          <div className="space-y-3 pt-2">
            <Button
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 dark:from-green-600 dark:to-green-700 shadow-lg hover:shadow-xl transition-all"
              size="lg"
              onClick={() => navigate("/user-settings")}
            >
              {t("payment.goToSettings")}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 text-base font-medium border-2 hover:bg-muted/50"
              onClick={() => navigate("/")}
            >
              <Home className="mr-2 h-5 w-5" />
              {t("payment.goToHome")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
