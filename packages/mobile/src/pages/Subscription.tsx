import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { supabase } from "@shared/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Check,
  Crown,
  X,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import useEmblaCarousel from "embla-carousel-react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: "month" | "year";
  features: Array<{ text: string; included: boolean }>;
  max_printers: number;
  popular?: boolean;
  description: string;
}

const Subscription = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isYearly, setIsYearly] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [emblaRef] = useEmblaCarousel({ align: "center", skipSnaps: false });

  const isMobile = Capacitor.isNativePlatform();

  useEffect(() => {
    const loadCurrentPlan = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("user_subscriptions")
          .select("plan_name")
          .eq("user_id", user.id)
          .single();

        if (!error && data) {
          // 'basic'은 'free'로 매핑 (레거시 지원)
          const planName = data.plan_name.toLowerCase();
          setCurrentPlan(planName === 'basic' ? 'free' : planName);
        }
      } catch (error) {
        console.error("Failed to load subscription:", error);
      }
    };

    loadCurrentPlan();
  }, [user]);

  const plans: SubscriptionPlan[] = [
    {
      id: "free",
      name: t("subscription.free", t("subscription.basic")),
      price: 0,
      interval: isYearly ? "year" : "month",
      max_printers: 1,
      description: t("subscription.freeDesc", t("subscription.basicDesc")),
      features: [
        { text: t("subscription.feature.maxPrinters", { count: 2 }), included: true },
        { text: t("subscription.feature.monitoring"), included: true },
        { text: t("subscription.feature.remoteControl"), included: true },
        { text: t("subscription.feature.aiModel"), included: false },
        { text: t("subscription.feature.analytics"), included: false },
        { text: t("subscription.feature.apiAccess"), included: false },
        { text: t("subscription.feature.support"), included: false },
        { text: t("subscription.feature.slack"), included: false },
        { text: t("subscription.feature.sla"), included: false },
      ],
    },
    {
      id: "pro",
      name: t("subscription.pro"),
      price: isYearly ? 192000 : 19900,
      interval: isYearly ? "year" : "month",
      max_printers: 10,
      description: t("subscription.proDesc"),
      popular: true,
      features: [
        { text: t("subscription.feature.maxPrinters", { count: 10 }), included: true },
        { text: t("subscription.feature.monitoring"), included: true },
        { text: t("subscription.feature.remoteControl"), included: true },
        { text: t("subscription.feature.aiModel"), included: true },
        { text: t("subscription.feature.analytics"), included: true },
        { text: t("subscription.feature.apiAccess"), included: true },
        { text: t("subscription.feature.support"), included: false },
        { text: t("subscription.feature.slack"), included: false },
        { text: t("subscription.feature.sla"), included: false },
      ],
    },
    {
      id: "enterprise",
      name: t("subscription.enterprise"),
      price: -1,
      interval: isYearly ? "year" : "month",
      max_printers: -1,
      description: t("subscription.enterpriseDesc"),
      features: [
        { text: t("subscription.feature.unlimitedPrinters"), included: true },
        { text: t("subscription.feature.monitoring"), included: true },
        { text: t("subscription.feature.remoteControl"), included: true },
        { text: t("subscription.feature.aiModel"), included: true },
        { text: t("subscription.feature.analytics"), included: true },
        { text: t("subscription.feature.apiAccess"), included: true },
        { text: t("subscription.feature.support"), included: true },
        { text: t("subscription.feature.slack"), included: true },
        { text: t("subscription.feature.sla"), included: true },
      ],
    },
  ];

  const handleSelectPlan = async (planId: string) => {
    if (planId === currentPlan) {
      toast({
        title: t("subscription.currentPlan"),
        description: t("subscription.alreadySubscribed"),
      });
      return;
    }

    if (planId === "enterprise") {
      toast({
        title: t("subscription.contactRequired"),
        description: t("subscription.enterpriseContact"),
      });
      return;
    }

    if (planId === "free") {
      toast({
        title: t("subscription.downgrade"),
        description: t("subscription.downgradeConfirm"),
      });
      return;
    }

    // 웹 결제 페이지 URL 생성
    const webBaseUrl = import.meta.env.VITE_WEB_URL || "https://factor3d.io";
    const checkoutUrl = `${webBaseUrl}/payment/checkout?plan=${planId}&cycle=${isYearly ? "yearly" : "monthly"}`;

    // 모바일에서는 외부 브라우저로 결제 페이지 열기
    if (isMobile) {
      try {
        await Browser.open({ url: checkoutUrl });
      } catch (error) {
        console.error("Failed to open browser:", error);
        toast({
          title: t("common.error"),
          description: t("subscription.browserOpenFailed"),
          variant: "destructive",
        });
      }
    } else {
      navigate("/payment/checkout", { state: { planId, isYearly } });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-background border-b safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">{t("subscription.title")}</h1>
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 모바일 전용 안내 메시지 */}
      {isMobile && (
        <div className="mx-4 mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <ExternalLink className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-500">{t("subscription.externalPayment", "External Payment")}</h3>
              <p className="text-sm text-blue-500/80 mt-1">
                {t("subscription.externalPaymentDesc", "Payment will open in your browser for secure checkout.")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 월간/연간 토글 */}
      <div className="px-4 py-6">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setIsYearly(false)}
            className={`px-6 py-2 rounded-full font-medium transition-colors ${
              !isYearly
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {t("subscription.monthly")}
          </button>
          <button
            onClick={() => setIsYearly(true)}
            className={`px-6 py-2 rounded-full font-medium transition-colors ${
              isYearly
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {t("subscription.yearly")}
          </button>
          {isYearly && (
            <Badge className="ml-2 bg-green-500 text-white">{t("subscription.yearlyDiscount")}</Badge>
          )}
        </div>
      </div>

      {/* 플랜 캐러셀 */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4 px-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="flex-[0_0_85%] min-w-0"
            >
              <div className="bg-card rounded-2xl border-2 border-border shadow-lg overflow-hidden h-full flex flex-col">
                {/* 플랜 헤더 */}
                <div className="p-6 text-center relative">
                  {plan.popular && (
                    <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">
                      {t("subscription.popular")}
                    </Badge>
                  )}
                  {currentPlan === plan.id && (
                    <Badge className="absolute top-4 left-4 bg-green-500 text-white">
                      {t("subscription.currentPlan")}
                    </Badge>
                  )}
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {plan.description}
                  </p>

                  {/* 가격 */}
                  <div className="mb-4">
                    {plan.price === -1 ? (
                      <p className="text-3xl font-bold">{t("subscription.contactUs")}</p>
                    ) : plan.price === 0 ? (
                      <p className="text-3xl font-bold">{t("subscription.free")}</p>
                    ) : (
                      <div>
                        <p className="text-4xl font-bold">
                          ₩{plan.price.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          / {plan.interval === "year" ? t("subscription.year") : t("subscription.month")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 기능 목록 */}
                <div className="flex-1 px-6 pb-6">
                  <div className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3"
                      >
                        {feature.included ? (
                          <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                        ) : (
                          <X className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <span
                          className={`text-sm ${
                            feature.included
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {feature.text}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* 지원 타입 */}
                  {plan.id === "enterprise" && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("subscription.supportType")}
                      </p>
                      <p className="text-sm font-semibold mt-1">
                        {t("subscription.dedicatedManager")}
                      </p>
                    </div>
                  )}
                </div>

                {/* 버튼 */}
                <div className="p-6 pt-0">
                  <Button
                    onClick={() => handleSelectPlan(plan.id)}
                    className="w-full h-12"
                    variant={
                      currentPlan === plan.id
                        ? "outline"
                        : plan.popular
                        ? "default"
                        : "outline"
                    }
                    disabled={currentPlan === plan.id}
                  >
                    {plan.id === "enterprise" ? (
                      t("subscription.contactUs")
                    ) : currentPlan === plan.id ? (
                      t("subscription.currentPlan")
                    ) : plan.price === 0 ? (
                      t("subscription.downgrade")
                    ) : isMobile ? (
                      <>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {t("subscription.subscribe")}
                      </>
                    ) : (
                      <>
                        <Crown className="h-4 w-4 mr-2" />
                        {t("subscription.subscribe")}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 인디케이터 */}
      <div className="flex justify-center gap-2 mt-6">
        {plans.map((_, index) => (
          <div
            key={index}
            className={`h-2 rounded-full transition-all ${
              index === 1 ? "w-8 bg-primary" : "w-2 bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default Subscription;
