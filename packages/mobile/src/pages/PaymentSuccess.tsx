import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatKRW } from "@shared/services/tossPaymentsService";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);

  const orderId = searchParams.get("orderId");
  const amount = searchParams.get("amount");
  const paymentKey = searchParams.get("paymentKey");

  useEffect(() => {
    // 결제 승인 처리 (백엔드 API 호출 필요)
    const confirmPayment = async () => {
      try {
        // TODO: 백엔드 API로 결제 승인 요청
        // await fetch('/api/payments/confirm', {
        //   method: 'POST',
        //   body: JSON.stringify({ orderId, amount, paymentKey })
        // });

        console.log("결제 승인:", { orderId, amount, paymentKey });

        // 2초 후 처리 완료
        setTimeout(() => {
          setIsProcessing(false);
        }, 2000);
      } catch (error) {
        console.error("결제 승인 실패:", error);
        setIsProcessing(false);
      }
    };

    if (orderId && amount && paymentKey) {
      confirmPayment();
    } else {
      setIsProcessing(false);
    }
  }, [orderId, amount, paymentKey]);

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
