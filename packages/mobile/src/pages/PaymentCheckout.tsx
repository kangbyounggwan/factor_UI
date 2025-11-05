import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ChevronLeft, Shield, Lock, ArrowLeft } from "lucide-react";
import { useAuth } from "@shared/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  // URL 파라미터에서 플랜 정보 가져오기
  const planId = searchParams.get("plan") || "pro";
  const billingCycle = searchParams.get("cycle") || "monthly";
  const isYearly = billingCycle === "yearly";

  const [loading, setLoading] = useState(false);
  const [widgetLoading, setWidgetLoading] = useState(true);
  const [customerName, setCustomerName] = useState(
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.display_name ||
    ""
  );
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
          title: t('payment.error'),
          description: t('payment.checkout.loadingWidget'),
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
        title: t('payment.error'),
        description: t('payment.checkout.widgetNotReady'),
        variant: "destructive",
      });
      return;
    }

    if (!customerName || !customerEmail) {
      toast({
        title: t('payment.checkout.customerInfo'),
        description: t('payment.checkout.fillAllFields'),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const orderName = `${planName} - ${isYearly ? t('payment.checkout.yearly') : t('payment.checkout.monthly')}`;

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
          title: t('payment.failTitle'),
          description: errorMessage || t('payment.requestFailed'),
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background safe-area-bottom" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b safe-area-top">
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
            <h1 className="text-xl font-bold">{t('payment.checkout.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('payment.checkout.securePayment')}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pt-6 space-y-4">
        {/* Order Summary Card */}
        <Card className="border-primary/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{t('payment.checkout.orderSummary')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('payment.checkout.plan')}</span>
              <span className="font-semibold">{planName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('payment.checkout.billingCycle')}</span>
              <span className="font-medium">{isYearly ? t('payment.checkout.yearly') : t('payment.checkout.monthly')}</span>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">{t('payment.checkout.monthlyFee')}</span>
                <span>{formatKRW(monthlyAmount)}</span>
              </div>

              {isYearly && (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{t('payment.checkout.months12')}</span>
                    <span>{formatKRW(monthlyAmount * 12)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-600 font-medium">{t('payment.checkout.yearlyDiscount')}</span>
                    <span className="text-green-600 font-medium">
                      -{formatKRW(monthlyAmount * 12 * 0.1)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <Separator />

            <div className="flex justify-between items-center pt-2">
              <span className="text-lg font-bold">{t('payment.checkout.totalAmount')}</span>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {formatKRW(amount)}
                </div>
                {isYearly && (
                  <div className="text-xs text-muted-foreground">
                    {t('payment.checkout.perMonth')} {formatKRW(Math.floor(amount / 12))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Information */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{t('payment.checkout.customerInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('payment.email')}</Label>
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
              <Label htmlFor="name">{t('payment.customerName')}</Label>
              <Input
                id="name"
                placeholder={t('payment.customerNamePlaceholder')}
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
            <CardTitle className="text-lg">{t('payment.checkout.paymentMethod')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative min-h-[200px]">
              <div id="payment-methods" ref={paymentMethodsRef}></div>
              {widgetLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t('payment.checkout.loadingWidget')}
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
            <p className="font-medium">{t('payment.checkout.securePayment')}</p>
            <p className="text-muted-foreground text-xs">
              {t('payment.checkout.securePaymentDesc')}
            </p>
          </div>
        </div>

        {/* Terms */}
        <div className="text-xs text-muted-foreground text-center space-y-1 pb-20">
          <p>
            {t('payment.checkout.termsNotice1')}{" "}
            <button className="underline">{t('payment.checkout.termsOfService')}</button>
            {" "}{t('payment.checkout.and')}{" "}
            <button className="underline">{t('payment.checkout.privacyPolicy')}</button>
            {t('payment.checkout.termsNotice2')}
          </p>
          <p className="text-muted-foreground/60">
            {t('payment.orderId')}: {orderId}
          </p>
        </div>
      </div>

      {/* Payment Button - Fixed at bottom with safe area */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t safe-area-bottom">
        <Button
          size="lg"
          className="w-full h-14 text-lg font-semibold shadow-lg"
          onClick={handlePayment}
          disabled={loading || widgetLoading || !paymentWidget || !customerName || !customerEmail}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('payment.checkout.processing')}
            </>
          ) : (
            <>
              {formatKRW(amount)} {t('payment.pay')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default PaymentCheckout;
