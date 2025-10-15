import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { useTranslation } from "react-i18next";
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
const getSubscriptionPlans = (isYearly: boolean, t: any): SubscriptionPlan[] => [
  {
    id: "basic",
    name: t('subscription.plans.basic.name'),
    price: 0,
    interval: isYearly ? "year" : "month",
    max_printers: 2,
    description: t('subscription.plans.basic.description'),
    color: "bg-muted",
    features: [
      t('subscription.plans.basic.feature1'),
      t('subscription.plans.basic.feature2'),
      t('subscription.plans.basic.feature3'),
      t('subscription.plans.basic.feature4')
    ],
    current: true
  },
  {
    id: "pro",
    name: t('subscription.plans.pro.name'),
    price: isYearly ? 192 : 20, // 연간 20% 할인 (월 16달러)
    interval: isYearly ? "year" : "month",
    max_printers: 10,
    description: t('subscription.plans.pro.description'),
    color: "bg-primary",
    features: [
      t('subscription.plans.pro.feature1'),
      t('subscription.plans.pro.feature2'),
      t('subscription.plans.pro.feature3'),
      t('subscription.plans.pro.feature4'),
      t('subscription.plans.pro.feature5'),
      t('subscription.plans.pro.feature6')
    ],
    popular: true
  },
  {
    id: "enterprise",
    name: t('subscription.plans.enterprise.name'),
    price: -1, // Contact us
    interval: isYearly ? "year" : "month",
    max_printers: -1,
    description: t('subscription.plans.enterprise.description'),
    color: "bg-primary",
    features: [
      t('subscription.plans.enterprise.feature1'),
      t('subscription.plans.enterprise.feature2'),
      t('subscription.plans.enterprise.feature3'),
      t('subscription.plans.enterprise.feature4'),
      t('subscription.plans.enterprise.feature5'),
      t('subscription.plans.enterprise.feature6')
    ]
  }
];

