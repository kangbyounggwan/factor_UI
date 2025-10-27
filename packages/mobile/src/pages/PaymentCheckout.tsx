import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ChevronLeft, Shield, Lock, ArrowLeft } from "lucide-react";
import { useAuth } from "@shared/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  initializePaymentWidget,
  renderPaymentWidget,
  requestPayment,
  generateOrderId,
  formatKRW,
  getPlanAmount,
  getPlanName,
} from "@shared/services/tossPaymentsService";
import { PaymentWidgetInstance } from "@tosspayments/payment-widget-sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const PaymentCheckout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // URL 파라미터에서 플랜 정보 가져오기
  const planId = searchParams.get("plan") || "pro";
  const billingCycle = searchParams.get("cycle") || "monthly";
  const isYearly = billingCycle === "yearly";

  const [loading, setLoading] = useState(false);
  const [widgetLoading, setWidgetLoading] = useState(true);
  const [customerName, setCustomerName] = useState(user?.user_metadata?.full_name || "");
  const [customerEmail, setCustomerEmail] = useState(user?.email || "");
  const [paymentWidget, setPaymentWidget] = useState<PaymentWidgetInstance | null>(null);
  const [orderId] = useState(generateOrderId("SUB", planId, billingCycle));

  const paymentMethodsRef = useRef<HTMLDivElement>(null);

  const amount = getPlanAmount(planId, isYearly);
  const planName = getPlanName(planId);
  const monthlyAmount = getPlanAmount(planId, false);

  // 결제 위젯 초기화
  useEffect(() => {
    let mounted = true;

    const initWidget = async () => {
      try {
        setWidgetLoading(true);

        const customerKey = user?.id || "ANONYMOUS";

        console.log("결제 위젯 초기화 시작...", { customerKey, amount });

        const widget = await initializePaymentWidget(customerKey);

        if (!mounted) return;

        console.log("결제 위젯 초기화 완료");
        setPaymentWidget(widget);

        await new Promise(resolve => setTimeout(resolve, 300));

        if (!mounted || !paymentMethodsRef.current) {
          console.log("DOM이 준비되지 않음");
          return;
        }

        console.log("결제 위젯 렌더링 시작...");

        await renderPaymentWidget({
          paymentWidget: widget,
          amount,
          selector: "#payment-methods",
          variantKey: "DEFAULT",
        });

        if (!mounted) return;

        console.log("결제 위젯 렌더링 완료");
        setWidgetLoading(false);
      } catch (error) {
        console.error("위젯 초기화 실패:", error);
        if (!mounted) return;
        setWidgetLoading(false);
        toast({
          title: "오류",
          description: "결제 위젯을 불러오는데 실패했습니다.",
          variant: "destructive",
        });
      }
    };

    initWidget();

    return () => {
      mounted = false;
    };
  }, [amount, user?.id, toast]);

  const handlePayment = async () => {
    if (!paymentWidget) {
      toast({
        title: "오류",
        description: "결제 위젯이 준비되지 않았습니다.",
        variant: "destructive",
      });
      return;
    }

    if (!customerName || !customerEmail) {
      toast({
        title: "정보 입력 필요",
        description: "이름과 이메일을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const orderName = `${planName} - ${isYearly ? '연간 구독' : '월간 구독'}`;

      await requestPayment({
        paymentWidget,
        orderId,
        orderName,
        customerName,
        customerEmail,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      });

      setLoading(false);
    } catch (error: unknown) {
      console.error("결제 요청 실패:", error);
      setLoading(false);

      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('취소')) {
        toast({
          title: "결제 실패",
          description: errorMessage || "결제 요청에 실패했습니다.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">결제하기</h1>
            <p className="text-xs text-muted-foreground">안전한 결제를 진행합니다</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pt-6 space-y-4">
        {/* Order Summary Card */}
        <Card className="border-primary/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">주문 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">플랜</span>
              <span className="font-semibold">{planName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">결제 주기</span>
              <span className="font-medium">{isYearly ? '연간' : '월간'}</span>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">월 이용료</span>
                <span>{formatKRW(monthlyAmount)}</span>
              </div>

              {isYearly && (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">12개월</span>
                    <span>{formatKRW(monthlyAmount * 12)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-600 font-medium">연간 할인 (10%)</span>
                    <span className="text-green-600 font-medium">
                      -{formatKRW(monthlyAmount * 12 * 0.1)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <Separator />

            <div className="flex justify-between items-center pt-2">
              <span className="text-lg font-bold">총 결제금액</span>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {formatKRW(amount)}
                </div>
                {isYearly && (
                  <div className="text-xs text-muted-foreground">
                    월 {formatKRW(Math.floor(amount / 12))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Information */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">구매자 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                placeholder="홍길동"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="h-12"
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">결제 수단</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative min-h-[200px]">
              <div id="payment-methods" ref={paymentMethodsRef}></div>
              {widgetLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">
                    결제 수단을 불러오는 중...
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border">
          <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium">안전한 결제</p>
            <p className="text-muted-foreground text-xs">
              TossPayments를 통해 안전하게 결제가 처리됩니다.
            </p>
          </div>
        </div>

        {/* Payment Button */}
        <Button
          size="lg"
          className="w-full h-14 text-lg font-semibold sticky bottom-4 shadow-lg"
          onClick={handlePayment}
          disabled={loading || widgetLoading || !paymentWidget || !customerName || !customerEmail}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              결제 처리 중...
            </>
          ) : (
            <>
              {formatKRW(amount)} 결제하기
            </>
          )}
        </Button>

        {/* Terms */}
        <div className="text-xs text-muted-foreground text-center space-y-1 pb-4">
          <p>
            결제 진행 시{" "}
            <button className="underline">이용약관</button>
            {" "}및{" "}
            <button className="underline">개인정보처리방침</button>
            에 동의하게 됩니다.
          </p>
          <p className="text-muted-foreground/60">
            주문번호: {orderId}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentCheckout;
