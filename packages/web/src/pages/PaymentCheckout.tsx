import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ChevronLeft, Shield, Lock, Check, CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  initializePaddleService,
  openPaddleCheckout,
  getPaddlePriceId,
  formatUSD,
  PLAN_DISPLAY_PRICES,
  CheckoutEventData,
} from "@/lib/paddleService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const PaymentCheckout = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // URL 파라미터에서 플랜 정보 가져오기
  const planId = searchParams.get("plan") || "pro";
  const billingCycle = searchParams.get("cycle") || "monthly";
  const isYearly = billingCycle === "yearly";

  const [loading, setLoading] = useState(false);
  const [paddleReady, setPaddleReady] = useState(false);
  const [customerName, setCustomerName] = useState(user?.user_metadata?.full_name || "");
  const [customerEmail, setCustomerEmail] = useState(user?.email || "");

  // 가격 정보
  const planPrices = PLAN_DISPLAY_PRICES[planId as keyof typeof PLAN_DISPLAY_PRICES] || PLAN_DISPLAY_PRICES.pro;
  const amount = isYearly ? planPrices.yearly : planPrices.monthly;
  const monthlyAmount = planPrices.monthly;

  // 플랜 이름
  const getPlanName = (id: string): string => {
    const names: Record<string, string> = {
      basic: "Basic",
      pro: "Pro",
      enterprise: "Enterprise",
    };
    return names[id] || "Pro";
  };
  const planName = getPlanName(planId);

  // 체크아웃 완료 핸들러
  const handleCheckoutComplete = useCallback((data: CheckoutEventData) => {
    console.log('[PaymentCheckout] Checkout completed:', data);
    navigate(`/payment/success?provider=paddle&plan=${planId}&transactionId=${data.transactionId || ''}`);
  }, [navigate, planId]);

  // 체크아웃 닫기 핸들러
  const handleCheckoutClose = useCallback(() => {
    console.log('[PaymentCheckout] Checkout closed');
    setLoading(false);
  }, []);

  // 체크아웃 에러 핸들러
  const handleCheckoutError = useCallback((error: Error) => {
    console.error('[PaymentCheckout] Checkout error:', error);
    toast({
      title: t("payment.error"),
      description: t("payment.requestFailed"),
      variant: "destructive",
    });
    setLoading(false);
  }, [toast, t]);

  // 메타 태그 설정
  useEffect(() => {
    document.title = t("payment.checkout.title") + ' | FACTOR';

    const desc = t("payment.checkout.subtitle");
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);

    // robots meta - 결제 페이지는 인덱싱 방지
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex, nofollow');
  }, [t]);

  // 사용자 정보가 로드되면 폼 필드 업데이트
  useEffect(() => {
    if (user) {
      if (user.user_metadata?.full_name) {
        setCustomerName(user.user_metadata.full_name);
      }
      if (user.email) {
        setCustomerEmail(user.email);
      }
    }
  }, [user]);

  // Paddle 초기화
  useEffect(() => {
    const init = async () => {
      const paddle = await initializePaddleService({
        onCheckoutComplete: handleCheckoutComplete,
        onCheckoutClose: handleCheckoutClose,
        onCheckoutError: handleCheckoutError,
      });
      setPaddleReady(!!paddle);
    };

    init();
  }, [handleCheckoutComplete, handleCheckoutClose, handleCheckoutError]);

  const handlePayment = async () => {
    if (!paddleReady) {
      toast({
        title: t("payment.error"),
        description: t("pricing.error.notReady"),
        variant: "destructive",
      });
      return;
    }

    if (!customerEmail) {
      toast({
        title: t("payment.error"),
        description: t("payment.checkout.fillAllFields"),
        variant: "destructive",
      });
      return;
    }

    const priceId = getPaddlePriceId(planId, isYearly);

    if (!priceId) {
      toast({
        title: t("payment.error"),
        description: t("pricing.error.configError"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      await openPaddleCheckout({
        priceId,
        customerEmail,
        locale: 'en',
        successUrl: `${window.location.origin}/payment/success?provider=paddle&plan=${planId}`,
      });
    } catch (error) {
      console.error("결제 요청 실패:", error);
      setLoading(false);
      toast({
        title: t("payment.error"),
        description: t("payment.requestFailed"),
        variant: "destructive",
      });
    }
  };

  // Pro 플랜 기능 목록
  const proFeatures = [
    t("subscription.plans.pro.feature1", "Connect up to 5 3D printers"),
    t("subscription.plans.pro.feature2", "Unlimited webcam streaming"),
    t("subscription.plans.pro.feature3", "50 AI model generations/month"),
    t("subscription.plans.pro.feature4", "Advanced analytics dashboard"),
    t("subscription.plans.pro.feature5", "API access"),
    t("subscription.plans.pro.feature6", "Priority email support"),
  ];

  return (
    <div className="bg-background min-h-screen">
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

            {/* Customer Information */}
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
                  <Label htmlFor="name">{t("payment.checkout.name")} <span className="text-muted-foreground text-xs">({t("common.optional", "Optional")})</span></Label>
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

            {/* Payment Method Info */}
            <div className="bg-card rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">
                {t("payment.checkout.paymentMethod")}
              </h2>

              <div className="space-y-4">
                {/* Paddle Badge */}
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <CreditCard className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">Paddle Checkout</p>
                    <p className="text-sm text-muted-foreground">
                      {t("pricing.trust.cards", "All major cards accepted")}
                    </p>
                  </div>
                </div>

                {/* Supported Payment Methods */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Visa</Badge>
                  <Badge variant="secondary">Mastercard</Badge>
                  <Badge variant="secondary">American Express</Badge>
                  <Badge variant="secondary">PayPal</Badge>
                  <Badge variant="secondary">Apple Pay</Badge>
                  <Badge variant="secondary">Google Pay</Badge>
                </div>

                <p className="text-xs text-muted-foreground">
                  {t("pricing.trust.paddleMerchant", "Payments are processed by Paddle, our Merchant of Record.")}
                </p>
              </div>
            </div>

            {/* Security Notice */}
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border">
              <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium">{t("payment.checkout.securePayment")}</p>
                <p className="text-muted-foreground">
                  {t("pricing.faq.a2", "We accept all major credit cards, PayPal, Apple Pay, and Google Pay through our payment partner Paddle.")}
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {isYearly ? t("payment.checkout.yearly") : t("payment.checkout.monthly")}
                      </span>
                      {isYearly && (
                        <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                          {t("pricing.savePercent", "Save ~17%")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Features */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm">{t("pricing.whatsIncluded", "What's included")}</h3>
                  <ul className="space-y-2">
                    {proFeatures.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                {/* Price Breakdown */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>{isYearly ? t("subscription.yearly", "Yearly") : t("subscription.monthly", "Monthly")} {t("subscription.perMonth", "price")}</span>
                    <span className="font-medium">
                      {formatUSD(monthlyAmount)}/{t("pricing.month", "month")}
                    </span>
                  </div>

                  {isYearly && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">x 12 {t("pricing.month", "months")}</span>
                        <span>
                          {formatUSD(monthlyAmount * 12)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-600 font-medium">
                          {t("payment.checkout.yearlyDiscount")}
                        </span>
                        <span className="text-green-600 font-medium">
                          -{formatUSD(monthlyAmount * 12 - amount)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <Separator />

                {/* Total */}
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold">
                    {t("payment.checkout.totalAmount")}
                  </span>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary">
                      {formatUSD(amount)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {isYearly
                        ? `${formatUSD(amount / 12)}/${t("pricing.month", "month")} ${t("pricing.billedAnnually", "billed annually")}`
                        : t("subscription.billedMonthly", "Billed monthly")
                      }
                    </div>
                  </div>
                </div>

                {/* Payment Button */}
                <Button
                  size="lg"
                  className="w-full h-14 text-lg font-semibold"
                  onClick={handlePayment}
                  disabled={loading || !paddleReady || !customerEmail}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t("payment.checkout.processing")}
                    </>
                  ) : !paddleReady ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t("common.loading", "Loading...")}
                    </>
                  ) : (
                    <>{t("payment.checkout.subscribe")}</>
                  )}
                </Button>

                {/* Terms */}
                <div className="text-xs text-muted-foreground text-center space-y-1">
                  <p>
                    {t("payment.checkout.termsNotice1")}{" "}
                    <button
                      onClick={() => navigate("/terms")}
                      className="underline hover:text-foreground"
                    >
                      {t("payment.checkout.termsOfService")}
                    </button>
                    {t("payment.checkout.and")}{" "}
                    <button
                      onClick={() => navigate("/privacy")}
                      className="underline hover:text-foreground"
                    >
                      {t("payment.checkout.privacyPolicy")}
                    </button>
                    {t("payment.checkout.termsNotice2")}
                  </p>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-4 p-4 bg-muted/50 rounded-lg flex items-center justify-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                <strong>Powered by Paddle</strong> - {t("pricing.trust.secure", "Secure payment")}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PaymentCheckout;