const Subscription = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);

  const subscriptionPlans = getSubscriptionPlans(isYearly, t);

  // 로그인된 사용자일 때만 현재 플랜 표시
  const currentPlan = user ? subscriptionPlans.find(plan => plan.current) : null;

  const handleUpgrade = (planId: string) => {
    if (planId === 'enterprise') {
      // Enterprise는 Contact Us로 처리
      window.open('mailto:contact@example.com?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }
    setSelectedPlan(planId);
    // 여기에 결제 로직 구현
    console.log(`Upgrading to plan: ${planId}`);
  };

  const formatPrice = (price: number) => {
    if (price === 0) return t('subscription.free');
    if (price === -1) return t('subscription.contact');
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
    <div className="bg-background min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 헤더 */}
        <header className="space-y-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('subscription.backButton')}
          </Button>

          <div className="space-y-2">
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Crown className="h-10 w-10 text-primary" />
              {t('subscription.title')}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t('subscription.subtitle')}
            </p>
          </div>
        </header>

        {/* 현재 구독 정보 - 로그인된 사용자만 표시 */}
        {currentPlan && user && (
          <Card className="border-primary bg-primary/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-16 translate-x-16"></div>
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Crown className="h-6 w-6 text-primary" />
                {t('subscription.currentPlan')}: {currentPlan.name}
                <Badge variant="outline" className="ml-2">{t('subscription.active')}</Badge>
              </CardTitle>
              <p className="text-muted-foreground">{currentPlan.description}</p>
            </CardHeader>
            <CardContent className="space-y-6 relative">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-3xl font-bold">
                    {formatPrice(currentPlan.price)}
                  </div>
                  {currentPlan.price > 0 && (
                    <div className="text-sm text-muted-foreground">{t('subscription.billedMonthly')}</div>
                  )}
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm text-muted-foreground">{t('subscription.nextBillingDate')}</div>
                  <div className="font-medium">2024년 8월 15일</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    {t('subscription.includedFeatures')}
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {currentPlan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <Check className="h-3 w-3 text-success flex-shrink-0" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">{t('subscription.usageStatus')}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{t('subscription.registeredPrinters')}</span>
                      <span>4 / {currentPlan.max_printers === -1 ? t('subscription.unlimited') : currentPlan.max_printers}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{t('subscription.printJobsThisMonth')}</span>
                      <span>127개</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{t('subscription.dataUsage')}</span>
                      <span>2.4GB / 10GB</span>
                    </div>
                  </div>
                </div>
              </div>

              {currentPlan.price > 0 && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button variant="outline" className="flex-1">
                    <CreditCard className="h-4 w-4 mr-2" />
                    {t('subscription.updatePayment')}
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Calendar className="h-4 w-4 mr-2" />
                    {t('subscription.cancelSubscription')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 로그인된 사용자만 구분선 표시 */}
        {user && <Separator />}

        {/* 사용 가능한 플랜 */}
        <section className="space-y-6">
          <div className="text-center space-y-4 mb-10 md:mb-16 lg:mb-20">
            <h2 className="text-3xl font-bold">{t('subscription.allPlans')}</h2>
            <p className="text-muted-foreground text-lg">
              {t('subscription.allPlansSubtitle')}
            </p>

            {/* 월간/연간 탭 */}
            <Tabs
              value={isYearly ? "yearly" : "monthly"}
              onValueChange={(value) => setIsYearly(value === "yearly")}
              className="w-fit mx-auto"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="monthly" className="flex items-center gap-2">
                  {t('subscription.monthly')}
                </TabsTrigger>
                <TabsTrigger value="yearly" className="flex items-center gap-2">
                  {t('subscription.yearly')}
                  <Badge variant="secondary" className="text-xs">{t('subscription.yearlyDiscount')}</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-16">
            {subscriptionPlans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative transition-all duration-300 hover:shadow-2xl flex flex-col ${
                  plan.popular ? "border-2 border-primary shadow-xl scale-105" : ""
                } ${plan.current ? "opacity-75" : "hover:scale-105"}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1 text-sm font-medium">
                      {t('subscription.popularPlan')}
                    </Badge>
                  </div>
                )}

                {plan.current && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <Badge variant="secondary" className="px-4 py-1 text-sm font-medium">
                      {t('subscription.currentPlanButton')}
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-6 relative overflow-hidden">
                  <div className={`absolute inset-0 ${plan.color} opacity-5`}></div>

                  {/* 플랜명 */}
                  <CardTitle className="text-2xl relative z-10 mb-2">{plan.name}</CardTitle>

                  {/* 설명 - 고정 높이 */}
                  <p className="text-muted-foreground relative z-10 min-h-[3rem] mb-4">{plan.description}</p>

                  {/* 가격 */}
                  <div className="space-y-2 relative z-10">
                    <div className="text-4xl font-bold">
                      {formatPrice(plan.price)}
                    </div>
                    <div className="h-10 flex flex-col justify-center">
                      {plan.price > 0 && (
                        <div className="text-sm text-muted-foreground">{isYearly ? t('subscription.billedYearly') : t('subscription.billedMonthly')}</div>
                      )}
                      {isYearly && plan.price > 0 && (
                        <div className="text-xs text-muted-foreground">{t('subscription.basedOnMonthly', { price: (plan.price / 12).toFixed(2) })}</div>
                      )}
                      {plan.price === -1 && (
                        <div className="text-sm text-muted-foreground">{t('subscription.customPricing')}</div>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {/* 컨텐츠 영역 - flex-1로 남은 공간 차지 */}
                <CardContent className="flex-1 flex flex-col pb-6">
                  {/* 주요 기능 - flex-1로 확장 */}
                  <div className="flex-1 space-y-3 mb-6">
                    <h4 className="font-semibold text-center">{t('subscription.keyFeatures')}</h4>
                    <div className="space-y-2.5">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 버튼 - 하단 고정 */}
                  <Button
                    className="w-full mt-auto"
                    variant={plan.current ? "outline" : plan.popular ? "default" : "outline"}
                    disabled={plan.current}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {plan.current ? (
                      <>
                        <Crown className="h-4 w-4 mr-2" />
                        {t('subscription.currentPlanButton')}
                      </>
                    ) : plan.price === 0 ? (
                      <>
                        <Rocket className="h-4 w-4 mr-2" />
                        {t('subscription.startFree')}
                      </>
                    ) : plan.price === -1 ? (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        {t('subscription.contactUs')}
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        {t('subscription.upgrade')} ({formatPrice(plan.price)})
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* 자주 묻는 질문 */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-center">{t('subscription.faq')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('subscription.faqQuestion1')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t('subscription.faqAnswer1')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('subscription.faqQuestion2')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t('subscription.faqAnswer2')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('subscription.faqQuestion3')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t('subscription.faqAnswer3')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('subscription.faqQuestion4')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t('subscription.faqAnswer4')}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Subscription;