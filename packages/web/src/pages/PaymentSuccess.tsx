import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, ArrowRight, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import { formatKRW } from "@/lib/tossPaymentsService";
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
  const paymentKey = searchParams.get("paymentKey");
  const orderId = searchParams.get("orderId");
  const amount = searchParams.get("amount");

  useEffect(() => {
    const verifyPayment = async () => {
      if (!user) {
        setError(t("payment.userNotFound"));
        setVerifying(false);
        return;
      }

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

    if (paymentKey && orderId && amount) {
      verifyPayment();
    } else {
      setError(t("payment.invalidParameters"));
      setVerifying(false);
    }
  }, [paymentKey, orderId, amount, user, t]);

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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-green-200 dark:border-green-800">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">{t("payment.successTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <p className="text-center text-muted-foreground">
              {t("payment.successDescription")}
            </p>

            {/* 결제 정보 */}
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("payment.orderId")}</span>
                <span className="font-mono">{orderId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("payment.amount")}</span>
                <span className="font-semibold">{formatKRW(Number(amount))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("payment.paymentKey")}</span>
                <span className="font-mono text-xs truncate max-w-[200px]">
                  {paymentKey}
                </span>
              </div>
            </div>

            {/* 안내 메시지 */}
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3">
              <p className="text-xs text-blue-900 dark:text-blue-100">
                {t("payment.receiptEmail")}
              </p>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="space-y-2">
            <Button
              className="w-full"
              size="lg"
              onClick={() => navigate("/settings")}
            >
              {t("payment.goToSettings")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/")}
            >
              <Home className="mr-2 h-4 w-4" />
              {t("payment.goToHome")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
