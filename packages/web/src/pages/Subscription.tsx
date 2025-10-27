import { useState, useEffect, useRef } from "react";
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
  X,
  CreditCard,
  Calendar,
  Users,
  Shield,
  Headphones,
  Rocket,
  Mail,
  ChevronDown
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaymentDialog } from "@/components/PaymentDialog";
import { supabase } from "@shared/integrations/supabase/client";

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
const getSubscriptionPlans = (isYearly: boolean, t: (key: string) => string, currentPlanId?: string): SubscriptionPlan[] => [
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
    current: currentPlanId === 'basic'
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
    popular: true,
    current: currentPlanId === 'pro'
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
    ],
    current: currentPlanId === 'enterprise'
  }
];

const Subscription = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showDetailedTable, setShowDetailedTable] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string>('basic');
  const tableRef = useRef<HTMLDivElement>(null);

  // 로그인 체크 - 로그인하지 않은 경우 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true });
    }
  }, [user, navigate]);

  // DB에서 현재 플랜 가져오기
  useEffect(() => {
    const loadCurrentPlan = async () => {
      if (!user) {
        setCurrentPlanId('basic');
        return;
      }

      try {
        const { data: subscription, error } = await supabase
          .from('user_subscriptions')
          .select('plan_name')
          .eq('user_id', user.id)
          .single();

        if (error || !subscription) {
          setCurrentPlanId('basic');
          return;
        }

        setCurrentPlanId(subscription.plan_name?.toLowerCase() || 'basic');
      } catch (error) {
        console.error('Error loading current plan:', error);
        setCurrentPlanId('basic');
      }
    };

    loadCurrentPlan();
  }, [user]);

  const subscriptionPlans = getSubscriptionPlans(isYearly, t, currentPlanId);

  // 로그인된 사용자일 때만 현재 플랜 표시
  const currentPlan = user ? subscriptionPlans.find(plan => plan.current) : null;

  // 테이블로 스크롤하는 함수
  const handleScrollToTable = () => {
    setShowDetailedTable(true);

    // 테이블이 렌더링된 후 스크롤
    setTimeout(() => {
      tableRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
  };

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
    // 유료 플랜은 새로운 결제 페이지로 이동
    navigate(`/payment/checkout?plan=${planId}&cycle=${isYearly ? 'yearly' : 'monthly'}`);
  };

  const formatPrice = (price: number) => {
    if (price === 0) return t('subscription.free');
    if (price === -1) return t('subscription.contact');
    return `$${price}`;
  };

  useEffect(() => {
    const desc = '프린터 팜을 위한 구독 플랜과 가격을 비교하고, 가장 알맞은 요금제로 바로 업그레이드하세요.';

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
    <div className="fixed inset-0 z-50 bg-background">
      {/* 닫기 버튼 */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10"
        onClick={() => navigate(-1)}
      >
        <X className="h-5 w-5" />
      </Button>

      {/* 스크롤 가능한 컨텐츠 영역 */}
      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8 lg:py-16 space-y-6 lg:space-y-10">
          {/* 헤더 */}
          <header className="space-y-2 lg:space-y-4 text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
              {t('subscription.title')}
            </h1>
            <p className="text-sm lg:text-base text-muted-foreground">
              {t('subscription.subtitle')}
            </p>
          </header>

          {/* 월간/연간 탭 */}
          <div className="flex justify-center">
            <Tabs
              value={isYearly ? "yearly" : "monthly"}
              onValueChange={(value) => setIsYearly(value === "yearly")}
              className="inline-flex"
            >
              <TabsList className="grid grid-cols-2 h-10 lg:h-11 bg-muted p-1 rounded-lg w-fit">
                <TabsTrigger
                  value="monthly"
                  className="min-w-[100px] lg:min-w-[120px] px-4 lg:px-6 py-2 text-xs lg:text-sm font-medium text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  {t('subscription.monthly')}
                </TabsTrigger>
                <TabsTrigger
                  value="yearly"
                  className="min-w-[100px] lg:min-w-[120px] px-4 lg:px-6 py-2 text-xs lg:text-sm font-medium text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  {t('subscription.yearly')}
                  <Badge variant="secondary" className="ml-1 lg:ml-2 bg-primary/10 text-primary hover:bg-primary/20 text-[10px] lg:text-xs px-1 lg:px-1.5 py-0">
                    {t('subscription.yearlyDiscount')}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* 플랜 카드 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
            {subscriptionPlans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative flex flex-col overflow-hidden rounded-2xl lg:rounded-3xl min-h-[500px] lg:min-h-[38.25rem] ${
                  plan.popular
                    ? "border-2 border-blue-500/50 bg-gradient-to-br from-slate-200 via-blue-100/80 to-slate-300 dark:from-blue-950 dark:via-blue-900/60 dark:to-blue-950"
                    : "border border-border bg-card"
                }`}
                style={plan.popular ? {
                  boxShadow: '0 0 20px rgba(37, 99, 235, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.6)'
                } : undefined}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-primary text-primary-foreground px-2.5 py-0.5 text-xs font-medium rounded-md shadow-sm">
                      인기
                    </Badge>
                  </div>
                )}

                <CardHeader className="px-6 lg:px-8 pt-6 lg:pt-9 pb-4 lg:pb-6 space-y-4 lg:space-y-6">
                  {/* 플랜명 */}
                  <CardTitle className="text-2xl lg:text-[28px] font-medium tracking-tight">
                    {plan.name}
                  </CardTitle>

                  {/* 가격 */}
                  <div className="flex items-end gap-1.5 min-h-[50px] lg:min-h-[60px]">
                    <div className="flex items-start">
                      <span className="text-lg lg:text-xl text-muted-foreground mr-0.5">$</span>
                      <span className="text-4xl lg:text-5xl font-normal leading-none tracking-tight">
                        {plan.price === 0 ? "0" : plan.price === -1 ? "" : plan.price}
                      </span>
                    </div>
                    {plan.price >= 0 && (
                      <div className="mb-0.5 flex flex-col items-start">
                        <span className="text-muted-foreground text-[10px] lg:text-[11px] leading-tight">
                          USD /<br />{isYearly ? '월' : '월'}
                        </span>
                      </div>
                    )}
                    {plan.price === -1 && (
                      <span className="text-4xl lg:text-5xl font-normal leading-none tracking-tight">Custom</span>
                    )}
                  </div>

                  {/* 설명 */}
                  <p className="text-sm lg:text-base text-foreground font-medium leading-snug mt-3 lg:mt-4 min-h-[40px] lg:min-h-[48px]">
                    {plan.description}
                  </p>
                </CardHeader>

                <CardContent className="px-6 lg:px-8 pb-6 lg:pb-9 pt-0 flex flex-col flex-1">
                  {/* Features */}
                  <div className="flex flex-col grow gap-2 mb-3 lg:mb-4">
                    <ul className="mb-2 flex flex-col gap-3 lg:gap-5">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="relative">
                          <div className="flex items-start gap-2.5 lg:gap-3.5">
                            <Check className="h-4 w-4 lg:h-5 lg:w-5 text-foreground flex-shrink-0 mt-0.5" strokeWidth={2} />
                            <span className="text-xs lg:text-sm text-foreground font-normal leading-snug">
                              {feature}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA Button - 하단 정렬 */}
                  <div className="mt-auto w-full">
                    <Button
                      className={`w-full h-11 lg:h-9 text-sm lg:text-sm font-semibold rounded-full transition-colors ${
                        plan.popular
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : plan.current
                          ? "opacity-50 cursor-not-allowed bg-muted text-foreground"
                          : plan.price === -1
                          ? "bg-foreground hover:bg-foreground/90 text-background"
                          : "bg-muted hover:bg-muted/80 text-foreground"
                      }`}
                      disabled={plan.current}
                      onClick={() => handleUpgrade(plan.id)}
                    >
                      {plan.current
                        ? t('subscription.currentPlanButton')
                        : plan.price === -1
                        ? "Contact Us"
                        : (() => {
                            const planOrder = { basic: 0, pro: 1, enterprise: 2 };
                            const currentOrder = planOrder[currentPlanId as keyof typeof planOrder] || 0;
                            const targetOrder = planOrder[plan.id as keyof typeof planOrder] || 0;

                            if (targetOrder > currentOrder) {
                              return t('subscription.upgrade'); // 업그레이드
                            } else {
                              return t('subscription.downgrade'); // 다운그레이드
                            }
                          })()
                      }
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 모든 플랜 비교하기 버튼 */}
          <div
            className="flex flex-col items-center mt-8 lg:mt-16 mb-6 lg:mb-8 cursor-pointer group"
            onClick={handleScrollToTable}
          >
            <p className="text-xs lg:text-sm text-muted-foreground mb-3 lg:mb-4 group-hover:text-foreground transition-colors">
              모든 플랜 비교하기
            </p>
            <div className="animate-bounce">
              <ChevronDown className="h-6 w-6 lg:h-8 lg:w-8 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </div>

          {/* 플랜 상세 비교 테이블 */}
          {showDetailedTable && (
          <div ref={tableRef} className="mt-12 lg:mt-20 space-y-6 lg:space-y-8">
            <div className="text-center space-y-1 lg:space-y-2">
              <h2 className="text-2xl lg:text-3xl font-bold">{t('subscription.compareTitle')}</h2>
              <p className="text-sm lg:text-base text-muted-foreground">{t('subscription.compareSubtitle')}</p>
            </div>

            {/* 비교 테이블 */}
            <div className="w-full overflow-x-auto -mx-4 lg:mx-0">
              <table className="w-full border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 lg:py-4 px-3 lg:px-6 font-semibold text-xs lg:text-sm min-w-[140px] lg:min-w-[200px]"></th>
                    <th className="text-center py-3 lg:py-4 px-2 lg:px-6 font-semibold text-xs lg:text-sm min-w-[100px] lg:min-w-[150px]">Basic</th>
                    <th className="text-center py-3 lg:py-4 px-2 lg:px-6 font-semibold text-xs lg:text-sm min-w-[100px] lg:min-w-[150px] bg-primary/5">PRO</th>
                    <th className="text-center py-3 lg:py-4 px-2 lg:px-6 font-semibold text-xs lg:text-sm min-w-[100px] lg:min-w-[150px]">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 프린터 관리 섹션 */}
                  <tr className="border-b border-border bg-muted/30">
                    <td colSpan={4} className="py-2 lg:py-3 px-3 lg:px-6 font-semibold text-xs lg:text-sm">{t('subscription.comparison.printerManagement')}</td>
                  </tr>
                  <tr className="border-b border-border hover:bg-muted/20">
                    <td className="py-3 lg:py-4 px-3 lg:px-6 text-xs lg:text-sm">{t('subscription.comparison.maxPrinters')}</td>
                    <td className="py-3 lg:py-4 px-2 lg:px-6 text-center text-xs lg:text-sm">{t('subscription.comparison.printersCount', { count: 2 })}</td>
                    <td className="py-3 lg:py-4 px-2 lg:px-6 text-center bg-primary/5 text-xs lg:text-sm">{t('subscription.comparison.printersCount', { count: 10 })}</td>
                    <td className="py-3 lg:py-4 px-2 lg:px-6 text-center text-xs lg:text-sm">{t('subscription.comparison.unlimited')}</td>
                  </tr>
                  <tr className="border-b border-border hover:bg-muted/20">
                    <td className="py-3 lg:py-4 px-3 lg:px-6 text-xs lg:text-sm">{t('subscription.comparison.realtimeMonitoring')}</td>
                    <td className="py-4 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-success" /></td>
                    <td className="py-4 px-6 text-center bg-primary/5"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-success" /></td>
                    <td className="py-4 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-success" /></td>
                  </tr>
                  <tr className="border-b border-border hover:bg-muted/20">
                    <td className="py-3 lg:py-4 px-3 lg:px-6 text-xs lg:text-sm">{t('subscription.comparison.remoteControl')}</td>
                    <td className="py-4 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-success" /></td>
                    <td className="py-4 px-6 text-center bg-primary/5"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-success" /></td>
                    <td className="py-4 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-success" /></td>
                  </tr>

                  {/* 기능 섹션 */}
                  <tr className="border-b border-border bg-muted/30">
                    <td colSpan={4} className="py-2 lg:py-3 px-3 lg:px-6 font-semibold text-xs lg:text-sm">{t('subscription.comparison.keyFeatures')}</td>
                  </tr>
                  <tr className="border-b border-border hover:bg-muted/20">
                    <td className="py-3 lg:py-4 px-3 lg:px-6 text-xs lg:text-sm">{t('subscription.comparison.aiModelGeneration')}</td>
                    <td className="py-4 px-6 text-center text-xs lg:text-sm">{t('subscription.comparison.limited')}</td>
                    <td className="py-4 px-6 text-center bg-primary/5"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-success" /></td>
                    <td className="py-4 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-success" /></td>
                  </tr>
                  <tr className="border-b border-border hover:bg-muted/20">
                    <td className="py-3 lg:py-4 px-3 lg:px-6 text-xs lg:text-sm">{t('subscription.comparison.advancedAnalytics')}</td>
                    <td className="py-4 px-6 text-center">-</td>
                    <td className="py-4 px-6 text-center bg-primary/5"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-success" /></td>
                    <td className="py-4 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-success" /></td>
                  </tr>
                  <tr className="border-b border-border hover:bg-muted/20">
                    <td className="py-3 lg:py-4 px-3 lg:px-6 text-xs lg:text-sm">{t('subscription.comparison.apiAccess')}</td>
                    <td className="py-4 px-6 text-center">-</td>
                    <td className="py-4 px-6 text-center bg-primary/5"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-success" /></td>
                    <td className="py-4 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-success" /></td>
                  </tr>

                  {/* 지원 섹션 */}
                  <tr className="border-b border-border bg-muted/30">
                    <td colSpan={4} className="py-2 lg:py-3 px-3 lg:px-6 font-semibold text-xs lg:text-sm">{t('subscription.comparison.customerSupport')}</td>
                  </tr>
                  <tr className="border-b border-border hover:bg-muted/20">
                    <td className="py-3 lg:py-4 px-3 lg:px-6 text-xs lg:text-sm">{t('subscription.comparison.supportType')}</td>
                    <td className="py-4 px-6 text-center text-xs lg:text-sm">{t('subscription.comparison.community')}</td>
                    <td className="py-4 px-6 text-center bg-primary/5 text-xs lg:text-sm">{t('subscription.comparison.email24h')}</td>
                    <td className="py-4 px-6 text-center text-xs lg:text-sm">{t('subscription.comparison.dedicatedManager')}</td>
                  </tr>
                  <tr className="border-b border-border hover:bg-muted/20">
                    <td className="py-3 lg:py-4 px-3 lg:px-6 text-xs lg:text-sm">{t('subscription.comparison.slackChannel')}</td>
                    <td className="py-4 px-6 text-center">-</td>
                    <td className="py-4 px-6 text-center bg-primary/5">-</td>
                    <td className="py-4 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-success" /></td>
                  </tr>
                  <tr className="border-b border-border hover:bg-muted/20">
                    <td className="py-3 lg:py-4 px-3 lg:px-6 text-xs lg:text-sm">{t('subscription.comparison.slaGuarantee')}</td>
                    <td className="py-4 px-6 text-center">-</td>
                    <td className="py-4 px-6 text-center bg-primary/5">-</td>
                    <td className="py-4 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-success" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* 결제 다이얼로그 */}
      {selectedPlan && (
        <PaymentDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          planId={selectedPlan}
          isYearly={isYearly}
        />
      )}
    </div>
  );
};

export default Subscription;