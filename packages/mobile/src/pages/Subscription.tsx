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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import useEmblaCarousel from "embla-carousel-react";

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
  const [isYearly, setIsYearly] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>("basic");
  const [emblaRef] = useEmblaCarousel({ align: "center", skipSnaps: false });

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
          setCurrentPlan(data.plan_name.toLowerCase());
        }
      } catch (error) {
        console.error("Failed to load subscription:", error);
      }
    };

    loadCurrentPlan();
  }, [user]);

  const plans: SubscriptionPlan[] = [
    {
      id: "basic",
      name: "Basic",
      price: 0,
      interval: isYearly ? "year" : "month",
      max_printers: 2,
      description: "개인 사용자를 위한 기본 플랜",
      features: [
        { text: "최대 2대 프린터 연결", included: true },
        { text: "실시간 모니터링", included: true },
        { text: "원격 제어", included: true },
        { text: "AI 모델 생성", included: false },
        { text: "고급 분석 및 통계", included: false },
        { text: "API 접근", included: false },
        { text: "전담 지원", included: false },
        { text: "전용 슬랙 채널", included: false },
        { text: "SLA 보장", included: false },
      ],
    },
    {
      id: "pro",
      name: "Pro",
      price: isYearly ? 192000 : 19900,
      interval: isYearly ? "year" : "month",
      max_printers: 10,
      description: "소규모 팀을 위한 프로 플랜",
      popular: true,
      features: [
        { text: "최대 10대 프린터 연결", included: true },
        { text: "실시간 모니터링", included: true },
        { text: "원격 제어", included: true },
        { text: "AI 모델 생성", included: true },
        { text: "고급 분석 및 통계", included: true },
        { text: "API 접근", included: true },
        { text: "전담 지원", included: false },
        { text: "전용 슬랙 채널", included: false },
        { text: "SLA 보장", included: false },
      ],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: -1,
      interval: isYearly ? "year" : "month",
      max_printers: -1,
      description: "대규모 인터넷 스케일 워크로드를 위한 플랜",
      features: [
        { text: "무제한 프린터 연결", included: true },
        { text: "실시간 모니터링", included: true },
        { text: "원격 제어", included: true },
        { text: "AI 모델 생성", included: true },
        { text: "고급 분석 및 통계", included: true },
        { text: "API 접근", included: true },
        { text: "24/7 전담 매니저", included: true },
        { text: "전용 슬랙 채널", included: true },
        { text: "SLA 보장", included: true },
      ],
    },
  ];

  const handleSelectPlan = (planId: string) => {
    if (planId === currentPlan) {
      toast({
        title: "현재 플랜",
        description: "이미 사용 중인 플랜입니다.",
      });
      return;
    }

    if (planId === "enterprise") {
      toast({
        title: "문의 필요",
        description: "Enterprise 플랜은 별도 문의가 필요합니다.",
      });
      return;
    }

    if (planId === "basic") {
      toast({
        title: "다운그레이드",
        description: "Basic 플랜으로 변경하시겠습니까?",
      });
      return;
    }

    // Pro 플랜 결제 페이지로 이동
    navigate("/payment/checkout", { state: { planId, isYearly } });
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
          <h1 className="text-lg font-semibold">Subscription Plans & Pricing</h1>
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

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
            Monthly
          </button>
          <button
            onClick={() => setIsYearly(true)}
            className={`px-6 py-2 rounded-full font-medium transition-colors ${
              isYearly
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            Yearly
          </button>
          {isYearly && (
            <Badge className="ml-2 bg-green-500 text-white">20% off</Badge>
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
                      인기
                    </Badge>
                  )}
                  {currentPlan === plan.id && (
                    <Badge className="absolute top-4 left-4 bg-green-500 text-white">
                      현재 플랜
                    </Badge>
                  )}
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {plan.description}
                  </p>

                  {/* 가격 */}
                  <div className="mb-4">
                    {plan.price === -1 ? (
                      <p className="text-3xl font-bold">문의</p>
                    ) : plan.price === 0 ? (
                      <p className="text-3xl font-bold">무료</p>
                    ) : (
                      <div>
                        <p className="text-4xl font-bold">
                          ₩{plan.price.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          / {plan.interval === "year" ? "년" : "월"}
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
                        Support Type
                      </p>
                      <p className="text-sm font-semibold mt-1">
                        24/7 Dedicated Manager
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
                      "Contact Us"
                    ) : currentPlan === plan.id ? (
                      "현재 플랜"
                    ) : plan.price === 0 ? (
                      "다운그레이드"
                    ) : (
                      <>
                        <Crown className="h-4 w-4 mr-2" />
                        구독하기
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
