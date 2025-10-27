import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ChevronLeft, Shield, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
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
} from "@/lib/tossPaymentsService";
import { PaymentWidgetInstance } from "@tosspayments/payment-widget-sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const PaymentCheckout = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
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

        console.log("결제 위젯 초기화 시작...", { customerKey, amount, theme });

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
      }
    };

    initWidget();

    return () => {
      mounted = false;
    };
  }, [amount, user?.id, theme]);

  const handlePayment = async () => {
    if (!paymentWidget) {
      toast({
        title: t("payment.error"),
        description: t("payment.checkout.widgetNotReady"),
        variant: "destructive",
      });
      return;
    }

    if (!customerName || !customerEmail) {
      toast({
        title: t("payment.error"),
        description: t("payment.checkout.fillAllFields"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const orderName = `${planName} - ${isYearly ? t("payment.checkout.yearlySubscription") : t("payment.checkout.monthlySubscription")}`;

      await requestPayment({
        paymentWidget,
        orderId,
        orderName,
        customerName,
        customerEmail,
        // windowTarget을 지정하지 않아 기본 동작 사용 (모바일: self, PC: iframe)
      });

      // 결제 요청 성공 (Redirect 방식이므로 successUrl로 이동)
      setLoading(false);
    } catch (error: unknown) {
      console.error("결제 요청 실패:", error);
      setLoading(false);

      // 사용자가 취소한 경우가 아닌 경우에만 에러 토스트 표시
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('취소')) {
        toast({
          title: t("payment.error"),
          description: errorMessage || t("payment.requestFailed"),
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="bg-background">
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Payment Form */}
          <div className="space-y-6">
            {/* Title with Back Button */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/subscription")}
                className="flex-shrink-0"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">
                  {t("payment.checkout.title")}
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  {t("payment.checkout.subtitle")}
                </p>
              </div>
            </div>

            {/* Payment Method - 위로 이동 */}
            <div className="bg-card rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">
                {t("payment.checkout.paymentMethod")}
              </h2>

              {/* Payment Widget Area */}
              <div className="relative">
                <div id="payment-methods" ref={paymentMethodsRef}></div>
                {widgetLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {t("payment.checkout.loadingWidget")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Information - 아래로 이동 */}
            <div className="bg-card rounded-xl border p-6 space-y-4">
              <h2 className="text-lg font-semibold">
                {t("payment.checkout.customerInfo")}
              </h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("payment.checkout.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("payment.checkout.emailPlaceholder")}
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">{t("payment.checkout.name")}</Label>
                  <Input
                    id="name"
                    placeholder={t("payment.checkout.namePlaceholder")}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-12"
                  />
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border">
              <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium">{t("payment.checkout.securePayment")}</p>
                <p className="text-muted-foreground">
                  {t("payment.checkout.securePaymentDesc")}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="bg-card rounded-xl border overflow-hidden">
              {/* Header */}
              <div className="bg-primary p-6">
                <h2 className="text-lg font-semibold text-primary-foreground mb-1">{t("payment.checkout.orderSummary")}</h2>
                <p className="text-primary-foreground/80 text-sm">{t("payment.checkout.orderSummaryDesc")}</p>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Plan Info */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">{t("payment.checkout.plan")}</span>
                    <span className="font-semibold">
                      {planName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t("payment.checkout.billingCycle")}
                    </span>
                    <span className="font-medium">
                      {isYearly ? t("payment.checkout.yearly") : t("payment.checkout.monthly")}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Price Breakdown */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>{t("payment.checkout.monthlyPrice")}</span>
                    <span className="font-medium">
                      {formatKRW(monthlyAmount)}
                    </span>
                  </div>

                  {isYearly && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("payment.checkout.multiply12Months")}</span>
                        <span>
                          {formatKRW(monthlyAmount * 12)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-600 font-medium">
                          {t("payment.checkout.yearlyDiscount")}
                        </span>
                        <span className="text-green-600 font-medium">
                          -{formatKRW(monthlyAmount * 12 * 0.1)}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Tax Info */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("payment.checkout.vat")}</span>
                    <span>{t("payment.checkout.included")}</span>
                  </div>
                </div>

                <Separator />

                {/* Total */}
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold">
                    {t("payment.checkout.totalAmount")}
                  </span>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary">
                      {formatKRW(amount)}
                    </div>
                    {isYearly && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {t("payment.checkout.perMonth")} {formatKRW(amount / 12)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Button */}
                <Button
                  size="lg"
                  className="w-full h-14 text-lg font-semibold"
                  onClick={handlePayment}
                  disabled={loading || widgetLoading || !paymentWidget || !customerName || !customerEmail}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t("payment.checkout.processing")}
                    </>
                  ) : (
                    <>{t("payment.checkout.subscribe")}</>
                  )}
                </Button>

                {/* Terms */}
                <div className="text-xs text-muted-foreground text-center space-y-1">
                  <p>
                    {t("payment.checkout.termsNotice1")}{" "}
                    <button className="underline hover:text-foreground">
                      {t("payment.checkout.termsOfService")}
                    </button>
                    {t("payment.checkout.and")}{" "}
                    <button className="underline hover:text-foreground">
                      {t("payment.checkout.privacyPolicy")}
                    </button>
                    {t("payment.checkout.termsNotice2")}
                  </p>
                  <p className="text-muted-foreground/60">
                    {t("payment.checkout.orderId")}: {orderId}
                  </p>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground text-center">
                <strong>Powered by TossPayments</strong>
                <br />
                {t("payment.checkout.poweredByDesc")}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PaymentCheckout;
