import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { supabase } from "@shared/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Crown,
  Check,
  Zap,
  ArrowLeft,
  CreditCard,
  Calendar,
  Users,
  Shield,
  Headphones,
  Rocket,
  Mail
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useEmblaCarousel from "embla-carousel-react";

// 구독 플랜 타입
interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: "month" | "year";
  features: string[];
  max_printers: number;
  popular?: boolean;
  current?: boolean;
  description: string;
  color: string;
}

// 구독 플랜 상세 정보
const getSubscriptionPlans = (isYearly: boolean): SubscriptionPlan[] => [
  {
    id: "basic",
    name: "Basic",
    price: 0,
    interval: isYearly ? "year" : "month",
    max_printers: 2,
    description: "개인 사용자를 위한 필수 플랜",
    color: "bg-muted",
    features: [
      "최대 2대 프린터 연결",
      "기본 모니터링 기능",
      "이메일 알림",
      "커뮤니티 지원"
    ],
    current: true
  },
  {
    id: "pro",
    name: "Pro",
    price: isYearly ? 192000 : 19900,
    interval: isYearly ? "year" : "month",
    max_printers: 10,
    description: "소규모 팀과 전문가를 위한 플랜",
    color: "bg-primary",
    features: [
      "최대 10대 프린터 연결",
      "고급 모니터링 및 분석",
      "우선순위 이메일 지원",
      "맞춤형 알림",
      "API 접근",
      "월간 리포트"
    ],
    popular: true
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: -1,
    interval: isYearly ? "year" : "month",
    max_printers: -1,
    description: "대규모 조직을 위한 맞춤형 솔루션",
    color: "bg-primary",
    features: [
      "무제한 프린터 연결",
      "전담 계정 관리자",
      "24/7 전화 지원",
      "맞춤형 통합",
      "SLA 보장",
      "온사이트 교육"
    ]
  }
];

