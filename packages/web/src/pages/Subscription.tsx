import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@shared/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { initializePaddleService } from "@/lib/paddleService";

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

// 구독 플랜 상세 정보 (USD)
const getSubscriptionPlans = (isYearly: boolean, t: (key: string) => string, currentPlanId?: string): SubscriptionPlan[] => [
  {
    id: "free",
    name: t('subscription.plans.free.name'),
    price: 0, // Free
    interval: isYearly ? "year" : "month",
    max_printers: 1,
    description: t('subscription.plans.free.description'),
    color: "bg-slate-500",
    features: [
      t('subscription.plans.free.feature1'),
      t('subscription.plans.free.feature2'),
      t('subscription.plans.free.feature3'),
      t('subscription.plans.free.feature4')
    ],
    current: currentPlanId === 'free'
  },
  {
    id: "starter",
    name: t('subscription.plans.starter.name'),
    price: isYearly ? 90 : 9, // USD: $9/month, $90/year (Save ~17%)
    interval: isYearly ? "year" : "month",
    max_printers: 2,
    description: t('subscription.plans.starter.description'),
    color: "bg-blue-500",
    features: [
      t('subscription.plans.starter.feature1'),
      t('subscription.plans.starter.feature2'),
      t('subscription.plans.starter.feature3'),
      t('subscription.plans.starter.feature4')
    ],
    current: currentPlanId === 'starter'
  },
  {
    id: "pro",
    name: t('subscription.plans.pro.name'),
    price: isYearly ? 190 : 19, // USD: $19/month, $190/year (Save ~17%)
    interval: isYearly ? "year" : "month",
    max_printers: 5,
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
  const { toast } = useToast();
  const [isYearly, setIsYearly] = useState(false);
  const [showDetailedTable, setShowDetailedTable] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string>('free');
  const [isPaddleReady, setIsPaddleReady] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0); // 캐러셀 인덱스 (0: Free-Starter-Pro, 1: Starter-Pro-Enterprise)
  const tableRef = useRef<HTMLDivElement>(null);

  // Paddle 초기화
  useEffect(() => {
    const initPaddle = async () => {
      const paddle = await initializePaddleService({
        onCheckoutComplete: () => {
          toast({
            title: t('subscription.paymentSuccess'),
            description: t('subscription.paymentSuccessMessage'),
          });
          navigate('/payment/success?provider=paddle');
        },
        onCheckoutClose: () => {
          setIsLoading(null);
        },
        onCheckoutError: () => {
          toast({
            title: t('payment.error'),
            description: t('payment.requestFailed'),
            variant: "destructive",
          });
          setIsLoading(null);
        },
      });
      setIsPaddleReady(!!paddle);
    };
    initPaddle();
  }, [navigate, toast, t]);

  // 로그인 체크 제거 - 공개 페이지로 변경
  // Subscription 페이지는 이제 마케팅/정보 페이지입니다
  // 실제 구독 관리는 Settings 페이지에서 수행합니다

  // DB에서 현재 플랜 가져오기
  useEffect(() => {
    const loadCurrentPlan = async () => {
      if (!user) {
        setCurrentPlanId('free');
        return;
      }

      try {
        const { data: subscription, error } = await supabase
          .from('user_subscriptions')
          .select('plan_name')
          .eq('user_id', user.id)
          .single();

        if (error || !subscription) {
          setCurrentPlanId('free');
          return;
        }

        // 'basic'은 'free'로 매핑 (레거시 지원)
        const planName = subscription.plan_name?.toLowerCase() || 'free';
        setCurrentPlanId(planName === 'basic' ? 'free' : planName);
      } catch (error) {
        console.error('Error loading current plan:', error);
        setCurrentPlanId('free');
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

  const handleCancelSubscription = async () => {
    if (!user) return;

    try {
      // 구독 취소 - user_subscriptions 테이블에서 삭제
      const { error } = await supabase
        .from('user_subscriptions')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      // 성공 토스트
      toast({
        title: t('subscription.cancelSuccessTitle'),
        description: t('subscription.cancelSuccessMessage'),
      });

      // 현재 플랜을 free로 업데이트
      setCurrentPlanId('free');
      setShowCancelDialog(false);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast({
        title: t('payment.error'),
        description: t('payment.requestFailed'),
        variant: "destructive",
      });
    }
  };

  const handleUpgrade = async (planId: string) => {
    console.log('handleUpgrade called with planId:', planId, 'currentPlanId:', currentPlanId);

    // Free 플랜: 무료이므로 로그인/회원가입으로 이동
    if (planId === 'free' || planId === 'basic') {
      if (!user) {
        navigate('/auth');
      } else {
        navigate('/dashboard');
      }
      return;
    }

    // Enterprise: Contact Sales
    if (planId === 'enterprise') {
      window.location.href = 'mailto:sales@factor.io.kr?subject=Enterprise Plan Inquiry';
      return;
    }

    // 로그인한 사용자: UserSettings 구독 탭으로 이동
    if (user) {
      navigate('/user-settings?tab=subscription');
      return;
    }

    // 로그인하지 않은 사용자는 로그인 페이지로 이동
    navigate('/auth');
  };

  const formatPrice = (price: number) => {
    if (price === 0) return t('subscription.free');
    if (price === -1) return t('subscription.contact');
    return `$${price.toLocaleString('en-US')}`;
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
      {/* NoScript Fallback */}
      <noscript>
        <div style={{padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui'}}>
          <h1>{t('subscription.title')}</h1>
          <p>{t('subscription.subtitle')}</p>
          <div style={{marginTop: '2rem'}}>
            <h2>Basic Plan - Free</h2>
            <ul>
              <li>1 printer connection</li>
              <li>Real-time monitoring</li>
              <li>Remote control</li>
            </ul>
            <h2>Pro Plan - $19/month</h2>
            <ul>
              <li>5 printer connections</li>
              <li>AI model generation (50/month)</li>
              <li>Advanced analytics</li>
              <li>API access</li>
              <li>Email support (24h response)</li>
            </ul>
            <h2>Enterprise Plan - Custom</h2>
            <ul>
              <li>Unlimited printers</li>
              <li>Unlimited AI generation</li>
              <li>Dedicated account manager</li>
              <li>Slack channel support</li>
              <li>SLA guarantee</li>
            </ul>
            <p>JavaScript is required to view pricing details and subscribe. Please enable JavaScript in your browser.</p>
          </div>
        </div>
      </noscript>
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
              <TabsList className="grid grid-cols-2 h-12 lg:h-14 bg-muted/60 p-1.5 rounded-full w-fit border-2 border-border/40 shadow-inner">
                <TabsTrigger
                  value="monthly"
                  className="min-w-[110px] lg:min-w-[140px] px-5 lg:px-8 py-2.5 text-xs lg:text-sm font-semibold text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-lg rounded-full transition-all duration-200 hover:text-foreground"
                >
                  {t('subscription.monthly')}
                </TabsTrigger>
                <TabsTrigger
                  value="yearly"
                  className="min-w-[110px] lg:min-w-[140px] px-5 lg:px-8 py-2.5 text-xs lg:text-sm font-semibold text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-lg rounded-full transition-all duration-200 hover:text-foreground"
                >
                  {t('subscription.yearly')}
                  <Badge variant="secondary" className="ml-1.5 lg:ml-2 bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-600 dark:text-emerald-400 hover:from-emerald-500/30 hover:to-green-500/30 text-[10px] lg:text-xs px-1.5 lg:px-2 py-0.5 font-bold border border-emerald-500/30 rounded-full">
                    {t('subscription.yearlyDiscount')}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* 플랜 카드 캐러셀 */}
          <div className="relative">
            {/* 왼쪽 화살표 - carouselIndex가 1일 때만 표시 */}
            {carouselIndex === 1 && (
              <button
                onClick={() => setCarouselIndex(0)}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 lg:-translate-x-6 z-10 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-background border-2 border-border shadow-lg flex items-center justify-center transition-all duration-200 hover:bg-muted hover:border-primary/50 hover:shadow-xl cursor-pointer"
                aria-label="Previous plans"
              >
                <ChevronLeft className="h-5 w-5 lg:h-6 lg:w-6" />
              </button>
            )}

            {/* 오른쪽 화살표 - carouselIndex가 0일 때만 표시 */}
            {carouselIndex === 0 && (
              <button
                onClick={() => setCarouselIndex(1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 lg:translate-x-6 z-10 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-background border-2 border-border shadow-lg flex items-center justify-center transition-all duration-200 hover:bg-muted hover:border-primary/50 hover:shadow-xl cursor-pointer"
                aria-label="Next plans"
              >
                <ChevronRight className="h-5 w-5 lg:h-6 lg:w-6" />
              </button>
            )}

            {/* 플랜 카드 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 px-4 lg:px-8">
              {subscriptionPlans.slice(carouselIndex, carouselIndex + 3).map((plan, index) => {
                // 가운데 카드 부각: carouselIndex === 0이면 Starter(index 1), carouselIndex === 1이면 Pro(index 1)
                const isCenterHighlighted = index === 1;
                const isStarterCenter = carouselIndex === 0 && plan.id === 'starter';
                const isProCenter = carouselIndex === 1 && plan.popular;

                return (
              <Card
                key={plan.id}
                className={`relative flex flex-col overflow-hidden rounded-2xl lg:rounded-3xl min-h-[500px] lg:min-h-[38.25rem] transition-all duration-300 ${
                  isStarterCenter
                    ? "border-2 border-amber-400/60 bg-gradient-to-br from-amber-50 via-yellow-50/90 to-orange-50 dark:from-amber-950/90 dark:via-yellow-900/70 dark:to-orange-950/80 ring-4 ring-amber-500/10 scale-[1.02] lg:scale-105"
                    : isProCenter
                    ? "border-2 border-blue-500/60 bg-gradient-to-br from-blue-50 via-blue-100/90 to-indigo-100 dark:from-blue-950/90 dark:via-blue-900/70 dark:to-indigo-950/80 ring-4 ring-blue-500/10 scale-[1.02] lg:scale-105"
                    : plan.id === 'starter'
                    ? "border-2 border-amber-400/60 bg-gradient-to-br from-amber-50 via-yellow-50/90 to-orange-50 dark:from-amber-950/90 dark:via-yellow-900/70 dark:to-orange-950/80 hover:border-amber-500/80 hover:shadow-lg hover:shadow-amber-500/20"
                    : plan.popular
                    ? "border-2 border-blue-500/60 bg-gradient-to-br from-blue-50 via-blue-100/90 to-indigo-100 dark:from-blue-950/90 dark:via-blue-900/70 dark:to-indigo-950/80 hover:border-blue-500/80 hover:shadow-lg hover:shadow-blue-500/20"
                    : plan.id === 'enterprise'
                    ? "border-2 border-purple-400/60 bg-gradient-to-br from-purple-50 via-violet-50/90 to-fuchsia-50 dark:from-slate-900 dark:via-purple-950/30 dark:to-slate-900 hover:border-purple-500/80 hover:shadow-lg hover:shadow-purple-500/20"
                    : "border-2 border-border/60 bg-gradient-to-br from-card via-card to-muted/20 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                }`}
                style={isStarterCenter ? {
                  boxShadow: '0 8px 40px rgba(245, 158, 11, 0.25), 0 0 0 1px rgba(245, 158, 11, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.8)'
                } : isProCenter ? {
                  boxShadow: '0 8px 40px rgba(37, 99, 235, 0.25), 0 0 0 1px rgba(37, 99, 235, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.8)'
                } : plan.id === 'starter' ? {
                  boxShadow: '0 4px 20px rgba(245, 158, 11, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.6)'
                } : plan.popular ? {
                  boxShadow: '0 4px 20px rgba(37, 99, 235, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.6)'
                } : plan.id === 'enterprise' ? {
                  boxShadow: '0 4px 20px rgba(147, 51, 234, 0.1), inset 0 1px 1px rgba(255, 255, 255, 0.5)'
                } : undefined}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-1 text-xs font-semibold rounded-full shadow-lg shadow-blue-500/30 border border-blue-400/30">
                      {t('subscription.popular')}
                    </Badge>
                  </div>
                )}

                {/* Starter Badge */}
                {plan.id === 'starter' && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1 text-xs font-semibold rounded-full shadow-lg shadow-amber-500/30 border border-amber-400/30">
                      {t('subscription.bestValue') || 'Best Value'}
                    </Badge>
                  </div>
                )}

                {/* Enterprise Badge */}
                {plan.id === 'enterprise' && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 text-xs font-semibold rounded-full shadow-lg shadow-purple-500/30 border border-purple-400/30">
                      {t('subscription.premium') || 'Premium'}
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
                        {plan.price === 0 ? "0" : plan.price === -1 ? "" : plan.price.toLocaleString('en-US')}
                      </span>
                    </div>
                    {plan.price >= 0 && (
                      <div className="mb-0.5 flex flex-col items-start">
                        <span className="text-muted-foreground text-[10px] lg:text-[11px] leading-tight">
                          /<br />{isYearly ? t('subscription.year') : t('subscription.month')}
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
                      className={`w-full h-12 lg:h-11 text-sm lg:text-sm font-semibold rounded-full transition-all duration-200 ${
                        plan.popular
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 border border-blue-400/20"
                          : plan.id === 'starter'
                          ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 border border-amber-400/20"
                          : plan.current
                          ? "opacity-50 cursor-not-allowed bg-muted text-foreground border-2 border-border"
                          : plan.price === -1
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 border border-purple-400/20"
                          : "bg-foreground hover:bg-foreground/90 text-background border-2 border-foreground/10 hover:scale-[1.02]"
                      }`}
                      disabled={plan.current || isLoading === plan.id}
                      onClick={() => handleUpgrade(plan.id)}
                    >
                      {isLoading === plan.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('payment.processing')}
                        </>
                      ) : user && plan.current ? (
                        t('subscription.currentPlanButton')
                      ) : plan.price === -1 ? (
                        t('subscription.contactSales')
                      ) : plan.id === 'free' || plan.id === 'basic' ? (
                        user ? t('subscription.currentPlanButton') : t('subscription.getStarted')
                      ) : (
                        (() => {
                          const planOrder = { free: 0, basic: 0, starter: 1, pro: 2, enterprise: 3 };
                          const currentOrder = planOrder[currentPlanId as keyof typeof planOrder] ?? 0;
                          const targetOrder = planOrder[plan.id as keyof typeof planOrder] ?? 0;

                          if (targetOrder > currentOrder) {
                            return t('subscription.upgrade'); // 업그레이드
                          } else {
                            return t('subscription.downgrade'); // 다운그레이드
                          }
                        })()
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
            </div>

            {/* 캐러셀 인디케이터 */}
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setCarouselIndex(0)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  carouselIndex === 0
                    ? 'bg-primary w-6'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                aria-label="View Free, Starter, Pro plans"
              />
              <button
                onClick={() => setCarouselIndex(1)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  carouselIndex === 1
                    ? 'bg-primary w-6'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                aria-label="View Starter, Pro, Enterprise plans"
              />
            </div>
          </div>

          {/* 모든 플랜 비교하기 버튼 */}
          <div
            className="flex flex-col items-center mt-8 lg:mt-16 mb-6 lg:mb-8 cursor-pointer group"
            onClick={handleScrollToTable}
          >
            <p className="text-xs lg:text-sm text-muted-foreground mb-3 lg:mb-4 group-hover:text-foreground transition-colors">
              {t('subscription.compareAllFeatures')}
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
            <div className="w-full overflow-x-auto -mx-4 lg:mx-0 rounded-2xl border-2 border-border/60 bg-card/50 backdrop-blur-sm shadow-lg">
              <table className="w-full border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b-2 border-border/60 bg-muted/40">
                    <th className="text-left py-4 lg:py-5 px-4 lg:px-6 font-bold text-xs lg:text-sm min-w-[140px] lg:min-w-[200px] text-foreground"></th>
                    <th className="text-center py-4 lg:py-5 px-2 lg:px-6 font-bold text-xs lg:text-sm min-w-[100px] lg:min-w-[150px] text-sky-700 dark:text-sky-300">{t('subscription.plans.starter.name')}</th>
                    <th className="text-center py-4 lg:py-5 px-2 lg:px-6 font-bold text-xs lg:text-sm min-w-[100px] lg:min-w-[150px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-x-2 border-blue-500/20">{t('subscription.plans.pro.name')}</th>
                    <th className="text-center py-4 lg:py-5 px-2 lg:px-6 font-bold text-xs lg:text-sm min-w-[100px] lg:min-w-[150px] text-purple-700 dark:text-purple-300">{t('subscription.plans.enterprise.name')}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 프린터 관리 섹션 */}
                  <tr className="border-b border-border/60 bg-gradient-to-r from-muted/50 to-muted/30">
                    <td colSpan={4} className="py-3 lg:py-4 px-4 lg:px-6 font-bold text-xs lg:text-sm text-foreground">{t('subscription.comparison.printerManagement')}</td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-4 lg:py-5 px-4 lg:px-6 text-xs lg:text-sm font-medium">{t('subscription.comparison.maxPrinters')}</td>
                    <td className="py-4 lg:py-5 px-2 lg:px-6 text-center text-xs lg:text-sm font-semibold text-sky-700 dark:text-sky-300">{t('subscription.comparison.printersCount', { count: 2 })}</td>
                    <td className="py-4 lg:py-5 px-2 lg:px-6 text-center bg-blue-500/5 text-xs lg:text-sm font-semibold text-blue-700 dark:text-blue-300 border-x-2 border-blue-500/20">{t('subscription.comparison.printersCount', { count: 5 })}</td>
                    <td className="py-4 lg:py-5 px-2 lg:px-6 text-center text-xs lg:text-sm font-semibold text-purple-700 dark:text-purple-300">{t('subscription.comparison.unlimited')}</td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-4 lg:py-5 px-4 lg:px-6 text-xs lg:text-sm font-medium">{t('subscription.comparison.realtimeMonitoring')}</td>
                    <td className="py-4 lg:py-5 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                    <td className="py-4 lg:py-5 px-6 text-center bg-blue-500/5 border-x-2 border-blue-500/20"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                    <td className="py-4 lg:py-5 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-4 lg:py-5 px-4 lg:px-6 text-xs lg:text-sm font-medium">{t('subscription.comparison.remoteControl')}</td>
                    <td className="py-4 lg:py-5 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                    <td className="py-4 lg:py-5 px-6 text-center bg-blue-500/5 border-x-2 border-blue-500/20"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                    <td className="py-4 lg:py-5 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                  </tr>

                  {/* 기능 섹션 */}
                  <tr className="border-b border-border/60 bg-gradient-to-r from-muted/50 to-muted/30">
                    <td colSpan={4} className="py-3 lg:py-4 px-4 lg:px-6 font-bold text-xs lg:text-sm text-foreground">{t('subscription.comparison.keyFeatures')}</td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-4 lg:py-5 px-4 lg:px-6 text-xs lg:text-sm font-medium">{t('subscription.comparison.aiModelGeneration')}</td>
                    <td className="py-4 lg:py-5 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                    <td className="py-4 lg:py-5 px-6 text-center bg-blue-500/5 text-xs lg:text-sm font-semibold text-blue-700 dark:text-blue-300 border-x-2 border-blue-500/20">{t('subscription.comparison.modelsPerMonth', { count: 50 })}</td>
                    <td className="py-4 lg:py-5 px-6 text-center text-xs lg:text-sm font-semibold text-purple-700 dark:text-purple-300">{t('subscription.comparison.unlimited')}</td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-4 lg:py-5 px-4 lg:px-6 text-xs lg:text-sm font-medium">{t('subscription.comparison.basicAiAssistant')}</td>
                    <td className="py-4 lg:py-5 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                    <td className="py-4 lg:py-5 px-6 text-center bg-blue-500/5 border-x-2 border-blue-500/20"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                    <td className="py-4 lg:py-5 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-4 lg:py-5 px-4 lg:px-6 text-xs lg:text-sm font-medium">{t('subscription.comparison.anomalyDetection')}</td>
                    <td className="py-4 lg:py-5 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                    <td className="py-4 lg:py-5 px-6 text-center bg-blue-500/5 border-x-2 border-blue-500/20"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                    <td className="py-4 lg:py-5 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-4 lg:py-5 px-4 lg:px-6 text-xs lg:text-sm font-medium">{t('subscription.comparison.advancedAnalytics')}</td>
                    <td className="py-4 lg:py-5 px-6 text-center text-muted-foreground/60">-</td>
                    <td className="py-4 lg:py-5 px-6 text-center bg-blue-500/5 border-x-2 border-blue-500/20"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                    <td className="py-4 lg:py-5 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-4 lg:py-5 px-4 lg:px-6 text-xs lg:text-sm font-medium">{t('subscription.comparison.advancedAiAssistant')}</td>
                    <td className="py-4 lg:py-5 px-6 text-center text-muted-foreground/60">-</td>
                    <td className="py-4 lg:py-5 px-6 text-center bg-blue-500/5 text-muted-foreground/60 border-x-2 border-blue-500/20">-</td>
                    <td className="py-4 lg:py-5 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-4 lg:py-5 px-4 lg:px-6 text-xs lg:text-sm font-medium">{t('subscription.comparison.apiAccess')}</td>
                    <td className="py-4 lg:py-5 px-6 text-center text-muted-foreground/60">-</td>
                    <td className="py-4 lg:py-5 px-6 text-center bg-blue-500/5 border-x-2 border-blue-500/20"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                    <td className="py-4 lg:py-5 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                  </tr>

                  {/* 지원 섹션 */}
                  <tr className="border-b border-border/60 bg-gradient-to-r from-muted/50 to-muted/30">
                    <td colSpan={4} className="py-3 lg:py-4 px-4 lg:px-6 font-bold text-xs lg:text-sm text-foreground">{t('subscription.comparison.customerSupport')}</td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-4 lg:py-5 px-4 lg:px-6 text-xs lg:text-sm font-medium">{t('subscription.comparison.supportType')}</td>
                    <td className="py-4 lg:py-5 px-6 text-center text-xs lg:text-sm text-sky-700 dark:text-sky-300">{t('subscription.comparison.community')}</td>
                    <td className="py-4 lg:py-5 px-6 text-center bg-blue-500/5 text-xs lg:text-sm font-medium text-blue-700 dark:text-blue-300 border-x-2 border-blue-500/20">{t('subscription.comparison.email24h')}</td>
                    <td className="py-4 lg:py-5 px-6 text-center text-xs lg:text-sm font-medium text-purple-700 dark:text-purple-300">{t('subscription.comparison.dedicatedManager')}</td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-4 lg:py-5 px-4 lg:px-6 text-xs lg:text-sm font-medium">{t('subscription.comparison.slackChannel')}</td>
                    <td className="py-4 lg:py-5 px-6 text-center text-muted-foreground/60">-</td>
                    <td className="py-4 lg:py-5 px-6 text-center bg-blue-500/5 text-muted-foreground/60 border-x-2 border-blue-500/20">-</td>
                    <td className="py-4 lg:py-5 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                  </tr>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="py-4 lg:py-5 px-4 lg:px-6 text-xs lg:text-sm font-medium">{t('subscription.comparison.slaGuarantee')}</td>
                    <td className="py-4 lg:py-5 px-6 text-center text-muted-foreground/60">-</td>
                    <td className="py-4 lg:py-5 px-6 text-center bg-blue-500/5 text-muted-foreground/60 border-x-2 border-blue-500/20">-</td>
                    <td className="py-4 lg:py-5 px-6 text-center"><Check className="h-4 w-4 lg:h-5 lg:w-5 mx-auto text-emerald-500" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* 구독 취소 확인 다이얼로그 */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('subscription.cancelConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('subscription.cancelConfirmMessage')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelSubscription}>
              {t('subscription.cancelConfirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Subscription;