import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatKRW } from "@shared/services/tossPaymentsService";
import { useAuth } from "@shared/contexts/AuthContext";
import { upsertSubscription, createPaymentHistory } from "@shared/services/supabaseService/subscription";
import { notifyPaymentSuccess } from "@shared/services/supabaseService/notifications";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orderId = searchParams.get("orderId");
  const amount = searchParams.get("amount");
  const paymentKey = searchParams.get("paymentKey");

  useEffect(() => {
    const confirmPayment = async () => {
      if (!user) {
        // 사용자 정보 로딩 대기
        return;
      }

      setError(null);

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

        console.log('[PaymentSuccess] 결제 승인 시작:', {
          orderId,
          amount,
          paymentKey,
          planName,
          periodStart,
          periodEnd
        });

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
          throw new Error('구독 업데이트 실패');
        }

        console.log('[PaymentSuccess] 구독 업데이트 성공:', subscriptionResult.subscription);

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
          console.error('[PaymentSuccess] 결제 내역 저장 실패:', paymentResult.error);
          // 결제 내역 저장 실패는 치명적이지 않으므로 계속 진행
        } else {
          console.log('[PaymentSuccess] 결제 내역 저장 성공:', paymentResult.payment);
        }

        // 3. 결제 성공 알림 전송
        await notifyPaymentSuccess({
          userId: user.id,
          paymentId: paymentResult.payment?.id || subscriptionResult.subscription?.id || '',
          planName,
          amount: Number(amount),
        });

        console.log('[PaymentSuccess] 결제 처리 완료');
        setIsProcessing(false);
      } catch (error) {
        console.error('[PaymentSuccess] 결제 승인 실패:', error);
        setError('결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.');
        setIsProcessing(false);
      }
    };

    if (orderId && amount && paymentKey) {
      confirmPayment();
    } else {
      setError('결제 정보가 올바르지 않습니다.');
      setIsProcessing(false);
    }
  }, [orderId, amount, paymentKey, user]);

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
            <div>
              <h2 className="text-xl font-bold mb-2">결제 처리 중</h2>
              <p className="text-sm text-muted-foreground">
                결제를 완료하는 중입니다.<br />
                잠시만 기다려주세요.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              결제 처리 오류
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => navigate("/subscription")}
              >
                구독 페이지로 이동
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/dashboard")}
              >
                대시보드로 이동
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-4">
              <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-500" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">결제 완료!</h1>
            <p className="text-muted-foreground">
              결제가 성공적으로 완료되었습니다.
            </p>
          </div>

          {amount && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">결제 금액</span>
                <span className="text-lg font-bold">
                  {formatKRW(parseInt(amount))}
                </span>
              </div>
              {orderId && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">주문번호</span>
                  <span className="text-xs font-mono">{orderId}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2 pt-4">
            <Button
              size="lg"
              className="w-full"
              onClick={() => navigate("/dashboard")}
            >
              대시보드로 이동
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => navigate("/subscription")}
            >
              구독 관리
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            결제 영수증이 이메일로 발송되었습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