const Subscription = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isYearly, setIsYearly] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'center',
    loop: false,
    skipSnaps: false,
    dragFree: false
  });
  const [selectedIndex, setSelectedIndex] = useState(1); // Pro 플랜이 중앙에 오도록
  const [userPlanId, setUserPlanId] = useState<string>('basic');
  const [loadingPlan, setLoadingPlan] = useState(true);

  const subscriptionPlans = getSubscriptionPlans(isYearly).map(plan => ({
    ...plan,
    current: plan.id === userPlanId
  }));

  // 로그인된 사용자일 때만 현재 플랜 표시
  const currentPlan = user ? subscriptionPlans.find(plan => plan.current) : null;

  // 사용자의 현재 플랜 로드
  useEffect(() => {
    const loadUserPlan = async () => {
      if (!user) {
        setLoadingPlan(false);
        return;
      }

      try {
        setLoadingPlan(true);
        const { data: subscription, error } = await supabase
          .from('user_subscriptions')
          .select(`
            *,
            subscription_plans (
              id,
              name
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (error || !subscription) {
          setUserPlanId('basic');
          return;
        }

        const planData = subscription.subscription_plans as any;
        // subscription_plans의 name을 id 형식으로 변환 (예: "Pro" -> "pro")
        const planId = planData?.name?.toLowerCase() || 'basic';
        setUserPlanId(planId);
      } catch (error) {
        console.error('Error loading user plan:', error);
        setUserPlanId('basic');
      } finally {
        setLoadingPlan(false);
      }
    };

    loadUserPlan();
  }, [user]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  const handleUpgrade = (planId: string) => {
    if (planId === 'enterprise') {
      // Enterprise는 Contact Us로 처리
      window.open('mailto:contact@example.com?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }
    if (planId === 'basic') {
      // Basic 플랜은 무료이므로 바로 전환
      console.log('Switching to Basic plan');
      return;
    }
    // 유료 플랜은 결제 페이지로 이동
    navigate(`/payment/checkout?plan=${planId}&cycle=${isYearly ? 'yearly' : 'monthly'}`);
  };

  const formatPrice = (price: number) => {
    if (price === 0) return "무료";
    if (price === -1) return "문의";
    return `$${price}`;
  };

  useEffect(() => {
    const title = '구독 플랜 및 가격 | 프린터 관리 플랫폼';
    const desc = '프린터 팜을 위한 구독 플랜과 가격을 비교하고, 가장 알맞은 요금제로 바로 업그레이드하세요.';
    document.title = title;

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${window.location.origin}/subscription`);

    // JSON-LD 구조화 데이터 (상품/오퍼)
    const offers = subscriptionPlans
      .filter((p) => p.price >= 0)
      .map((p) => ({
        '@type': 'Offer',
        name: p.name,
        price: p.price,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      }));

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: '3D 프린터 관리 구독',
      description: desc,
      offers,
    } as const;

    const prev = document.getElementById('subscription-jsonld');
    if (prev) prev.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'subscription-jsonld';
    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }, [subscriptionPlans]);

  return (
    <div className="bg-background h-[90dvh] overflow-hidden p-6">
      <div className="max-w-7xl mx-auto h-full w-full flex flex-col gap-4">
        {/* 헤더 영역 */}
        <div className="text-center space-y-4 flex-shrink-0">
          <h2 className="text-3xl font-bold">모든 플랜 살펴보기</h2>

          {/* 월간/연간 탭 */}
          <Tabs
            value={isYearly ? "yearly" : "monthly"}
            onValueChange={(value) => setIsYearly(value === "yearly")}
            className="w-fit mx-auto"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly" className="flex items-center gap-2">
                월간
              </TabsTrigger>
              <TabsTrigger value="yearly" className="flex items-center gap-2">
                연간
                <Badge variant="secondary" className="text-xs">20% 할인</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* 모바일 전체 화면 캐러셀 */}
        <div className="lg:hidden -mx-6 flex-1 overflow-hidden">
            <div className="overflow-hidden h-full" ref={emblaRef}>
              <div className="flex h-full">
                {subscriptionPlans.map((plan, index) => (
                  <div
                    key={plan.id}
                    className="flex-[0_0_100%] min-w-0 px-6 h-full"
                  >
                    <Card
                      className={`relative transition-all duration-500 h-full flex flex-col overflow-hidden rounded-2xl ${
                        plan.popular
                          ? "border-2 border-blue-500/40 bg-gradient-to-br from-blue-950 via-blue-900/60 to-blue-950"
                          : plan.current
                          ? "border-2 border-primary bg-primary/5"
                          : "border border-border bg-card"
                      }`}
                      style={plan.popular ? {
                        boxShadow: '0 4px 20px rgba(37, 99, 235, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                        backgroundImage: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, transparent 50%, rgba(37, 99, 235, 0.04) 100%)'
                      } : undefined}
                    >
                      {plan.popular && (
                        <div className="absolute top-4 right-4 z-20">
                          <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs font-medium">
                            인기 플랜
                          </Badge>
                        </div>
                      )}

                      {plan.current && !plan.popular && (
                        <div className="absolute top-4 right-4 z-20">
                          <Badge variant="secondary" className="px-3 py-1 text-xs font-medium">
                            현재 플랜
                          </Badge>
                        </div>
                      )}

                      <CardHeader className="text-center pb-6 pt-8">
                        {/* 플랜명 - 상단 중앙 크게 */}
                        <CardTitle className="text-4xl font-bold mb-2">
                          {plan.name}
                        </CardTitle>

                        <p className="text-muted-foreground text-sm mb-4">
                          {plan.description}
                        </p>
                      </CardHeader>

                      <CardContent className="flex-1 flex flex-col justify-between px-6 pb-6 overflow-y-auto">
                        {/* 주요 기능 섹션 */}
                        <div className="space-y-2 flex-1 overflow-y-auto">
                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm">실시간 모니터링</span>
                            <Check className="h-5 w-5 text-success" />
                          </div>

                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm">원격 제어</span>
                            <Check className="h-5 w-5 text-success" />
                          </div>

                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm">AI 모델 생성</span>
                            {plan.id === 'basic' ? (
                              <span className="text-xs text-muted-foreground">제한적</span>
                            ) : (
                              <Check className="h-5 w-5 text-success" />
                            )}
                          </div>

                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm">고급 분석 및 통계</span>
                            {plan.id === 'basic' ? (
                              <span className="text-xs text-muted-foreground">-</span>
                            ) : (
                              <Check className="h-5 w-5 text-success" />
                            )}
                          </div>

                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm">API 접근</span>
                            {plan.id === 'basic' ? (
                              <span className="text-xs text-muted-foreground">-</span>
                            ) : (
                              <Check className="h-5 w-5 text-success" />
                            )}
                          </div>

                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm">지원 방식</span>
                            <span className="text-xs text-muted-foreground">
                              {plan.id === 'basic' ? '커뮤니티' : plan.id === 'pro' ? '이메일 (24시간 이내)' : '24/7 전담 매니저'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm">전용 Slack 채널</span>
                            {plan.id === 'enterprise' ? (
                              <Check className="h-5 w-5 text-success" />
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm">SLA 보장</span>
                            {plan.id === 'enterprise' ? (
                              <Check className="h-5 w-5 text-success" />
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </div>

                        {/* 하단 가격 버튼 */}
                        <div className="pt-4 mt-4 border-t">
                          <Button
                            className={`w-full h-12 text-base font-semibold ${
                              plan.popular && !plan.current
                                ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white border-0 shadow-lg shadow-blue-500/30"
                                : ""
                            }`}
                            variant={plan.current ? "outline" : "default"}
                            disabled={plan.current}
                            onClick={() => handleUpgrade(plan.id)}
                          >
                            {plan.current ? (
                              "나의 현재 플랜"
                            ) : plan.price === 0 ? (
                              "나의 현재 플랜"
                            ) : plan.price === -1 ? (
                              "Contact Us"
                            ) : (
                              <>
                                ₩{plan.price.toLocaleString()}{isYearly ? '/년' : '/월'}부터 시작
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>

          </div>

        {/* 캐러셀 인디케이터 */}
        <div className="lg:hidden flex justify-center gap-2 flex-shrink-0">
          {subscriptionPlans.map((_, index) => (
            <button
              key={index}
              className={`h-2 rounded-full transition-all ${
                selectedIndex === index
                  ? "w-8 bg-primary"
                  : "w-2 bg-muted-foreground/30"
              }`}
              onClick={() => emblaApi?.scrollTo(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* 데스크톱 그리드 */}
        <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-8">
          {subscriptionPlans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative transition-all duration-300 hover:shadow-2xl ${
                plan.popular ? "border-2 border-primary shadow-xl scale-105" : ""
              } ${plan.current ? "opacity-75" : "hover:scale-105"}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1 text-sm font-medium">
                    인기 플랜
                  </Badge>
                </div>
              )}

              {plan.current && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <Badge variant="secondary" className="px-4 py-1 text-sm font-medium">
                    현재 플랜
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4 relative overflow-hidden">
                <div className={`absolute inset-0 ${plan.color} opacity-5`}></div>
                <CardTitle className="text-2xl relative z-10">{plan.name}</CardTitle>
                <p className="text-muted-foreground relative z-10">{plan.description}</p>

                <div className="space-y-2 relative z-10">
                  <div className="text-4xl font-bold">
                    {formatPrice(plan.price)}
                  </div>
                  {plan.price > 0 && (
                    <div className="text-sm text-muted-foreground">{isYearly ? '연간 결제' : '월간 결제'}</div>
                  )}
                  {isYearly && plan.price > 0 && (
                    <div className="text-xs text-muted-foreground">월 ${ (plan.price / 12).toFixed(2) } 기준</div>
                  )}
                  {plan.price === -1 && (
                    <div className="text-sm text-muted-foreground">맞춤형 가격</div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-center">주요 기능</h4>
                  <div className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full"
                  variant={plan.current ? "outline" : plan.popular ? "default" : "outline"}
                  disabled={plan.current}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {plan.current ? (
                    <>
                      <Crown className="h-4 w-4 mr-2" />
                      현재 플랜
                    </>
                  ) : plan.price === 0 ? (
                    <>
                      <Rocket className="h-4 w-4 mr-2" />
                      무료 시작
                    </>
                  ) : plan.price === -1 ? (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Contact Us
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      업그레이드 ({formatPrice(plan.price)})
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Subscription;